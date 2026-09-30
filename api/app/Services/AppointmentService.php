<?php

namespace App\Services;

use App\Models\Appointment;
use App\Models\ClientProfile;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;

class AppointmentService
{
    public function __construct(private PaygPricingService $paygPricing) {}

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

        if (!Schema::hasColumn('appointments', 'assigned_to')) {
            Schema::table('appointments', function (\Illuminate\Database\Schema\Blueprint $table) {
                $table->unsignedBigInteger('assigned_to')->nullable();
            });
        }
        $hasAssignedTo = true;

        if (!Schema::hasColumn('appointments', 'group_hike_id')) {
            Schema::table('appointments', function (\Illuminate\Database\Schema\Blueprint $table) {
                $table->string('group_hike_id', 36)->nullable();
                $table->string('group_hike_name')->nullable();
            });
        }

        // Accept both 'recurrence_rule' and 'recurrence' from frontend
        $recurrenceRule = $data['recurrence_rule'] ?? $data['recurrence'] ?? null;

        // Group hikes: every participant is its own Appointment row, tied
        // together by a shared group_hike_id so the calendar can collapse
        // them into one tile and the admin can see the full roster. A
        // fresh id is minted the first time a pack_hike is created; joining
        // an existing hike passes the id through instead of generating one.
        $groupHikeId = $data['group_hike_id'] ?? null;
        if ($data['service_type'] === 'pack_hike' && !$groupHikeId) {
            $groupHikeId = (string) \Illuminate\Support\Str::uuid();
        }

        $fields = [
            'user_id'           => $data['user_id'],
            'service_type'      => $data['service_type'],
            'scheduled_time'    => $scheduledTime,
            'client_time_block' => $data['client_time_block'],
            'duration_minutes'  => $data['duration_minutes'] ?? 30,
            'notes'             => $data['notes'] ?? null,
            'recurrence_rule'   => $recurrenceRule,
            'group_hike_id'     => $groupHikeId,
            'group_hike_name'   => $groupHikeId ? ($data['group_hike_name'] ?? null) : null,
        ];

        if ($hasAssignedTo) {
            $fields['assigned_to'] = $data['assigned_to'] ?? null;
        }

        $appointment = Appointment::create($fields);
        $this->applyPaygCharge($appointment);

        $appointment->dogs()->attach($data['dog_ids']);

        // Generate recurring children if rule provided
        if (!empty($recurrenceRule)) {
            $this->generateRecurring($appointment);
        }

