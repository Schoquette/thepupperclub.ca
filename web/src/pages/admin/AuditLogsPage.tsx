import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { format } from 'date-fns';

const MODEL_LABELS: Record<string, string> = {
  'App\\Models\\User':              'User',
  'App\\Models\\Dog':               'Dog',
  'App\\Models\\ClientProfile':     'Profile',
  'App\\Models\\HomeAccess':        'Home Access',
  'App\\Models\\Appointment':       'Appointment',
  'App\\Models\\Invoice':           'Invoice',
  'App\\Models\\ServiceRequest':    'Service Request',
  'App\\Models\\VaccinationRecord': 'Vaccination',
};

function modelLabel(type: string): string {
  return MODEL_LABELS[type] ?? type.split('\\').pop() ?? type;
}

const ACTION_COLORS: Record<string, string> = {
  created:  'bg-green-50 text-green-700',
  updated:  'bg-blue-50 text-blue-700',
  deleted:  'bg-red-50 text-red-600',
  login:    'bg-cream text-taupe',
  logout:   'bg-cream text-taupe',
};

export default function AdminAuditLogsPage() {
  const [actionFilter, setActionFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', actionFilter, modelFilter, page],
    queryFn: () =>
      api.get('/admin/audit-logs', {
        params: {
          action:     actionFilter || undefined,
          model_type: modelFilter  || undefined,
          page,
        },
      }).then(r => r.data),
  });

  const logs: any[]    = data?.data  ?? [];
  const meta           = data?.meta  ?? {};
  const lastPage       = meta.last_page ?? 1;

  return (
    <div className="space-y-6">
      <h1 className="page-title">Audit Log</h1>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          className="input w-auto text-sm"
          value={actionFilter}
          onChange={e => { setActionFilter(e.target.value); setPage(1); }}
        >
          <option value="">All actions</option>
          {['created','updated','deleted','login','logout','password_reset','invite_sent'].map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        <select
          className="input w-auto text-sm"
          value={modelFilter}
          onChange={e => { setModelFilter(e.target.value); setPage(1); }}
        >
          <option value="">All models</option>
          {Object.entries(MODEL_LABELS).map(([k, v]) => (
            <option key={k} value={v}>{v}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : logs.length === 0 ? (
        <Card>
          <p className="text-center py-8 text-taupe">No audit log entries found.</p>
        </Card>
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cream bg-cream/40">
                  <th className="text-left px-4 py-3 text-xs text-taupe uppercase tracking-wide font-semibold">When</th>
                  <th className="text-left px-4 py-3 text-xs text-taupe uppercase tracking-wide font-semibold">Actor</th>
                  <th className="text-left px-4 py-3 text-xs text-taupe uppercase tracking-wide font-semibold">Action</th>
                  <th className="text-left px-4 py-3 text-xs text-taupe uppercase tracking-wide font-semibold">Object</th>
                  <th className="text-left px-4 py-3 text-xs text-taupe uppercase tracking-wide font-semibold">Changes</th>
                  <th className="text-left px-4 py-3 text-xs text-taupe uppercase tracking-wide font-semibold">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream">
                {logs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-cream/30">
                    <td className="px-4 py-3 text-taupe whitespace-nowrap">
                      {log.created_at
                        ? format(new Date(log.created_at), 'MMM d, h:mm a')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-espresso font-medium">
                      {log.user?.name ?? `User #${log.user_id}`}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${ACTION_COLORS[log.action] ?? 'bg-cream text-taupe'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-taupe">
                      {modelLabel(log.model_type)} #{log.model_id}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      {log.changed_fields && Object.keys(log.changed_fields).length > 0 ? (
                        <div className="text-xs text-taupe space-y-0.5">
                          {Object.entries(log.changed_fields).slice(0, 4).map(([k, v]: any) => (
                            <div key={k}>
                              <span className="font-medium text-espresso">{k}:</span>{' '}
                              <span className="text-taupe/80">
                                {typeof v === 'object' ? JSON.stringify(v) : String(v ?? '—')}
                              </span>
                            </div>
                          ))}
                          {Object.keys(log.changed_fields).length > 4 && (
                            <div className="text-taupe/60">+{Object.keys(log.changed_fields).length - 4} more</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-taupe/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-taupe/60 font-mono">
                      {log.ip_address ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {lastPage > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-cream">
              <span className="text-sm text-taupe">
                Page {meta.current_page} of {lastPage} — {meta.total} entries
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1 rounded-lg text-sm border border-taupe/30 text-espresso hover:bg-cream disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  disabled={page >= lastPage}
                  onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1 rounded-lg text-sm border border-taupe/30 text-espresso hover:bg-cream disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
