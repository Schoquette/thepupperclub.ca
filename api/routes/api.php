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

// Temporary: add missing dog intake columns (REMOVE after running)
Route::get('/fix-dog-columns-9x7k', function () {
    $results = [];
    $columns = [
        'personality_description' => 'TEXT NULL',
        'energy_level' => 'VARCHAR(50) NULL',
        'interaction_dogs' => 'VARCHAR(50) NULL',
        'interaction_strangers' => 'VARCHAR(50) NULL',
        'interaction_children' => 'VARCHAR(50) NULL',
        'triggers' => 'TEXT NULL',
        'preferred_walk_style' => 'JSON NULL',
        'preferred_gear' => 'JSON NULL',
        'treats_allowed' => 'VARCHAR(50) NULL',
        'treats_notes' => 'TEXT NULL',
        'training_commands' => 'TEXT NULL',
        'avoid_on_walks' => 'TEXT NULL',
        'medical_conditions' => 'TEXT NULL',
        'allergies' => 'TEXT NULL',
        'administer_medication_on_visits' => 'TINYINT(1) NULL',
        'mobility_limitations' => 'TINYINT(1) NULL',
        'recent_surgeries' => 'TEXT NULL',
    ];
    foreach ($columns as $col => $type) {
        if (!\Illuminate\Support\Facades\Schema::hasColumn('dogs', $col)) {
            try {
                \Illuminate\Support\Facades\DB::statement("ALTER TABLE dogs ADD COLUMN {$col} {$type}");
                $results[] = "Added {$col}";
            } catch (\Throwable $e) {
                $results[] = "Failed {$col}: " . $e->getMessage();
            }
        } else {
            $results[] = "{$col} already exists";
        }
    }
    return response()->json(['results' => $results]);
});

// Temporary: fix billing_method enum (REMOVE after running)
Route::get('/fix-billing-enum-9x7k', function () {
    try {
        \Illuminate\Support\Facades\DB::statement(
            "ALTER TABLE client_profiles MODIFY COLUMN billing_method ENUM('credit_card','e_transfer','cash','ach','interac_pad') NOT NULL DEFAULT 'credit_card'"
        );
        return response()->json(['message' => 'billing_method enum updated to include interac_pad.']);
    } catch (\Throwable $e) {
        return response()->json(['error' => $e->getMessage()], 500);
    }
});

// Temporary: clear config cache (REMOVE after confirming)
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

    return response()->json([
        'message' => 'All caches cleared.',
        'had_cached_config' => $hadCache,
        'frontend_url_now' => config('services.frontend_url'),
        'env_frontend_url' => env('FRONTEND_URL'),
        'config_file_exists' => file_exists($cachedConfig),
    ]);
});

// Temporary: check mail config (REMOVE after confirming)
Route::get('/mail-debug-9x7k', function () {
    return response()->json([
        'MAIL_MAILER' => env('MAIL_MAILER'),
        'MAIL_HOST' => env('MAIL_HOST'),
        'MAIL_PORT' => env('MAIL_PORT'),
        'MAIL_USERNAME' => env('MAIL_USERNAME'),
        'MAIL_PASSWORD' => env('MAIL_PASSWORD') ? '***set***' : '***NOT SET***',
        'MAIL_ENCRYPTION' => env('MAIL_ENCRYPTION'),
        'MAIL_FROM_ADDRESS' => env('MAIL_FROM_ADDRESS'),
        'default_mailer' => config('mail.default'),
        'mailers_defined' => array_keys(config('mail.mailers', [])),
    ]);
});

// Temporary: test email delivery (REMOVE after confirming)
Route::get('/test-email-9x7k', function () {
    \Illuminate\Support\Facades\Mail::raw('This is a test email from The Pupper Club portal.', function ($msg) {
        $msg->to('sophie@thepupperclub.ca')->subject('Email Test');
    });
    return response()->json(['message' => 'Test email sent. Check your inbox.']);
});

// Temporary: add notification_preferences JSON column to client_profiles (REMOVE after running)
Route::get('/add-notif-prefs-9x7k', function () {
    if (!\Illuminate\Support\Facades\Schema::hasColumn('client_profiles', 'notification_preferences')) {
        \Illuminate\Support\Facades\Schema::table('client_profiles', function ($t) {
            $t->json('notification_preferences')->nullable();
        });
        return response()->json(['message' => 'notification_preferences column added.']);
    }
    return response()->json(['message' => 'notification_preferences column already exists.']);
});

