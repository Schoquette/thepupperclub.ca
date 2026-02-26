<?php

namespace App\Services;

use App\Models\Appointment;
use App\Models\Invoice;
use App\Models\VisitReport;

class VisitNotificationService
{
    public function __construct(private ExpoNotificationService $expo) {}

    public function sendArrival(Appointment $appointment): void
    {
        $user         = $appointment->user;
        $conversation = $user->conversation()->firstOrCreate(['user_id' => $user->id]);
        $adminUser    = \App\Models\User::where('role', 'admin')->first();

        $conversation->messages()->create([
            'sender_id' => $adminUser?->id,
            'type'      => 'arrival',
            'body'      => "Your walker has arrived! Walk is starting now.",
            'metadata'  => [
                'appointment_id' => $appointment->id,
                'check_in_time'  => $appointment->check_in_time?->toIso8601String(),
            ],
        ]);
        $conversation->increment('unread_count_client');
        $conversation->update(['last_message_at' => now()]);

        $this->expo->send($user, "Your walker has arrived! 🐾", "Your walk is starting now.");
    }

    public function sendVisitComplete(Appointment $appointment, VisitReport $report): void
    {
        $user         = $appointment->user;
        $conversation = $user->conversation()->firstOrCreate(['user_id' => $user->id]);
        $adminUser    = \App\Models\User::where('role', 'admin')->first();

        $conversation->messages()->create([
            'sender_id' => $adminUser?->id,
            'type'      => 'visit_report',
            'body'      => "Walk complete! Here's how it went.",
            'metadata'  => [
                'appointment_id'  => $appointment->id,
                'visit_report_id' => $report->id,
                'photo_urls'      => $report->photo_urls,
                'mood'            => $report->mood,
                'eliminated'      => $report->eliminated,
                'ate_well'        => $report->ate_well,
                'drank_water'     => $report->drank_water,
                'notes'           => $report->notes,
            ],
        ]);
        $conversation->increment('unread_count_client');
        $conversation->update(['last_message_at' => now()]);

        $this->expo->send($user, "Walk complete! 🐕", "Your visit report is ready.");
    }

    public function sendInvoicePaid(Invoice $invoice): void
    {
        $user = $invoice->user;
        $this->expo->send($user, "Payment confirmed 🎉", "Invoice #{$invoice->invoice_number} has been paid.");
    }

    public function sendPreVisitPrompt(Appointment $appointment): void
    {
        $user         = $appointment->user;
        $conversation = $user->conversation()->firstOrCreate(['user_id' => $user->id]);
        $adminUser    = \App\Models\User::where('role', 'admin')->first();

        $conversation->messages()->create([
            'sender_id' => $adminUser?->id,
            'type'      => 'pre_visit_prompt',
            'body'      => "Your walk is tomorrow! Please make sure your dog is ready.",
            'metadata'  => [
                'appointment_id' => $appointment->id,
                'scheduled_date' => $appointment->scheduled_time->toDateString(),
                'time_block'     => $appointment->client_time_block,
            ],
        ]);
        $conversation->increment('unread_count_client');
        $conversation->update(['last_message_at' => now()]);

        $this->expo->send($user, "Walk tomorrow! 🐾", "Your walk is scheduled for tomorrow. Make sure {$appointment->dogs->pluck('name')->join(' & ')} is ready!");

        $appointment->update(['pre_visit_notification_sent' => true]);
    }
}
