import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, addMinutes } from 'date-fns';
import { enCA } from 'date-fns/locale';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = { 'en-CA': enCA };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

const STATUS_COLORS: Record<string, string> = {
  scheduled:  '#6492D8',
  checked_in: '#C9A24D',
  completed:  '#9CA3AF',
  cancelled:  '#C8BFB6',
};

const SERVICE_LABELS: Record<string, string> = {
  walk_30:      '30-Min Visit',
  walk_60:      '60-Min Visit',
  drop_in:      'Drop-In Visit',
  overnight:    'Overnight Stay',
  day_boarding: 'Day Boarding',
  custom:       'Custom Visit',
};

const TIME_BLOCKS = [
  { value: 'early_morning', label: '7–10 AM (Early Morning)' },
  { value: 'morning',       label: '9–12 PM (Morning)' },
  { value: 'midday',        label: '11 AM–2 PM (Midday)' },
  { value: 'afternoon',     label: '2–5 PM (Afternoon)' },
  { value: 'evening',       label: '5–8 PM (Evening)' },
];

const TIME_BLOCK_LABELS: Record<string, string> = {
  early_morning: '7–10 AM',
  morning:       '9 AM–12 PM',
  midday:        '11 AM–2 PM',
  afternoon:     '2–5 PM',
  evening:       '5–8 PM',
};

function getTimeBlockLabel(block?: string): string {
  if (!block) return '';
  return TIME_BLOCK_LABELS[block] ?? block.replace(/_/g, ' ');
}

const SERVICE_TYPES = [
  { value: 'walk_30',      label: '30-Minute Visit' },
  { value: 'walk_60',      label: '60-Minute Visit' },
  { value: 'drop_in',      label: 'Drop-In Visit' },
  { value: 'overnight',    label: 'Overnight Stay' },
  { value: 'day_boarding', label: 'Day Boarding' },
];

