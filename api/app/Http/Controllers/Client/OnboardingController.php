<?php

namespace App\Http\Controllers\Client;

use App\Http\Controllers\Controller;
use App\Models\OnboardingStep;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OnboardingController extends Controller
{
    public function status(Request $request): JsonResponse
    {
        $user  = $request->user();
        $steps = OnboardingStep::allSteps();

        $completedSteps = $user->onboardingSteps()
            ->whereNotNull('completed_at')
            ->pluck('completed_at', 'step')
            ->all();

        $status = collect($steps)->mapWithKeys(fn($step) => [
            $step => [
                'completed'    => isset($completedSteps[$step]),
                'completed_at' => $completedSteps[$step] ?? null,
            ],
        ]);

        $nextStep = collect($steps)->first(fn($s) => !isset($completedSteps[$s]));
        $allDone  = $nextStep === null;

        return response()->json([
            'data' => [
                'steps'      => $status,
                'next_step'  => $nextStep,
                'completed'  => $allDone,
            ],
        ]);
    }

    public function completeStep(Request $request, string $step): JsonResponse
    {
        abort_unless(in_array($step, OnboardingStep::allSteps()), 404, 'Invalid step.');

        $request->user()->onboardingSteps()->updateOrCreate(
            ['step' => $step],
            ['completed_at' => now()]
        );

        // If all steps complete, mark onboarding done on profile
        $completed = $request->user()->onboardingSteps()->whereNotNull('completed_at')->count();
        if ($completed === count(OnboardingStep::allSteps())) {
            $request->user()->clientProfile()->update(['onboarding_completed_at' => now()]);
        }

        return response()->json(['message' => "Step '{$step}' marked complete."]);
    }
}