// Temporary: add request_type column to service_requests (REMOVE after running)
Route::get('/add-request-type-9x7k', function () {
    if (!\Illuminate\Support\Facades\Schema::hasColumn('service_requests', 'request_type')) {
        \Illuminate\Support\Facades\Schema::table('service_requests', function ($t) {
            $t->string('request_type')->nullable()->after('status');
        });
        // Backfill existing records by parsing notes
        \App\Models\ServiceRequest::whereNull('request_type')->each(function ($sr) {
            $notes = $sr->notes ?? '';
            if (str_starts_with($notes, 'Time change request')) $sr->update(['request_type' => 'time_change']);
            elseif (str_starts_with($notes, 'Extension request')) $sr->update(['request_type' => 'extension']);
            elseif (str_starts_with($notes, 'Special service')) $sr->update(['request_type' => 'special_service']);
            else $sr->update(['request_type' => 'new_visit']);
        });
        return response()->json(['message' => 'request_type column added and backfilled.']);
    }
    return response()->json(['message' => 'request_type column already exists.']);
});

// Temporary: add distance_km column to appointments (REMOVE after running)
Route::get('/add-appt-distance-9x7k', function () {
    if (!\Illuminate\Support\Facades\Schema::hasColumn('appointments', 'distance_km')) {
        \Illuminate\Support\Facades\Schema::table('appointments', function ($t) {
            $t->decimal('distance_km', 6, 1)->nullable()->after('check_out_time');
        });
        return response()->json(['message' => 'distance_km column added to appointments.']);
    }
    return response()->json(['message' => 'distance_km column already exists.']);
});

// Temporary: add appointment_id to service_requests (REMOVE after running)
Route::get('/add-sr-appointment-id-9x7k', function () {
    if (!\Illuminate\Support\Facades\Schema::hasColumn('service_requests', 'appointment_id')) {
        \Illuminate\Support\Facades\Schema::table('service_requests', function ($t) {
            $t->unsignedBigInteger('appointment_id')->nullable()->after('user_id');
            $t->foreign('appointment_id')->references('id')->on('appointments')->nullOnDelete();
        });
        return response()->json(['message' => 'appointment_id column added to service_requests.']);
    }
    return response()->json(['message' => 'appointment_id column already exists.']);
});

// Temporary: add adoptaversary column to dogs table (REMOVE after running)
Route::get('/add-adoptaversary-9x7k', function () {
    if (!\Illuminate\Support\Facades\Schema::hasColumn('dogs', 'adoptaversary')) {
        \Illuminate\Support\Facades\Schema::table('dogs', function ($t) {
            $t->date('adoptaversary')->nullable()->after('date_of_birth');
        });
        return response()->json(['message' => 'adoptaversary column added to dogs table.']);
    }
    return response()->json(['message' => 'adoptaversary column already exists.']);
});

// Temporary: fix dogs.size enum to include toy and xl (REMOVE after running)
Route::get('/fix-dog-size-enum-9x7k', function () {
    try {
        // Change size from ENUM to VARCHAR so any value works
        \Illuminate\Support\Facades\DB::statement(
            "ALTER TABLE dogs MODIFY COLUMN size VARCHAR(20) NULL"
        );
        return response()->json(['message' => 'dogs.size changed to VARCHAR(20) — toy, xl, etc. now accepted.']);
    } catch (\Throwable $e) {
        return response()->json(['error' => $e->getMessage()], 500);
    }
});

// Temporary: add notify columns to users table for admin prefs (REMOVE after running)
Route::get('/add-user-notify-cols-9x7k', function () {
    \App\Models\User::ensureNotifyColumns();
    return response()->json(['message' => 'notify_app, notify_email, notify_sms added to users table.']);
});

