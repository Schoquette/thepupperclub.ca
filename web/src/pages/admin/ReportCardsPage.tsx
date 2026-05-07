import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { format } from 'date-fns';

export default function AdminReportCardsPage() {
  const [statusFilter, setStatusFilter] = useState<'all' | 'sent' | 'draft'>('all');
  const [clientFilter, setClientFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-report-cards', statusFilter],
    queryFn: () =>
      api
        .get('/admin/report-cards', {
          params: statusFilter !== 'all' ? { status: statusFilter } : {},
        })
        .then((r) => r.data),
  });

  const { data: dueData } = useQuery({
    queryKey: ['admin-report-cards-due'],
    queryFn: () => api.get('/admin/report-cards/due').then((r) => r.data),
  });

  const { data: clientsData } = useQuery({
    queryKey: ['admin-clients-list'],
    queryFn: () => api.get('/admin/clients').then((r) => r.data.data),
  });

  const dueAppointments: any[] = dueData?.data ?? [];
  const reports = data?.data ?? [];

  // Filter due appointments by client
  const filteredDue = useMemo(() => {
    if (!clientFilter) return dueAppointments;
    return dueAppointments.filter((a: any) => String(a.user_id) === clientFilter);
  }, [dueAppointments, clientFilter]);

  // Filter report cards by client
  const filteredReports = useMemo(() => {
    if (!clientFilter) return reports;
    return reports.filter((r: any) => String(r.user_id) === clientFilter);
  }, [reports, clientFilter]);

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Report Cards</h1>
        <Link to="/admin/report-cards/new">
          <Button size="sm">+ New Report Card</Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex gap-2">
          {(['all', 'sent', 'draft'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
                statusFilter === f
                  ? 'bg-espresso text-cream'
                  : 'bg-white text-taupe hover:text-espresso'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div>
          <select
            className="input text-sm"
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
          >
            <option value="">All Clients</option>
            {(clientsData ?? []).map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Due Report Cards */}
      {filteredDue.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2 px-1">
            Report Cards Due ({filteredDue.length})
          </h2>
          <Card padding="none">
            <div className="divide-y divide-cream">
              {filteredDue.map((appt: any) => {
                const localStr = appt.scheduled_time?.replace(/[Zz]$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
                const d = new Date(localStr);
                const dogNames = appt.dogs?.map((dog: any) => dog.name).join(', ') || '';
                return (
                  <Link
                    key={appt.id}
                    to={`/admin/report-cards/new?appointment_id=${appt.id}&user_id=${appt.user_id}`}
                    className="flex items-center gap-4 px-5 py-3 hover:bg-cream/50 transition-colors"
                  >
                    <div className="h-9 w-9 rounded-full bg-red-100 text-red-500 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {appt.user?.name?.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-espresso">{appt.user?.name}</div>
                      <div className="text-xs text-taupe mt-0.5">
                        {dogNames && <span>{dogNames} — </span>}
                        {appt.service_type?.replace(/_/g, ' ')}
                      </div>
                    </div>
                    <div className="text-xs text-taupe flex-shrink-0">
                      {format(d, 'MMM d, yyyy · h:mm a')}
                    </div>
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600 flex-shrink-0">
                      Due
                    </span>
                  </Link>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* Existing Report Cards */}
      {filteredReports.length === 0 ? (
        <Card>
          <p className="text-center py-8 text-taupe">No report cards found.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredReports.map((r: any) => (
            <Link key={r.id} to={`/admin/report-cards/${r.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-espresso text-sm">
                      {r.user?.name ?? '—'}
                    </div>
                    <div className="text-xs text-taupe mt-0.5">
                      {r.arrival_time
                        ? format(new Date(r.arrival_time), 'MMM d, yyyy · h:mm a')
                        : r.appointment?.scheduled_time
                          ? format(new Date(r.appointment.scheduled_time), 'MMM d, yyyy · h:mm a')
                          : format(new Date(r.created_at), 'MMM d, yyyy')}
                      {r.appointment?.service_type && (
                        <span className="ml-1.5 text-taupe/70">
                          — {r.appointment.service_type.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      r.sent_at ? 'bg-green-50 text-green-700' : 'bg-cream text-taupe'
                    }`}
                  >
                    {r.sent_at ? 'Sent' : 'Draft'}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
