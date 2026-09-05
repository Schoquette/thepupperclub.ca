<?php

namespace App\Services;

use App\Models\CalendarBlock;
use Carbon\Carbon;

class CalendarBlockService
{
    public function create(array $data): CalendarBlock
    {
        $recurrenceRule = $data['recurrence'] ?? null;

        $block = CalendarBlock::create([
            'title'             => $data['title'],
            'location'          => $data['location'] ?? null,
            'scheduled_time'    => $data['scheduled_time'],
            'duration_minutes'  => $data['duration_minutes'],
            'assigned_to'       => $data['assigned_to'] ?? null,
            'created_by'        => $data['created_by'] ?? null,
            'notes'             => $data['notes'] ?? null,
            'recurrence_rule'   => $recurrenceRule,
        ]);

        if (!empty($recurrenceRule)) {
            $this->generateRecurring($block);
        }

        return $block;
    }

    public function update(CalendarBlock $block, array $data, string $scope = 'single'): void
    {
        if ($scope === 'future_all' && $block->recurrence_parent_id) {
            CalendarBlock::where(function ($q) use ($block) {
                $q->where('id', $block->id)
                  ->orWhere(function ($q2) use ($block) {
                      $q2->where('recurrence_parent_id', $block->recurrence_parent_id)
                         ->where('scheduled_time', '>=', $block->scheduled_time);
                  });
            })->update($data);
        } else {
            $block->update($data);
        }
    }

    public function delete(CalendarBlock $block, string $scope = 'single'): void
    {
        if ($scope === 'future_all') {
            CalendarBlock::where(function ($q) use ($block) {
                $q->where('id', $block->id)
                  ->orWhere(function ($q2) use ($block) {
                      $q2->where('recurrence_parent_id', $block->recurrence_parent_id ?? $block->id)
                         ->where('scheduled_time', '>=', $block->scheduled_time);
                  });
            })->each(fn ($b) => $b->delete());
        } else {
            $block->delete();
        }
    }

    public function generateRecurring(CalendarBlock $parent, ?string $upTo = null): void
    {
        $rule = $parent->recurrence_rule;
        if (!$rule) return;

        $upTo     = $upTo ? Carbon::parse($upTo) : Carbon::now()->addMonths(6);
        $current  = Carbon::parse($parent->scheduled_time);
        $generated = 0;
        $maxOccurrences = $rule['end_after_count'] ?? $rule['occurrences'] ?? 999;
        $endDate  = isset($rule['end_date']) ? Carbon::parse($rule['end_date'])->endOfDay() : $upTo;
        $interval = max(1, (int) ($rule['interval'] ?? 1));
        $daysOfWeek = $rule['days_of_week'] ?? [];

        if (($rule['end_type'] ?? 'never') === 'never') {
            $maxOccurrences = 999;
        }

        while ($generated < $maxOccurrences) {
            $current = $this->nextOccurrence($current->copy(), $rule, $interval, $daysOfWeek);

            if ($current->gt($upTo) || $current->gt($endDate)) break;

            CalendarBlock::create([
                'title'                => $parent->title,
                'location'             => $parent->location,
                'scheduled_time'       => $current,
                'duration_minutes'     => $parent->duration_minutes,
                'assigned_to'          => $parent->assigned_to,
                'created_by'           => $parent->created_by,
                'notes'                => $parent->notes,
                'recurrence_rule'      => null,
                'recurrence_parent_id' => $parent->id,
            ]);

            $generated++;
        }
    }

    private function nextOccurrence(Carbon $from, array $rule, int $interval = 1, array $daysOfWeek = []): Carbon
    {
        $frequency = $rule['frequency'] ?? 'weekly';

        if ($frequency === 'weekly' && !empty($daysOfWeek)) {
            $dayMap = ['sun' => 0, 'mon' => 1, 'tue' => 2, 'wed' => 3, 'thu' => 4, 'fri' => 5, 'sat' => 6];
            $targetDays = array_map(fn($d) => $dayMap[$d] ?? $d, $daysOfWeek);
            $startOfWeek = $from->copy()->startOfWeek(Carbon::SUNDAY);
            $next = $from->copy()->addDay();

            while ($next->lt($startOfWeek->copy()->addWeeks(1))) {
                if (in_array($next->dayOfWeek, $targetDays)) {
                    return $next;
                }
                $next->addDay();
            }

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
            'daily'   => $from->addDays($interval),
            'weekly'  => $from->addWeeks($interval),
            'monthly' => $from->addMonths($interval),
            default   => $from->addWeeks($interval),
        };
    }
}
