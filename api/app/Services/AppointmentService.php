<?php

namespace App\Services;

use App\Models\Appointment;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class AppointmentService
{
    private const BUFFER_MINUTES = 15;
    private const MAX_PER_BLOCK  = 3;

    public function create(array $data): Appointment
    {
        $scheduledTime = Carbon::parse($data['scheduled_time']);

        $this->validateBuffer($scheduledTime, null);
        $this->validateBlockCapacity($data['client_time_block'], $scheduledTime->toDateString());

        $appointment = Appointment::create([
            'user_id'           => $data['user_id'],
            'assigned_to'       => $data['assigned_to'] ?? null,
            'service_type'      => $data['service_type'],
            'scheduled_time'    => $scheduledTime,
            'client_time_block' => $data['client_time_block'],
            'duration_minutes'  => $data['duration_minutes'] ?? 30,
            'notes'             => $data['notes'] ?? null,
            'recurrence_rule'   => $data['recurrence_rule'] ?? null,
        ]);

        $appointment->dogs()->attach($data['dog_ids']);

        // Generate recurring children if rule provided
        if (!empty($data['recurrence_rule'])) {
            $this->generateRecurring($appointment);
        }

        return $appointment;
    }

    public function update(Appointment $appointment, array $data, string $scope = 'single'): void
    {
        if ($scope === 'future_all' && $appointment->recurrence_parent_id) {
            // Update this and all future siblings
            Appointment::where(function ($q) use ($appointment) {
                $q->where('id', $appointment->id)
                  ->orWhere(function ($q2) use ($appointment) {
                      $q2->where('recurrence_parent_id', $appointment->recurrence_parent_id)
                         ->where('scheduled_time', '>=', $appointment->scheduled_time);
                  });
            })->update($data);
        } else {
            $appointment->update($data);
        }
    }

    public function cancel(Appointment $appointment, string $scope = 'single'): void
    {
        if ($scope === 'future_all') {
            Appointment::where(function ($q) use ($appointment) {
                $q->where('id', $appointment->id)
                  ->orWhere(function ($q2) use ($appointment) {
                      $q2->where('recurrence_parent_id', $appointment->recurrence_parent_id ?? $appointment->id)
                         ->where('scheduled_time', '>=', $appointment->scheduled_time);
                  });
            })->update(['status' => 'cancelled']);
        } else {
            $appointment->update(['status' => 'cancelled']);
        }
    }

    private function validateBuffer(Carbon $scheduledTime, ?int $excludeId): void
    {
        $bufferStart = $scheduledTime->copy()->subMinutes(self::BUFFER_MINUTES);
        $bufferEnd   = $scheduledTime->copy()->addMinutes(self::BUFFER_MINUTES);

        $conflict = Appointment::whereIn('status', ['scheduled', 'checked_in'])
            ->whereBetween('scheduled_time', [$bufferStart, $bufferEnd])
            ->when($excludeId, fn($q) => $q->where('id', '!=', $excludeId))
            ->exists();

        abort_if($conflict, 422, "Appointment conflicts with 15-minute buffer window.");
    }

    private function validateBlockCapacity(string $timeBlock, string $date): void
    {
        $count = Appointment::whereDate('scheduled_time', $date)
            ->where('client_time_block', $timeBlock)
            ->whereIn('status', ['scheduled', 'checked_in'])
            ->count();

        abort_if($count >= self::MAX_PER_BLOCK, 422, "Time block '{$timeBlock}' is fully booked for {$date}.");
    }

    public function generateRecurring(Appointment $parent, ?string $upTo = null): void
    {
        $rule = $parent->recurrence_rule;
        if (!$rule) return;

        $upTo      = $upTo ? Carbon::parse($upTo) : Carbon::now()->addMonths(6);
        $current   = Carbon::parse($parent->scheduled_time);
        $dogIds    = $parent->dogs->pluck('id')->all();
        $generated = 0;
        $maxOccurrences = $rule['occurrences'] ?? 999;
        $endDate   = isset($rule['end_date']) ? Carbon::parse($rule['end_date']) : $upTo;

        while ($generated < $maxOccurrences) {
            $current = $this->nextOccurrence($current, $rule);

            if ($current->gt($upTo) || $current->gt($endDate)) break;

            $child = Appointment::create([
                'user_id'              => $parent->user_id,
                'assigned_to'          => $parent->assigned_to,
                'service_type'         => $parent->service_type,
                'scheduled_time'       => $current,
                'client_time_block'    => $parent->client_time_block,
                'duration_minutes'     => $parent->duration_minutes,
                'notes'                => $parent->notes,
                'recurrence_rule'      => null,
                'recurrence_parent_id' => $parent->id,
            ]);

            $child->dogs()->attach($dogIds);
            $generated++;
        }
    }

    private function nextOccurrence(Carbon $from, array $rule): Carbon
    {
        return match ($rule['frequency']) {
            'daily'     => $from->addDay(),
            'weekly'    => $from->addWeek(),
            'biweekly'  => $from->addWeeks(2),
            'monthly'   => $from->addMonth(),
            default     => $from->addWeek(),
        };
    }
}
