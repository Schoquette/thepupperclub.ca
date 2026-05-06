import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import api from '@/lib/api';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import type { Appointment } from '@pupper/shared';
import { format, formatDistanceToNow } from 'date-fns';
import { ClipboardList, MessageCircle, DollarSign, Clock, Dog, CheckCircle, AlertTriangle, Mail, XCircle } from 'lucide-react';
import { PawIcon } from '@/components/ui/PawIcon';

const TIME_BLOCK_LABELS: Record<string, string> = {
  early_morning: '7–10 AM', morning: '9–12 PM', midday: '11 AM–2 PM',
  afternoon: '2–5 PM', evening: '5–8 PM',
};

function WalkCard({ appointment }: { appointment: Appointment }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isCheckedIn = appointment.status === 'checked_in';
  const isDone = appointment.status === 'completed';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCheckIn = async () => {
    setLoading(true);
    setError('');
    try {
      await api.post(`/admin/appointments/${appointment.id}/check-in`);
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard-counts'] });
    } catch (e: any) {
      setError(e.response?.data?.message || 'Check-in failed');
    } finally {
      setLoading(false);
    }
  };

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
        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {TIME_BLOCK_LABELS[appointment.client_time_block]}</span>
        <span className="flex items-center gap-1"><Dog className="w-3.5 h-3.5" /> {appointment.service_type.replace('_', ' ')}</span>
      </div>
      {!isDone && (
        <div className="flex gap-2 mt-1">
          {!isCheckedIn ? (
            <Button
              size="sm"
              loading={loading}
              onClick={handleCheckIn}
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
      {error && <p className="text-xs text-red-500">{error}</p>}
      {isDone && appointment.visitReport && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-1.5">
          <CheckCircle className="w-4 h-4" />
          <span>Visit complete</span>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery<any>({
    queryKey: ['admin-dashboard'],
    queryFn: () => api.get('/admin/dashboard').then(r => r.data.data),
    refetchInterval: 30_000,
  });

  if (isLoading) return <PageLoader />;

  const today = format(new Date(), 'EEEE, MMMM d');
  const recentErrors: any[] = data?.recent_errors ?? [];
  const recentEmails: any[] = data?.recent_emails ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="text-taupe mt-1">{today}</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Today's Walks",    value: data?.todays_appointments?.length ?? 0, Icon: PawIcon,       color: 'text-gold' },
          { label: 'Pending Requests', value: data?.pending_service_requests ?? 0,    Icon: ClipboardList, color: 'text-blue' },
          { label: 'Unread Messages',  value: data?.unread_messages ?? 0,             Icon: MessageCircle, color: 'text-espresso' },
          { label: 'Outstanding',      value: `$${Number(data?.outstanding_total ?? 0).toFixed(0)}`, Icon: DollarSign, color: 'text-gold' },
        ].map(stat => (
          <Card key={stat.label} padding="sm">
            <stat.Icon className="w-6 h-6 text-taupe mb-1" />
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
            <div className="text-xl font-bold text-espresso">${Number(data?.revenue_this_month?.billed_this_month ?? 0).toFixed(0)}</div>
            <div className="text-xs text-taupe mt-0.5">Billed</div>
          </div>
          <div>
            <div className="text-xl font-bold text-green-600">${Number(data?.revenue_this_month?.collected_this_month ?? 0).toFixed(0)}</div>
            <div className="text-xs text-taupe mt-0.5">Collected</div>
          </div>
          <div>
            <div className="text-xl font-bold text-red-500">${Number(data?.revenue_this_month?.outstanding ?? 0).toFixed(0)}</div>
            <div className="text-xs text-taupe mt-0.5">Outstanding</div>
          </div>
        </div>
      </Card>

      {/* Today's walks */}
      <div>
        <h2 className="font-display text-lg text-espresso mb-4">Today's Walks</h2>
        {(data?.todays_appointments?.length ?? 0) === 0 ? (
          <Card>
            <p className="text-center text-taupe py-8">No walks scheduled for today.</p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {data?.todays_appointments.map((appt: Appointment) => (
              <WalkCard key={appt.id} appointment={appt} />
            ))}
          </div>
        )}
      </div>

      {/* Recent Emails & Errors side by side */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Email Log */}
        <Card>
          <CardHeader title="Recent Emails" />
          {recentEmails.length === 0 ? (
            <p className="text-center text-taupe text-sm py-6">No emails sent yet.</p>
          ) : (
            <div className="space-y-1">
              {recentEmails.map((log: any) => (
                <div key={log.id} className="flex items-start gap-3 py-2.5 border-b border-cream last:border-0">
                  <div className={`mt-0.5 flex-shrink-0 ${log.status === 'sent' ? 'text-green-500' : 'text-red-500'}`}>
                    {log.status === 'sent' ? <Mail className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-espresso truncate">{log.subject}</div>
                    <div className="text-xs text-taupe mt-0.5">
                      To: {log.to_email}
                      {log.user?.name && <span> ({log.user.name})</span>}
                    </div>
                    {log.error_message && (
                      <div className="text-xs text-red-600 mt-0.5 truncate">{log.error_message}</div>
                    )}
                  </div>
                  <div className="text-[11px] text-taupe flex-shrink-0">
                    {log.created_at ? formatDistanceToNow(new Date(log.created_at), { addSuffix: true }) : '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-cream">
            <button
              onClick={() => navigate('/admin/email-logs')}
              className="text-sm text-blue hover:underline font-medium"
            >
              View all emails
            </button>
          </div>
        </Card>

        {/* Error Log */}
        <Card>
          <CardHeader title="Recent Errors" />
          {recentErrors.length === 0 ? (
            <p className="text-center text-taupe text-sm py-6">No errors recorded.</p>
          ) : (
            <div className="space-y-1">
              {recentErrors.map((log: any) => (
                <div key={log.id} className="flex items-start gap-3 py-2.5 border-b border-cream last:border-0">
                  <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-espresso">
                      <span className="text-red-600">{log.type}</span>
                    </div>
                    <div className="text-xs text-taupe mt-0.5 line-clamp-2">{log.message}</div>
                    {log.url && (
                      <div className="text-[11px] text-taupe mt-0.5 truncate">{log.url}</div>
                    )}
                  </div>
                  <div className="text-[11px] text-taupe flex-shrink-0">
                    {log.created_at ? formatDistanceToNow(new Date(log.created_at), { addSuffix: true }) : '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-cream">
            <button
              onClick={() => navigate('/admin/error-logs')}
              className="text-sm text-blue hover:underline font-medium"
            >
              View all errors
            </button>
          </div>
        </Card>
      </div>

      {/* Upcoming renewals */}
      {data?.upcoming_renewals && data.upcoming_renewals.length > 0 && (
        <Card>
          <CardHeader title="Upcoming Renewals" subtitle="Next 7 days" />
          <div className="space-y-2">
            {data.upcoming_renewals.map((r: any) => (
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
