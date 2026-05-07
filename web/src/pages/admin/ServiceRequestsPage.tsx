import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Input';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { format, parseISO } from 'date-fns';
import { ChevronUp, ChevronDown, Filter, Download } from 'lucide-react';

const TIME_BLOCK_LABELS = {
  early_morning: '6–9 AM', morning: '9 AM–12 PM', midday: '12–3 PM',
  afternoon: '3–6 PM', evening: '6–9 PM',
};

// Maps a time block to the start-of-block time, used to pre-fill the datetime picker
const TIME_BLOCK_DEFAULTS: Record<string, string> = {
  early_morning: '07:00',
  morning:       '10:00',
  midday:        '12:30',
  afternoon:     '15:00',
  evening:       '18:00',
};

// Generate 15-minute increment time options from 6:00 AM to 9:00 PM
const TIME_OPTIONS: { value: string; label: string }[] = [];
for (let h = 6; h <= 21; h++) {
  for (let m = 0; m < 60; m += 15) {
    if (h === 21 && m > 0) break; // stop at 9:00 PM
    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    const value = `${hh}:${mm}`;
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const label = `${hour12}:${mm} ${ampm}`;
    TIME_OPTIONS.push({ value, label });
  }
}

// Service type durations (minutes) for display
const SERVICE_DURATIONS: Record<string, number> = {
  walk_30: 30, walk_60: 60, custom: 30, day_boarding: 480, overnight: 1440,
};

// Mini availability timeline for a given date
function AvailabilityTimeline({ date, selectedTime, serviceDuration }: { date: string; selectedTime?: string; serviceDuration?: number }) {
  const { data } = useQuery({
    queryKey: ['day-appointments', date],
    queryFn: () => api.get(`/admin/appointments?date=${date}`).then(r => r.data),
    enabled: !!date,
  });

  const appointments = data?.data ?? [];
  const START_HOUR = 6;
  const END_HOUR = 21;
  const totalMinutes = (END_HOUR - START_HOUR) * 60;

  const toPercent = (h: number, m: number) => {
    const mins = (h - START_HOUR) * 60 + m;
    return Math.max(0, Math.min(100, (mins / totalMinutes) * 100));
  };

  const hourMarkers = [];
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    hourMarkers.push(h);
  }

  // Parse selected time for the "proposed" indicator
  const proposedStart = selectedTime ? (() => {
    const [hh, mm] = selectedTime.split(':').map(Number);
    return { h: hh, m: mm };
  })() : null;

  const duration = serviceDuration ?? 30;

  return (
    <div className="mt-3">
      <label className="label text-xs">Schedule for {format(parseISO(date), 'EEEE, MMM d')}</label>
      <div className="relative h-12 bg-cream rounded-lg mt-1 overflow-hidden border border-taupe/30">
        {/* Hour markers */}
        {hourMarkers.map(h => (
          <div key={h} className="absolute top-0 bottom-0 border-l border-taupe/20" style={{ left: `${toPercent(h, 0)}%` }}>
            <span className="absolute top-0.5 left-0.5 text-[9px] text-taupe leading-none">
              {h > 12 ? h - 12 : h}{h >= 12 ? 'p' : 'a'}
            </span>
          </div>
        ))}

        {/* Existing appointments */}
        {appointments.map((apt: any) => {
          if (!apt.scheduled_time || apt.status === 'cancelled') return null;
          const dt = new Date(apt.scheduled_time);
          const h = dt.getHours();
          const m = dt.getMinutes();
          const aptDuration = SERVICE_DURATIONS[apt.service_type] ?? 30;
          const left = toPercent(h, m);
          const width = (aptDuration / totalMinutes) * 100;
          return (
            <div
              key={apt.id}
              className="absolute top-4 bottom-1 rounded bg-blue/60 flex items-center justify-center overflow-hidden"
              style={{ left: `${left}%`, width: `${Math.max(width, 1)}%` }}
              title={`${apt.user?.name ?? 'Appointment'} · ${format(dt, 'h:mm a')} · ${apt.service_type === 'walk_30' ? '30-Minute Visit' : apt.service_type === 'walk_60' ? '60-Minute Visit' : apt.service_type.replace(/_/g, ' ')}`}
            >
              <span className="text-[8px] text-white font-medium truncate px-0.5">
                {apt.user?.name?.split(' ')[0] ?? ''}
              </span>
            </div>
          );
        })}

        {/* Proposed time indicator */}
        {proposedStart && (
          <div
            className="absolute top-3.5 bottom-0.5 rounded border-2 border-gold bg-gold/20"
            style={{
              left: `${toPercent(proposedStart.h, proposedStart.m)}%`,
              width: `${Math.max((duration / totalMinutes) * 100, 1)}%`,
            }}
            title={`Proposed: ${selectedTime}`}
          />
        )}
      </div>
      {appointments.length === 0 && (
        <p className="text-[10px] text-taupe mt-0.5">No existing appointments this day</p>
      )}
      {appointments.length > 0 && (
        <p className="text-[10px] text-taupe mt-0.5">{appointments.filter((a: any) => a.status !== 'cancelled').length} appointment{appointments.filter((a: any) => a.status !== 'cancelled').length !== 1 ? 's' : ''} scheduled</p>
      )}
    </div>
  );
}

