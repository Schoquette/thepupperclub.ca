import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { format } from 'date-fns';

export default function AdminReportCardsPage() {
  const [statusFilter, setStatusFilter] = useState<'all' | 'sent' | 'draft'>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-report-cards', statusFilter],
    queryFn: () =>
      api
        .get('/admin/report-cards', {
          params: statusFilter !== 'all' ? { status: statusFilter } : {},
        })
        .then((r) => r.data),
  });

  if (isLoading) return <PageLoader />;

  const reports = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Report Cards</h1>
        <Link to="/admin/report-cards/new">
          <Button size="sm">+ New Report Card</Button>
        </Link>
      </div>

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

      {reports.length === 0 ? (
        <Card>
          <p className="text-center py-8 text-taupe">No report cards found.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {reports.map((r: any) => (
            <Link key={r.id} to={`/admin/report-cards/${r.id}`}>
              <Card padding="sm" className="hover:shadow-md transition-shadow cursor-pointer">
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
