<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__ . '/../routes/api.php',
        commands: __DIR__ . '/../routes/console.php',
        health: '/up',
        apiPrefix: 'api',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->prepend(\App\Http\Middleware\JsonMethodOverride::class);
        $middleware->alias([
            'role' => \App\Http\Middleware\RoleMiddleware::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->render(function (\Illuminate\Auth\AuthenticationException $e, Request $request) {
            // This app is API-only (apiPrefix: 'api', no web login view/
            // named 'login' route exists at all). Laravel's default auth
            // middleware falls back to redirecting to route('login') when
            // the request doesn't look like it "expects JSON" (e.g. an
            // Accept header of application/octet-stream, as used by the
            // backup-download curl call) — with no such route registered,
            // that redirect attempt itself throws RouteNotFoundException,
            // masking every failed-auth request on /api/* as an opaque
            // 500 instead of a clean 401.
            if ($request->expectsJson() || $request->is('api/*')) {
                return response()->json(['message' => 'Unauthenticated.'], 401);
            }
        });

        $exceptions->render(function (\Illuminate\Auth\Access\AuthorizationException $e, Request $request) {
            if ($request->expectsJson()) {
                return response()->json(['message' => 'Forbidden.'], 403);
            }
        });

        $exceptions->render(function (\Illuminate\Validation\ValidationException $e, Request $request) {
            if ($request->expectsJson()) {
                return response()->json([
                    'message' => $e->getMessage(),
                    'errors'  => $e->errors(),
                ], 422);
            }
        });

        $exceptions->render(function (\Illuminate\Database\Eloquent\ModelNotFoundException $e, Request $request) {
            if ($request->expectsJson()) {
                return response()->json(['message' => 'Not found.'], 404);
            }
        });

        // Log all API errors to error_logs table
        $exceptions->report(function (\Throwable $e) {
            try {
                if (!\Illuminate\Support\Facades\Schema::hasTable('error_logs')) return;
                // Skip validation and auth errors
                if ($e instanceof \Illuminate\Validation\ValidationException) return;
                if ($e instanceof \Illuminate\Auth\AuthenticationException) return;
                if ($e instanceof \Illuminate\Database\Eloquent\ModelNotFoundException) return;

                \App\Models\ErrorLog::create([
                    'user_id'    => auth()->id(),
                    'type'       => class_basename($e),
                    'message'    => \Illuminate\Support\Str::limit($e->getMessage(), 1000),
                    'context'    => [
                        'file'  => $e->getFile() . ':' . $e->getLine(),
                        'trace' => \Illuminate\Support\Str::limit($e->getTraceAsString(), 2000),
                    ],
                    'url'        => request()->fullUrl(),
                    'ip_address' => request()->ip(),
                    'created_at' => now(),
                ]);
            } catch (\Throwable $logError) {
                // Don't let error logging break the app
            }
        })->stop(false);
    })->create();
