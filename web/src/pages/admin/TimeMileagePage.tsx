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
  scheduled_time: string | null;
  scheduled_minutes: number | null;
  check_in: string | null;
  check_out: string | null;
  actual_minutes: number | null;
  duration_minutes: number | null;
  distance_km: number | null;
  status: string;
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
  const rounded = Math.round(Number(minutes));
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatServiceType(type: string): string {
  if (type === 'walk_30') return '30-Minute Visit';
  if (type === 'walk_60') return '60-Minute Visit';
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
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [timeMode, setTimeMode] = useState<'actual' | 'scheduled'>('actual');

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

  const getDuration = (row: Row) =>
    timeMode === 'actual' ? (row.actual_minutes ?? row.scheduled_minutes) : row.scheduled_minutes;

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
      totalMinutes: rows.reduce((s, r) => s + Number(getDuration(r) ?? 0), 0),
      totalKm: rows.reduce((s, r) => s + Number(r.distance_km ?? 0), 0),
    }));
  }, [data?.rows, timeMode]); // eslint-disable-line

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

          {/* Time mode toggle */}
          <div>
            <div className="text-xs font-semibold text-taupe uppercase tracking-wide mb-2">Time</div>
            <div className="flex gap-1 bg-cream rounded-full p-0.5">
              {(['actual', 'scheduled'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setTimeMode(mode)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
                    timeMode === mode
                      ? 'bg-gold text-white'
                      : 'text-espresso hover:text-gold'
                  }`}
                >
                  {mode}
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
      {data?.summary && (() => {
        const totalMin = grouped.reduce((s, g) => s + g.totalMinutes, 0);
        const totalKm = grouped.reduce((s, g) => s + g.totalKm, 0);
        return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card padding="sm">
            <div className="text-2xl mb-1">📋</div>
            <div className="text-2xl font-bold text-gold">{data.summary.total_visits}</div>
            <div className="text-xs text-taupe mt-0.5">Total Visits</div>
          </Card>
          <Card padding="sm">
            <div className="text-2xl mb-1">⏱️</div>
            <div className="text-2xl font-bold text-espresso">{formatDuration(totalMin)}</div>
            <div className="text-xs text-taupe mt-0.5">Total Time ({timeMode})</div>
          </Card>
          <Card padding="sm">
            <div className="text-2xl mb-1">🚗</div>
            <div className="text-2xl font-bold text-blue">{totalKm.toFixed(1)} km</div>
            <div className="text-xs text-taupe mt-0.5">Total Distance</div>
          </Card>
          <Card padding="sm">
            <div className="text-2xl mb-1">⏰</div>
            <div className="text-2xl font-bold text-espresso">{(totalMin / 60).toFixed(1)}</div>
            <div className="text-xs text-taupe mt-0.5">Total Hours</div>
          </Card>
        </div>
        );
      })()}

      {/* Detailed table */}
      {isLoading ? (
        <PageLoader />
      ) : grouped.length === 0 ? (
        <Card>
          <p className="text-center text-taupe py-8">No visits in this period.</p>
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
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">{timeMode === 'actual' ? 'Check In' : 'Scheduled'}</th>
                  <th className="py-3 px-3">{timeMode === 'actual' ? 'Check Out' : ''}</th>
                  <th className="py-3 px-3 text-right">Duration</th>
                  <th className="py-3 px-3 text-right">Mileage</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map(group => {
                  const isCollapsed = !!collapsed[group.date];
                  return (
                  <React.Fragment key={group.date}>
                    {/* Date header row */}
                    <tr
                      className="bg-gold/10 border-l-4 border-l-gold cursor-pointer select-none hover:bg-gold/15 transition-colors"
                      onClick={() => setCollapsed(prev => ({ ...prev, [group.date]: !prev[group.date] }))}
                    >
                      <td colSpan={9} className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <svg
                            className={`w-4 h-4 text-gold flex-shrink-0 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                          </svg>
                          <span className="font-bold text-espresso">
                            {format(new Date(group.date + 'T00:00'), 'EEEE, MMMM d, yyyy')}
                          </span>
                          <span className="text-xs text-taupe font-medium bg-white/60 px-2 py-0.5 rounded-full">
                            {group.rows.length} visit{group.rows.length !== 1 ? 's' : ''}
                            {' · '}{formatDuration(group.totalMinutes)}
                            {' · '}{group.totalKm.toFixed(1)} km
                          </span>
                        </div>
                      </td>
                    </tr>
                    {/* Visit rows */}
                    {!isCollapsed && group.rows.map(row => (
                      <tr key={row.id} className="border-b border-cream/50 hover:bg-cream/30 transition-colors">
                        <td className="py-2.5 px-3 pl-8 font-medium text-espresso">{row.client_name}</td>
                        <td className="py-2.5 px-3 text-taupe">{row.dogs || '—'}</td>
                        <td className="py-2.5 px-3 text-taupe">{formatServiceType(row.service_type)}</td>
                        <td className="py-2.5 px-3 text-taupe">{row.assigned_to ?? '—'}</td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            row.status === 'completed' ? 'bg-green-50 text-green-600' :
                            row.status === 'checked_in' ? 'bg-gold/10 text-gold' :
                            'bg-blue/10 text-blue'
                          }`}>
                            {row.status === 'checked_in' ? 'Checked In' : row.status === 'completed' ? 'Completed' : 'Scheduled'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-taupe">{timeMode === 'actual' ? (row.check_in ?? '—') : (row.scheduled_time ?? '—')}</td>
                        <td className="py-2.5 px-3 text-taupe">{timeMode === 'actual' ? (row.check_out ?? '—') : ''}</td>
                        <td className="py-2.5 px-3 text-right font-medium text-espresso">{formatDuration(getDuration(row))}</td>
                        <td className="py-2.5 px-3 text-right font-medium text-espresso">
                          {row.distance_km != null ? `${row.distance_km} km` : '—'}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                  );
                })}
                {/* Grand total row */}
                {(() => {
                  const grandMin = grouped.reduce((s, g) => s + g.totalMinutes, 0);
                  const grandKm = grouped.reduce((s, g) => s + g.totalKm, 0);
                  return (
                  <tr className="bg-espresso/5 font-semibold text-espresso">
                    <td colSpan={7} className="py-3 px-3">
                      Total ({data?.summary.total_visits} visits)
                    </td>
                    <td className="py-3 px-3 text-right">{formatDuration(grandMin)}</td>
                    <td className="py-3 px-3 text-right">{grandKm.toFixed(1)} km</td>
                  </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
