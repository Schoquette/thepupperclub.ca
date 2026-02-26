<?php

namespace App\Console\Commands;

use App\Models\Appointment;
use App\Services\AppointmentService;
use Illuminate\Console\Command;

class GenerateRecurringAppointments extends Command
{
    protected $signature = 'appointments:generate-recurring';
    protected $description = 'Expand recurring appointment rules up to 6 months ahead';

    public function handle(AppointmentService $service): void
    {
        $upTo = now()->addMonths(6)->toDateString();

        // Find parent appointments (with recurrence rules)
        $parents = Appointment::whereNotNull('recurrence_rule')
            ->whereNull('recurrence_parent_id')
            ->whereIn('status', ['scheduled'])
            ->with('dogs')
            ->get();

        foreach ($parents as $parent) {
            $service->generateRecurring($parent, $upTo);
            $this->info("Generated recurring appointments for #{$parent->id}");
        }

        $this->info("Done. Processed {$parents->count()} recurring rules.");
    }
}