// Temporary: add assigned_to to template fields + countersign columns (REMOVE after running)
Route::get('/add-signing-cols-9x7k', function () {
    $results = [];
    if (!\Illuminate\Support\Facades\Schema::hasColumn('document_template_fields', 'assigned_to')) {
        \Illuminate\Support\Facades\Schema::table('document_template_fields', function ($t) {
            $t->string('assigned_to', 20)->default('client')->after('field_type');
        });
        $results[] = 'added assigned_to to document_template_fields';
    }
    $countersignCols = ['countersign_token', 'countersigned_at', 'countersigner_name', 'countersigner_ip', 'countersign_signature_data', 'countersign_field_values'];
    foreach ($countersignCols as $col) {
        if (!\Illuminate\Support\Facades\Schema::hasColumn('client_documents', $col)) {
            \Illuminate\Support\Facades\Schema::table('client_documents', function ($t) use ($col) {
                if ($col === 'countersigned_at') $t->timestamp($col)->nullable();
                elseif ($col === 'countersign_field_values') $t->json($col)->nullable();
                elseif ($col === 'countersign_signature_data') $t->longText($col)->nullable();
                else $t->string($col, 255)->nullable();
            });
            $results[] = "added $col to client_documents";
        }
    }
    // Expand type ENUM to include 'document'
    try {
        \Illuminate\Support\Facades\DB::statement("ALTER TABLE client_documents MODIFY COLUMN type ENUM('vaccination_record','vet_record','service_agreement','liability_waiver','intake_form','other','document') NOT NULL DEFAULT 'other'");
        $results[] = 'expanded type ENUM to include document';
    } catch (\Throwable $e) {
        $results[] = 'type ENUM update skipped: ' . $e->getMessage();
    }

    // first_viewed_at for document view tracking
    if (!\Illuminate\Support\Facades\Schema::hasColumn('client_documents', 'first_viewed_at')) {
        \Illuminate\Support\Facades\Schema::table('client_documents', function ($t) {
            $t->timestamp('first_viewed_at')->nullable();
        });
        $results[] = 'added first_viewed_at to client_documents';
    }
    return response()->json(['results' => $results ?: ['all columns already exist']]);
});

