import React, { useState } from 'react';
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

const TIME_BLOCK_LABELS = {
  early_morning: '7–10 AM', morning: '9–12 PM', midday: '11 AM–2 PM',
  afternoon: '2–5 PM', evening: '5–8 PM',
};

// Maps a time block to the start-of-block time, used to pre-fill the datetime picker
const TIME_BLOCK_DEFAULTS: Record<string, string> = {
  early_morning: '08:00',
  morning:       '09:00',
  midday:        '12:00',
  afternoon:     '14:00',
  evening:       '17:00',
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
              title={`${apt.user?.name ?? 'Appointment'} · ${format(dt, 'h:mm a')} · ${apt.service_type.replace(/_/g, ' ')}`}
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
  { value: 'walk_30', label: '30-Min Walk' },
  { value: 'walk_60', label: '60-Min Walk' },
  { value: 'drop_in', label: 'Drop-In Visit' },
  { value: 'day_boarding', label: 'Day Boarding' },
  { value: 'overnight', label: 'Overnight' },
];

const TIME_BLOCKS = [
  { value: 'early_morning', label: 'Early Morning (7–10 AM)' },
  { value: 'morning', label: 'Morning (9–12 PM)' },
  { value: 'midday', label: 'Midday (11 AM–2 PM)' },
  { value: 'afternoon', label: 'Afternoon (2–5 PM)' },
  { value: 'evening', label: 'Evening (5–8 PM)' },
];

function blankCreateForm() {
  return { user_id: '', dog_ids: [] as number[], service_type: 'walk_60', preferred_time_block: 'morning', preferred_date: '', notes: '' };
}

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

  const { data, isLoading } = useQuery({
    queryKey: ['admin-service-requests'],
    queryFn: () => api.get('/admin/service-requests').then(r => r.data),
    refetchInterval: 30_000,
  });

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

      <div className="space-y-3">
        {data?.data?.map((sr: any) => (
          <Card key={sr.id} padding="sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-espresso text-sm">{sr.user?.name}</div>
                <div className="text-xs text-taupe mt-0.5">
                  {sr.service_type.replace(/_/g, ' ')} · {TIME_BLOCK_LABELS[sr.preferred_time_block as keyof typeof TIME_BLOCK_LABELS]} · {format(new Date(sr.preferred_date), 'MMM d')}
                </div>
                {sr.notes && <div className="text-xs text-taupe mt-1 italic">"{sr.notes}"</div>}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={statusBadge(sr.status)}>{sr.status.replace('_', ' ')}</Badge>
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
              </div>
            </div>
          </Card>
        ))}
        {data?.data?.length === 0 && (
          <Card>
            <p className="text-center py-8 text-taupe">No service requests.</p>
          </Card>
        )}
      </div>

      <Modal open={!!action && !!selected} onClose={() => { setSelected(null); setAction(null); setApiError(null); setScheduledDate(''); setScheduledTime(''); setAdminResponse(''); setCounterDate(''); setCounterTime(''); }} title="Respond to Request">
        {selected && (
          <div className="space-y-4">
            <div className="bg-cream rounded-lg p-4 text-sm">
              <div className="font-semibold">{selected.user?.name} — {selected.dogs?.map((d: any) => d.name).join(', ')}</div>
              <div className="text-taupe mt-1">
                {selected.service_type.replace(/_/g, ' ')} · {TIME_BLOCK_LABELS[selected.preferred_time_block as keyof typeof TIME_BLOCK_LABELS]} · {format(new Date(selected.preferred_date), 'EEEE, MMM d')}
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
                            placeholder="e.g. 30-Min Visit (extra)"
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
