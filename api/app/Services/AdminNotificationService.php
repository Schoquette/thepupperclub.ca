<?php

namespace App\Services;

use App\Models\ClientDocument;
use App\Models\Dog;
use App\Models\User;
use Illuminate\Support\Facades\Log;

class AdminNotificationService
{
    public function profileUpdated(User $client): void
    {
        $this->notifyAdmin("Profile Updated", "{$client->name} has updated their profile.");
    }

    public function homeAccessUpdated(User $client): void
    {
        $this->notifyAdmin("Home Access Updated", "{$client->name} has updated their home access info.");
    }

    public function dogAdded(User $client, Dog $dog): void
    {
        $message = "{$client->name} added a new dog: {$dog->name}. Review and activate the profile.";
        if ($dog->bite_history) {
            $message .= " ⚠️ BITE HISTORY recorded.";
        }
        $this->notifyAdmin("New Dog Added", $message);
    }

    public function dogUpdated(User $client, Dog $dog, array $diff): void
    {
        if (empty($diff)) return;
        $fields = implode(', ', array_keys($diff));
        $this->notifyAdmin("Dog Profile Updated", "{$client->name} updated {$dog->name}'s profile. Changed: {$fields}.");
    }

    public function documentUploaded(User $client, ClientDocument $doc): void
    {
        $this->notifyAdmin("Document Uploaded", "{$client->name} uploaded a new document: {$doc->filename}.");
    }

    public function invoicePaymentFailed(object $invoice): void
    {
        $this->notifyAdmin("Payment Failed", "Payment failed for invoice #{$invoice->invoice_number}.");
    }

    private function notifyAdmin(string $title, string $body): void
    {
        $admin = User::where('role', 'admin')->first();
        if (!$admin) return;

        // Push notification to admin
        app(ExpoNotificationService::class)->send($admin, $title, $body);

        Log::info("[AdminNotification] {$title}: {$body}");
    }
}
