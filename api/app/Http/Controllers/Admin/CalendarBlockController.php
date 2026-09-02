<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CalendarBlock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CalendarBlockController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = CalendarBlock::with('assignedAdmin:id,name')
            ->when($request->start, fn($q) => $q->where('scheduled_time', '>=', $request->start))
            ->when($request->end, fn($q) => $q->where('scheduled_time', '<=', $request->end))
            ->when($request->assigned_to, fn($q) => $q->where('assigned_to', $request->assigned_to))
            ->orderBy('scheduled_time');

        return response()->json(['data' => $query->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title'             => 'required|string|max:255',
            'location'          => 'nullable|string|max:255',
            'scheduled_time'    => 'required|date',
            'duration_minutes'  => 'required|integer|min:5|max:10080',
            'assigned_to'       => 'nullable|exists:users,id',
            'notes'             => 'nullable|string|max:2000',
        ]);

        $data['created_by'] = $request->user()->id;

        $block = CalendarBlock::create($data);

        return response()->json(['data' => $block->load('assignedAdmin:id,name')], 201);
    }

    public function update(Request $request, CalendarBlock $calendarBlock): JsonResponse
    {
        $data = $request->validate([
            'title'             => 'sometimes|string|max:255',
            'location'          => 'sometimes|nullable|string|max:255',
            'scheduled_time'    => 'sometimes|date',
            'duration_minutes'  => 'sometimes|integer|min:5|max:10080',
            'assigned_to'       => 'sometimes|nullable|exists:users,id',
            'notes'             => 'sometimes|nullable|string|max:2000',
        ]);

        $calendarBlock->update($data);

        return response()->json(['data' => $calendarBlock->load('assignedAdmin:id,name')]);
    }

    public function destroy(CalendarBlock $calendarBlock): JsonResponse
    {
        $calendarBlock->delete();

        return response()->json(['message' => 'Block deleted.']);
    }
}
