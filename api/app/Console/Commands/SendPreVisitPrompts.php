<?php

namespace App\Console\Commands;

use App\Models\Appointment;
use App\Services\VisitNotificationService;
use Illuminate\Console\Command;

class SendPreVisitPrompts extends Command
{
    protected $signature = 'visits:send-pre-visit-prompts';
    protected $description = 'Send pre-visit notifications for tomorrow\'s appointments';

    public function handle(VisitNotificationService $notificationService): void
    {
        $tomorrow = now()->addDay()->toDateString();

        $appointments = Appointment::whereDate('scheduled_time', $tomorrow)
            ->where('status', 'scheduled')
            ->where('pre_visit_notification_sent', false)
            ->with(['user', 'dogs'])
            ->get();

        foreach ($appointments as $appointment) {
            $notificationService->sendPreVisitPrompt($appointment);
            $this->info("Pre-visit prompt sent for appointment #{$appointment->id}");
        }

        $this->info("Sent {$appointments->count()} pre-visit prompts.");
    }
}
