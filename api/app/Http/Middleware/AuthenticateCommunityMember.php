<?php

namespace App\Http\Middleware;

use App\Models\CommunityMember;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateCommunityMember
{
    public function handle(Request $request, Closure $next): Response
    {
        $header = $request->bearerToken();
        if (!$header) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $member = CommunityMember::findByPlainToken($header);
        if (!$member) {
            return response()->json(['message' => 'Invalid or expired token.'], 401);
        }

        if (in_array($member->status, ['suspended', 'closed'], true)) {
            return response()->json(['message' => 'Account is no longer active.'], 403);
        }

        // Bind the member onto the request so controllers can read it cleanly.
        $request->attributes->set('community_member', $member);

        return $next($request);
    }
}