const SERVICE_TYPES = [
  { value: 'walk_30', label: '30-Minute Visit' },
  { value: 'walk_60', label: '60-Minute Visit' },
  { value: 'drop_in', label: 'Drop-In Visit' },
  { value: 'day_boarding', label: 'Day Boarding' },
  { value: 'overnight', label: 'Overnight' },
];

const TIME_BLOCKS = [
  { value: 'early_morning', label: 'Early Morning (6–9 AM)' },
  { value: 'morning', label: 'Morning (9 AM–12 PM)' },
  { value: 'midday', label: 'Midday (12–3 PM)' },
  { value: 'afternoon', label: 'Afternoon (3–6 PM)' },
  { value: 'evening', label: 'Evening (6–9 PM)' },
];

function blankCreateForm() {
  return { user_id: '', dog_ids: [] as number[], service_type: 'walk_60', preferred_time_block: 'morning', preferred_date: '', notes: '' };
}

const SERVICE_LABELS: Record<string, string> = {
  walk_30: '30-Minute Visit', walk_60: '60-Minute Visit', drop_in: 'Drop-In',
  overnight: 'Overnight', day_boarding: 'Day Boarding',
};

const REQUEST_TYPE_LABELS: Record<string, string> = {
  new_visit: 'New Service',
  time_change: 'Modification',
  extension: 'Modification',
  special_service: 'Modification',
};

const REQUEST_TYPE_DETAIL: Record<string, string> = {
  new_visit: 'New Service',
  time_change: 'Time Change',
  extension: 'Extension',
  special_service: 'Add-on Service',
};

const TYPE_FILTER_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'new_visit', label: 'New Service' },
  { value: 'modification', label: 'Modification' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'declined', label: 'Declined' },
  { value: 'counter_offered', label: 'Counter Offered' },
];

type SortField = 'date' | 'client' | 'service' | 'status';
type SortDir = 'asc' | 'desc';