// Temporary: create email_logs and error_logs tables (REMOVE after running)
Route::get('/create-log-tables-9x7k', function () {
    $results = [];
    try {
        if (!\Illuminate\Support\Facades\Schema::hasTable('email_logs')) {
            \Illuminate\Support\Facades\DB::statement("
                CREATE TABLE email_logs (
                    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    user_id BIGINT UNSIGNED NULL,
                    to_email VARCHAR(255) NOT NULL,
                    subject VARCHAR(500) NOT NULL,
                    mail_class VARCHAR(100) NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'sent',
                    error_message TEXT NULL,
                    resend_id VARCHAR(100) NULL,
                    created_at TIMESTAMP NULL,
                    INDEX email_logs_user_id_index (user_id),
                    INDEX email_logs_status_index (status),
                    INDEX email_logs_created_at_index (created_at)
                )
            ");
            $results[] = 'email_logs table created';
        } else {
            $results[] = 'email_logs already exists';
        }

        if (!\Illuminate\Support\Facades\Schema::hasTable('error_logs')) {
            \Illuminate\Support\Facades\DB::statement("
                CREATE TABLE error_logs (
                    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    user_id BIGINT UNSIGNED NULL,
                    type VARCHAR(100) NOT NULL,
                    message TEXT NOT NULL,
                    context JSON NULL,
                    url VARCHAR(500) NULL,
                    ip_address VARCHAR(45) NULL,
                    created_at TIMESTAMP NULL,
                    INDEX error_logs_type_index (type),
                    INDEX error_logs_created_at_index (created_at)
                )
            ");
            $results[] = 'error_logs table created';
        } else {
            $results[] = 'error_logs already exists';
        }

        return response()->json(['message' => 'Done', 'results' => $results]);
    } catch (\Throwable $e) {
        return response()->json(['error' => $e->getMessage(), 'results' => $results], 500);
    }
});

// Temporary: create document tables (REMOVE after running)
Route::get('/create-document-tables-9x7k', function () {
    $results = [];
    try {
        // 1. Create client_documents if missing
        if (!\Illuminate\Support\Facades\Schema::hasTable('client_documents')) {
            \Illuminate\Support\Facades\DB::statement("
                CREATE TABLE client_documents (
                    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    user_id BIGINT UNSIGNED NOT NULL,
                    dog_id BIGINT UNSIGNED NULL,
                    type ENUM('vaccination_record','vet_record','service_agreement','liability_waiver','intake_form','other') NOT NULL,
                    filename VARCHAR(255) NOT NULL,
                    mime_type VARCHAR(255) NOT NULL,
                    size_bytes INT UNSIGNED NOT NULL,
                    storage_path VARCHAR(255) NOT NULL,
                    uploaded_by ENUM('admin','client') NOT NULL DEFAULT 'client',
                    signature_requested_at TIMESTAMP NULL,
                    signature_token VARCHAR(64) NULL,
                    signed_at TIMESTAMP NULL,
                    signer_name VARCHAR(255) NULL,
                    signer_ip VARCHAR(255) NULL,
                    signature_data LONGTEXT NULL,
                    signed_pdf_path VARCHAR(255) NULL,
                    created_at TIMESTAMP NULL,
                    updated_at TIMESTAMP NULL,
                    CONSTRAINT client_documents_user_id_foreign FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    CONSTRAINT client_documents_dog_id_foreign FOREIGN KEY (dog_id) REFERENCES dogs(id) ON DELETE SET NULL,
                    UNIQUE KEY client_documents_signature_token_unique (signature_token)
                )
            ");
            $results[] = 'client_documents table created';
        } else {
            // Add signature columns if missing
            if (!\Illuminate\Support\Facades\Schema::hasColumn('client_documents', 'signature_requested_at')) {
                \Illuminate\Support\Facades\DB::statement("ALTER TABLE client_documents ADD COLUMN signature_requested_at TIMESTAMP NULL AFTER uploaded_by");
                \Illuminate\Support\Facades\DB::statement("ALTER TABLE client_documents ADD COLUMN signature_token VARCHAR(64) NULL AFTER signature_requested_at");
                \Illuminate\Support\Facades\DB::statement("ALTER TABLE client_documents ADD COLUMN signed_at TIMESTAMP NULL AFTER signature_token");
                \Illuminate\Support\Facades\DB::statement("ALTER TABLE client_documents ADD COLUMN signer_name VARCHAR(255) NULL AFTER signed_at");
                \Illuminate\Support\Facades\DB::statement("ALTER TABLE client_documents ADD COLUMN signer_ip VARCHAR(255) NULL AFTER signer_name");
                \Illuminate\Support\Facades\DB::statement("ALTER TABLE client_documents ADD COLUMN signature_data LONGTEXT NULL AFTER signer_ip");
                \Illuminate\Support\Facades\DB::statement("ALTER TABLE client_documents ADD COLUMN signed_pdf_path VARCHAR(255) NULL AFTER signature_data");
                $results[] = 'signature columns added to client_documents';
            }
            $results[] = 'client_documents already exists';
        }

        // 2. Create document_templates if missing
        if (!\Illuminate\Support\Facades\Schema::hasTable('document_templates')) {
            \Illuminate\Support\Facades\DB::statement("
                CREATE TABLE document_templates (
                    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    description TEXT NULL,
                    pdf_storage_path VARCHAR(255) NOT NULL,
                    pdf_filename VARCHAR(255) NOT NULL,
                    page_count INT UNSIGNED NOT NULL DEFAULT 1,
                    created_by BIGINT UNSIGNED NULL,
                    created_at TIMESTAMP NULL,
                    updated_at TIMESTAMP NULL,
                    CONSTRAINT document_templates_created_by_foreign FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
                )
            ");
            $results[] = 'document_templates table created';
        } else {
            $results[] = 'document_templates already exists';
        }

        // 3. Create document_template_fields if missing
        if (!\Illuminate\Support\Facades\Schema::hasTable('document_template_fields')) {
            \Illuminate\Support\Facades\DB::statement("
                CREATE TABLE document_template_fields (
                    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    template_id BIGINT UNSIGNED NOT NULL,
                    label VARCHAR(255) NOT NULL,
                    field_type VARCHAR(50) NOT NULL,
                    page INT UNSIGNED NOT NULL DEFAULT 1,
                    x DECIMAL(8,2) NOT NULL DEFAULT 0,
                    y DECIMAL(8,2) NOT NULL DEFAULT 0,
                    width DECIMAL(8,2) NOT NULL DEFAULT 20,
                    height DECIMAL(8,2) NOT NULL DEFAULT 5,
                    required TINYINT(1) NOT NULL DEFAULT 1,
                    sort_order INT UNSIGNED NOT NULL DEFAULT 0,
                    default_value VARCHAR(255) NULL,
                    created_at TIMESTAMP NULL,
                    updated_at TIMESTAMP NULL,
                    CONSTRAINT dtf_template_id_foreign FOREIGN KEY (template_id) REFERENCES document_templates(id) ON DELETE CASCADE
                )
            ");
            $results[] = 'document_template_fields table created';
        } else {
            $results[] = 'document_template_fields already exists';
        }

        // 4. Add template columns to client_documents if missing
        if (!\Illuminate\Support\Facades\Schema::hasColumn('client_documents', 'template_id')) {
            \Illuminate\Support\Facades\DB::statement("ALTER TABLE client_documents ADD COLUMN template_id BIGINT UNSIGNED NULL AFTER uploaded_by");
            \Illuminate\Support\Facades\DB::statement("ALTER TABLE client_documents ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'draft' AFTER template_id");
            \Illuminate\Support\Facades\DB::statement("ALTER TABLE client_documents ADD COLUMN field_values JSON NULL AFTER status");
            \Illuminate\Support\Facades\DB::statement("ALTER TABLE client_documents ADD COLUMN sent_at TIMESTAMP NULL AFTER field_values");
            \Illuminate\Support\Facades\DB::statement("ALTER TABLE client_documents ADD COLUMN expires_at TIMESTAMP NULL AFTER sent_at");
            $results[] = 'template columns added to client_documents';
        } else {
            $results[] = 'template columns already exist on client_documents';
        }

        return response()->json(['message' => 'Done', 'results' => $results]);
    } catch (\Throwable $e) {
        return response()->json(['error' => $e->getMessage(), 'results' => $results], 500);
    }
});

// ── Public ───────────────────────────────────────────────────────────────────
Route::post('/auth/login',          [AuthController::class, 'login']);
Route::post('/auth/forgot-password',[AuthController::class, 'forgotPassword']);
Route::post('/auth/reset-password', [AuthController::class, 'resetPassword']);
Route::post('/webhooks/stripe',     [StripeWebhookController::class, 'handle']);
Route::post('/webhooks/email',      [\App\Http\Controllers\InboundEmailController::class, 'handle']);
Route::post('/contact',             [ContactController::class, 'submit']);

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

        // Intake form
        Route::get('/clients/{client}/intake',           [IntakeController::class, 'show']);
        Route::put('/clients/{client}/intake',           [IntakeController::class, 'save']);
        Route::post('/clients/{client}/intake/save',     [IntakeController::class, 'save']);
        Route::post('/clients/{client}/intake/submit',   [IntakeController::class, 'submit']);

        // Document signing
        Route::post('/clients/{client}/documents/{document}/request-signature', [\App\Http\Controllers\SigningController::class, 'request']);
        Route::get('/clients/{client}/documents/{document}/certificate',         [\App\Http\Controllers\SigningController::class, 'certificate']);

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
        Route::get('/appointments',                          [Admin\AppointmentController::class, 'index']);
        Route::post('/appointments',                         [Admin\AppointmentController::class, 'store']);
        Route::get('/appointments/{appointment}',            [Admin\AppointmentController::class, 'show']);
        Route::patch('/appointments/{appointment}',          [Admin\AppointmentController::class, 'update']);
        Route::delete('/appointments/{appointment}',         [Admin\AppointmentController::class, 'destroy']);
        Route::post('/appointments/{appointment}/check-in',  [Admin\AppointmentController::class, 'checkIn']);
        Route::post('/appointments/{appointment}/complete',  [Admin\AppointmentController::class, 'complete']);
        Route::get('/appointments/{appointment}/report',     [Admin\AppointmentController::class, 'report']);
        Route::patch('/appointments/{appointment}/report',   [Admin\AppointmentController::class, 'updateReport']);

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
        Route::post('/invoices/{invoice}/discount',  [Admin\InvoiceController::class, 'applyDiscount']);
        Route::post('/invoices/{invoice}/send',      [Admin\InvoiceController::class, 'send']);
        Route::post('/invoices/{invoice}/resend',   [Admin\InvoiceController::class, 'resend']);
        Route::post('/invoices/{invoice}/reminder', [Admin\InvoiceController::class, 'sendReminder']);
        Route::get('/invoices/{invoice}/pdf',       [Admin\InvoiceController::class, 'pdf']);

        // Report cards
        Route::get('/report-cards',                                [AdminReportCardController::class, 'index']);
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
        Route::get('/time-mileage/appointment/{appointment}', [Admin\TimeMileageController::class, 'appointmentMileage']);

        // Report exports
        Route::get('/reports/export',        [Admin\ReportExportController::class, 'export']);
        Route::get('/reports/walk-history',  [Admin\ReportExportController::class, 'walkHistory']);
        Route::get('/reports/billing',       [Admin\ReportExportController::class, 'billingHistory']);

        // Audit logs
        Route::get('/audit-logs', [Admin\AuditLogController::class, 'index']);

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
        Route::get('/invoices/{invoice}/pdf',        [Client\InvoiceController::class, 'pdf']);
        Route::post('/invoices/{invoice}/pay',       [Client\InvoiceController::class, 'pay']);
        Route::post('/invoices/{invoice}/tip',       [Client\InvoiceController::class, 'tip']);
        Route::post('/billing/setup-intent',         [Client\InvoiceController::class, 'setupIntent']);
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
