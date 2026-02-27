<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $logs = AuditLog::with('user')
            ->when($request->action,     fn($q) => $q->where('action', $request->action))
            ->when($request->model_type, fn($q) => $q->where('model_type', 'like', "%{$request->model_type}%"))
            ->when($request->user_id,    fn($q) => $q->where('user_id', $request->user_id))
            ->orderBy('created_at', 'desc')
            ->paginate(50);

        return response()->json($logs);
    }
}
