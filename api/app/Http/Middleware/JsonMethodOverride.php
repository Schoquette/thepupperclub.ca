<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/**
 * Read _method from JSON request bodies so that PUT/PATCH/DELETE
 * can be tunnelled through POST (IIS strips bodies on those methods).
 */
class JsonMethodOverride
{
    public function handle(Request $request, Closure $next)
    {
        if (
            $request->isMethod('POST') &&
            $request->isJson() &&
            $request->input('_method')
        ) {
            $request->setMethod($request->input('_method'));
        }

        return $next($request);
    }
}
