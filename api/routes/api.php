<?php

use App\Http\Controllers\Admin;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Client;
use App\Http\Controllers\ConversationController;
use App\Http\Controllers\DocumentController;
use App\Http\Controllers\ContactController;
use App\Http\Controllers\StripeWebhookController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Admin\IntakeController;
use App\Http\Controllers\Admin\ReportCardController as AdminReportCardController;
use App\Http\Controllers\Client\ReportCardController as ClientReportCardController;






// Cache-clearing utility hit automatically by the deploy pipeline after
// every deploy (see .github/workflows/deploy.yml) — not a one-off temp
// route despite the URL suffix; keep this one.
Route::get('/clear-cache-9x7k', function () {
    // Also manually delete cached config file
    $cachedConfig = base_path('bootstrap/cache/config.php');
    $hadCache = file_exists($cachedConfig);
    if ($hadCache) {
        @unlink($cachedConfig);
    }

    \Illuminate\Support\Facades\Artisan::call('config:clear');
    \Illuminate\Support\Facades\Artisan::call('route:clear');
    \Illuminate\Support\Facades\Artisan::call('view:clear');

    // Belt-and-suspenders: also manually delete compiled blade views.
    // `view:clear` has been observed to silently no-op on GoDaddy's
    // Windows/IIS filesystem (permission quirks), leaving a stale
    // compiled template in place after a blade file changes — a report
    // card email kept rendering pre-fix output for two weeks even
    // though the source .blade.php and every deploy afterward were
    // correct.
    $viewsCleared = 0;
    $viewsPath = storage_path('framework/views');
    if (is_dir($viewsPath)) {
        foreach (glob($viewsPath . '/*.php') as $file) {
            if (@unlink($file)) $viewsCleared++;
        }
    }

    // Reset PHP OPcache so freshly-deployed PHP files (fallback.php,
    // controllers, etc.) take effect immediately instead of waiting for
    // OPcache's TTL.
    $opcacheReset = function_exists('opcache_reset') ? @opcache_reset() : null;

    return response()->json([
        'message' => 'All caches cleared.',
        'had_cached_config' => $hadCache,
        'compiled_views_deleted' => $viewsCleared,
        'frontend_url_now' => config('services.frontend_url'),
        'env_frontend_url' => env('FRONTEND_URL'),
        'config_file_exists' => file_exists($cachedConfig),
        'opcache_reset' => $opcacheReset,
    ]);
});

// ── Public ───────────────────────────────────────────────────────────────────
Route::post('/auth/login',          [AuthController::class, 'login'])->middleware('throttle:6,1');
Route::post('/auth/forgot-password',[AuthController::class, 'forgotPassword'])->middleware('throttle:3,1');
Route::post('/auth/reset-password', [AuthController::class, 'resetPassword']);
Route::post('/webhooks/stripe',     [StripeWebhookController::class, 'handle']);
Route::post('/webhooks/email',      [\App\Http\Controllers\InboundEmailController::class, 'handle']);
Route::post('/contact',             [ContactController::class, 'submit'])->middleware('throttle:5,1');
Route::post('/rescue-trip-interest', [\App\Http\Controllers\RescueTripInterestController::class, 'store']);
Route::post('/transport-quote',      [\App\Http\Controllers\TransportQuoteController::class, 'quote']);

// Public — returns the Google Maps browser key so static marketing
// pages can attach Places Autocomplete without committing the key.
// The key is restricted by HTTP referrer in Google Cloud Console.
Route::get('/maps-key', function () {
    return response()->json([
        'key' => config('services.google.maps_api_key') ?: '',
    ])->header('Cache-Control', 'public, max-age=3600');
});

// Public inline images (must be accessible for emails)
Route::get('/admin/broadcast-images/{filename}', [Admin\NotificationController::class, 'serveInlineImage'])
    ->where('filename', '[a-zA-Z0-9_\-\.]+');