export default function AdminServiceRequestsPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<any>(null);
  const [action, setAction] = useState<'approve' | 'decline' | 'counter' | null>(null);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [adminResponse, setAdminResponse] = useState('');
  const [counterDate, setCounterDate] = useState('');
  const [counterTime, setCounterTime] = useState('');
  const [apiError, setApiError] = useState<string | null>(null);

  // Billing
  const [billingType, setBillingType] = useState<'included_in_plan' | 'charge'>('included_in_plan');
  const [billingDescription, setBillingDescription] = useState('');
  const [billingAmount, setBillingAmount] = useState('');

  // Create form
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState(blankCreateForm);
  const [createError, setCreateError] = useState('');

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [filterType, setFilterType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-service-requests'],
    queryFn: () => api.get('/admin/service-requests').then(r => r.data),
    refetchInterval: 30_000,
  });

  // Build unique client list for filter dropdown
  const clientOptions = useMemo(() => {
    const all: any[] = data?.data ?? [];
    const map = new Map<number, string>();
    all.forEach((sr: any) => { if (sr.user) map.set(sr.user.id, sr.user.name); });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);

  // Filter + sort
  const filteredRequests = useMemo(() => {
    let list: any[] = data?.data ?? [];
    if (filterStatus) list = list.filter((sr: any) => sr.status === filterStatus);
    if (filterClient) list = list.filter((sr: any) => sr.user_id === Number(filterClient));
    if (filterType === 'new_visit') list = list.filter((sr: any) => (sr.request_type ?? 'new_visit') === 'new_visit');
    if (filterType === 'modification') list = list.filter((sr: any) => ['time_change', 'extension', 'special_service'].includes(sr.request_type));
    if (dateFrom) list = list.filter((sr: any) => sr.preferred_date && String(sr.preferred_date).slice(0, 10) >= dateFrom);
    if (dateTo) list = list.filter((sr: any) => sr.preferred_date && String(sr.preferred_date).slice(0, 10) <= dateTo);
    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'date': {
          const da = a.preferred_date ? new Date(a.preferred_date).getTime() : 0;
          const db = b.preferred_date ? new Date(b.preferred_date).getTime() : 0;
          cmp = da - db; break;
        }
        case 'client': cmp = (a.user?.name ?? '').localeCompare(b.user?.name ?? ''); break;
        case 'service': cmp = (a.service_type ?? '').localeCompare(b.service_type ?? ''); break;
        case 'status': cmp = (a.status ?? '').localeCompare(b.status ?? ''); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [data, filterStatus, filterClient, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir(field === 'date' ? 'desc' : 'asc'); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronUp className="w-3 h-3 text-taupe/40" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-espresso" /> : <ChevronDown className="w-3 h-3 text-espresso" />;
  };

  const exportCSV = () => {
    const headers = ['Date', 'Client', 'Service', 'Time', 'Dogs', 'Type', 'Notes', 'Status'];
    const rows = filteredRequests.map((sr: any) => [
      sr.preferred_date ? format(new Date(sr.preferred_date), 'yyyy-MM-dd') : '',
      sr.user?.name ?? '',
      SERVICE_LABELS[sr.service_type] ?? sr.service_type?.replace(/_/g, ' ') ?? '',
      TIME_BLOCK_LABELS[sr.preferred_time_block as keyof typeof TIME_BLOCK_LABELS] ?? sr.preferred_time_block ?? '',
      sr.dogs?.map((d: any) => d.name).join(', ') ?? '',
      REQUEST_TYPE_DETAIL[sr.request_type ?? 'new_visit'] ?? '',
      (sr.notes ?? '').replace(/"/g, '""'),
      sr.status?.replace(/_/g, ' ') ?? '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `service-requests-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const printWin = window.open('', '_blank');
    if (!printWin) return;
    const rows = filteredRequests.map((sr: any) => `
      <tr>
        <td>${sr.preferred_date ? format(new Date(sr.preferred_date), 'MMM d, yyyy') : ''}</td>
        <td>${sr.user?.name ?? ''}</td>
        <td>${SERVICE_LABELS[sr.service_type] ?? sr.service_type?.replace(/_/g, ' ') ?? ''}</td>
        <td>${TIME_BLOCK_LABELS[sr.preferred_time_block as keyof typeof TIME_BLOCK_LABELS] ?? ''}</td>
        <td>${sr.dogs?.map((d: any) => d.name).join(', ') ?? ''}</td>
        <td>${REQUEST_TYPE_DETAIL[sr.request_type ?? 'new_visit'] ?? ''}</td>
        <td>${sr.status?.replace(/_/g, ' ') ?? ''}</td>
      </tr>`).join('');
    printWin.document.write(`<!DOCTYPE html><html><head><title>Service Requests</title>
      <style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}th{background:#f5f5f5;font-weight:600}
      h1{font-size:18px;margin-bottom:4px}p{font-size:11px;color:#888;margin-bottom:12px}</style></head>
      <body><h1>Service Requests</h1><p>Exported ${format(new Date(), 'MMM d, yyyy h:mm a')}</p>
      <table><thead><tr><th>Date</th><th>Client</th><th>Service</th><th>Time</th><th>Dogs</th><th>Type</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody></table></body></html>`);
    printWin.document.close();
    printWin.onload = () => { printWin.print(); };
  };

  // Fetch Stripe products for billing picker
  const { data: stripeProducts } = useQuery({
    queryKey: ['stripe-products'],
    queryFn: () => api.get('/admin/stripe/products').then(r => r.data.data ?? []),
    enabled: action === 'approve',
    staleTime: 60_000,
  });

  // Load clients for the create form
  const { data: clientsData } = useQuery({
    queryKey: ['admin-clients-sr'],
    queryFn: () => api.get('/admin/clients').then(r => r.data.data),
    enabled: creating,
  });

  // Load dogs for selected client
  const selectedClientId = createForm.user_id ? parseInt(createForm.user_id) : null;
  const { data: clientDetail } = useQuery({
    queryKey: ['admin-client-dogs-sr', selectedClientId],
    queryFn: () => api.get(`/admin/clients/${selectedClientId}`).then(r => r.data.data),
    enabled: !!selectedClientId,
  });
  const clientDogs: any[] = (clientDetail?.dogs ?? []).filter((d: any) => d.is_active);

  const createRequest = useMutation({
    mutationFn: () => api.post('/admin/service-requests', {
      ...createForm,
      user_id: parseInt(createForm.user_id),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-service-requests'] });
      setCreating(false);
      setCreateForm(blankCreateForm());
      setCreateError('');
    },
    onError: (err: any) => {
      setCreateError(err.response?.data?.message ?? 'Failed to create request.');
    },
  });

  const respond = useMutation({
    mutationFn: (payload: object) =>
      api.patch(`/admin/service-requests/${selected.id}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-service-requests'] });
      setSelected(null); setAction(null); setApiError(null);
    },
    onError: (err: any) => {
      setApiError(err.response?.data?.message || 'Something went wrong. Please try again.');
    },
  });

  const handleAction = () => {
    if (action === 'approve') {
      respond.mutate({
        action: 'approve',
        admin_response: adminResponse,
        scheduled_time: `${scheduledDate}T${scheduledTime}`,
        billing_type: billingType,
        billing_description: billingType === 'charge' ? billingDescription : undefined,
        billing_amount: billingType === 'charge' ? parseFloat(billingAmount) || 0 : undefined,
      });
    } else if (action === 'decline') {
      respond.mutate({ action: 'decline', admin_response: adminResponse });
    } else if (action === 'counter') {
      respond.mutate({ action: 'counter', admin_response: adminResponse, counter_date: counterDate, counter_time: counterTime });
    }
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Service Requests</h1>
        <Button size="sm" onClick={() => { setCreating(true); setCreateForm(blankCreateForm()); setCreateError(''); }}>
          + Create Request
        </Button>
      </div>

      {/* Create request modal */}
      <Modal open={creating} onClose={() => setCreating(false)} title="Create Service Request" size="md">
        <div className="space-y-4">
          {/* Client */}
          <div>
            <label className="label">Client *</label>
            <select
              className="input"
              value={createForm.user_id}
              onChange={e => setCreateForm(f => ({ ...f, user_id: e.target.value, dog_ids: [] }))}
            >
              <option value="">Select a client</option>
              {(clientsData ?? []).map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Dogs */}
          {clientDogs.length > 0 && (
            <div>
              <label className="label">Dogs *</label>
              <div className="flex gap-2 flex-wrap">
                {clientDogs.map((d: any) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setCreateForm(f => ({
                      ...f,
                      dog_ids: f.dog_ids.includes(d.id)
                        ? f.dog_ids.filter(id => id !== d.id)
                        : [...f.dog_ids, d.id],
                    }))}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      createForm.dog_ids.includes(d.id)
                        ? 'bg-espresso text-cream border-espresso'
                        : 'border-taupe text-espresso hover:bg-cream'
                    }`}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Service type */}
          <div>
            <label className="label">Service Type *</label>
            <select
              className="input"
              value={createForm.service_type}
              onChange={e => setCreateForm(f => ({ ...f, service_type: e.target.value }))}
            >
              {SERVICE_TYPES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Date + Time Block */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Preferred Date *"
              type="date"
              min={new Date().toISOString().substring(0, 10)}
              value={createForm.preferred_date}
              onChange={e => setCreateForm(f => ({ ...f, preferred_date: e.target.value }))}
            />
            <div>
              <label className="label">Preferred Time *</label>
              <select
                className="input"
                value={createForm.preferred_time_block}
                onChange={e => setCreateForm(f => ({ ...f, preferred_time_block: e.target.value }))}
              >
                {TIME_BLOCKS.map(tb => (
                  <option key={tb.value} value={tb.value}>{tb.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <Textarea
            label="Notes"
            rows={2}
            value={createForm.notes}
            onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Any special instructions..."
          />

          {createError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{createError}</p>}

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
            <Button
              loading={createRequest.isPending}
              disabled={!createForm.user_id || createForm.dog_ids.length === 0 || !createForm.preferred_date}
              onClick={() => createRequest.mutate()}
            >
              Create Request
            </Button>
          </div>
        </div>
      </Modal>

      {/* Filters */}
      <Card padding="sm">
        <div className="flex flex-wrap items-center gap-3">
          <Filter className="w-4 h-4 text-taupe" />
          <select
            className="input !py-1.5 !text-sm w-auto min-w-[140px]"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            className="input !py-1.5 !text-sm w-auto min-w-[160px]"
            value={filterClient}
            onChange={e => setFilterClient(e.target.value)}
          >
            <option value="">All Clients</option>
            {clientOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <select
            className="input !py-1.5 !text-sm w-auto min-w-[140px]"
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
          >
            {TYPE_FILTER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <input type="date" className="input !py-1.5 !text-sm w-auto" value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="From date" />
          <span className="text-xs text-taupe">to</span>
          <input type="date" className="input !py-1.5 !text-sm w-auto" value={dateTo} onChange={e => setDateTo(e.target.value)} title="To date" />
          {(filterStatus || filterClient || filterType || dateFrom || dateTo) && (
            <button
              onClick={() => { setFilterStatus(''); setFilterClient(''); setFilterType(''); setDateFrom(''); setDateTo(''); }}
              className="text-xs text-blue hover:underline font-medium"
            >
              Clear filters
            </button>
          )}
        </div>
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-cream">
          <span className="text-xs text-taupe">{filteredRequests.length} request{filteredRequests.length !== 1 ? 's' : ''}</span>
          <div className="flex gap-2">
            <button onClick={() => exportCSV()} className="flex items-center gap-1 text-xs text-espresso hover:text-blue font-medium">
              <Download className="w-3 h-3" /> CSV
            </button>
            <button onClick={() => exportPDF()} className="flex items-center gap-1 text-xs text-espresso hover:text-blue font-medium">
              <Download className="w-3 h-3" /> PDF
            </button>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cream text-left">
                {([
                  ['date', 'Date'],
                  ['client', 'Client'],
                  ['service', 'Service'],
                ] as [SortField, string][]).map(([field, label]) => (
                  <th key={field} className="px-4 py-3 font-medium text-taupe">
                    <button onClick={() => toggleSort(field)} className="flex items-center gap-1 hover:text-espresso">
                      {label} <SortIcon field={field} />
                    </button>
                  </th>
                ))}
                <th className="px-4 py-3 font-medium text-taupe">Time</th>
                <th className="px-4 py-3 font-medium text-taupe">Dogs</th>
                <th className="px-4 py-3 font-medium text-taupe">Type</th>
                <th className="px-4 py-3 font-medium text-taupe">Notes</th>
                <th className="px-4 py-3 font-medium text-taupe">
                  <button onClick={() => toggleSort('status')} className="flex items-center gap-1 hover:text-espresso">
                    Status <SortIcon field="status" />
                  </button>
                </th>
                <th className="px-4 py-3 font-medium text-taupe text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((sr: any) => (
                <tr key={sr.id} className="border-b border-cream/60 hover:bg-cream/30 transition-colors">
                  <td className="px-4 py-3 text-espresso whitespace-nowrap">
                    {sr.preferred_date ? format(new Date(sr.preferred_date), 'MMM d, yyyy') : '—'}
                  </td>
                  <td className="px-4 py-3 font-medium text-espresso whitespace-nowrap">{sr.user?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-espresso whitespace-nowrap">
                    {SERVICE_LABELS[sr.service_type] ?? sr.service_type?.replace(/_/g, ' ')}
                  </td>
                  <td className="px-4 py-3 text-taupe whitespace-nowrap">
                    {TIME_BLOCK_LABELS[sr.preferred_time_block as keyof typeof TIME_BLOCK_LABELS] ?? sr.preferred_time_block}
                  </td>
                  <td className="px-4 py-3 text-espresso whitespace-nowrap">
                    {sr.dogs?.map((d: any) => d.name).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {(() => {
                      const rt = sr.request_type ?? 'new_visit';
                      const isNew = rt === 'new_visit';
                      return (
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${isNew ? 'bg-blue/10 text-blue' : 'bg-gold/10 text-gold'}`}>
                          {REQUEST_TYPE_DETAIL[rt] ?? rt}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 text-taupe max-w-[200px] truncate" title={sr.notes ?? ''}>
                    {sr.notes ? <span className="italic">"{sr.notes}"</span> : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusBadge(sr.status)}>{sr.status.replace('_', ' ')}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {sr.status === 'pending' && (
                      <Button size="sm" onClick={() => {
                        setSelected(sr);
                        setAction('approve');
                        setAdminResponse('');
                        setApiError(null);
                        setBillingType('included_in_plan');
                        setBillingDescription('');
                        setBillingAmount('');
                        const date = sr.preferred_date ? String(sr.preferred_date).substring(0, 10) : '';
                        const time = TIME_BLOCK_DEFAULTS[sr.preferred_time_block] ?? '09:00';
                        setScheduledDate(date);
                        setScheduledTime(time);
                        setCounterDate(date);
                        setCounterTime(time);
                      }}>
                        Review
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredRequests.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-taupe">
                    {(filterStatus || filterClient) ? 'No requests match your filters.' : 'No service requests.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={!!action && !!selected} onClose={() => { setSelected(null); setAction(null); setApiError(null); setScheduledDate(''); setScheduledTime(''); setAdminResponse(''); setCounterDate(''); setCounterTime(''); }} title="Respond to Request">
        {selected && (
          <div className="space-y-4">
            <div className="bg-cream rounded-lg p-4 text-sm">
              <div className="font-semibold">{selected.user?.name} — {selected.dogs?.map((d: any) => d.name).join(', ')}</div>
              <div className="text-taupe mt-1">
                {selected.service_type === 'walk_30' ? '30-Minute Visit' : selected.service_type === 'walk_60' ? '60-Minute Visit' : selected.service_type.replace(/_/g, ' ')} · {TIME_BLOCK_LABELS[selected.preferred_time_block as keyof typeof TIME_BLOCK_LABELS]} · {format(new Date(selected.preferred_date), 'EEEE, MMM d')}
              </div>
            </div>

            <div className="flex gap-2">
              {(['approve','counter','decline'] as const).map(a => (
                <button key={a} onClick={() => setAction(a)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize border transition-colors ${
                    action === a
                      ? a === 'approve' ? 'bg-gold text-white border-gold'
                        : a === 'decline' ? 'bg-red-600 text-white border-red-600'
                        : 'bg-blue text-white border-blue'
                      : 'border-taupe text-espresso hover:bg-cream'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>

            {action === 'approve' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Date" type="date" min={new Date().toISOString().substring(0, 10)} value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} />
                  <div>
                    <label className="label">Time</label>
                    <select className="input" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)}>
                      {TIME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
                {scheduledDate && (
                  <AvailabilityTimeline
                    date={scheduledDate}
                    selectedTime={scheduledTime}
                    serviceDuration={SERVICE_DURATIONS[selected?.service_type] ?? 30}
                  />
                )}

                {/* Billing */}
                <div className="border-t border-cream pt-4">
                  <label className="label">Billing</label>
                  <div className="flex gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => { setBillingType('included_in_plan'); setBillingDescription(''); setBillingAmount(''); }}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                        billingType === 'included_in_plan' ? 'bg-gold text-white border-gold' : 'border-taupe text-espresso hover:bg-cream'
                      }`}
                    >
                      Included in Plan
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingType('charge')}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                        billingType === 'charge' ? 'bg-gold text-white border-gold' : 'border-taupe text-espresso hover:bg-cream'
                      }`}
                    >
                      Extra Charge
                    </button>
                  </div>

                  {billingType === 'charge' && (
                    <div className="space-y-3">
                      {/* Stripe product quick-pick */}
                      {Array.isArray(stripeProducts) && stripeProducts.length > 0 && (
                        <div>
                          <label className="label text-xs">Quick pick from Stripe</label>
                          <select
                            className="input"
                            value=""
                            onChange={e => {
                              const val = e.target.value;
                              if (!val) return;
                              // Format: productName|||amount
                              const [name, amt] = val.split('|||');
                              setBillingDescription(name);
                              setBillingAmount(amt);
                            }}
                          >
                            <option value="">Select a product...</option>
                            {(stripeProducts as any[]).map((p: any) =>
                              (p.prices ?? []).map((pr: any) => (
                                <option key={pr.id} value={`${p.name}|||${pr.amount ?? 0}`}>
                                  {p.name}{pr.nickname ? ` — ${pr.nickname}` : ''} — ${pr.amount?.toFixed(2) ?? '0.00'} {pr.currency}
                                </option>
                              ))
                            )}
                          </select>
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                          <Input
                            label="Description"
                            value={billingDescription}
                            onChange={e => setBillingDescription(e.target.value)}
                            placeholder="e.g. 30-Minute Visit (extra)"
                          />
                        </div>
                        <Input
                          label="Amount ($)"
                          type="number"
                          min="0"
                          step="0.01"
                          value={billingAmount}
                          onChange={e => setBillingAmount(e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      <p className="text-xs text-taupe">This will be added as a line item to the client's next invoice (or a new draft will be created).</p>
                    </div>
                  )}

                  {billingType === 'included_in_plan' && (
                    <p className="text-xs text-taupe">No extra charge — this visit is covered by the client's plan.</p>
                  )}
                </div>
              </div>
            )}
            {action === 'counter' && (
              <div>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Counter date" type="date" min={new Date().toISOString().substring(0, 10)} value={counterDate} onChange={e => setCounterDate(e.target.value)} />
                  <div>
                    <label className="label">Counter time</label>
                    <select className="input" value={counterTime} onChange={e => setCounterTime(e.target.value)}>
                      {TIME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
                {counterDate && (
                  <AvailabilityTimeline
                    date={counterDate}
                    selectedTime={counterTime}
                    serviceDuration={SERVICE_DURATIONS[selected?.service_type] ?? 30}
                  />
                )}
              </div>
            )}
            <Textarea
              label="Message to client (optional)"
              rows={3}
              value={adminResponse}
              onChange={e => setAdminResponse(e.target.value)}
              placeholder="Any notes for the client..."
            />
            {apiError && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{apiError}</p>
            )}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setSelected(null); setAction(null); setApiError(null); setScheduledDate(''); setScheduledTime(''); setAdminResponse(''); setCounterDate(''); setCounterTime(''); }}>Cancel</Button>
              <Button
                loading={respond.isPending}
                variant={action === 'decline' ? 'danger' : 'primary'}
                disabled={(action === 'approve' && (!scheduledDate || !scheduledTime)) || (action === 'counter' && (!counterDate || !counterTime))}
                onClick={handleAction}
              >
                {action === 'approve' ? 'Approve & Create Appointment' : action === 'decline' ? 'Decline Request' : 'Send Counter Offer'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
