import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import {
  format,
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfYear, endOfYear,
} from 'date-fns';

type Preset = 'today' | 'week' | 'month' | 'year' | 'ytd' | 'custom';
type Tab = 'mileage' | 'walk_history' | 'billing';

const PRESETS: { value: Preset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'ytd', label: 'Year to Date' },
  { value: 'custom', label: 'Custom' },
];

const TABS: { value: Tab; label: string }[] = [
  { value: 'mileage', label: 'Mileage' },
  { value: 'walk_history', label: 'Walk History' },
  { value: 'billing', label: 'Billing' },
];

function getPresetRange(preset: Preset): { start: string; end: string } {
  const now = new Date();
  switch (preset) {
    case 'today':
      return { start: format(startOfDay(now), 'yyyy-MM-dd'), end: format(endOfDay(now), 'yyyy-MM-dd') };
    case 'week':
      return { start: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'), end: format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd') };
    case 'month':
      return { start: format(startOfMonth(now), 'yyyy-MM-dd'), end: format(endOfMonth(now), 'yyyy-MM-dd') };
    case 'year':
      return { start: format(startOfYear(now), 'yyyy-MM-dd'), end: format(endOfYear(now), 'yyyy-MM-dd') };
    case 'ytd':
      return { start: format(startOfYear(now), 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') };
    default:
      return { start: format(startOfMonth(now), 'yyyy-MM-dd'), end: format(endOfMonth(now), 'yyyy-MM-dd') };
  }
}

function formatServiceType(type: string): string {
  if (type === 'walk_30') return '30-Minute Visit';
  if (type === 'walk_60') return '60-Minute Visit';
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatDuration(minutes: number | null): string {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('mileage');
  const [preset, setPreset] = useState<Preset>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [downloading, setDownloading] = useState(false);

  // Load clients for filter
  const { data: clients } = useQuery<any[]>({
    queryKey: ['admin-clients-list'],
    queryFn: () => api.get('/admin/clients?per_page=200').then(r => r.data.data),
  });

  // Load team members for mileage filter
  const { data: teamMembers } = useQuery<any[]>({
    queryKey: ['admin-team'],
    queryFn: () => api.get('/admin/team').then(r => r.data.data),
  });

  const range = useMemo(() => {
    if (preset === 'custom' && customStart && customEnd) {
      return { start: customStart, end: customEnd };
    }
    return getPresetRange(preset);
  }, [preset, customStart, customEnd]);

  const endpoint = tab === 'billing' ? '/admin/reports/billing' : '/admin/reports/walk-history';

  // For mileage, reuse the time-mileage endpoint
  const queryEndpoint = tab === 'mileage' ? '/admin/time-mileage' : endpoint;

  const { data, isLoading } = useQuery<any>({
    queryKey: ['reports', tab, range.start, range.end, clientFilter, teamFilter],
    queryFn: () =>
      api.get(queryEndpoint, {
        params: {
          start: range.start,
          end: range.end,
          ...(clientFilter ? { user_id: clientFilter } : {}),
          ...(tab === 'mileage' && teamFilter ? { assigned_to: teamFilter } : {}),
        },
      }).then(r => r.data.data),
    enabled: !!range.start && !!range.end,
  });

  const handleDownload = async (fmt: 'csv' | 'pdf') => {
    setDownloading(true);
    try {
      const response = await api.get('/admin/reports/export', {
        params: {
          start: range.start,
          end: range.end,
          type: tab,
          format: fmt,
          ...(clientFilter ? { user_id: clientFilter } : {}),
        },
        responseType: 'blob',
      });

      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = fmt;
      a.download = `${tab}_report_${range.start}_${range.end}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Download failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="page-title">Reports</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl p-1 shadow-card">
        {TABS.map(t => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t.value
                ? 'bg-gold text-white'
                : 'text-espresso hover:bg-cream'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap items-end gap-4">
          {/* Preset pills */}
          <div className="flex-1">
            <div className="text-xs font-semibold text-taupe uppercase tracking-wide mb-2">Period</div>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map(p => (
                <button
                  key={p.value}
                  onClick={() => setPreset(p.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    preset === p.value
                      ? 'bg-gold text-white border-gold'
                      : 'bg-white text-espresso border-taupe/30 hover:border-gold'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Client filter */}
          <div>
            <div className="text-xs font-semibold text-taupe uppercase tracking-wide mb-2">Client</div>
            <select
              className="input text-sm"
              value={clientFilter}
              onChange={e => setClientFilter(e.target.value)}
            >
              <option value="">All Clients</option>
              {(clients ?? []).map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Team member filter (mileage only) */}
          {tab === 'mileage' && (
            <div>
              <div className="text-xs font-semibold text-taupe uppercase tracking-wide mb-2">Team Member</div>
              <select
                className="input text-sm"
                value={teamFilter}
                onChange={e => setTeamFilter(e.target.value)}
              >
                <option value="">All</option>
                {(teamMembers ?? []).map((m: any) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Custom date range */}
          {preset === 'custom' && (
            <div className="flex items-end gap-3">
              <div>
                <label className="text-xs text-taupe block mb-1">Start</label>
                <input type="date" className="input text-sm" value={customStart} onChange={e => setCustomStart(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-taupe block mb-1">End</label>
                <input type="date" className="input text-sm" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {/* Date range indicator + download buttons */}
        <div className="mt-3 flex items-center justify-between">
          <div className="text-sm text-taupe">
            {range.start && range.end && (
              <>
                {format(new Date(range.start + 'T00:00'), 'MMM d, yyyy')} — {format(new Date(range.end + 'T00:00'), 'MMM d, yyyy')}
              </>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleDownload('csv')}
              disabled={downloading || isLoading}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-taupe/30 text-espresso hover:border-gold transition-colors disabled:opacity-50"
            >
              Download CSV
            </button>
            <button
              onClick={() => handleDownload('pdf')}
              disabled={downloading || isLoading}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-gold text-white hover:bg-gold/90 transition-colors disabled:opacity-50"
            >
              Download PDF
            </button>
          </div>
        </div>
      </Card>

      {/* Content */}
      {isLoading ? (
        <PageLoader />
      ) : tab === 'mileage' ? (
        <MileageTab data={data} />
      ) : tab === 'walk_history' ? (
        <WalkHistoryTab data={data} />
      ) : (
        <BillingTab data={data} />
      )}
    </div>
  );
}

// ── Mileage Tab ──────────────────────────────────────────────────────────────

function MileageTab({ data }: { data: any }) {
  const grouped = useMemo(() => {
    if (!data?.rows) return [];
    const map = new Map<string, any[]>();
    data.rows.forEach((row: any) => {
      const existing = map.get(row.date) ?? [];
      existing.push(row);
      map.set(row.date, existing);
    });
    return Array.from(map.entries()).map(([date, rows]) => ({
      date,
      rows,
      totalMinutes: rows.reduce((s: number, r: any) => s + (r.duration_minutes ?? 0), 0),
      totalKm: rows.reduce((s: number, r: any) => s + (r.distance_km ?? 0), 0),
    }));
  }, [data?.rows]);

  if (!data?.summary) return null;

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card padding="sm">
          <div className="text-2xl font-bold text-gold">{data.summary.total_visits}</div>
          <div className="text-xs text-taupe mt-0.5">Total Visits</div>
        </Card>
        <Card padding="sm">
          <div className="text-2xl font-bold text-espresso">{formatDuration(data.summary.total_minutes)}</div>
          <div className="text-xs text-taupe mt-0.5">Total Time</div>
        </Card>
        <Card padding="sm">
          <div className="text-2xl font-bold text-blue">{data.summary.total_km} km</div>
          <div className="text-xs text-taupe mt-0.5">Total Mileage</div>
        </Card>
      </div>

      {grouped.length === 0 ? (
        <Card><p className="text-center text-taupe py-8">No completed visits in this period.</p></Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cream text-left text-xs text-taupe uppercase tracking-wide">
                  <th className="py-3 px-3">Client</th>
                  <th className="py-3 px-3">Dogs</th>
                  <th className="py-3 px-3">Service</th>
                  <th className="py-3 px-3">Team Member</th>
                  <th className="py-3 px-3">Check In</th>
                  <th className="py-3 px-3">Check Out</th>
                  <th className="py-3 px-3 text-right">Duration</th>
                  <th className="py-3 px-3 text-right">Mileage</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map(group => (
                  <React.Fragment key={group.date}>
                    <tr className="bg-cream/50">
                      <td colSpan={8} className="py-2 px-3 font-semibold text-espresso text-sm">
                        {format(new Date(group.date + 'T00:00'), 'EEEE, MMM d, yyyy')}
                        <span className="text-taupe font-normal ml-3">
                          {group.rows.length} visit{group.rows.length !== 1 ? 's' : ''}
                          {' · '}{formatDuration(group.totalMinutes)}
                          {' · '}{group.totalKm.toFixed(1)} km
                        </span>
                      </td>
                    </tr>
                    {group.rows.map((row: any) => (
                      <tr key={row.id} className="border-b border-cream/50 hover:bg-cream/30 transition-colors">
                        <td className="py-2.5 px-3 font-medium text-espresso">{row.client_name}</td>
                        <td className="py-2.5 px-3 text-taupe">{row.dogs || '—'}</td>
                        <td className="py-2.5 px-3 text-taupe">{formatServiceType(row.service_type)}</td>
                        <td className="py-2.5 px-3 text-taupe">{row.assigned_to ?? '—'}</td>
                        <td className="py-2.5 px-3 text-taupe">{row.check_in ?? '—'}</td>
                        <td className="py-2.5 px-3 text-taupe">{row.check_out ?? '—'}</td>
                        <td className="py-2.5 px-3 text-right font-medium text-espresso">{formatDuration(row.duration_minutes)}</td>
                        <td className="py-2.5 px-3 text-right font-medium text-espresso">
                          {row.distance_km != null ? `${row.distance_km} km` : '—'}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}

// ── Walk History Tab ─────────────────────────────────────────────────────────

function WalkHistoryTab({ data }: { data: any }) {
  const grouped = useMemo(() => {
    if (!data?.rows) return [];
    const map = new Map<string, any[]>();
    data.rows.forEach((row: any) => {
      const existing = map.get(row.date) ?? [];
      existing.push(row);
      map.set(row.date, existing);
    });
    return Array.from(map.entries()).map(([date, rows]) => ({ date, rows }));
  }, [data?.rows]);

  if (!data?.summary) return null;

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card padding="sm">
          <div className="text-2xl font-bold text-gold">{data.summary.total_appointments}</div>
          <div className="text-xs text-taupe mt-0.5">Total Appointments</div>
        </Card>
        <Card padding="sm">
          <div className="text-2xl font-bold text-espresso">{data.summary.total_hours} hrs</div>
          <div className="text-xs text-taupe mt-0.5">Total Hours</div>
        </Card>
        <Card padding="sm">
          <div className="text-2xl font-bold text-blue">{formatDuration(data.summary.total_minutes)}</div>
          <div className="text-xs text-taupe mt-0.5">Total Time</div>
        </Card>
      </div>

      {grouped.length === 0 ? (
        <Card><p className="text-center text-taupe py-8">No appointments in this period.</p></Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cream text-left text-xs text-taupe uppercase tracking-wide">
                  <th className="py-3 px-3">Client</th>
                  <th className="py-3 px-3">Dogs</th>
                  <th className="py-3 px-3">Service</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Time</th>
                  <th className="py-3 px-3">Duration</th>
                  <th className="py-3 px-3">Team Member</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map(group => (
                  <React.Fragment key={group.date}>
                    <tr className="bg-cream/50">
                      <td colSpan={7} className="py-2 px-3 font-semibold text-espresso text-sm">
                        {format(new Date(group.date + 'T00:00'), 'EEEE, MMM d, yyyy')}
                        <span className="text-taupe font-normal ml-3">{group.rows.length} appointment{group.rows.length !== 1 ? 's' : ''}</span>
                      </td>
                    </tr>
                    {group.rows.map((row: any) => (
                      <tr key={row.id} className="border-b border-cream/50 hover:bg-cream/30 transition-colors">
                        <td className="py-2.5 px-3 font-medium text-espresso">{row.client_name}</td>
                        <td className="py-2.5 px-3 text-taupe">{row.dogs || '—'}</td>
                        <td className="py-2.5 px-3 text-taupe">{formatServiceType(row.service_type)}</td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            row.status === 'completed' ? 'bg-green-100 text-green-800' :
                            row.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                            row.status === 'checked_in' ? 'bg-blue-100 text-blue-800' :
                            'bg-cream text-espresso'
                          }`}>
                            {row.status.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-taupe">{row.scheduled_time}</td>
                        <td className="py-2.5 px-3 font-medium text-espresso">{formatDuration(row.duration_minutes)}</td>
                        <td className="py-2.5 px-3 text-taupe">{row.team_member ?? '—'}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}

// ── Billing Tab ──────────────────────────────────────────────────────────────

function BillingTab({ data }: { data: any }) {
  if (!data?.summary) return null;

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card padding="sm">
          <div className="text-2xl font-bold text-gold">{data.summary.total_invoices}</div>
          <div className="text-xs text-taupe mt-0.5">Total Invoices</div>
        </Card>
        <Card padding="sm">
          <div className="text-2xl font-bold text-espresso">${data.summary.total_revenue}</div>
          <div className="text-xs text-taupe mt-0.5">Total Revenue</div>
        </Card>
        <Card padding="sm">
          <div className="text-2xl font-bold text-taupe">${data.summary.total_gst}</div>
          <div className="text-xs text-taupe mt-0.5">Total GST</div>
        </Card>
        <Card padding="sm">
          <div className="text-2xl font-bold text-green-600">{data.summary.paid_count}</div>
          <div className="text-xs text-taupe mt-0.5">Paid</div>
        </Card>
        <Card padding="sm">
          <div className="text-2xl font-bold text-red-500">${data.summary.outstanding}</div>
          <div className="text-xs text-taupe mt-0.5">Outstanding</div>
        </Card>
      </div>

      {(data.rows?.length ?? 0) === 0 ? (
        <Card><p className="text-center text-taupe py-8">No invoices in this period.</p></Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cream text-left text-xs text-taupe uppercase tracking-wide">
                  <th className="py-3 px-3">Invoice #</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Client</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Subtotal</th>
                  <th className="py-3 px-3 text-right">GST</th>
                  <th className="py-3 px-3 text-right">Total</th>
                  <th className="py-3 px-3">Paid Date</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row: any) => (
                  <tr key={row.id} className="border-b border-cream/50 hover:bg-cream/30 transition-colors">
                    <td className="py-2.5 px-3 font-medium text-espresso">{row.invoice_number}</td>
                    <td className="py-2.5 px-3 text-taupe">{row.date}</td>
                    <td className="py-2.5 px-3 text-espresso">{row.client_name}</td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        row.status === 'paid' ? 'bg-green-100 text-green-800' :
                        row.status === 'overdue' ? 'bg-red-100 text-red-800' :
                        row.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                        'bg-cream text-espresso'
                      }`}>
                        {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-taupe">${row.subtotal}</td>
                    <td className="py-2.5 px-3 text-right text-taupe">${row.gst}</td>
                    <td className="py-2.5 px-3 text-right font-medium text-espresso">${row.total}</td>
                    <td className="py-2.5 px-3 text-taupe">{row.paid_at ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