// Document signing (token-based, no auth required)
Route::get('/signing/{token}',          [\App\Http\Controllers\SigningController::class, 'show']);
Route::get('/signing/{token}/document', [\App\Http\Controllers\SigningController::class, 'serveDocument']);
Route::post('/signing/{token}/sign',    [\App\Http\Controllers\SigningController::class, 'sign']);

// ── Authenticated ─────────────────────────────────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/auth/logout',      [AuthController::class, 'logout']);
    Route::get('/auth/me',           [AuthController::class, 'me']);
    Route::patch('/auth/set-password',    [AuthController::class, 'setPassword']);
    Route::patch('/auth/change-password', [AuthController::class, 'changePassword']);
    Route::post('/auth/delete-account',    [AuthController::class, 'deleteAccount']);
    Route::patch('/auth/push-token',      [AuthController::class, 'updatePushToken']);
    Route::patch('/auth/notification-preferences', [AuthController::class, 'updateNotificationPreferences']);

    // ── Admin ─────────────────────────────────────────────────────────────────
    Route::middleware('role:admin')->prefix('admin')->group(function () {
        Route::get('/dashboard', [Admin\DashboardController::class, 'index']);
        Route::get('/error-logs', [Admin\DashboardController::class, 'errorLogs']);
        Route::get('/email-logs', [Admin\DashboardController::class, 'emailLogs']);
        Route::get('/email-logs/{id}', [Admin\DashboardController::class, 'emailLogPreview']);

        // Clients
        Route::get('/clients/pending',                  [Admin\ClientController::class, 'pending']);
        Route::post('/clients/invite',                  [Admin\ClientController::class, 'invite']);
        Route::post('/clients/create-draft',            [Admin\ClientController::class, 'createDraft']);
        Route::get('/clients',                          [Admin\ClientController::class, 'index']);
        Route::get('/clients/{client}',                 [Admin\ClientController::class, 'show']);
        Route::patch('/clients/{client}',               [Admin\ClientController::class, 'update']);
        Route::delete('/clients/{client}',             [Admin\ClientController::class, 'destroy']);
        Route::post('/clients/{client}/resend-invite',  [Admin\ClientController::class, 'resendInvite']);
        Route::post('/clients/{client}/reset-password', [Admin\ClientController::class, 'resetPassword']);
        Route::get('/clients/{client}/home-access',     [Admin\ClientController::class, 'homeAccess']);
        Route::patch('/clients/{client}/home-access',   [Admin\ClientController::class, 'updateHomeAccess']);
        Route::get('/clients/{client}/documents',       [Admin\ClientController::class, 'documents']);
        Route::post('/clients/{client}/documents',      [Admin\ClientController::class, 'uploadDocument']);
        Route::delete('/clients/{client}/documents/{document}', [Admin\ClientController::class, 'deleteDocument']);
        Route::post('/clients/{client}/subscribe',            [Admin\ClientController::class, 'subscribe']);
        Route::post('/clients/{client}/cancel-subscription',  [Admin\ClientController::class, 'cancelSubscription']);
        Route::post('/clients/{client}/pause-subscription',  [Admin\ClientController::class, 'pauseSubscription']);
        Route::post('/clients/{client}/resume-subscription', [Admin\ClientController::class, 'resumeSubscription']);
        Route::get('/clients/{client}/subscription-history', [Admin\ClientController::class, 'subscriptionHistory']);
        Route::get('/clients/{client}/billing-summary',    [Admin\ClientController::class, 'billingSummary']);
        Route::post('/clients/{client}/generate-upcoming-invoice', [Admin\ClientController::class, 'generateUpcomingInvoice']);

        // Intake form
        Route::get('/clients/{client}/intake',           [IntakeController::class, 'show']);
        Route::put('/clients/{client}/intake',           [IntakeController::class, 'save']);
        Route::post('/clients/{client}/intake/save',     [IntakeController::class, 'save']);
        Route::post('/clients/{client}/intake/submit',   [IntakeController::class, 'submit']);

        // Document signing
        Route::post('/clients/{client}/documents/{document}/request-signature',   [\App\Http\Controllers\SigningController::class, 'request']);
        Route::get('/clients/{client}/documents/{document}/certificate',           [\App\Http\Controllers\SigningController::class, 'certificate']);
        Route::post('/clients/{client}/documents/{document}/add-external-signer', [\App\Http\Controllers\SigningController::class, 'addExternalSigner']);

        // Document Templates
        Route::get('/document-templates',                        [Admin\DocumentTemplateController::class, 'index']);
        Route::post('/document-templates',                       [Admin\DocumentTemplateController::class, 'store']);
        Route::get('/document-templates/{template}',             [Admin\DocumentTemplateController::class, 'show']);
        Route::patch('/document-templates/{template}',           [Admin\DocumentTemplateController::class, 'update']);
        Route::delete('/document-templates/{template}',          [Admin\DocumentTemplateController::class, 'destroy']);
        Route::get('/document-templates/{template}/pdf',         [Admin\DocumentTemplateController::class, 'servePdf']);
        Route::put('/document-templates/{template}/fields',      [Admin\DocumentTemplateController::class, 'saveFields']);
        Route::post('/document-templates/{template}/use',        [Admin\DocumentTemplateController::class, 'useTemplate']);

        // Admin document management
        Route::get('/documents',                                 [Admin\DocumentTemplateController::class, 'adminIndex']);
        Route::patch('/documents/{document}/field-values',       [Admin\DocumentTemplateController::class, 'updateFieldValues']);
        Route::patch('/documents/{document}/rename',             [Admin\DocumentTemplateController::class, 'renameDocument']);
        Route::delete('/documents/{document}',                   [Admin\DocumentTemplateController::class, 'deleteDocument']);
        Route::post('/documents/{document}/send',                [Admin\DocumentTemplateController::class, 'sendForSigning']);
        Route::get('/documents/{document}/certificate',          [\App\Http\Controllers\SigningController::class, 'certificateByDocument']);

        // Dogs
        Route::get('/dogs/birthdays', [Admin\DogController::class, 'birthdays']);
        Route::get('/dogs',         [Admin\DogController::class, 'index']);
        Route::post('/dogs',        [Admin\DogController::class, 'store']);
        Route::get('/dogs/{dog}',          [Admin\DogController::class, 'show']);
        Route::patch('/dogs/{dog}',        [Admin\DogController::class, 'update']);
        Route::post('/dogs/{dog}/photo',   [Admin\DogController::class, 'uploadPhoto']);
        Route::get('/dogs/{dog}/photo',    [Admin\DogController::class, 'servePhoto']);
        Route::delete('/dogs/{dog}/photo', [Admin\DogController::class, 'deletePhoto']);

        // Appointments
        Route::get('/appointments/scheduling-status',        [Admin\AppointmentController::class, 'schedulingStatus']);
        Route::post('/appointments/email-schedule',          [Admin\AppointmentController::class, 'emailSchedule']);
        Route::get('/appointments',                          [Admin\AppointmentController::class, 'index']);
        Route::post('/appointments',                         [Admin\AppointmentController::class, 'store']);
        Route::get('/appointments/{appointment}',            [Admin\AppointmentController::class, 'show']);
        Route::patch('/appointments/{appointment}',          [Admin\AppointmentController::class, 'update']);
        Route::patch('/appointments/{appointment}/times',    [Admin\AppointmentController::class, 'updateTimes']);
        Route::delete('/appointments/{appointment}',         [Admin\AppointmentController::class, 'destroy']);
        Route::post('/appointments/{appointment}/check-in',            [Admin\AppointmentController::class, 'checkIn']);
        Route::post('/appointments/{appointment}/complete',            [Admin\AppointmentController::class, 'complete']);
        Route::post('/appointments/{appointment}/dismiss-report-card', [Admin\ReportCardController::class, 'dismissDue']);
        Route::get('/appointments/{appointment}/report',     [Admin\AppointmentController::class, 'report']);
        Route::patch('/appointments/{appointment}/report',   [Admin\AppointmentController::class, 'updateReport']);

        // Calendar blocks (non-client calendar entries)
        Route::get('/calendar-blocks',                       [Admin\CalendarBlockController::class, 'index']);
        Route::post('/calendar-blocks',                      [Admin\CalendarBlockController::class, 'store']);
        Route::patch('/calendar-blocks/{calendarBlock}',      [Admin\CalendarBlockController::class, 'update']);
        Route::delete('/calendar-blocks/{calendarBlock}',     [Admin\CalendarBlockController::class, 'destroy']);

        // Service requests
        Route::get('/service-requests',               [Admin\ServiceRequestController::class, 'index']);
        Route::post('/service-requests',              [Admin\ServiceRequestController::class, 'store']);
        Route::patch('/service-requests/{serviceRequest}', [Admin\ServiceRequestController::class, 'update']);

        // Invoices
        // Stripe
        Route::get('/stripe/products',            [Admin\StripeController::class, 'products']);

        Route::get('/invoices/dashboard',         [Admin\InvoiceController::class, 'dashboard']);
        Route::get('/invoices',                   [Admin\InvoiceController::class, 'index']);
        Route::post('/invoices',                  [Admin\InvoiceController::class, 'store']);
        Route::get('/invoices/{invoice}',         [Admin\InvoiceController::class, 'show']);
        Route::patch('/invoices/{invoice}',       [Admin\InvoiceController::class, 'update']);
        Route::post('/invoices/{invoice}/mark-paid',  [Admin\InvoiceController::class, 'markPaid']);
        Route::post('/invoices/{invoice}/void',      [Admin\InvoiceController::class, 'void']);
        Route::post('/invoices/{invoice}/add-items',  [Admin\InvoiceController::class, 'addLineItems']);
        Route::post('/invoices/{invoice}/discount',  [Admin\InvoiceController::class, 'applyDiscount']);
        Route::post('/invoices/{invoice}/approve',   [Admin\InvoiceController::class, 'approve']);
        Route::post('/invoices/{invoice}/send',      [Admin\InvoiceController::class, 'send']);
        Route::post('/invoices/{invoice}/resend',   [Admin\InvoiceController::class, 'resend']);
        Route::post('/invoices/{invoice}/reminder', [Admin\InvoiceController::class, 'sendReminder']);
        Route::get('/invoices/{invoice}/pdf',       [Admin\InvoiceController::class, 'pdf']);

        // Report cards
        Route::get('/report-cards',                                [AdminReportCardController::class, 'index']);
        Route::get('/report-cards/due',                            [AdminReportCardController::class, 'due']);
        Route::post('/report-cards',                               [AdminReportCardController::class, 'store']);
        Route::get('/report-cards/{reportCard}',                   [AdminReportCardController::class, 'show']);
        Route::post('/report-cards/{reportCard}',                  [AdminReportCardController::class, 'update']); // POST for multipart
        Route::delete('/report-cards/{reportCard}',                [AdminReportCardController::class, 'destroy']);
        Route::post('/report-cards/{reportCard}/send',             [AdminReportCardController::class, 'send']);
        Route::get('/report-cards/{reportCard}/photos/{index}',      [AdminReportCardController::class, 'servePhoto']);
        Route::delete('/report-cards/{reportCard}/photos',                  [AdminReportCardController::class, 'deletePhoto']);
        Route::delete('/report-cards/{reportCard}/comments/{comment}',     [AdminReportCardController::class, 'deleteComment']);
        Route::get('/clients/{client}/report-template',            [AdminReportCardController::class, 'getTemplate']);
        Route::put('/clients/{client}/report-template',            [AdminReportCardController::class, 'saveTemplate']);
        Route::delete('/clients/{client}/report-template',         [AdminReportCardController::class, 'resetTemplate']);

        // Notifications & Broadcast
        Route::post('/notifications/broadcast',       [Admin\NotificationController::class, 'broadcast']);
        Route::post('/notifications/preview',        [Admin\NotificationController::class, 'preview']);
        Route::post('/notifications/inline-image',   [Admin\NotificationController::class, 'uploadInlineImage']);
        Route::get('/notifications/history',      [Admin\NotificationController::class, 'history']);
        Route::get('/system-templates',                [Admin\NotificationController::class, 'systemTemplates']);
        Route::get('/system-templates/{key}/preview',  [Admin\NotificationController::class, 'systemTemplatePreview']);
        Route::put('/system-templates/{key}',          [Admin\NotificationController::class, 'updateSystemTemplate']);
        Route::delete('/system-templates/{key}',       [Admin\NotificationController::class, 'resetSystemTemplate']);
        Route::get('/broadcast-templates',        [Admin\NotificationController::class, 'templates']);
        Route::post('/broadcast-templates',       [Admin\NotificationController::class, 'storeTemplate']);
        Route::patch('/broadcast-templates/{id}', [Admin\NotificationController::class, 'updateTemplate']);
        Route::delete('/broadcast-templates/{id}',[Admin\NotificationController::class, 'destroyTemplate']);
        Route::get('/broadcast-attachments/{path}', [Admin\NotificationController::class, 'serveAttachment'])->where('path', '.*');

        // Vaccination records
        Route::get('/dogs/{dog}/vaccinations',              [Admin\VaccinationController::class, 'index']);
        Route::post('/dogs/{dog}/vaccinations',             [Admin\VaccinationController::class, 'store']);
        Route::delete('/dogs/{dog}/vaccinations/{record}',  [Admin\VaccinationController::class, 'destroy']);

        // Team members
        Route::get('/team',                         [Admin\TeamController::class, 'index']);
        Route::post('/team',                        [Admin\TeamController::class, 'store']);
        Route::patch('/team/{user}',                [Admin\TeamController::class, 'update']);
        Route::delete('/team/{user}',               [Admin\TeamController::class, 'destroy']);
        Route::post('/team/{user}/reset-password',  [Admin\TeamController::class, 'resetPassword']);

        // Time & Mileage
        Route::get('/time-mileage',              [Admin\TimeMileageController::class, 'report']);
        Route::post('/time-mileage/estimate',    [Admin\TimeMileageController::class, 'mileageEstimate']);
        Route::post('/time-mileage/recalculate', [Admin\TimeMileageController::class, 'recalculateDay']);
        Route::get('/time-mileage/appointment/{appointment}', [Admin\TimeMileageController::class, 'appointmentMileage']);

        // Report exports
        Route::get('/reports/export',        [Admin\ReportExportController::class, 'export']);
        Route::get('/reports/walk-history',  [Admin\ReportExportController::class, 'walkHistory']);
        Route::get('/reports/billing',       [Admin\ReportExportController::class, 'billingHistory']);

        // Audit logs
        Route::get('/audit-logs', [Admin\AuditLogController::class, 'index']);

        // Backup
        Route::get('/backup/download', [Admin\BackupController::class, 'download']);

        // Conversations (admin inbox)
        Route::get('/conversations',                                    [ConversationController::class, 'inbox']);
        Route::patch('/conversations/{conversation}/status',            [ConversationController::class, 'updateStatus']);
    });

    // ── Client ────────────────────────────────────────────────────────────────
    Route::middleware('role:client')->prefix('client')->group(function () {
        // Onboarding
        Route::get('/onboarding/status',             [Client\OnboardingController::class, 'status']);
        Route::patch('/onboarding/step/{step}',      [Client\OnboardingController::class, 'completeStep']);

        // Profile
        Route::get('/profile',                       [Client\ProfileController::class, 'show']);
        Route::patch('/profile',                     [Client\ProfileController::class, 'update']);
        Route::post('/profile/confirm',              [Client\ProfileController::class, 'confirm']);

        // Client-side intake form
        Route::get('/intake',                        [Client\IntakeController::class, 'show']);
        Route::put('/intake',                        [Client\IntakeController::class, 'save']);
        Route::post('/intake/save',                  [Client\IntakeController::class, 'save']);
        Route::post('/intake/submit',                [Client\IntakeController::class, 'submit']);
        Route::get('/home-access',                   [Client\ProfileController::class, 'homeAccess']);
        Route::patch('/home-access',                 [Client\ProfileController::class, 'updateHomeAccess']);

        // Dogs & Documents
        Route::get('/dogs',                          [Client\DogController::class, 'index']);
        Route::post('/dogs',                         [Client\DogController::class, 'store']);
        Route::patch('/dogs/{dog}',                  [Client\DogController::class, 'update']);
        Route::post('/dogs/{dog}/update',            [Client\DogController::class, 'update']);
        Route::post('/dogs/{dog}/photo',             [Client\DogController::class, 'uploadPhoto']);
        Route::get('/dogs/{dog}/photo',              [Client\DogController::class, 'servePhoto']);
        Route::delete('/dogs/{dog}/photo',           [Client\DogController::class, 'deletePhoto']);
        Route::get('/documents',                     [Client\DogController::class, 'documents']);
        Route::post('/documents',                    [Client\DogController::class, 'uploadDocument']);

        // Appointments & Service Requests
        Route::get('/appointments',                                      [Client\AppointmentController::class, 'index']);
        Route::post('/appointments/{appointment}/cancel',                [Client\AppointmentController::class, 'cancel']);
        Route::post('/appointments/{appointment}/request-time-change',   [Client\AppointmentController::class, 'requestTimeChange']);
        Route::post('/appointments/{appointment}/request-extension',     [Client\AppointmentController::class, 'requestExtension']);
        Route::post('/appointments/{appointment}/request-special-service', [Client\AppointmentController::class, 'requestSpecialService']);
        Route::get('/service-requests',                              [Client\AppointmentController::class, 'serviceRequests']);
        Route::post('/service-requests',                             [Client\AppointmentController::class, 'storeServiceRequest']);
        Route::put('/service-requests/{serviceRequest}',             [Client\AppointmentController::class, 'updateServiceRequest']);
        Route::delete('/service-requests/{serviceRequest}',          [Client\AppointmentController::class, 'destroyServiceRequest']);

        // Report cards
        Route::get('/report-cards',                          [ClientReportCardController::class, 'index']);
        Route::get('/report-cards/{reportCard}',             [ClientReportCardController::class, 'show']);
        Route::get('/report-cards/{reportCard}/photos/{index}',              [ClientReportCardController::class, 'servePhoto']);
        Route::post('/report-cards/{reportCard}/comments',                   [ClientReportCardController::class, 'postComment']);
        Route::delete('/report-cards/{reportCard}/comments/{comment}',       [ClientReportCardController::class, 'deleteComment']);
        Route::post('/report-cards/{reportCard}/change-request',             [ClientReportCardController::class, 'submitChangeRequest']);

        // Invoices
        Route::get('/invoices',                      [Client\InvoiceController::class, 'index']);
        Route::get('/invoices/{invoice}',            [Client\InvoiceController::class, 'show']);
        Route::get('/invoices/{invoice}/pdf',        [Client\InvoiceController::class, 'pdf']);
        Route::post('/invoices/{invoice}/pay',       [Client\InvoiceController::class, 'pay']);
        Route::post('/invoices/{invoice}/tip',       [Client\InvoiceController::class, 'tip']);
        Route::post('/billing/setup-intent',         [Client\InvoiceController::class, 'setupIntent']);
        Route::post('/billing/setup-intent-pad',     [Client\InvoiceController::class, 'setupIntentPad']);
        Route::post('/billing/payment-method',       [Client\InvoiceController::class, 'savePaymentMethod']);
        Route::get('/billing/payment-method',        [Client\InvoiceController::class, 'paymentMethod']);
    });

    // ── Shared: Document download (admin or document owner) ──────────────────
    Route::get('/documents/{document}', [DocumentController::class, 'serve'])->name('documents.serve');

    // ── Shared: Conversations (both roles access by client ID) ────────────────
    Route::get('/conversations/{clientId}',                              [ConversationController::class, 'thread']);
    Route::post('/conversations/{clientId}/messages',                    [ConversationController::class, 'sendMessage']);
    Route::post('/conversations/{clientId}/photo',                       [ConversationController::class, 'sendPhoto']);
    Route::patch('/conversations/{clientId}/messages/{message}/read',    [ConversationController::class, 'markRead']);
    Route::patch('/messages/{message}',                                  [ConversationController::class, 'editMessage']);
    Route::delete('/messages/{message}',                                 [ConversationController::class, 'deleteMessage']);
    Route::get('/messages/{message}/photo',                              [ConversationController::class, 'servePhoto']);
    Route::get('/messages/{message}/attachment/{index}',                  [ConversationController::class, 'serveMessageAttachment']);
    Route::post('/messages/{message}/reactions',                         [ConversationController::class, 'toggleReaction']);
});

