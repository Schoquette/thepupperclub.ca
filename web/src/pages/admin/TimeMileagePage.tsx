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

interface Row {
  id: number;
  date: string;
  client_name: string;
  dogs: string;
  service_type: string;
  address: string | null;
  assigned_to: string | null;
  check_in: string | null;
  check_out: string | null;
  duration_minutes: number | null;
  distance_km: number | null;
}

interface Summary {
  total_visits: number;
  total_minutes: number;
  total_hours: number;
  total_km: number;
}

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

function formatDuration(minutes: number | null): string {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatServiceType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const PRESETS: { value: Preset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'ytd', label: 'Year to Date' },
  { value: 'custom', label: 'Custom' },
];

export default function TimeMileagePage() {
  const [preset, setPreset] = useState<Preset>('week');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [teamFilter, setTeamFilter] = useState('');

  // Load team members for filter
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

  const { data, isLoading } = useQuery<{ rows: Row[]; summary: Summary }>({
    queryKey: ['time-mileage', range.start, range.end, teamFilter],
    queryFn: () =>
      api.get('/admin/time-mileage', {
        params: {
          start: range.start,
          end: range.end,
          ...(teamFilter ? { assigned_to: teamFilter } : {}),
        },
      }).then(r => r.data.data),
    enabled: !!range.start && !!range.end,
  });

  // Group rows by date for daily subtotals
  const grouped = useMemo(() => {
    if (!data?.rows) return [];
    const map = new Map<string, Row[]>();
    data.rows.forEach(row => {
      const existing = map.get(row.date) ?? [];
      existing.push(row);
      map.set(row.date, existing);
    });
    return Array.from(map.entries()).map(([date, rows]) => ({
      date,
      rows,
      totalMinutes: rows.reduce((s, r) => s + (r.duration_minutes ?? 0), 0),
      totalKm: rows.reduce((s, r) => s + (r.distance_km ?? 0), 0),
    }));
  }, [data?.rows]);

  return (
    <div className="space-y-6">
      <h1 className="page-title">Time & Mileage</h1>

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

          {/* Team member filter */}
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

          {/* Custom date range */}
          {preset === 'custom' && (
            <div className="flex items-end gap-3">
              <div>
                <label className="text-xs text-taupe block mb-1">Start</label>
                <input
                  type="date"
                  className="input text-sm"
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-taupe block mb-1">End</label>
                <input
                  type="date"
                  className="input text-sm"
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Date range indicator */}
        {range.start && range.end && (
          <div className="mt-3 text-sm text-taupe">
            {format(new Date(range.start + 'T00:00'), 'MMM d, yyyy')} — {format(new Date(range.end + 'T00:00'), 'MMM d, yyyy')}
          </div>
        )}
      </Card>

      {/* Summary cards */}
      {data?.summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card padding="sm">
            <div className="text-2xl mb-1">📋</div>
            <div className="text-2xl font-bold text-gold">{data.summary.total_visits}</div>
            <div className="text-xs text-taupe mt-0.5">Total Visits</div>
          </Card>
          <Card padding="sm">
            <div className="text-2xl mb-1">⏱️</div>
            <div className="text-2xl font-bold text-espresso">{formatDuration(data.summary.total_minutes)}</div>
            <div className="text-xs text-taupe mt-0.5">Total Time</div>
          </Card>
          <Card padding="sm">
            <div className="text-2xl mb-1">🚗</div>
            <div className="text-2xl font-bold text-blue">{data.summary.total_km} km</div>
            <div className="text-xs text-taupe mt-0.5">Total Distance</div>
          </Card>
          <Card padding="sm">
            <div className="text-2xl mb-1">⏰</div>
            <div className="text-2xl font-bold text-espresso">{data.summary.total_hours}</div>
            <div className="text-xs text-taupe mt-0.5">Total Hours</div>
          </Card>
        </div>
      )}

      {/* Detailed table */}
      {isLoading ? (
        <PageLoader />
      ) : grouped.length === 0 ? (
        <Card>
          <p className="text-center text-taupe py-8">No completed visits in this period.</p>
        </Card>
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
                    {/* Date header row */}
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
                    {/* Visit rows */}
                    {group.rows.map(row => (
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
                {/* Grand total row */}
                <tr className="bg-espresso/5 font-semibold text-espresso">
                  <td colSpan={6} className="py-3 px-3">
                    Total ({data?.summary.total_visits} visits)
                  </td>
                  <td className="py-3 px-3 text-right">{formatDuration(data?.summary.total_minutes ?? 0)}</td>
                  <td className="py-3 px-3 text-right">{data?.summary.total_km ?? 0} km</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
