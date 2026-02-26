<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\Conversation;
use App\Models\Invoice;
use App\Models\ServiceRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    public function index(): JsonResponse
    {
        $today = now()->toDateString();

        $todaysAppointments = Appointment::with(['user.clientProfile', 'dogs', 'visitReport'])
            ->whereDate('scheduled_time', $today)
            ->whereIn('status', ['scheduled', 'checked_in'])
            ->orderBy('scheduled_time')
            ->get();

        $pendingRequests = ServiceRequest::where('status', 'pending')->count();

        $unreadMessages = Conversation::sum('unread_count_admin');

        $outstandingInvoices = Invoice::whereIn('status', ['sent', 'overdue']);
        $outstandingCount = $outstandingInvoices->count();
        $outstandingTotal = $outstandingInvoices->sum('total');

        $upcomingRenewals = User::where('role', 'client')
            ->whereHas('clientProfile', function ($q) {
                $q->whereBetween('subscription_end_date', [now(), now()->addDays(7)]);
            })
            ->with('clientProfile')
            ->get()
            ->map(fn($user) => [
                'user_id'           => $user->id,
                'client_name'       => $user->name,
                'renewal_date'      => $user->clientProfile->subscription_end_date,
                'subscription_tier' => $user->clientProfile->subscription_tier,
            ]);

        $monthStart = now()->startOfMonth();
        $monthEnd   = now()->endOfMonth();

        $billed = Invoice::whereBetween('created_at', [$monthStart, $monthEnd])->sum('total');
        $collected = Invoice::where('status', 'paid')
            ->whereBetween('paid_at', [$monthStart, $monthEnd])
            ->sum('total');

        return response()->json([
            'data' => [
                'todays_appointments'    => $todaysAppointments,
                'pending_service_requests' => $pendingRequests,
                'unread_messages'        => $unreadMessages,
                'outstanding_invoices'   => $outstandingCount,
                'outstanding_total'      => $outstandingTotal,
                'upcoming_renewals'      => $upcomingRenewals,
                'revenue_this_month'     => [
                    'billed_this_month'    => $billed,
                    'collected_this_month' => $collected,
                    'outstanding'          => $outstandingTotal,
                    'overdue_count'        => Invoice::where('status', 'overdue')->count(),
                ],
            ],
        ]);
    }
}
