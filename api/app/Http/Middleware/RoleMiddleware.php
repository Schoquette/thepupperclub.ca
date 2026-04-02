<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RoleMiddleware
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $userRole = $request->user()?->role;

        // Superadmin inherits admin access
        $effectiveRoles = $roles;
        if (in_array('admin', $roles)) {
            $effectiveRoles[] = 'superadmin';
        }

        if (!$userRole || !in_array($userRole, $effectiveRoles)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        return $next($request);
    }
}
