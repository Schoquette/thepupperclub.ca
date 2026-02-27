import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enCA } from 'date-fns/locale';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = { 'en-CA': enCA };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

const STATUS_COLORS: Record<string, string> = {
  scheduled:  '#6492D8',
  checked_in: '#C9A24D',
  completed:  '#22c55e',
  cancelled:  '#C8BFB6',
};

const SERVICE_TYPES = [
  { value: 'walk_30',      label: '30-min Walk' },
  { value: 'walk_60',      label: '60-min Walk' },
  { value: 'drop_in',      label: 'Drop-in Visit' },
  { value: 'overnight',    label: 'Overnight' },
  { value: 'day_boarding', label: 'Day Boarding' },
];

const TIME_BLOCKS = [
  { value: 'early_morning', label: '7–10 AM' },
  { value: 'morning',       label: '9–12 PM' },
  { value: 'midday',        label: '11 AM–2 PM' },
  { value: 'afternoon',     label: '2–5 PM' },
  { value: 'evening',       label: '5–8 PM' },
];

const DURATIONS = [30, 45, 60, 90, 120, 240, 480];

type NewApptForm = {
  user_id: string;
  dog_ids: number[];
  service_type: string;
  scheduled_time: string;
  client_time_block: string;
  duration_minutes: number;
  notes: string;
};

function blankForm(): NewApptForm {
  return {
    user_id: '',
    dog_ids: [],
    service_type: 'walk_60',
    scheduled_time: '',
    client_time_block: 'morning',
    duration_minutes: 60,
    notes: '',
  };
}