        return $appointment;
    }

    /**
     * Pay-As-You-Go accounting, stamped once at scheduling time (not at
     * check-in/completion) per the business rule: a prepaid pack depletes
     * as visits land on the calendar, including future recurring
     * occurrences that haven't happened yet. Balances are never
     * hand-incremented/decremented elsewhere — they're derived live from
     * these stamps, so cancelling a visit (soft-delete or status update)
     * automatically frees it up with no reversal code needed.
     */
    private function applyPaygCharge(Appointment $appointment): void
    {
        if (!in_array($appointment->service_type, PaygPricingService::VISIT_TYPES, true)) return;

        if (!Schema::hasColumn('appointments', 'payg_charge_mode')) {
            Schema::table('appointments', function (\Illuminate\Database\Schema\Blueprint $table) {
                $table->string('payg_charge_mode')->nullable();
                $table->decimal('payg_rate', 8, 2)->nullable();
                $table->timestamp('payg_billed_at')->nullable();
            });
        }

        $profile = ClientProfile::where('user_id', $appointment->user_id)->first();
        if (!$profile || empty($profile->payg_mode)) return;

        if ($profile->payg_mode === 'prepaid_pack') {
            $purchasedColumn = "pack_purchased_{$appointment->service_type}";
            $purchased = Schema::hasColumn('client_profiles', $purchasedColumn) ? (int) $profile->{$purchasedColumn} : 0;
            $used = Appointment::where('user_id', $appointment->user_id)
                ->where('service_type', $appointment->service_type)
                ->where('payg_charge_mode', 'pack')
                ->where('status', '!=', 'cancelled')
                ->where('id', '!=', $appointment->id)
                ->count();

            if ($purchased - $used > 0) {
                $appointment->update(['payg_charge_mode' => 'pack']);
                return;
            }
        }

        // per_visit mode, or a prepaid pack that's run dry — falls back
        // to running-tab billing at this client's resolved rate. Weekend
        // custom pricing (if set) applies to Saturday/Sunday visits.
        $isWeekend = $appointment->scheduled_time->isWeekend();
        $rate = $this->paygPricing->resolveRate($profile, $appointment->service_type, $isWeekend);
        $appointment->update(['payg_charge_mode' => 'running_tab', 'payg_rate' => $rate]);
    }

    /**
     * Query matching every row in $appointment's recurring series (the
     * parent plus all of its generated children), regardless of date.
     * Works whether $appointment itself is the parent or a child.
     */
    private function seriesQuery(Appointment $appointment)
    {
        $parentId = $appointment->recurrence_parent_id ?? $appointment->id;

        return Appointment::where(function ($q) use ($parentId) {
            $q->where('id', $parentId)->orWhere('recurrence_parent_id', $parentId);
        });
    }

    /**
     * Update a single appointment, this-and-future occurrences, or every
     * occurrence in the series ($scope: single|future_all|all).
     *
     * When scheduled_time changes under a multi-row scope, every matched
     * row is shifted by the same delta (preserving each occurrence's own
     * date) rather than overwritten to one absolute timestamp — otherwise
     * a "this and future" or "all" time edit would collapse every
     * occurrence onto the same instant.
     */
    public function update(Appointment $appointment, array $data, string $scope = 'single', ?array $dogIds = null): void
    {
        // Ensure scheduled_time is always parsed in Pacific timezone
        if (isset($data['scheduled_time'])) {
            $data['scheduled_time'] = $this->parseTime($data['scheduled_time']);
        }

        if ($scope !== 'future_all' && $scope !== 'all') {
            $appointment->update($data);
            if ($dogIds !== null) {
                $appointment->dogs()->sync($dogIds);
            }
            return;
        }

        $query = $this->seriesQuery($appointment);
        if ($scope === 'future_all') {
            $query->where('scheduled_time', '>=', $appointment->scheduled_time);
        }

        if (array_key_exists('scheduled_time', $data)) {
            $deltaSeconds = $data['scheduled_time']->getTimestamp() - $appointment->scheduled_time->getTimestamp();
            $rows = $query->get();
            foreach ($rows as $row) {
                $rowData = $data;
                $rowData['scheduled_time'] = $row->scheduled_time->copy()->addSeconds($deltaSeconds);
                $row->update($rowData);
                if ($dogIds !== null) {
                    $row->dogs()->sync($dogIds);
                }
            }
        } else {
            $ids = (clone $query)->pluck('id');
            $query->update($data);
            if ($dogIds !== null) {
                foreach ($ids as $id) {
                    Appointment::find($id)?->dogs()->sync($dogIds);
                }
            }
        }
    }

    public function cancel(Appointment $appointment, string $scope = 'single'): void
    {
        if ($scope === 'future_all' || $scope === 'all') {
            $query = $this->seriesQuery($appointment);
            if ($scope === 'future_all') {
                $query->where('scheduled_time', '>=', $appointment->scheduled_time);
            }
            $query->each(fn ($a) => $a->delete());
        } else {
            $appointment->update(['status' => 'cancelled']);
        }
    }

    public function generateRecurring(Appointment $parent, ?string $upTo = null): void
    {
        $rule = $parent->recurrence_rule;
        if (!$rule) return;

        $upTo = $upTo ? Carbon::parse($upTo) : Carbon::now()->addMonths(6);

        // Resume from the last already-generated occurrence rather than
        // always restarting from the parent's own scheduled_time. This
        // method is re-run monthly by GenerateRecurringAppointments for
        // every active recurring series (not just newly-created ones) to
        // keep extending the 6-month window as time passes -- restarting
        // from scratch every run would regenerate (duplicate) every
        // occurrence a prior run already created. withTrashed() so a
        // cancelled/deleted occurrence's slot doesn't get regenerated.
        $latestChild = Appointment::withTrashed()
            ->where('recurrence_parent_id', $parent->id)
            ->orderByDesc('scheduled_time')
            ->first();
        $alreadyGenerated = Appointment::withTrashed()->where('recurrence_parent_id', $parent->id)->count();

        $current   = Carbon::parse($latestChild->scheduled_time ?? $parent->scheduled_time);
        $dogIds    = $parent->dogs->pluck('id')->all();
        $generated = $alreadyGenerated;
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

            if (Schema::hasColumn('appointments', 'group_hike_id')) {
                $childFields['group_hike_id']   = $parent->group_hike_id;
                $childFields['group_hike_name'] = $parent->group_hike_name;
            }

            if (Schema::hasColumn('appointments', 'assigned_to')) {
                $childFields['assigned_to'] = $parent->assigned_to;
            }

            $child = Appointment::create($childFields);
            $this->applyPaygCharge($child);

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
