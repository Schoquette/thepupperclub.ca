<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Dog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Dog::with(['user', 'vaccinationRecords'])
            ->when($request->user_id, fn($q) => $q->where('user_id', $request->user_id))
            ->when($request->active !== null, fn($q) => $q->where('is_active', $request->boolean('active')));

        return response()->json($query->paginate(50));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $dog = Dog::create($data);

        return response()->json(['data' => $dog->load('vaccinationRecords')], 201);
    }

    public function show(Dog $dog): JsonResponse
    {
        return response()->json(['data' => $dog->load(['user', 'vaccinationRecords'])]);
    }

    public function update(Request $request, Dog $dog): JsonResponse
    {
        $data = $this->validated($request);
        $dog->update($data);

        return response()->json(['data' => $dog->fresh('vaccinationRecords')]);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'user_id'            => 'required|exists:users,id',
            'name'               => 'required|string|max:100',
            'breed'              => 'nullable|string|max:100',
            'date_of_birth'      => 'nullable|date',
            'size'               => 'nullable|in:small,medium,large,extra_large',
            'sex'                => 'nullable|in:male,female',
            'weight_kg'          => 'nullable|numeric|min:0',
            'colour'             => 'nullable|string|max:100',
            'microchip_number'   => 'nullable|string|max:50',
            'spayed_neutered'    => 'boolean',
            'bite_history'       => 'boolean',
            'bite_history_notes' => 'nullable|string',
            'aggression_notes'   => 'nullable|string',
            'vet_name'           => 'nullable|string|max:255',
            'vet_phone'          => 'nullable|string|max:20',
            'vet_address'        => 'nullable|string|max:255',
            'medications'        => 'nullable|array',
            'medications.*.name'      => 'required|string',
            'medications.*.dosage'    => 'required|string',
            'medications.*.frequency' => 'required|string',
            'medications.*.notes'     => 'nullable|string',
            'special_instructions'   => 'nullable|string',
            'is_active'          => 'boolean',
        ]);
    }
}
