<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;

class ContactController extends Controller
{
    public function submit(Request $request)
    {
        $validated = $request->validate([
            'first_name' => 'required|string|max:100',
            'last_name'  => 'required|string|max:100',
            'email'      => 'required|email|max:255',
            'phone'      => 'nullable|string|max:30',
            'dog_name'   => 'nullable|string|max:100',
            'message'    => 'required|string|max:5000',
        ]);

        try {
            Mail::raw($this->formatMessage($validated), function ($mail) use ($validated) {
                $mail->to('sophie@thepupperclub.ca')
                     ->replyTo($validated['email'], $validated['first_name'] . ' ' . $validated['last_name'])
                     ->subject('New Contact Form — ' . $validated['first_name'] . ' ' . $validated['last_name']);
            });
        } catch (\Exception $e) {
            Log::error('Contact form email failed', [
                'error' => $e->getMessage(),
                'data'  => $validated,
            ]);
        }

        // Always log the submission
        Log::info('Contact form submission', $validated);

        return response()->json(['message' => 'Message received. We\'ll be in touch!']);
    }

    private function formatMessage(array $data): string
    {
        $lines = [
            "Name: {$data['first_name']} {$data['last_name']}",
            "Email: {$data['email']}",
        ];

        if (!empty($data['phone'])) {
            $lines[] = "Phone: {$data['phone']}";
        }
        if (!empty($data['dog_name'])) {
            $lines[] = "Dog's Name: {$data['dog_name']}";
        }

        $lines[] = "";
        $lines[] = "Message:";
        $lines[] = $data['message'];

        return implode("\n", $lines);
    }
}