export default function AdminCalendarPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [range, setRange] = useState({ start: new Date(), end: new Date() });
  const [selected, setSelected] = useState<any>(null);
  const [creatingAppt, setCreatingAppt] = useState(false);
  const [newForm, setNewForm] = useState<NewApptForm>(blankForm());
  const [createError, setCreateError] = useState('');

  // Visit completion report form (legacy – still used for check-out)
  const [completing, setCompleting] = useState(false);
  const [reportForm, setReportForm] = useState({
    eliminated: false, ate_well: false, drank_water: false,
    mood: 'good', energy_level: 'normal', distance_km: '', notes: '',
  });
  const [photos, setPhotos] = useState<File[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-appointments', range],
    queryFn: () =>
      api.get('/admin/appointments', {
        params: {
          start: range.start.toISOString(),
          end: range.end.toISOString(),
        },
      }).then(r => r.data.data),
  });

  // Load clients for new appointment form
  const { data: clientsData } = useQuery({
    queryKey: ['admin-clients-calendar'],
    queryFn: () => api.get('/admin/clients').then(r => r.data.data),
    enabled: creatingAppt,
  });

  // Load dogs for selected client
  const selectedClientId = newForm.user_id ? parseInt(newForm.user_id) : null;
  const { data: clientDetail } = useQuery({
    queryKey: ['admin-client-dogs', selectedClientId],
    queryFn: () => api.get(`/admin/clients/${selectedClientId}`).then(r => r.data.data),
    enabled: !!selectedClientId,
  });
  const clientDogs: any[] = (clientDetail?.dogs ?? []).filter((d: any) => d.is_active);

  const checkIn = useMutation({
    mutationFn: (id: number) => api.post(`/admin/appointments/${id}/check-in`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-appointments'] }); setSelected(null); },
  });

  const complete = useMutation({
    mutationFn: async (id: number) => {
      const fd = new FormData();
      Object.entries(reportForm).forEach(([k, v]) => fd.append(k, String(v)));
      photos.forEach(p => fd.append('photos[]', p));
      return api.post(`/admin/appointments/${id}/complete`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-appointments'] });
      setSelected(null); setCompleting(false);
      setPhotos([]);
    },
  });

  const createAppointment = useMutation({
    mutationFn: (payload: object) => api.post('/admin/appointments', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-appointments'] });
      setCreatingAppt(false);
      setNewForm(blankForm());
      setCreateError('');
    },
    onError: (err: any) => {
      setCreateError(err.response?.data?.message ?? 'Failed to create appointment.');
    },
  });

  const handleCreate = () => {
    setCreateError('');
    createAppointment.mutate({
      user_id:           parseInt(newForm.user_id),
      dog_ids:           newForm.dog_ids,
      service_type:      newForm.service_type,
      scheduled_time:    newForm.scheduled_time,
      client_time_block: newForm.client_time_block,
      duration_minutes:  newForm.duration_minutes,
      notes:             newForm.notes || undefined,
    });
  };

  const toggleDog = (dogId: number) => {
    setNewForm(f => ({
      ...f,
      dog_ids: f.dog_ids.includes(dogId)
        ? f.dog_ids.filter(id => id !== dogId)
        : [...f.dog_ids, dogId],
    }));
  };

  const events = (data ?? []).map((appt: any) => ({
    id: appt.id,
    title: `${appt.user?.name} — ${appt.dogs?.map((d: any) => d.name).join(', ')}`,
    start: new Date(appt.scheduled_time),
    end: new Date(new Date(appt.scheduled_time).getTime() + appt.duration_minutes * 60_000),
    resource: appt,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Calendar</h1>
        <Button size="sm" onClick={() => { setCreatingAppt(true); setCreateError(''); }}>
          + New Appointment
        </Button>
      </div>

      {isLoading ? <PageLoader /> : (
        <Card padding="none" className="overflow-hidden">
          <Calendar
            localizer={localizer}
            events={events}
            defaultView={Views.WEEK}
            style={{ height: 600, padding: 16 }}
            onRangeChange={(r: any) => {
              if (Array.isArray(r)) {
                setRange({ start: r[0], end: r[r.length - 1] });
              } else {
                setRange({ start: r.start, end: r.end });
              }
            }}
            onSelectEvent={(e: any) => setSelected(e.resource)}
            eventPropGetter={(e: any) => ({
              style: {
                backgroundColor: STATUS_COLORS[e.resource.status] ?? '#C8BFB6',
                borderRadius: 6,
                border: 'none',
                color: 'white',
                fontSize: 12,
              },
            })}
          />
        </Card>
      )}

      {/* Appointment detail modal */}
      <Modal open={!!selected && !completing} onClose={() => setSelected(null)} title="Appointment" size="lg">
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-espresso">{selected.user?.name}</div>
                <div className="text-sm text-taupe">{selected.dogs?.map((d: any) => d.name).join(', ')}</div>
              </div>
              <Badge variant={statusBadge(selected.status)}>{selected.status.replace('_', ' ')}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-taupe">Service:</span> {selected.service_type.replace(/_/g, ' ')}</div>
              <div><span className="text-taupe">Duration:</span> {selected.duration_minutes} min</div>
              <div><span className="text-taupe">Time:</span> {format(new Date(selected.scheduled_time), 'h:mm a')}</div>
              <div><span className="text-taupe">Date:</span> {format(new Date(selected.scheduled_time), 'MMM d, yyyy')}</div>
            </div>
            {selected.notes && <p className="text-sm text-taupe bg-cream rounded-lg p-3">{selected.notes}</p>}
            <div className="flex justify-end gap-3 mt-4">
              {selected.status === 'scheduled' && (
                <Button loading={checkIn.isPending} onClick={() => checkIn.mutate(selected.id)}>
                  Check In
                </Button>
              )}
              {selected.status === 'checked_in' && (
                <Button onClick={() => setCompleting(true)}>
                  Complete Visit
                </Button>
              )}
              {selected.status === 'completed' && (
                <Button variant="outline" onClick={() => navigate(`/admin/report-cards/new?appointment_id=${selected.id}`)}>
                  Write Report Card
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Complete visit modal */}
      <Modal open={completing} onClose={() => setCompleting(false)} title="Complete Visit" size="lg">
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {(['eliminated', 'ate_well', 'drank_water'] as const).map(k => (
                <label key={k} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reportForm[k] as boolean}
                    onChange={e => setReportForm(f => ({ ...f, [k]: e.target.checked }))}
                    className="rounded border-taupe accent-gold"
                  />
                  <span className="text-sm capitalize">{k.replace(/_/g, ' ')}</span>
                </label>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Mood</label>
                <select className="input" value={reportForm.mood}
                  onChange={e => setReportForm(f => ({ ...f, mood: e.target.value }))}>
                  {['great','good','okay','anxious','unwell'].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Energy</label>
                <select className="input" value={reportForm.energy_level}
                  onChange={e => setReportForm(f => ({ ...f, energy_level: e.target.value }))}>
                  {['high','normal','low'].map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Distance (km)</label>
              <input type="number" step="0.1" className="input" value={reportForm.distance_km}
                onChange={e => setReportForm(f => ({ ...f, distance_km: e.target.value }))} />
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea rows={3} className="input resize-none" value={reportForm.notes}
                onChange={e => setReportForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div>
              <label className="label">Photos (at least 1 required)</label>
              <input type="file" accept="image/*" multiple
                onChange={e => setPhotos(Array.from(e.target.files ?? []))}
                className="text-sm text-taupe" />
              {photos.length > 0 && <p className="text-xs text-green-600 mt-1">{photos.length} photo(s) selected</p>}
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setCompleting(false)}>Cancel</Button>
              <Button
                loading={complete.isPending}
                disabled={photos.length === 0}
                onClick={() => complete.mutate(selected.id)}
              >
                Submit & Complete
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* New appointment modal */}
      <Modal
        open={creatingAppt}
        onClose={() => { setCreatingAppt(false); setNewForm(blankForm()); setCreateError(''); }}
        title="New Appointment"
        size="lg"
      >
        <div className="space-y-4">
          {/* Client */}
          <div>
            <label className="label">Client *</label>
            <select
              className="input"
              value={newForm.user_id}
              onChange={e => setNewForm(f => ({ ...f, user_id: e.target.value, dog_ids: [] }))}
            >
              <option value="">— Select client —</option>
              {(clientsData ?? []).map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Dogs */}
          {newForm.user_id && clientDogs.length > 0 && (
            <div>
              <label className="label">Dogs *</label>
              <div className="flex gap-2 flex-wrap">
                {clientDogs.map((d: any) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleDog(d.id)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      newForm.dog_ids.includes(d.id)
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

          <div className="grid grid-cols-2 gap-3">
            {/* Service type */}
            <div>
              <label className="label">Service *</label>
              <select
                className="input"
                value={newForm.service_type}
                onChange={e => setNewForm(f => ({ ...f, service_type: e.target.value }))}
              >
                {SERVICE_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>

            {/* Duration */}
            <div>
              <label className="label">Duration *</label>
              <select
                className="input"
                value={newForm.duration_minutes}
                onChange={e => setNewForm(f => ({ ...f, duration_minutes: parseInt(e.target.value) }))}
              >
                {DURATIONS.map(d => (
                  <option key={d} value={d}>
                    {d >= 60 ? `${d / 60}h${d % 60 ? ` ${d % 60}m` : ''}` : `${d} min`}
                  </option>
                ))}
              </select>
            </div>

            {/* Date & time */}
            <div>
              <label className="label">Date & Time *</label>
              <input
                type="datetime-local"
                step={900}
                className="input"
                value={newForm.scheduled_time}
                onChange={e => setNewForm(f => ({ ...f, scheduled_time: e.target.value }))}
              />
            </div>

            {/* Time block */}
            <div>
              <label className="label">Client Time Block *</label>
              <select
                className="input"
                value={newForm.client_time_block}
                onChange={e => setNewForm(f => ({ ...f, client_time_block: e.target.value }))}
              >
                {TIME_BLOCKS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notes (optional)</label>
            <textarea
              rows={2}
              className="input resize-none"
              value={newForm.notes}
              onChange={e => setNewForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Any special instructions…"
            />
          </div>

          {createError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{createError}</p>
          )}

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => { setCreatingAppt(false); setNewForm(blankForm()); setCreateError(''); }}
            >
              Cancel
            </Button>
            <Button
              loading={createAppointment.isPending}
              disabled={!newForm.user_id || newForm.dog_ids.length === 0 || !newForm.scheduled_time}
              onClick={handleCreate}
            >
              Create Appointment
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
