<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('visits:send-pre-visit-prompts')->dailyAt('08:00');
Schedule::command('billing:generate-subscription-invoices')->daily();
Schedule::command('appointments:generate-recurring')->monthly();
