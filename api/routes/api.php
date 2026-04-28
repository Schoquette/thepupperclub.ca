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

    // ── Admin ─────────────────────────────────────────────────────────────────
    Route::middleware('role:admin')->prefix('admin')->group(function () {
        Route::get('/dashboard', [Admin\DashboardController::class, 'index']);

        // Clients
        Route::get('/clients/pending',                  [Admin\ClientController::class, 'pending']);
        Route::post('/clients/invite',                  [Admin\ClientController::class, 'invite']);
        Route::post('/clients/create-draft',            [Admin\ClientController::class, 'createDraft']);
        Route::get('/clients',                          [Admin\ClientController::class, 'index']);
        Route::get('/clients/{client}',                 [Admin\ClientController::class, 'show']);
        Route::patch('/clients/{client}',               [Admin\ClientController::class, 'update']);
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
        Route::post('/documents/{document}/send',                [Admin\DocumentTemplateController::class, 'sendForSigning']);

        // Dogs
        Route::get('/dogs',         [Admin\DogController::class, 'index']);
        Route::post('/dogs',        [Admin\DogController::class, 'store']);
        Route::get('/dogs/{dog}',          [Admin\DogController::class, 'show']);
        Route::patch('/dogs/{dog}',        [Admin\DogController::class, 'update']);
        Route::post('/dogs/{dog}/photo',   [Admin\DogController::class, 'uploadPhoto']);
        Route::get('/dogs/{dog}/photo',    [Admin\DogController::class, 'servePhoto']);
        Route::delete('/dogs/{dog}/photo', [Admin\DogController::class, 'deletePhoto']);

        // Appointments
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
        Route::post('/intake/submit',                [Client\IntakeController::class, 'submit']);
        Route::get('/home-access',                   [Client\ProfileController::class, 'homeAccess']);
        Route::patch('/home-access',                 [Client\ProfileController::class, 'updateHomeAccess']);

        // Dogs & Documents
        Route::get('/dogs',                          [Client\DogController::class, 'index']);
        Route::post('/dogs',                         [Client\DogController::class, 'store']);
        Route::patch('/dogs/{dog}',                  [Client\DogController::class, 'update']);
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
        Route::get('/service-requests',              [Client\AppointmentController::class, 'serviceRequests']);
        Route::post('/service-requests',             [Client\AppointmentController::class, 'storeServiceRequest']);

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