const EXTENSION_OPTIONS = [
  { value: '15', label: '15 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '45', label: '45 minutes' },
  { value: '60', label: '60 minutes' },
];

interface CalEvent {
  id: number;
  title: string;
  start: Date;
  end: Date;
  status: string;
  service_type: string;
  dogs: string;
  notes?: string;
  time_block: string;
  raw: any;
}

type ActionView = null | 'detail' | 'change_time' | 'cancel' | 'extend' | 'special_service';

export default function ClientAppointmentsPage() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState<any>(Views.MONTH);
  const [date, setDate] = useState(new Date());
  const [selected, setSelected] = useState<CalEvent | null>(null);
  const [actionView, setActionView] = useState<ActionView>('detail');
  const [requestModal, setRequestModal] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Time change form
  const [timeForm, setTimeForm] = useState({ preferred_time_block: 'morning', preferred_date: '', notes: '' });
  // Extension form
  const [extForm, setExtForm] = useState({ extra_minutes: '30', notes: '' });
  // Special service form
  const [specialForm, setSpecialForm] = useState({ service: '', address: '', comments: '' });
  // Cancel confirmation
  const [cancelConfirmed, setCancelConfirmed] = useState(false);
  // New request form
  const [extraChargeConfirmed, setExtraChargeConfirmed] = useState(false);
  const [requestAddons, setRequestAddons] = useState<{ service: string; address: string; comments: string }[]>([]);
  const [form, setForm] = useState({ service_type: 'walk_30', preferred_time_block: 'morning', preferred_date: '', notes: '', dog_ids: [] as number[] });
  // Edit request
  const [editingRequest, setEditingRequest] = useState<any>(null);
  const [editReqForm, setEditReqForm] = useState({ service_type: 'walk_30', preferred_time_block: 'morning', preferred_date: '', notes: '', dog_ids: [] as number[] });

  const { data: appointments, isLoading, isError } = useQuery({
    queryKey: ['client-appointments'],
    queryFn: () => api.get('/client/appointments').then(r => r.data.data),
  });

  const { data: dogs } = useQuery({
    queryKey: ['client-dogs'],
    queryFn: () => api.get('/client/dogs').then(r => r.data.data),
  });

  const { data: requests } = useQuery({
    queryKey: ['client-service-requests'],
    queryFn: () => api.get('/client/service-requests').then(r => r.data?.data ?? []),
  });

  const [requestSuccess, setRequestSuccess] = useState(false);
  const [requestError, setRequestError] = useState('');

  const createRequest = useMutation({
    mutationFn: () => api.post('/client/service-requests', { ...form, addons: requestAddons.length > 0 ? requestAddons : undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-service-requests'] });
      setRequestSuccess(true);
      setRequestError('');
    },
    onError: (e: any) => {
      setRequestError(e.response?.data?.message || 'Something went wrong. Please try again.');
    },
  });

  const updateRequest = useMutation({
    mutationFn: (id: number) => api.put(`/client/service-requests/${id}`, editReqForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-service-requests'] });
      setEditingRequest(null);
    },
  });

  const deleteRequest = useMutation({
    mutationFn: (id: number) => api.delete(`/client/service-requests/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-service-requests'] });
    },
  });

  const cancelMut = useMutation({
    mutationFn: (id: number) => api.post(`/client/appointments/${id}/cancel`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-appointments'] });
      setSuccessMsg('Appointment cancelled. Your walker has been notified.');
      setActionView('detail');
    },
  });

  const timeChangeMut = useMutation({
    mutationFn: (id: number) => api.post(`/client/appointments/${id}/request-time-change`, timeForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-service-requests'] });
      setSuccessMsg('Time change request submitted. Your walker will review it shortly.');
      setActionView('detail');
    },
  });

  const extensionMut = useMutation({
    mutationFn: (id: number) => api.post(`/client/appointments/${id}/request-extension`, {
      extra_minutes: Number(extForm.extra_minutes),
      notes: extForm.notes || null,
    }),
    onSuccess: () => {
      setSuccessMsg('Extension request submitted. Your walker will review it shortly.');
      setActionView('detail');
    },
  });

  const specialMut = useMutation({
    mutationFn: (id: number) => api.post(`/client/appointments/${id}/request-special-service`, {
      service: specialForm.service,
      address: specialForm.address || null,
      comments: specialForm.comments || null,
    }),
    onSuccess: () => {
      setSuccessMsg('Special service request submitted. Your walker will review it shortly.');
      setActionView('detail');
      setSpecialForm({ service: '', address: '', comments: '' });
    },
  });

  const toggleDog = (id: number) => {
    setForm(f => ({ ...f, dog_ids: f.dog_ids.includes(id) ? f.dog_ids.filter(d => d !== id) : [...f.dog_ids, id] }));
  };

  const openDetail = (evt: CalEvent) => {
    setSelected(evt);
    setActionView('detail');
    setSuccessMsg('');
    setTimeForm({ preferred_time_block: 'morning', preferred_date: '', notes: '' });
    setExtForm({ extra_minutes: '30', notes: '' });
    setSpecialForm({ service: '', address: '', comments: '' });
    setCancelConfirmed(false);
  };

  const closeModal = () => {
    setSelected(null);
    setActionView(null);
    setSuccessMsg('');
  };

  const isFuture = selected ? selected.start > new Date() : false;
  const isModifiable = isFuture && selected?.status === 'scheduled';

  // Map appointments → calendar events
  const events: CalEvent[] = useMemo(() => {
    if (!Array.isArray(appointments)) return [];
    return appointments
      .filter((a: any) => a.scheduled_time)
      .map((a: any) => {
        const start = new Date(a.scheduled_time);
        const duration = a.duration_minutes ?? 30;
        const end = addMinutes(start, duration);
        return {
          id: a.id,
          title: `${SERVICE_LABELS[a.service_type] ?? a.service_type?.replace(/_/g, ' ')} — ${a.dogs?.map((d: any) => d.name).join(', ') ?? ''}`,
          start, end,
          status: a.status,
          service_type: a.service_type,
          dogs: a.dogs?.map((d: any) => d.name).join(', ') ?? '',
          notes: a.notes,
          time_block: a.client_time_block ?? '',
          raw: a,
        };
      });
  }, [appointments]);

  // Auto-open appointment detail from ?edit=<id>
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && events.length > 0) {
      const evt = events.find(e => e.id === Number(editId));
      if (evt) {
        openDetail(evt);
        setSearchParams({}, { replace: true });
      }
    }
  }, [events, searchParams]);

  // Upcoming visits (next 7 days, scheduled only)
  const upcoming = useMemo(() => {
    const now = new Date();
    const weekOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return events
      .filter(e => e.status === 'scheduled' && e.start >= now && e.start <= weekOut)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [events]);

  const eventStyleGetter = (event: CalEvent) => ({
    style: {
      backgroundColor: STATUS_COLORS[event.status] ?? '#6492D8',
      borderRadius: '6px', border: 'none', color: '#fff', fontSize: '12px', padding: '2px 6px',
    },
  });

  if (isLoading) return <PageLoader />;

  if (isError) return (
    <div className="space-y-6">
      <h1 className="font-display text-xl text-white">Visits & Appointments</h1>
      <Card>
        <div className="text-center py-8">
          <p className="text-taupe text-sm">Unable to load appointments. Please try refreshing the page.</p>
          <Button size="sm" className="mt-4" onClick={() => window.location.reload()}>Refresh</Button>
        </div>
      </Card>
    </div>
  );

  // ── Modal title based on view ──
  const modalTitle =
    actionView === 'change_time' ? 'Request Time Change' :
    actionView === 'cancel' ? 'Cancel Appointment' :
    actionView === 'extend' ? 'Request Extension' :
    actionView === 'special_service' ? 'Request Special Service' :
    'Appointment Details';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl text-white">Visits & Appointments</h1>
        <Button size="sm" onClick={() => setRequestModal(true)}>+ Request Visit</Button>
      </div>

      {/* Upcoming visits banner */}
      {upcoming.length > 0 && (
        <Card>
          <h2 className="font-display text-sm text-espresso mb-3">Upcoming This Week</h2>
          <div className="space-y-2">
            {upcoming.slice(0, 5).map(evt => (
              <button
                key={evt.id}
                onClick={() => openDetail(evt)}
                className="w-full text-left flex items-center justify-between py-2 border-b border-cream last:border-0 hover:bg-cream/40 rounded-lg px-2 -mx-2 transition-colors"
              >
                <div>
                  <div className="text-sm font-medium text-espresso">
                    {SERVICE_LABELS[evt.service_type] ?? evt.service_type?.replace(/_/g, ' ')}
                  </div>
                  <div className="text-xs text-taupe">
                    {format(evt.start, 'EEEE, MMM d')} · {getTimeBlockLabel(evt.time_block)} — {evt.dogs}
                  </div>
                </div>
                <span className="text-xs font-medium text-blue hover:underline whitespace-nowrap">Edit</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Calendar */}
      <Card padding="none">
        <div style={{ height: 550 }} className="p-4">
          <Calendar
            localizer={localizer}
            events={events}
            view={view}
            onView={setView}
            date={date}
            onNavigate={setDate}
            views={[Views.MONTH, Views.WEEK, Views.DAY]}
            startAccessor="start"
            endAccessor="end"
            eventPropGetter={eventStyleGetter}
            onSelectEvent={openDetail}
            min={new Date(1970, 0, 1, 6, 0)}
            max={new Date(1970, 0, 1, 21, 0)}
            step={15}
            timeslots={4}
            popup
          />
        </div>
      </Card>

      {/* Pending requests */}
      {Array.isArray(requests) && requests.filter((r: any) => r.status === 'pending').length > 0 && (
        <div>
          <h2 className="font-display text-base text-white mb-2">Pending Requests</h2>
          <div className="space-y-2">
            {(requests as any[]).filter((r: any) => r.status === 'pending').map((req: any) => (
              <Card key={req.id} padding="sm">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-espresso capitalize">
                    {SERVICE_LABELS[req.service_type] ?? req.service_type?.replace(/_/g, ' ')} · {TIME_BLOCKS.find(t => t.value === req.preferred_time_block)?.label}
                    {req.preferred_date && (
                      <span className="text-taupe"> · {format(new Date(req.preferred_date + 'T00:00:00'), 'MMM d, yyyy')}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingRequest(req);
                        setEditReqForm({
                          service_type: req.service_type,
                          preferred_time_block: req.preferred_time_block,
                          preferred_date: req.preferred_date ? req.preferred_date.slice(0, 10) : '',
                          notes: req.notes ?? '',
                          dog_ids: req.dogs?.map((d: any) => d.id) ?? [],
                        });
                      }}
                      className="text-xs text-blue hover:underline font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => { if (confirm('Cancel this request?')) deleteRequest.mutate(req.id); }}
                      className="text-xs text-red-500 hover:underline font-medium"
                    >
                      Cancel
                    </button>
                    <Badge variant="gold">Pending</Badge>
                  </div>
                </div>
                {req.dogs?.length > 0 && (
                  <div className="text-xs text-taupe mt-1">
                    Dogs: {req.dogs.map((d: any) => d.name).join(', ')}
                  </div>
                )}
                {req.notes && (
                  <div className="text-xs text-taupe mt-1 line-clamp-2">Notes: {req.notes}</div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Edit request modal */}
      <Modal open={!!editingRequest} onClose={() => setEditingRequest(null)} title="Edit Service Request" size="lg">
        {editingRequest && (
          <div className="space-y-4">
            <Select
              label="Service type"
              value={editReqForm.service_type}
              onChange={e => setEditReqForm(f => ({ ...f, service_type: e.target.value }))}
              options={SERVICE_TYPES}
            />
            <Select
              label="Preferred time"
              value={editReqForm.preferred_time_block}
              onChange={e => setEditReqForm(f => ({ ...f, preferred_time_block: e.target.value }))}
              options={TIME_BLOCKS}
            />
            <Input
              label="Preferred date"
              type="date"
              value={editReqForm.preferred_date}
              onChange={e => setEditReqForm(f => ({ ...f, preferred_date: e.target.value }))}
              min={format(new Date(), 'yyyy-MM-dd')}
            />
            <div>
              <label className="label">Dog(s)</label>
              <div className="space-y-2">
                {dogs?.map((dog: any) => (
                  <label key={dog.id} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editReqForm.dog_ids.includes(dog.id)}
                      onChange={() => setEditReqForm(f => ({
                        ...f,
                        dog_ids: f.dog_ids.includes(dog.id) ? f.dog_ids.filter(id => id !== dog.id) : [...f.dog_ids, dog.id],
                      }))}
                      className="rounded border-taupe accent-gold"
                    />
                    <span className="text-sm text-espresso">{dog.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <Textarea
              label="Notes (optional)"
              rows={3}
              value={editReqForm.notes}
              onChange={e => setEditReqForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Anything your walker should know?"
            />
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setEditingRequest(null)}>Cancel</Button>
              <Button
                loading={updateRequest.isPending}
                disabled={!editReqForm.preferred_date || editReqForm.dog_ids.length === 0}
                onClick={() => updateRequest.mutate(editingRequest.id)}
              >
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Appointment detail / action modal ── */}
      <Modal open={!!selected && !!actionView} onClose={closeModal} title={modalTitle} size="lg">
        {selected && actionView === 'detail' && (
          <div className="space-y-4">
            {successMsg && (
              <div className="bg-green-50 text-green-700 text-sm rounded-lg px-4 py-3 font-medium">{successMsg}</div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-espresso">
                  {SERVICE_LABELS[selected.service_type] ?? selected.service_type?.replace(/_/g, ' ')}
                </span>
                <Badge variant={statusBadge(selected.status)}>{selected.status.replace(/_/g, ' ')}</Badge>
              </div>
              <div className="text-sm text-taupe">
                <div>{format(selected.start, 'EEEE, MMMM d, yyyy')}</div>
                <div>{getTimeBlockLabel(selected.time_block)}</div>
              </div>
              {selected.dogs && (
                <div className="text-sm">
                  <span className="text-taupe">Dogs: </span>
                  <span className="text-espresso font-medium">{selected.dogs}</span>
                </div>
              )}
              {selected.notes && (
                <div className="text-sm">
                  <span className="text-taupe">Notes: </span>
                  <span className="text-espresso">{selected.notes}</span>
                </div>
              )}
            </div>

            {/* Action buttons for future scheduled appointments */}
            {isModifiable && (
              <div className="border-t border-cream pt-4 space-y-2">
                <p className="text-xs text-taupe font-medium uppercase tracking-wide mb-2">Request Changes</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setActionView('change_time')}
                    className="flex items-center gap-2 px-4 py-3 rounded-lg border border-taupe/20 hover:bg-cream transition-colors text-left"
                  >
                    <span className="text-lg">🕐</span>
                    <div>
                      <div className="text-sm font-medium text-espresso">Change Time</div>
                      <div className="text-xs text-taupe">Request a new date/time</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setActionView('extend')}
                    className="flex items-center gap-2 px-4 py-3 rounded-lg border border-taupe/20 hover:bg-cream transition-colors text-left"
                  >
                    <span className="text-lg">⏱️</span>
                    <div>
                      <div className="text-sm font-medium text-espresso">Extend Time</div>
                      <div className="text-xs text-taupe">Request more time</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setActionView('special_service')}
                    className="flex items-center gap-2 px-4 py-3 rounded-lg border border-taupe/20 hover:bg-cream transition-colors text-left"
                  >
                    <span className="text-lg">✨</span>
                    <div>
                      <div className="text-sm font-medium text-espresso">Special Service</div>
                      <div className="text-xs text-taupe">Add-on services</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setActionView('cancel')}
                    className="flex items-center gap-2 px-4 py-3 rounded-lg border border-red-200 hover:bg-red-50 transition-colors text-left"
                  >
                    <span className="text-lg">✕</span>
                    <div>
                      <div className="text-sm font-medium text-red-600">Cancel</div>
                      <div className="text-xs text-taupe">Cancel this appointment</div>
                    </div>
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="outline" onClick={closeModal}>Close</Button>
            </div>
          </div>
        )}

        {/* ── Change Time ── */}
        {selected && actionView === 'change_time' && (
          <div className="space-y-4">
            <button onClick={() => setActionView('detail')} className="text-sm text-taupe hover:text-espresso">&larr; Back</button>
            <p className="text-sm text-taupe">
              Request a new time for your {SERVICE_LABELS[selected.service_type] ?? selected.service_type} on {format(selected.start, 'MMM d')}.
              This will be sent as a request and requires approval.
            </p>
            <Select
              label="Preferred time block"
              value={timeForm.preferred_time_block}
              onChange={e => setTimeForm(f => ({ ...f, preferred_time_block: e.target.value }))}
              options={TIME_BLOCKS}
            />
            <Input
              label="Preferred date"
              type="date"
              value={timeForm.preferred_date}
              onChange={e => setTimeForm(f => ({ ...f, preferred_date: e.target.value }))}
              min={format(new Date(), 'yyyy-MM-dd')}
            />
            <Textarea
              label="Notes (optional)"
              rows={2}
              value={timeForm.notes}
              onChange={e => setTimeForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Reason for the change..."
            />
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setActionView('detail')}>Cancel</Button>
              <Button
                loading={timeChangeMut.isPending}
                disabled={!timeForm.preferred_date}
                onClick={() => timeChangeMut.mutate(selected.id)}
              >
                Submit Request
              </Button>
            </div>
          </div>
        )}

        {/* ── Cancel ── */}
        {selected && actionView === 'cancel' && (
          <div className="space-y-4">
            <button onClick={() => { setActionView('detail'); setCancelConfirmed(false); }} className="text-sm text-taupe hover:text-espresso">&larr; Back</button>
            <div className="bg-red-50 rounded-lg p-4">
              <p className="text-sm text-red-700 font-medium">
                Are you sure you want to cancel this appointment?
              </p>
              <div className="text-sm text-red-600 mt-2">
                <div>{SERVICE_LABELS[selected.service_type] ?? selected.service_type}</div>
                <div>{format(selected.start, 'EEEE, MMMM d')} · {getTimeBlockLabel(selected.time_block)}</div>
                <div>{selected.dogs}</div>
              </div>
            </div>
            <label className="flex items-start gap-3 cursor-pointer bg-cream/60 rounded-lg p-3">
              <input
                type="checkbox"
                checked={cancelConfirmed}
                onChange={e => setCancelConfirmed(e.target.checked)}
                className="rounded accent-gold mt-0.5"
              />
              <span className="text-xs text-espresso leading-relaxed">
                I understand that we will do our best to reschedule, but if we are unable to find a time, this appointment will be lost.
              </span>
            </label>
            <p className="text-xs text-taupe">Your walker will be notified of this cancellation.</p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setActionView('detail'); setCancelConfirmed(false); }}>Go Back</Button>
              <Button
                loading={cancelMut.isPending}
                disabled={!cancelConfirmed}
                onClick={() => cancelMut.mutate(selected.id)}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Confirm Cancellation
              </Button>
            </div>
          </div>
        )}

        {/* ── Extend ── */}
        {selected && actionView === 'extend' && (
          <div className="space-y-4">
            <button onClick={() => setActionView('detail')} className="text-sm text-taupe hover:text-espresso">&larr; Back</button>
            <p className="text-sm text-taupe">
              Request additional time for your {SERVICE_LABELS[selected.service_type] ?? selected.service_type} on {format(selected.start, 'MMM d')}.
            </p>
            <div className="bg-gold/10 border border-gold/30 rounded-lg p-3">
              <p className="text-xs text-espresso font-medium">
                Note: An extra charge may apply if the extension is approved.
              </p>
            </div>
            <Select
              label="Additional time"
              value={extForm.extra_minutes}
              onChange={e => setExtForm(f => ({ ...f, extra_minutes: e.target.value }))}
              options={EXTENSION_OPTIONS}
            />
            <Textarea
              label="Notes (optional)"
              rows={2}
              value={extForm.notes}
              onChange={e => setExtForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Any details about why you need the extension..."
            />
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setActionView('detail')}>Cancel</Button>
              <Button
                loading={extensionMut.isPending}
                onClick={() => extensionMut.mutate(selected.id)}
              >
                Request Extension
              </Button>
            </div>
          </div>
        )}

        {/* ── Special Service ── */}
        {selected && actionView === 'special_service' && (
          <div className="space-y-4">
            <button onClick={() => setActionView('detail')} className="text-sm text-taupe hover:text-espresso">&larr; Back</button>
            <p className="text-sm text-taupe">
              Request a special service add-on for your appointment on {format(selected.start, 'MMM d')}.
            </p>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-espresso">Service</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'bring_to_appointment', label: 'Bring to Appointment', icon: '🚗', desc: 'Drop off at an address' },
                  { value: 'brush', label: 'Brush', icon: '🪮', desc: 'Coat brushing' },
                  { value: 'nail_trim', label: 'Nail Trim', icon: '✂️', desc: 'Nail trimming' },
                  { value: 'other', label: 'Other', icon: '📝', desc: 'Custom request' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setSpecialForm(f => ({ ...f, service: opt.value, address: '', comments: '' }))}
                    className={`flex items-center gap-2 px-3 py-3 rounded-lg border transition-colors text-left ${
                      specialForm.service === opt.value
                        ? 'border-gold bg-gold/10'
                        : 'border-taupe/20 hover:bg-cream'
                    }`}
                  >
                    <span className="text-lg">{opt.icon}</span>
                    <div>
                      <div className="text-sm font-medium text-espresso">{opt.label}</div>
                      <div className="text-xs text-taupe">{opt.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {specialForm.service === 'bring_to_appointment' && (
              <Input
                label="Drop-off address *"
                value={specialForm.address}
                onChange={e => setSpecialForm(f => ({ ...f, address: e.target.value }))}
                placeholder="e.g. 123 Main St, Vancouver, BC"
              />
            )}

            {specialForm.service === 'other' && (
              <Textarea
                label="What do you need? *"
                rows={3}
                value={specialForm.comments}
                onChange={e => setSpecialForm(f => ({ ...f, comments: e.target.value }))}
                placeholder="Describe the service you'd like..."
              />
            )}

            {specialForm.service && specialForm.service !== 'bring_to_appointment' && specialForm.service !== 'other' && (
              <Textarea
                label="Additional comments (optional)"
                rows={2}
                value={specialForm.comments}
                onChange={e => setSpecialForm(f => ({ ...f, comments: e.target.value }))}
                placeholder="Any special instructions..."
              />
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setActionView('detail')}>Cancel</Button>
              <Button
                loading={specialMut.isPending}
                disabled={
                  !specialForm.service
                  || (specialForm.service === 'bring_to_appointment' && !specialForm.address.trim())
                  || (specialForm.service === 'other' && !specialForm.comments.trim())
                }
                onClick={() => specialMut.mutate(selected.id)}
              >
                Submit Request
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Request visit modal ── */}
      <Modal open={requestModal} onClose={() => { setRequestModal(false); setRequestAddons([]); setExtraChargeConfirmed(false); setRequestSuccess(false); setRequestError(''); }} title={requestSuccess ? 'Request Submitted' : 'Request a Visit'} size="lg">
        {requestSuccess ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 className="font-display text-lg text-espresso">Visit request submitted!</h3>
            <p className="text-sm text-taupe max-w-sm mx-auto">
              Sophie will review your request and get back to you shortly. You'll see it listed under Pending Requests below.
            </p>
            <Button onClick={() => {
              setRequestModal(false);
              setRequestSuccess(false);
              setRequestError('');
              setForm({ service_type: 'walk_30', preferred_time_block: 'morning', preferred_date: '', notes: '', dog_ids: [] });
              setRequestAddons([]);
              setExtraChargeConfirmed(false);
            }}>
              Done
            </Button>
          </div>
        ) : (
        <div className="space-y-4">
          {requestError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">{requestError}</div>
          )}
          <Select
            label="Service type"
            value={form.service_type}
            onChange={e => setForm(f => ({ ...f, service_type: e.target.value }))}
            options={SERVICE_TYPES}
          />
          <Select
            label="Preferred time"
            value={form.preferred_time_block}
            onChange={e => setForm(f => ({ ...f, preferred_time_block: e.target.value }))}
            options={TIME_BLOCKS}
          />
          <Input
            label="Preferred date"
            type="date"
            value={form.preferred_date}
            onChange={e => setForm(f => ({ ...f, preferred_date: e.target.value }))}
            min={format(new Date(), 'yyyy-MM-dd')}
          />
          <div>
            <label className="label">Dog(s)</label>
            <div className="space-y-2">
              {dogs?.map((dog: any) => (
                <label key={dog.id} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.dog_ids.includes(dog.id)}
                    onChange={() => toggleDog(dog.id)}
                    className="rounded border-taupe accent-gold"
                  />
                  <span className="text-sm text-espresso">{dog.name}</span>
                </label>
              ))}
            </div>
          </div>
          <Textarea
            label="Notes (optional)"
            rows={3}
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Anything your walker should know?"
          />

          {/* Special services add-ons */}
          <div>
            <label className="block text-sm font-medium text-espresso mb-2">Add-on Services (optional)</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'bring_to_appointment', label: 'Bring to Appointment', icon: '🚗', desc: 'Drop off at an address' },
                { value: 'brush', label: 'Brush', icon: '🪮', desc: 'Coat brushing' },
                { value: 'nail_trim', label: 'Nail Trim', icon: '✂️', desc: 'Nail trimming' },
                { value: 'other', label: 'Other', icon: '📝', desc: 'Custom request' },
              ].map(opt => {
                const isSelected = requestAddons.some(a => a.service === opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setRequestAddons(prev => prev.filter(a => a.service !== opt.value));
                      } else {
                        setRequestAddons(prev => [...prev, { service: opt.value, address: '', comments: '' }]);
                      }
                    }}
                    className={`flex items-center gap-2 px-3 py-3 rounded-lg border transition-colors text-left ${
                      isSelected ? 'border-gold bg-gold/10' : 'border-taupe/20 hover:bg-cream'
                    }`}
                  >
                    <span className="text-lg">{opt.icon}</span>
                    <div>
                      <div className="text-sm font-medium text-espresso">{opt.label}</div>
                      <div className="text-xs text-taupe">{opt.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Conditional fields for selected add-ons */}
          {requestAddons.some(a => a.service === 'bring_to_appointment') && (
            <Input
              label="Drop-off address *"
              value={requestAddons.find(a => a.service === 'bring_to_appointment')?.address ?? ''}
              onChange={e => setRequestAddons(prev => prev.map(a =>
                a.service === 'bring_to_appointment' ? { ...a, address: e.target.value } : a
              ))}
              placeholder="e.g. 123 Main St, Vancouver, BC"
            />
          )}

          {requestAddons.some(a => a.service === 'other') && (
            <Textarea
              label="Describe the service you'd like *"
              rows={2}
              value={requestAddons.find(a => a.service === 'other')?.comments ?? ''}
              onChange={e => setRequestAddons(prev => prev.map(a =>
                a.service === 'other' ? { ...a, comments: e.target.value } : a
              ))}
              placeholder="What do you need?"
            />
          )}

          {/* Extra charge confirmation */}
          <label className="flex items-start gap-3 cursor-pointer bg-gold/10 border border-gold/30 rounded-lg p-3">
            <input
              type="checkbox"
              checked={extraChargeConfirmed}
              onChange={e => setExtraChargeConfirmed(e.target.checked)}
              className="rounded accent-gold mt-0.5"
            />
            <span className="text-xs text-espresso leading-relaxed">
              I understand that there may be an extra charge for visits outside of my plan.
            </span>
          </label>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => { setRequestModal(false); setRequestAddons([]); setExtraChargeConfirmed(false); setRequestError(''); }}>Cancel</Button>
            <Button
              loading={createRequest.isPending}
              disabled={
                !form.preferred_date
                || form.dog_ids.length === 0
                || !extraChargeConfirmed
                || (requestAddons.some(a => a.service === 'bring_to_appointment') && !requestAddons.find(a => a.service === 'bring_to_appointment')?.address?.trim())
                || (requestAddons.some(a => a.service === 'other') && !requestAddons.find(a => a.service === 'other')?.comments?.trim())
              }
              onClick={() => createRequest.mutate()}
            >
              Submit Request
            </Button>
          </div>
        </div>
        )}
      </Modal>
    </div>
  );
}