// ─────────────────────────────────────────────────────────────────────────────
// Community sub-brand
// Separate auth surface from the paid service — uses CommunityMember model,
// simple bearer-token auth (AuthenticateCommunityMember middleware), and a
// distinct route prefix so paid-service users and community members never
// collide.
// ─────────────────────────────────────────────────────────────────────────────
Route::prefix('community')->group(function () {
    // Public auth endpoints
    Route::post('/auth/register', [\App\Http\Controllers\Community\AuthController::class, 'register'])->middleware('throttle:6,1');
    Route::post('/auth/login',    [\App\Http\Controllers\Community\AuthController::class, 'login'])->middleware('throttle:6,1');

    // Authenticated endpoints (token in Authorization: Bearer)
    Route::middleware(\App\Http\Middleware\AuthenticateCommunityMember::class)->group(function () {
        Route::post('/auth/logout',          [\App\Http\Controllers\Community\AuthController::class, 'logout']);
        Route::get('/me',                    [\App\Http\Controllers\Community\AuthController::class, 'me']);
        Route::patch('/profile',             [\App\Http\Controllers\Community\ProfileController::class, 'update']);
        Route::post('/profile/photo',        [\App\Http\Controllers\Community\ProfileController::class, 'uploadPhoto']);
        Route::delete('/profile/photo',      [\App\Http\Controllers\Community\ProfileController::class, 'removePhoto']);
        Route::get('/members/{member}/photo', [\App\Http\Controllers\Community\ProfileController::class, 'servePhoto']);

        Route::post('/pets',                 [\App\Http\Controllers\Community\PetsController::class, 'store']);
        Route::post('/pets/{pet}',           [\App\Http\Controllers\Community\PetsController::class, 'update']); // POST + _method=PATCH
        Route::patch('/pets/{pet}',          [\App\Http\Controllers\Community\PetsController::class, 'update']);
        Route::delete('/pets/{pet}',         [\App\Http\Controllers\Community\PetsController::class, 'destroy']);
        Route::get('/pets/{pet}/photo',      [\App\Http\Controllers\Community\PetsController::class, 'photo']);

        Route::post('/support/contact',       [\App\Http\Controllers\Community\SupportController::class, 'contact']);
        Route::post('/donations/checkout',    [\App\Http\Controllers\Community\DonationsController::class, 'checkout']);

        Route::get('/invites',                [\App\Http\Controllers\Community\InvitesController::class, 'index']);
        Route::post('/invites',               [\App\Http\Controllers\Community\InvitesController::class, 'store']);
        Route::delete('/invites/{invite}',    [\App\Http\Controllers\Community\InvitesController::class, 'destroy']);

        Route::get('/account/settings',       [\App\Http\Controllers\Community\AccountController::class, 'settings']);
        Route::patch('/account/password',     [\App\Http\Controllers\Community\AccountController::class, 'changePassword']);
        Route::patch('/account/notifications', [\App\Http\Controllers\Community\AccountController::class, 'updateNotifications']);
        Route::post('/account/pause',         [\App\Http\Controllers\Community\AccountController::class, 'pause']);
        Route::post('/account/resume',        [\App\Http\Controllers\Community\AccountController::class, 'resume']);
        Route::delete('/account',             [\App\Http\Controllers\Community\AccountController::class, 'destroy']);

        Route::get('/verification/status',    [\App\Http\Controllers\Community\VerificationController::class, 'status']);
        Route::post('/verification/checkout', [\App\Http\Controllers\Community\VerificationController::class, 'checkout']);
        Route::post('/verification/start',    [\App\Http\Controllers\Community\VerificationController::class, 'start']);
        Route::get('/neighbours',            [\App\Http\Controllers\Community\NeighboursController::class, 'index']);
        Route::get('/connections',           [\App\Http\Controllers\Community\ConnectionsController::class, 'index']);
        Route::post('/connections',          [\App\Http\Controllers\Community\ConnectionsController::class, 'store']);
        Route::patch('/connections/{connection}',  [\App\Http\Controllers\Community\ConnectionsController::class, 'update']);
        Route::delete('/connections/{connection}', [\App\Http\Controllers\Community\ConnectionsController::class, 'destroy']);

        Route::get('/broadcasts/incoming',    [\App\Http\Controllers\Community\BroadcastsController::class, 'incoming']);
        Route::get('/broadcasts/outgoing',    [\App\Http\Controllers\Community\BroadcastsController::class, 'outgoing']);
        Route::post('/broadcasts',            [\App\Http\Controllers\Community\BroadcastsController::class, 'store']);
        Route::patch('/broadcasts/{broadcast}/respond', [\App\Http\Controllers\Community\BroadcastsController::class, 'respond']);
        Route::patch('/broadcasts/{broadcast}/close',   [\App\Http\Controllers\Community\BroadcastsController::class, 'close']);

        Route::get('/conversations',                            [\App\Http\Controllers\Community\ConversationsController::class, 'index']);
        Route::get('/conversations/{otherId}',                  [\App\Http\Controllers\Community\ConversationsController::class, 'thread']);
        Route::post('/conversations/{otherId}/messages',        [\App\Http\Controllers\Community\ConversationsController::class, 'send']);

        Route::get('/members/{id}',                                  [\App\Http\Controllers\Community\MembersController::class, 'show']);
        Route::post('/recommendations',                              [\App\Http\Controllers\Community\RecommendationsController::class, 'upsert']);
        Route::delete('/recommendations/{recommendation}',           [\App\Http\Controllers\Community\RecommendationsController::class, 'destroy']);
        Route::patch('/recommendations/{recommendation}/visibility', [\App\Http\Controllers\Community\RecommendationsController::class, 'visibility']);

        Route::get('/blocks',                  [\App\Http\Controllers\Community\SafetyController::class, 'listBlocks']);
        Route::post('/blocks',                 [\App\Http\Controllers\Community\SafetyController::class, 'block']);
        Route::delete('/blocks/{block}',       [\App\Http\Controllers\Community\SafetyController::class, 'unblock']);
        Route::post('/reports',                [\App\Http\Controllers\Community\SafetyController::class, 'report']);
    });
});

// Stripe Identity sends webhook events here. Public route — signature is
// verified inside the controller using the dedicated identity webhook secret.
Route::post('/webhooks/stripe-identity', [\App\Http\Controllers\Community\VerificationController::class, 'webhook']);

// Stripe Checkout sends `checkout.session.completed` here for the $5
// community verification fee. Signature is verified inside the controller.
// Acts only on sessions whose metadata.kind is community_verification_fee,
// so it never collides with the main paid-service checkout webhook.
Route::post('/webhooks/community-checkout', [\App\Http\Controllers\Community\VerificationController::class, 'checkoutWebhook']);
