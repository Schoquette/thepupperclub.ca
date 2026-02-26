<?php

namespace App\Http\Controllers\Client;

use App\Http\Controllers\Controller;
use App\Models\ServiceRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AppointmentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $appointments = $request->user()
            ->appointments()
            ->with('dogs')
            ->when($request->upcoming, fn($q) => $q->where('scheduled_time', '>=', now()))
            ->orderBy('scheduled_time')
            ->get()
            ->map(function ($appt) {
                // Strip exact scheduled_time — client only sees time block
                return array_merge($appt->toArray(), ['scheduled_time' => null]);
            });

        return response()->json(['data' => $appointments]);
    }

    public function serviceRequests(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $request->user()->serviceRequests()->with('dogs')->orderBy('created_at', 'desc')->get(),
        ]);
    }

    public function storeServiceRequest(Request $request): JsonResponse
    {
        $data = $request->validate([
            'service_type'        => 'required|in:walk_30,walk_60,drop_in,overnight,day_boarding',
            'preferred_time_block'=> 'required|in:early_morning,morning,midday,afternoon,evening',
            'preferred_date'      => 'required|date|after:today',
            'notes'               => 'nullable|string',
            'dog_ids'             => 'required|array|min:1',
            'dog_ids.*'           => 'exists:dogs,id',
        ]);

        $user = $request->user();

        // Verify all dogs belong to this client
        $validDogIds = $user->dogs()->whereIn('id', $data['dog_ids'])->pluck('id');
        abort_unless($validDogIds->count() === count($data['dog_ids']), 403, 'Invalid dog IDs.');

        $sr = ServiceRequest::create([
            'user_id'             => $user->id,
            'service_type'        => $data['service_type'],
            'preferred_time_block'=> $data['preferred_time_block'],
            'preferred_date'      => $data['preferred_date'],
            'notes'               => $data['notes'] ?? null,
        ]);

        $sr->dogs()->attach($data['dog_ids']);

        return response()->json(['data' => $sr->load('dogs')], 201);
    }
}
