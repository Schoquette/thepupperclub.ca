<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Dog;
use App\Models\VaccinationRecord;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VaccinationController extends Controller
{
    public function index(Dog $dog): JsonResponse
    {
        return response()->json([
            'data' => $dog->vaccinationRecords()->orderBy('expiry_date')->get(),
        ]);
    }

    public function store(Request $request, Dog $dog): JsonResponse
    {
        $data = $request->validate([
            'vaccine_name'      => 'required|string|max:255',
            'administered_date' => 'required|date',
            'expiry_date'       => 'nullable|date|after_or_equal:administered_date',
        ]);

        $record = $dog->vaccinationRecords()->create($data);

        return response()->json(['data' => $record], 201);
    }

    public function destroy(Dog $dog, VaccinationRecord $record): JsonResponse
    {
        abort_unless((int) $record->dog_id === (int) $dog->id, 404, 'Record not found.');
        $record->delete();

        return response()->json(['message' => 'Deleted.']);
    }
}
