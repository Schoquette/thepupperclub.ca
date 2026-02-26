<?php

use App\Http\Controllers\Admin;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Client;
use App\Http\Controllers\ConversationController;
use App\Http\Controllers\DocumentController;
use App\Http\Controllers\StripeWebhookController;
use Illuminate\Support\Facades\Route;

// ── Public ───────────────────────────────────────────────────────────────────
Route::post('/auth/login',          [AuthController::class, 'login']);
Route::post('/auth/forgot-password',[AuthController::class, 'forgotPassword']);
Route::post('/auth/reset-password', [AuthController::class, 'resetPassword']);
Route::post('/webhooks/stripe',     [StripeWebhookController::class, 'handle']);

// ── Authenticated ─────────────────────────────────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/auth/logout',      [AuthController::class, 'logout']);
    Route::get('/auth/me',           [AuthController::class, 'me']);
    Route::patch('/auth/set-password',[AuthController::class, 'setPassword']);
    Route::patch('/auth/push-token', [AuthController::class, 'updatePushToken']);

    // ── Admin ─────────────────────────────────────────────────────────────────
    Route::middleware('role:admin')->prefix('admin')->group(function () {
        Route::get('/dashboard', [Admin\DashboardController::class, 'index']);

        // Clients
        Route::get('/clients/pending',                  [Admin\ClientController::class, 'pending']);
        Route::post('/clients/invite',                  [Admin\ClientController::class, 'invite']);
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

        // Dogs
        Route::get('/dogs',         [Admin\DogController::class, 'index']);
        Route::post('/dogs',        [Admin\DogController::class, 'store']);
        Route::get('/dogs/{dog}',   [Admin\DogController::class, 'show']);
        Route::patch('/dogs/{dog}', [Admin\DogController::class, 'update']);

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
        Route::patch('/service-requests/{request}',   [Admin\ServiceRequestController::class, 'update']);

        // Invoices
        Route::get('/invoices/dashboard',         [Admin\InvoiceController::class, 'dashboard']);
        Route::get('/invoices',                   [Admin\InvoiceController::class, 'index']);
        Route::post('/invoices',                  [Admin\InvoiceController::class, 'store']);
        Route::get('/invoices/{invoice}',         [Admin\InvoiceController::class, 'show']);
        Route::patch('/invoices/{invoice}',       [Admin\InvoiceController::class, 'update']);
        Route::post('/invoices/{invoice}/mark-paid', [Admin\InvoiceController::class, 'markPaid']);
        Route::post('/invoices/{invoice}/send',   [Admin\InvoiceController::class, 'send']);
        Route::get('/invoices/{invoice}/pdf',     [Admin\InvoiceController::class, 'pdf']);

        // Notifications
        Route::post('/notifications/broadcast',   [Admin\NotificationController::class, 'broadcast']);
        Route::get('/notifications/history',      [Admin\NotificationController::class, 'history']);

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
        Route::get('/home-access',                   [Client\ProfileController::class, 'homeAccess']);
        Route::patch('/home-access',                 [Client\ProfileController::class, 'updateHomeAccess']);

        // Dogs & Documents
        Route::get('/dogs',                          [Client\DogController::class, 'index']);
        Route::post('/dogs',                         [Client\DogController::class, 'store']);
        Route::patch('/dogs/{dog}',                  [Client\DogController::class, 'update']);
        Route::get('/documents',                     [Client\DogController::class, 'documents']);
        Route::post('/documents',                    [Client\DogController::class, 'uploadDocument']);

        // Appointments & Service Requests
        Route::get('/appointments',                  [Client\AppointmentController::class, 'index']);
        Route::get('/service-requests',              [Client\AppointmentController::class, 'serviceRequests']);
        Route::post('/service-requests',             [Client\AppointmentController::class, 'storeServiceRequest']);

        // Invoices
        Route::get('/invoices',                      [Client\InvoiceController::class, 'index']);
        Route::post('/invoices/{invoice}/pay',       [Client\InvoiceController::class, 'pay']);
        Route::post('/invoices/{invoice}/tip',       [Client\InvoiceController::class, 'tip']);
    });

    // ── Shared: Document download (admin or document owner) ──────────────────
    Route::get('/documents/{document}', [DocumentController::class, 'serve'])->name('documents.serve');

    // ── Shared: Conversations (both roles access by client ID) ────────────────
    Route::get('/conversations/{clientId}',                              [ConversationController::class, 'thread']);
    Route::post('/conversations/{clientId}/messages',                    [ConversationController::class, 'sendMessage']);
    Route::patch('/conversations/{clientId}/messages/{message}/read',    [ConversationController::class, 'markRead']);
});
