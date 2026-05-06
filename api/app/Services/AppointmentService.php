<?php

namespace App\Services;

use App\Models\Appointment;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;

class AppointmentService
{
    private const BUFFER_MINUTES = 15;
    private const MAX_PER_BLOCK  = 3;

    /**
     * Parse a datetime string, always interpreting naive datetimes in Pacific time.
     */
    /**
     * Parse a time string, stripping any timezone info so the raw
     * local time is stored as-is in the database. The frontend always
     * sends and displays Pacific time, so no conversion is needed.
     */
    private function parseTime(string $time): Carbon
    {
        // Strip Z or offset so Carbon doesn't convert to UTC
        $clean = preg_replace('/[Zz]$|[+-]\d{2}:?\d{2}$/', '', $time);
        return Carbon::parse($clean);
    }

    public function create(array $data): Appointment
    {
        $scheduledTime = $this->parseTime($data['scheduled_time']);

        // Compare against Pacific "now" since all times are stored as naive Pacific
        $nowPacific = Carbon::now('America/Vancouver');
        $scheduledCheck = Carbon::parse($scheduledTime->format('Y-m-d H:i:s'), 'America/Vancouver');
        abort_if($scheduledCheck->lt($nowPacific), 422, 'Cannot schedule appointments in the past.');

        // Skip buffer/capacity checks if force flag is set (admin override)
        if (empty($data['force'])) {
            $this->validateBuffer($scheduledTime, null);
            $this->validateBlockCapacity($data['client_time_block'], $scheduledTime->toDateString());
        }

        if (!Schema::hasColumn('appointments', 'assigned_to')) {
            Schema::table('appointments', function (\Illuminate\Database\Schema\Blueprint $table) {
                $table->unsignedBigInteger('assigned_to')->nullable();
            });
        }
        $hasAssignedTo = true;

        // Accept both 'recurrence_rule' and 'recurrence' from frontend
        $recurrenceRule = $data['recurrence_rule'] ?? $data['recurrence'] ?? null;

        $fields = [
            'user_id'           => $data['user_id'],
            'service_type'      => $data['service_type'],
            'scheduled_time'    => $scheduledTime,
            'client_time_block' => $data['client_time_block'],
            'duration_minutes'  => $data['duration_minutes'] ?? 30,
            'notes'             => $data['notes'] ?? null,
            'recurrence_rule'   => $recurrenceRule,
        ];

        if ($hasAssignedTo) {
            $fields['assigned_to'] = $data['assigned_to'] ?? null;
        }

        $appointment = Appointment::create($fields);

        $appointment->dogs()->attach($data['dog_ids']);

        // Generate recurring children if rule provided
        if (!empty($recurrenceRule)) {
            $this->generateRecurring($appointment);
        }

        return $appointment;
    }

    public function update(Appointment $appointment, array $data, string $scope = 'single'): void
    {
        // Ensure scheduled_time is always parsed in Pacific timezone
        if (isset($data['scheduled_time'])) {
            $data['scheduled_time'] = $this->parseTime($data['scheduled_time']);
        }

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
        $maxOccurrences = $rule['end_after_count'] ?? $rule['occurrences'] ?? 999;
        $endDate   = isset($rule['end_date']) ? Carbon::parse($rule['end_date'])->endOfDay() : $upTo;
        $interval  = max(1, (int) ($rule['interval'] ?? 1));
        $daysOfWeek = $rule['days_of_week'] ?? [];

        // For "never" end type, cap at 6 months
        if (($rule['end_type'] ?? 'never') === 'never') {
            $maxOccurrences = 999;
        }

        while ($generated < $maxOccurrences) {
            $current = $this->nextOccurrence($current->copy(), $rule, $interval, $daysOfWeek);

            if ($current->gt($upTo) || $current->gt($endDate)) break;

            $childFields = [
                'user_id'              => $parent->user_id,
                'service_type'         => $parent->service_type,
                'scheduled_time'       => $current,
                'client_time_block'    => $parent->client_time_block,
                'duration_minutes'     => $parent->duration_minutes,
                'notes'                => $parent->notes,
                'recurrence_rule'      => null,
                'recurrence_parent_id' => $parent->id,
            ];

            if (Schema::hasColumn('appointments', 'assigned_to')) {
                $childFields['assigned_to'] = $parent->assigned_to;
            }

            $child = Appointment::create($childFields);

            $child->dogs()->attach($dogIds);
            $generated++;
        }
    }

    private function nextOccurrence(Carbon $from, array $rule, int $interval = 1, array $daysOfWeek = []): Carbon
    {
        $frequency = $rule['frequency'] ?? 'weekly';

        if ($frequency === 'weekly' && !empty($daysOfWeek)) {
            // For weekly with specific days: advance day-by-day to find the next matching day
            $dayMap = ['sun' => 0, 'mon' => 1, 'tue' => 2, 'wed' => 3, 'thu' => 4, 'fri' => 5, 'sat' => 6];
            $targetDays = array_map(fn($d) => $dayMap[$d] ?? $d, $daysOfWeek);
            $startOfWeek = $from->copy()->startOfWeek(Carbon::SUNDAY);
            $next = $from->copy()->addDay();

            // Try remaining days in this week first
            while ($next->lt($startOfWeek->copy()->addWeeks(1))) {
                if (in_array($next->dayOfWeek, $targetDays)) {
                    return $next;
                }
                $next->addDay();
            }

            // Jump ahead by (interval - 1) weeks then check each day of that week
            $next = $startOfWeek->copy()->addWeeks($interval);
            for ($d = 0; $d < 7; $d++) {
                $candidate = $next->copy()->addDays($d);
                if (in_array($candidate->dayOfWeek, $targetDays)) {
                    $candidate->setTime($from->hour, $from->minute, 0);
                    return $candidate;
                }
            }
        }

        return match ($frequency) {
            'daily'     => $from->addDays($interval),
            'weekly'    => $from->addWeeks($interval),
            'biweekly'  => $from->addWeeks(2),
            'monthly'   => $from->addMonths($interval),
            default     => $from->addWeeks($interval),
        };
    }
}
