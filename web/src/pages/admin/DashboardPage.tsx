import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import type { DashboardSummary, Appointment } from '@pupper/shared';
import { format } from 'date-fns';

const TIME_BLOCK_LABELS = {
  early_morning: '7–10 AM', morning: '9–12 PM', midday: '11 AM–2 PM',
  afternoon: '2–5 PM', evening: '5–8 PM',
};

const MOOD_EMOJI = { great: '🐾', good: '😊', okay: '😐', anxious: '😟', unwell: '🤒' };

function WalkCard({ appointment }: { appointment: Appointment }) {
  const navigate = useNavigate();
  const isCheckedIn = appointment.status === 'checked_in';
  const isDone = appointment.status === 'completed';

  return (
    <div className="bg-white rounded-xl shadow-card p-5 flex flex-col gap-3 border-l-4 border-gold">
      <div className="flex justify-between items-start">
        <div>
          <div className="font-semibold text-espresso">
            {(appointment as any).user?.name}
          </div>
          <div className="text-sm text-taupe mt-0.5">
            {appointment.dogs?.map((d: any) => d.name).join(', ') || '—'}
          </div>
        </div>
        <Badge variant={statusBadge(appointment.status)}>{appointment.status.replace('_', ' ')}</Badge>
      </div>
      <div className="flex items-center gap-4 text-sm text-taupe">
        <span>⏰ {TIME_BLOCK_LABELS[appointment.client_time_block]}</span>
        <span>🐕 {appointment.service_type.replace('_', ' ')}</span>
      </div>
      {!isDone && (
        <div className="flex gap-2 mt-1">
          {!isCheckedIn ? (
            <Button
              size="sm"
              onClick={() => api.post(`/admin/appointments/${appointment.id}/check-in`)}
            >
              Check In
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => navigate(`/admin/calendar`)}
            >
              Complete Visit
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => navigate(`/admin/inbox/${(appointment as any).user?.id}`)}>
            Message
          </Button>
        </div>
      )}
      {isDone && appointment.visitReport && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-1.5">
          <span>{MOOD_EMOJI[(appointment as any).visitReport?.mood || 'good']}</span>
          <span>Visit complete</span>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboardPage() {
  const { data, isLoading } = useQuery<DashboardSummary>({
    queryKey: ['admin-dashboard'],
    queryFn: () => api.get('/admin/dashboard').then(r => r.data.data),
    refetchInterval: 30_000,
  });

  if (isLoading) return <PageLoader />;

  const today = format(new Date(), 'EEEE, MMMM d');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="text-taupe mt-1">{today}</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Today's Walks",    value: data?.todays_appointments.length ?? 0, icon: '🐕', color: 'text-gold' },
          { label: 'Pending Requests', value: data?.pending_service_requests ?? 0,    icon: '📋', color: 'text-blue' },
          { label: 'Unread Messages',  value: data?.unread_messages ?? 0,             icon: '💬', color: 'text-espresso' },
          { label: 'Outstanding',      value: `$${(data?.outstanding_total ?? 0).toFixed(0)}`, icon: '💰', color: 'text-gold' },
        ].map(stat => (
          <Card key={stat.label} padding="sm">
            <div className="text-2xl mb-1">{stat.icon}</div>
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-taupe mt-0.5">{stat.label}</div>
          </Card>
        ))}
      </div>

      {/* Revenue row */}
      <Card>
        <CardHeader title="Revenue This Month" />
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-xl font-bold text-espresso">${(data?.revenue_this_month.billed_this_month ?? 0).toFixed(0)}</div>
            <div className="text-xs text-taupe mt-0.5">Billed</div>
          </div>
          <div>
            <div className="text-xl font-bold text-green-600">${(data?.revenue_this_month.collected_this_month ?? 0).toFixed(0)}</div>
            <div className="text-xs text-taupe mt-0.5">Collected</div>
          </div>
          <div>
            <div className="text-xl font-bold text-red-500">${(data?.revenue_this_month.outstanding ?? 0).toFixed(0)}</div>
            <div className="text-xs text-taupe mt-0.5">Outstanding</div>
          </div>
        </div>
      </Card>

      {/* Today's walks */}
      <div>
        <h2 className="font-display text-lg text-espresso mb-4">Today's Walks</h2>
        {data?.todays_appointments.length === 0 ? (
          <Card>
            <p className="text-center text-taupe py-8">No walks scheduled for today 🌟</p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {data?.todays_appointments.map(appt => (
              <WalkCard key={appt.id} appointment={appt} />
            ))}
          </div>
        )}
      </div>

      {/* Upcoming renewals */}
      {data?.upcoming_renewals && data.upcoming_renewals.length > 0 && (
        <Card>
          <CardHeader title="Upcoming Renewals" subtitle="Next 7 days" />
          <div className="space-y-2">
            {data.upcoming_renewals.map(r => (
              <div key={r.user_id} className="flex items-center justify-between py-2 border-b border-cream last:border-0">
                <div>
                  <div className="font-medium text-espresso text-sm">{r.client_name}</div>
                  <div className="text-xs text-taupe">{r.subscription_tier}</div>
                </div>
                <div className="text-sm text-gold font-semibold">
                  {format(new Date(r.renewal_date), 'MMM d')}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
