<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\BroadcastTemplate;
use App\Models\PushNotification;
use App\Models\SystemEmailTemplate;
use App\Models\User;
use App\Services\ExpoNotificationService;
use App\Services\NotificationDispatcher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class NotificationController extends Controller
{
    public function __construct(
        private ExpoNotificationService $expo,
        private NotificationDispatcher $dispatcher,
    ) {}

    // ── Broadcast ────────────────────────────────────────────────────────────

    public function broadcast(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title'       => 'required|string|max:255',
            'body'        => 'required|string',
            'recipients'  => 'required|array',    // ['all'] or array of user IDs
            'send_email'  => 'nullable',
            'attachments'   => 'nullable|array|max:10',
            'attachments.*' => 'file|max:10240', // 10MB per file
        ]);

        // Store uploaded attachments
        $storedFiles = [];
        if ($request->hasFile('attachments')) {
            foreach ($request->file('attachments') as $file) {
                $path = $file->store('broadcast_attachments', 'local');
                $storedFiles[] = [
                    'storage_path'  => $path,
                    'original_name' => $file->getClientOriginalName(),
                    'mime_type'     => $file->getMimeType(),
                    'size'          => $file->getSize(),
                ];
            }
        }

        $query = User::where('role', 'client')
            ->where('status', 'active');

        if ($data['recipients'] !== ['all']) {
            $query->whereIn('id', $data['recipients']);
        }

        $users = $query->with(['dogs', 'clientProfile'])->get();

        // One ID per broadcast send so the admin history can group all recipients
        // under the same card, regardless of per-user token substitution.
        $broadcastId = (string) Str::uuid();
        $originalTitle = $data['title']; // pre-substitution
        $originalBody  = $data['body'];  // pre-substitution (HTML)

        foreach ($users as $user) {
            // Replace tokens per-user
            $userBody = $this->replaceTokens($data['body'], $user);
            $userTitle = $this->replaceTokens($data['title'], $user);
            $plainBody = strip_tags($userBody);

            PushNotification::create([
                'user_id' => $user->id,
                'title'   => $userTitle,
                'body'    => $plainBody,
                'data'    => [
                    'type'           => 'broadcast',
                    'broadcast_id'   => $broadcastId,
                    'original_title' => $originalTitle,
                    'original_body'  => $originalBody,
                ],
                'sent_at' => now(),
            ]);

            // Store in conversation thread — single message carrying both content and attachments
            $conversation = $user->conversation()->firstOrCreate(['user_id' => $user->id]);
            $messageMeta = [
                'title'     => $userTitle,
                'broadcast' => true,
                'html_body' => $userBody,
            ];
            if (!empty($storedFiles)) {
                $messageMeta['attachments'] = array_map(fn($a) => [
                    'storage_path'  => $a['storage_path'],
                    'mime_type'     => $a['mime_type'],
                    'original_name' => $a['original_name'],
                    'size'          => $a['size'],
                    'broadcast'     => true,
                ], $storedFiles);
            }
            $conversation->messages()->create([
                'sender_id' => $request->user()->id,
                'type'      => 'notification',
                'body'      => $plainBody,
                'metadata'  => $messageMeta,
            ]);

            // Extract images from HTML body and prepare for CID embedding
            [$emailBody, $inlineImages] = $this->extractInlineImages($userBody);

            // Dispatch via client's preferred channels
            $this->dispatcher->notify(
                $user,
                $userTitle,
                $plainBody,
                $emailBody, // HTML version for email (with CID refs)
                [],
                $request->user()->email, // Reply-To admin sender
                null,
                $inlineImages,
                $storedFiles,
            );

            // If admin explicitly toggled "also send as email" AND user doesn't already have email preference,
            // send email anyway as a one-time override
            $sendEmail = filter_var($data['send_email'] ?? false, FILTER_VALIDATE_BOOLEAN);
            if ($sendEmail && $user->email) {
                $prefs = $user->clientProfile;
                $alreadySentEmail = $prefs && ($prefs->notify_email ?? false);
                if (!$alreadySentEmail) {
                    try {
                        $senderEmail = $request->user()->email;
                        $logoPath = public_path('images/logo-cream-stacked.png');
                        Mail::send([], [], function ($message) use ($user, $userTitle, $emailBody, $storedFiles, $senderEmail, $logoPath, $inlineImages) {
                            $replyAddr = config('services.resend.inbound_address') ?: $senderEmail;
                            $message->to($user->email)
                                ->subject($userTitle)
                                ->replyTo($replyAddr)
                                ->html(view('emails.broadcast', [
                                    'title'       => $userTitle,
                                    'content'     => $emailBody,
                                    'userName'    => $user->name,
                                    'attachments' => $storedFiles,
                                ])->render());

                            $symfony = $message->getSymfonyMessage();

                            if (file_exists($logoPath)) {
                                $logoPart = new \Symfony\Component\Mime\Part\DataPart(
                                    file_get_contents($logoPath),
                                    'logo.png',
                                    'image/png'
                                );
                                $logoPart->asInline();
                                $logoPart->setContentId('logo@thepupperclub.ca');
                                $symfony->addPart($logoPart);
                            }

                            // Embed broadcast images as CID attachments
                            foreach ($inlineImages as $img) {
                                $part = new \Symfony\Component\Mime\Part\DataPart(
                                    $img['data'],
                                    $img['filename'],
                                    $img['mime']
                                );
                                $part->asInline();
                                $part->setContentId($img['cid']);
                                $symfony->addPart($part);
                            }

                            foreach ($storedFiles as $att) {
                                $message->attach(Storage::disk('local')->path($att['storage_path']), [
                                    'as'   => $att['original_name'],
                                    'mime' => $att['mime_type'],
                                ]);
                            }
                        });
                    } catch (\Throwable $e) {
                        \Illuminate\Support\Facades\Log::warning('Broadcast email failed', [
                            'user_id' => $user->id,
                            'error'   => $e->getMessage(),
                        ]);
                    }
                }
            }
        }

        return response()->json(['message' => "Broadcast sent to {$users->count()} clients."]);
    }

    public function preview(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title'      => 'required|string|max:255',
            'body'       => 'required|string',
            'preview_as' => 'nullable|integer|exists:users,id',
        ]);

        // Pick a sample client for token replacement
        $sampleUser = null;
        if (!empty($data['preview_as'])) {
            $sampleUser = User::with('dogs')->find($data['preview_as']);
        }
        if (!$sampleUser) {
            $sampleUser = User::where('role', 'client')
                ->where('status', 'active')
                ->with('dogs')
                ->first();
        }

        // Build preview name or fallback
        $userName = $sampleUser?->name ?? 'Jane Doe';

        // Replace tokens
        $previewTitle = $sampleUser
            ? $this->replaceTokens($data['title'], $sampleUser)
            : $data['title'];
        $previewBody = $sampleUser
            ? $this->replaceTokens($data['body'], $sampleUser)
            : $data['body'];

        // Render the email HTML
        $emailHtml = view('emails.broadcast', [
            'title'       => $previewTitle,
            'content'     => $previewBody,
            'userName'    => $userName,
            'attachments' => [],
        ])->render();

        // Replace CID logo with real URL for browser preview
        $logoUrl = '/api/images/logo-cream-stacked.png';
        $emailHtml = str_replace('cid:logo@thepupperclub.ca', $logoUrl, $emailHtml);

        return response()->json([
            'email_html'  => $emailHtml,
            'html_body'   => $previewBody,
            'title'       => $previewTitle,
            'body'        => strip_tags($previewBody),
            'preview_user'=> $sampleUser ? ['id' => $sampleUser->id, 'name' => $sampleUser->name] : null,
        ]);
    }

    public function uploadInlineImage(Request $request): JsonResponse
    {
        $request->validate([
            'image' => ['required', 'file', 'max:10240'], // 10MB
        ]);

        // Validate by client extension rather than mime-sniffing — Windows/IIS
        // hosts often lack HEIC entries in their fileinfo magic DB and report
        // `application/octet-stream`, which fails Laravel's mimetypes rule.
        $file = $request->file('image');
        $ext = strtolower($file->getClientOriginalExtension());
        $allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'heic', 'heif'];
        abort_unless(in_array($ext, $allowed, true), 422, 'Unsupported image type.');

        $filename = $file->hashName();
        $file->storeAs('broadcast_inline', $filename, 'local');

        // Return an API-served URL so no storage symlink is needed
        $url = '/api/admin/broadcast-images/' . $filename;

        return response()->json([
            'url' => $url,
        ]);
    }

    public function serveInlineImage(string $filename): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $path = 'broadcast_inline/' . $filename;
        abort_unless(Storage::disk('local')->exists($path), 404);

        return Storage::disk('local')->response($path);
    }

    public function serveAttachment(Request $request, string $path): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $fullPath = 'broadcast_attachments/' . $path;
        abort_unless(Storage::disk('local')->exists($fullPath), 404);

        return Storage::disk('local')->response($fullPath);
    }

    public function history(Request $request): JsonResponse
    {
        $notifications = PushNotification::with('user')
            ->when($request->user_id, fn($q) => $q->where('user_id', $request->user_id))
            ->orderBy('created_at', 'desc')
            ->paginate(50);

        return response()->json($notifications);
    }

    // ── System Templates ─────────────────────────────────────────────────────

    private function systemTemplateDefinitions(): array
    {
        return [
            'client_invitation' => [
                'name'           => 'Client Invitation',
                'description'    => 'Sent when a new client is invited to the portal.',
                'default_subject'=> 'Welcome to The Pupper Club!',
                'tokens'         => ['{client_name}', '{temp_password}', '{set_password_url}'],
                'default_body'   => '<h2>Welcome, {client_name}!</h2><div class="content"><p>Sophie has set up your client account at <strong>The Pupper Club</strong>. You\'re just a few steps away from accessing your portal.</p><p>Your temporary password is:</p><div style="background:#F6F3EE;border:1px solid #C8BFB6;border-radius:8px;padding:16px 24px;font-family:monospace;font-size:18px;letter-spacing:2px;text-align:center;margin:16px 0;">{temp_password}</div><p>Click the button below to set your permanent password and get started:</p><p style="text-align:center;margin:28px 0;"><a href="{set_password_url}" style="display:inline-block;background:#C9A24D;color:#ffffff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;">Set My Password</a></p><p style="font-size:13px;color:#C8BFB6;">This link expires in 7 days. If you have any questions, reply to this email or contact Sophie directly.</p></div>',
            ],
            'invoice_new' => [
                'name'           => 'Invoice — New',
                'description'    => 'Sent when a new invoice is created and emailed to the client.',
                'default_subject'=> 'New Invoice — The Pupper Club',
                'tokens'         => ['{client_name}', '{invoice_number}', '{total}', '{due_date}', '{billing_period}', '{payment_method}', '{portal_url}'],
                'default_body'   => '<h2>New Invoice</h2><div class="content"><p>Hi {client_name},</p><p>Your invoice <strong>{invoice_number}</strong> for <strong>${total} CAD</strong> is ready.</p><p style="font-size:13px;color:#C8BFB6;">Service period: {billing_period}</p><p>Payment is due by <strong>{due_date}</strong>.</p><p style="font-size:13px;color:#5a4a44;">Payment method: <strong>{payment_method}</strong></p><p style="text-align:center;margin:28px 0;"><a href="{portal_url}" style="display:inline-block;background:#C9A24D;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:bold;font-size:15px;">View in Portal</a></p><p>Thanks,<br>Sophie — The Pupper Club</p></div>',
            ],
            'invoice_reminder' => [
                'name'           => 'Invoice — Payment Reminder',
                'description'    => 'Sent 3 days before an automatic payment is processed.',
                'default_subject'=> 'Payment Reminder — The Pupper Club',
                'tokens'         => ['{client_name}', '{invoice_number}', '{total}', '{due_date}', '{billing_period}', '{payment_method}', '{portal_url}'],
                'default_body'   => '<h2>Payment Reminder</h2><div class="content"><p>Hi {client_name},</p><p>This is a friendly reminder that your payment of <strong>${total} CAD</strong> (Invoice {invoice_number}) will be processed in <strong>3 days</strong> on <strong>{due_date}</strong>.</p><p style="font-size:13px;color:#C8BFB6;">Service period: {billing_period}</p><p>If you\'d like to update your payment method before then, you can do so below.</p><p style="font-size:13px;color:#5a4a44;">Payment method: <strong>{payment_method}</strong></p><p style="text-align:center;margin:28px 0;"><a href="{portal_url}" style="display:inline-block;background:#C9A24D;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:bold;font-size:15px;">Update Payment Method</a></p><p>Thanks,<br>Sophie — The Pupper Club</p></div>',
            ],
            'invoice_paid' => [
                'name'           => 'Invoice — Payment Confirmation',
                'description'    => 'Sent after an invoice has been successfully paid.',
                'default_subject'=> 'Payment Confirmation — The Pupper Club',
                'tokens'         => ['{client_name}', '{invoice_number}', '{total}', '{billing_period}', '{payment_method}', '{portal_url}'],
                'default_body'   => '<h2>Payment Confirmation</h2><div class="content"><p>Hi {client_name},</p><p>Your invoice <strong>{invoice_number}</strong> for <strong>${total} CAD</strong> has been paid.</p><p>Thank you for your payment, and being an awesome client!</p><p style="font-size:13px;color:#C8BFB6;">Service period: {billing_period}</p><p style="font-size:13px;color:#5a4a44;">Payment method: <strong>{payment_method}</strong></p><p style="text-align:center;margin:28px 0;"><a href="{portal_url}" style="display:inline-block;background:#C9A24D;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:bold;font-size:15px;">View in Portal</a></p><p>Thanks,<br>Sophie — The Pupper Club</p></div>',
            ],
            'signature_request' => [
                'name'           => 'Document Signature Request',
                'description'    => 'Sent when a document is sent to a client for electronic signature.',
                'default_subject'=> 'Document for Signature — The Pupper Club',
                'tokens'         => ['{client_name}', '{document_name}', '{signing_url}'],
                'default_body'   => '<h2>Document Ready for Your Signature</h2><div class="content"><p>Hi {client_name},</p><p>A document has been sent to you for review and signature:</p><p style="background:#F6F3EE;border-radius:8px;padding:14px 18px;font-size:14px;"><strong style="color:#3B2F2A;">{document_name}</strong></p><p>Please review the document carefully and provide your electronic signature at the link below.</p><p style="text-align:center;margin:28px 0;"><a href="{signing_url}" style="display:inline-block;background:#C9A24D;color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:bold;font-size:15px;">Review &amp; Sign Document</a></p><p style="font-size:13px;color:#C8BFB6;">This link is unique to you. Once signed, it cannot be reused.</p><p>Thanks,<br>Sophie — The Pupper Club</p></div>',
            ],
            'report_card' => [
                'name'           => 'Visit Report Card',
                'description'    => 'Sent after a visit is completed. Includes checklist, notes, photos, and times.',
                'default_subject'=> 'Visit Report Card — The Pupper Club',
                'tokens'         => ['{client_name}', '{dog_names}', '{visit_date}', '{arrival_time}', '{departure_time}', '{checklist_html}', '{notes}', '{visit_photo_html}', '{dog_photo_html}', '{portal_url}'],
                'default_body'   => '<div style="text-align:center;margin-bottom:24px;"><h2 style="margin:0 0 6px;font-size:22px;letter-spacing:2px;text-transform:uppercase;">Visit Report Card</h2><div style="color:#C9A24D;font-size:15px;">{dog_names}</div></div>{dog_photo_html}{visit_photo_html}<div style="display:flex;padding:16px 0;border-bottom:1px solid #F6F3EE;gap:24px;margin-bottom:20px;"><div style="flex:1;text-align:center;"><div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#C8BFB6;">Arrived</div><div style="font-size:20px;font-weight:700;color:#3B2F2A;margin-top:4px;">{arrival_time}</div><div style="font-size:12px;color:#C8BFB6;margin-top:2px;">{visit_date}</div></div><div style="flex:1;text-align:center;"><div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#C8BFB6;">Departed</div><div style="font-size:20px;font-weight:700;color:#3B2F2A;margin-top:4px;">{departure_time}</div></div></div><div style="margin-bottom:20px;"><div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#C8BFB6;margin-bottom:14px;">Activities & Care</div>{checklist_html}</div><div style="margin-bottom:20px;"><div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#C8BFB6;margin-bottom:14px;">Notes</div><div style="font-size:14px;line-height:1.6;color:#3B2F2A;">{notes}</div></div><div style="text-align:center;padding-top:16px;border-top:1px solid #F6F3EE;"><p style="text-align:center;margin:20px 0;"><a href="{portal_url}" style="display:inline-block;background:#C9A24D;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold;font-size:14px;">View All Report Cards</a></p><p style="font-size:12px;color:#C8BFB6;line-height:1.5;">With love from <span style="color:#C9A24D;">The Pupper Club</span><br>{client_name}, you can view and download all your report cards in your client portal.</p></div>',
            ],
            'broadcast' => [
                'name'           => 'Broadcast Message',
                'description'    => 'The template wrapper for broadcast messages sent to clients.',
                'default_subject'=> '{title}',
                'tokens'         => ['{title}', '{content}', '{client_name}'],
                'default_body'   => '<h2>{title}</h2><div class="content">{content}</div>',
            ],
            'general_notification' => [
                'name'           => 'General Notification',
                'description'    => 'Used for system-generated notifications like chat messages forwarded to email.',
                'default_subject'=> '{title}',
                'tokens'         => ['{title}', '{content}'],
                'default_body'   => '<h2>{title}</h2><div class="content">{content}</div>',
            ],
        ];
    }

    public function systemTemplates(): JsonResponse
    {
        $this->ensureSystemTemplateTable();

        $definitions = $this->systemTemplateDefinitions();
        $saved = SystemEmailTemplate::all()->keyBy('key');

        $result = [];
        foreach ($definitions as $key => $def) {
            $custom = $saved->get($key);
            $result[] = [
                'key'             => $key,
                'name'            => $def['name'],
                'description'     => $def['description'],
                'tokens'          => $def['tokens'],
                'default_subject' => $def['default_subject'],
                'default_body'    => $def['default_body'],
                'custom_subject'  => $custom?->subject,
                'custom_body'     => $custom?->body,
                'is_customized'   => $custom !== null,
                'updated_at'      => $custom?->updated_at?->toIso8601String(),
            ];
        }

        return response()->json(['data' => $result]);
    }

    public function updateSystemTemplate(Request $request, string $key): JsonResponse
    {
        $this->ensureSystemTemplateTable();

        $definitions = $this->systemTemplateDefinitions();
        abort_unless(isset($definitions[$key]), 404, 'Template not found.');

        $data = $request->validate([
            'subject' => 'sometimes|string|max:255',
            'body'    => 'sometimes|string',
        ]);

        $template = SystemEmailTemplate::updateOrCreate(
            ['key' => $key],
            $data
        );

        return response()->json(['data' => $template, 'message' => 'Template updated.']);
    }

    public function resetSystemTemplate(string $key): JsonResponse
    {
        $this->ensureSystemTemplateTable();

        SystemEmailTemplate::where('key', $key)->delete();

        return response()->json(['message' => 'Template reset to default.']);
    }

    public function systemTemplatePreview(Request $request): JsonResponse
    {
        $key = $request->route('key');

        $definitions = $this->systemTemplateDefinitions();
        abort_unless(isset($definitions[$key]), 404, 'Template not found.');

        $this->ensureSystemTemplateTable();
        $custom = SystemEmailTemplate::where('key', $key)->first();

        // For templates with dedicated Blade views AND no customization, render the actual Blade template
        if (!$custom && $key === 'report_card') {
            $html = $this->previewReportCardBlade();
        } else {
            // Use custom body if saved, otherwise use default
            $body = $custom?->body ?? $definitions[$key]['default_body'];

            // Replace tokens with sample values
            $sampleTokens = $this->sampleTokenValues();
            $html = str_replace(array_keys($sampleTokens), array_values($sampleTokens), $body);

            // Wrap in branded layout
            $html = view('emails.custom', [
                'content' => $html,
                'heading' => null,
            ])->render();
        }

        // Replace CID logo with real URL for browser preview
        $logoUrl = '/api/images/logo-cream-stacked.png';
        $html = str_replace('cid:logo@thepupperclub.ca', $logoUrl, $html);

        return response()->json(['html' => $html]);
    }

    private function previewReportCardBlade(): string
    {
        $sampleChecklist = ['Long Walk', 'Outdoor Play', 'Water Refill', 'Treats Given'];
        $dogPhotoSvg = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iI0Y2RjNFRSIvPjx0ZXh0IHg9IjUwIiB5PSI1OCIgZm9udC1zaXplPSI0MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iI0M4QkZCNiI+8J+Qvjwv dGV4dD48L3N2Zz4=';
        $frontendUrl = rtrim(env('FRONTEND_URL', 'https://thepupperclub.ca'), '/');

        return view('emails.report_card', [
            'client'       => (object) ['name' => 'Jane Smith'],
            'report'       => (object) ['id' => 0, 'notes' => 'Luna and Milo had a wonderful walk today!', 'checklist' => []],
            'dogNames'     => 'Luna & Milo',
            'dogSections'  => [
                ['name' => 'Luna', 'checklist' => $sampleChecklist, 'notes' => 'Luna was very energetic and loved exploring the trail.'],
                ['name' => 'Milo', 'checklist' => ['Short Walk', 'Belly Rubs', 'Water Refill'], 'notes' => 'Milo was calm and enjoyed sniffing everything.'],
            ],
            'checklist'    => $sampleChecklist,
            'specialTrip'  => null,
            'photoUrls'    => [],
            'photoUrl'     => null,
            'dogPhotoUrl'  => $dogPhotoSvg,
            'arrivalTime'  => '10:00 AM',
            'departureTime'=> '11:30 AM',
            'visitDate'    => 'April 8, 2026',
            'portalUrl'    => $frontendUrl . '/client/report-cards',
        ])->render();
    }

    /**
     * Render a system email template with actual data.
     * Returns null if no custom template is saved (caller should use default blade).
     */
    public static function renderSystemTemplate(string $key, array $tokens): ?string
    {
        if (!Schema::hasTable('system_email_templates')) {
            return null;
        }

        $custom = SystemEmailTemplate::where('key', $key)->first();
        if (!$custom) {
            return null;
        }

        $body = str_replace(array_keys($tokens), array_values($tokens), $custom->body);

        return view('emails.custom', [
            'content' => $body,
            'heading' => null,
        ])->render();
    }

    /**
     * Get custom subject line for a system template, or null to use default.
     */
    public static function getSystemSubject(string $key, array $tokens = []): ?string
    {
        if (!Schema::hasTable('system_email_templates')) {
            return null;
        }

        $custom = SystemEmailTemplate::where('key', $key)->first();
        if (!$custom?->subject) {
            return null;
        }

        return str_replace(array_keys($tokens), array_values($tokens), $custom->subject);
    }

    private function sampleTokenValues(): array
    {
        $frontendUrl = rtrim(env('FRONTEND_URL', 'https://thepupperclub.ca'), '/');
        return [
            '{client_name}'     => 'Jane Smith',
            '{client_first_name}' => 'Jane',
            '{temp_password}'   => 'TPC-abc123',
            '{set_password_url}'=> $frontendUrl . '/set-password?token=sample',
            '{invoice_number}'  => 'PC-2026-0042',
            '{total}'           => '185.00',
            '{due_date}'        => 'April 15, 2026',
            '{billing_period}'  => 'April 1 – April 15, 2026',
            '{payment_method}'  => 'Visa ending in 4242',
            '{portal_url}'      => $frontendUrl . '/client',
            '{document_name}'   => 'Service Agreement 2026.pdf',
            '{signing_url}'     => $frontendUrl . '/sign/sample-token',
            '{dog_names}'       => 'Luna & Milo',
            '{dog_name}'        => 'Luna',
            '{visit_date}'      => 'April 8, 2026',
            '{arrival_time}'    => '10:00 AM',
            '{departure_time}'  => '11:30 AM',
            '{notes}'           => 'Luna and Milo had a wonderful walk today! Both were very well behaved and enjoyed the sunshine.',
            '{checklist_html}'  => '<div style="display:flex;flex-wrap:wrap;gap:8px;"><span style="display:inline-flex;align-items:center;gap:6px;background:#F6F3EE;border-radius:20px;padding:6px 12px;font-size:13px;color:#3B2F2A;"><span style="width:8px;height:8px;border-radius:50%;background:#C9A24D;display:inline-block;"></span>Long Walk</span><span style="display:inline-flex;align-items:center;gap:6px;background:#F6F3EE;border-radius:20px;padding:6px 12px;font-size:13px;color:#3B2F2A;"><span style="width:8px;height:8px;border-radius:50%;background:#C9A24D;display:inline-block;"></span>Outdoor Play</span><span style="display:inline-flex;align-items:center;gap:6px;background:#F6F3EE;border-radius:20px;padding:6px 12px;font-size:13px;color:#3B2F2A;"><span style="width:8px;height:8px;border-radius:50%;background:#C9A24D;display:inline-block;"></span>Water Refill</span></div>',
            '{visit_photo_html}'=> '',
            '{dog_photo_html}'  => '<div style="text-align:center;margin-bottom:20px;"><img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iI0Y2RjNFRSIvPjx0ZXh0IHg9IjUwIiB5PSI1OCIgZm9udC1zaXplPSI0MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iI0M4QkZCNiI+8J+Qvjwv dGV4dD48L3N2Zz4=" alt="Dog photo" style="width:100px;height:100px;border-radius:50%;object-fit:cover;border:3px solid #C9A24D;" /></div>',
            '{title}'           => 'Sample Notification',
            '{content}'         => '<p>This is a sample notification message to preview the template layout.</p>',
        ];
    }

    private function ensureSystemTemplateTable(): void
    {
        if (!Schema::hasTable('system_email_templates')) {
            Schema::create('system_email_templates', function (\Illuminate\Database\Schema\Blueprint $table) {
                $table->id();
                $table->string('key')->unique();
                $table->string('subject')->nullable();
                $table->longText('body')->nullable();
                $table->timestamps();
            });
        }
    }

    // ── Marketing Templates ──────────────────────────────────────────────────

    public function templates(): JsonResponse
    {
        $this->ensureTemplateTable();

        $templates = BroadcastTemplate::orderBy('name')
            ->get();

        return response()->json(['data' => $templates]);
    }

    public function storeTemplate(Request $request): JsonResponse
    {
        $this->ensureTemplateTable();

        $data = $request->validate([
            'name'    => 'required|string|max:255',
            'subject' => 'required|string|max:255',
            'body'    => 'required|string',
        ]);

        $template = BroadcastTemplate::create([
            ...$data,
            'created_by' => $request->user()->id,
        ]);

        return response()->json(['data' => $template], 201);
    }

    public function updateTemplate(Request $request, int $id): JsonResponse
    {
        $this->ensureTemplateTable();

        $template = BroadcastTemplate::findOrFail($id);

        $data = $request->validate([
            'name'    => 'sometimes|string|max:255',
            'subject' => 'sometimes|string|max:255',
            'body'    => 'sometimes|string',
        ]);

        $template->update($data);

        return response()->json(['data' => $template]);
    }

    public function destroyTemplate(int $id): JsonResponse
    {
        $this->ensureTemplateTable();

        BroadcastTemplate::findOrFail($id)->delete();

        return response()->json(['message' => 'Template deleted.']);
    }

    /**
     * Replace template tokens with client-specific data.
     */
    private function replaceTokens(string $text, User $user): string
    {
        $firstName = explode(' ', trim($user->name))[0];
        $lastName  = count(explode(' ', trim($user->name))) > 1
            ? collect(explode(' ', trim($user->name)))->slice(1)->implode(' ')
            : '';

        $dogs     = ($user->dogs ?? collect())->filter(fn($d) => !$d->is_archived);
        $dogNames = $dogs->pluck('name')->join(' & ');
        $firstDog = $dogs->first()?->name ?? '';

        $tokens = [
            '{client_first_name}' => $firstName,
            '{client_last_name}'  => $lastName,
            '{client_name}'       => $user->name,
            '{client_email}'      => $user->email ?? '',
            '{dog_names}'         => $dogNames ?: 'your pup',
            '{dog_name}'          => $firstDog ?: 'your pup',
        ];

        return str_replace(array_keys($tokens), array_values($tokens), $text);
    }

    /**
     * Extract <img> tags from HTML, download their content, and return
     * the modified HTML + array of inline image parts for CID embedding.
     */
    private function extractInlineImages(string $html): array
    {
        $inlineImages = [];
        $counter = 0;

        $html = preg_replace_callback('/<img\s[^>]*src=["\']([^"\']+)["\'][^>]*>/i', function ($match) use (&$inlineImages, &$counter) {
            $src = $match[1];

            // Skip data URIs (already embedded) and CID references
            if (str_starts_with($src, 'data:') || str_starts_with($src, 'cid:')) {
                return $match[0];
            }

            $imageData = null;
            $mime = 'image/jpeg';

            // Try to load the image
            try {
                // Local broadcast image
                if (str_contains($src, '/broadcast-images/')) {
                    $filename = basename(parse_url($src, PHP_URL_PATH));
                    $path = 'broadcast_inline/' . $filename;
                    if (Storage::disk('local')->exists($path)) {
                        $imageData = Storage::disk('local')->get($path);
                        $mime = Storage::disk('local')->mimeType($path) ?: 'image/jpeg';
                    }
                }

                // External URL — download it
                if (!$imageData && str_starts_with($src, 'http')) {
                    $ctx = stream_context_create(['http' => ['timeout' => 5]]);
                    $imageData = @file_get_contents($src, false, $ctx);
                    // Detect mime from content
                    if ($imageData) {
                        $finfo = new \finfo(FILEINFO_MIME_TYPE);
                        $mime = $finfo->buffer($imageData) ?: 'image/jpeg';
                    }
                }
            } catch (\Throwable $e) {
                // If we can't load the image, leave the original tag
            }

            if (!$imageData) {
                return $match[0]; // Keep original if download failed
            }

            $counter++;
            $cid = "broadcast-img-{$counter}@thepupperclub.ca";
            $ext = match ($mime) {
                'image/png'  => 'png',
                'image/gif'  => 'gif',
                'image/webp' => 'webp',
                default      => 'jpg',
            };

            $inlineImages[] = [
                'data'     => $imageData,
                'filename' => "image-{$counter}.{$ext}",
                'mime'     => $mime,
                'cid'      => $cid,
            ];

            // Replace src with cid: reference
            return str_replace($src, "cid:{$cid}", $match[0]);
        }, $html) ?? $html;

        return [$html, $inlineImages];
    }

    private function ensureTemplateTable(): void
    {
        if (!Schema::hasTable('broadcast_templates')) {
            Schema::create('broadcast_templates', function (\Illuminate\Database\Schema\Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('subject');
                $table->longText('body');
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        }
    }
}
