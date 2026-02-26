<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

class SendTestEmail extends Command
{
    protected $signature   = 'mail:test {email : The address to send the test email to}';
    protected $description = 'Send a test email to verify mail configuration';

    public function handle(): int
    {
        $to      = $this->argument('email');
        $mailer  = config('mail.default');
        $host    = config('mail.mailers.smtp.host', 'n/a');
        $port    = config('mail.mailers.smtp.port', 'n/a');
        $from    = config('mail.from.address');

        $this->line('');
        $this->line("  Mailer    : <info>{$mailer}</info>");
        if ($mailer === 'smtp') {
            $this->line("  Host      : <info>{$host}:{$port}</info>");
        }
        $this->line("  From      : <info>{$from}</info>");
        $this->line("  Sending to: <info>{$to}</info>");
        $this->line('');

        try {
            Mail::raw(
                "This is a test email from The Pupper Club portal.\n\n"
                . "If you received this, your mail configuration is working correctly.\n\n"
                . "Mailer: {$mailer}\n"
                . ($mailer === 'smtp' ? "Host: {$host}:{$port}\n" : '')
                . "From: {$from}\n",
                fn ($m) => $m->to($to)->subject('Pupper Club — Mail Test ✅')
            );

            $this->info('Email sent successfully.');

            if ($mailer === 'log') {
                $this->line('  (log driver — check <comment>storage/logs/laravel.log</comment> to see the output)');
            }

            return self::SUCCESS;
        } catch (\Exception $e) {
            $this->error('Failed to send email:');
            $this->line("  {$e->getMessage()}");
            $this->line('');
            $this->line('Common fixes:');
            $this->line('  • Check MAIL_PASSWORD is set to your Resend API key (starts with re_)');
            $this->line('  • For local testing with no mail service, set MAIL_MAILER=log in .env');
            $this->line('  • Verify smtp.resend.com:587 is reachable from this server');

            return self::FAILURE;
        }
    }
}
