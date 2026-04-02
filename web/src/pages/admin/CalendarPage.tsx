import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, endOfWeek, addDays } from 'date-fns';
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
  { value: 'walk_30',      label: '30-min Visit',      defaultDuration: 30,   durations: [30] },
  { value: 'walk_60',      label: '60-min Visit',      defaultDuration: 60,   durations: [60] },
  { value: 'custom',       label: 'Custom Visit',      defaultDuration: 0,    durations: [15, 45, 75, 90, 120] },
  { value: 'day_boarding', label: 'Day Boarding',       defaultDuration: 480,  durations: [480] },
  { value: 'overnight',    label: 'Overnight Boarding', defaultDuration: 1440, durations: [1440] },
];

const TIME_BLOCKS = [
  { value: 'early_morning', label: '7–10 AM',    startHour: 7,  endHour: 10 },
  { value: 'morning',       label: '9–12 PM',    startHour: 9,  endHour: 12 },
  { value: 'midday',        label: '11 AM–2 PM', startHour: 11, endHour: 14 },
  { value: 'afternoon',     label: '2–5 PM',     startHour: 14, endHour: 17 },
  { value: 'evening',       label: '5–8 PM',     startHour: 17, endHour: 20 },
];

function getTimeBlock(dateTimeStr: string): string {
  if (!dateTimeStr) return 'morning';
  const hour = new Date(dateTimeStr).getHours();
  if (hour >= 17) return 'evening';
  if (hour >= 14) return 'afternoon';
  if (hour >= 11) return 'midday';
  if (hour >= 9) return 'morning';
  return 'early_morning';
}

const TIME_SLOTS: string[] = [];
for (let h = 6; h <= 21; h++) {
  for (let m = 0; m < 60; m += 15) {
    if (h === 21 && m > 0) break;
    const hh = h.toString().padStart(2, '0');
    const mm = m.toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    TIME_SLOTS.push(`${hh}:${mm}`);
  }
}

function formatTime12(t: string): string {
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${mStr} ${ampm}`;
}

function formatDuration(d: number): string {
  if (d >= 1440) return 'All day (overnight)';
  if (d >= 480) return 'All day';
  if (d >= 60) return `${Math.floor(d / 60)}h${d % 60 ? ` ${d % 60}m` : ''}`;
  return `${d} min`;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

type RecurrencePattern = {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  interval: number;
  days_of_week: number[];
  end_type: 'never' | 'after' | 'on_date';
  end_after_count: number;
  end_date: string;
};

function blankRecurrence(): RecurrencePattern {
  return {
    enabled: false,
    frequency: 'weekly',
    interval: 1,
    days_of_week: [],
    end_type: 'never',
    end_after_count: 10,
    end_date: '',
  };
}

type NewApptForm = {
  user_id: string;
  assigned_to: string;
  dog_ids: number[];
  service_type: string;
  scheduled_time: string;
  client_time_block: string;
  duration_minutes: number;
  notes: string;
  recurrence: RecurrencePattern;
};

function blankForm(): NewApptForm {
  return {
    user_id: '',
    assigned_to: '',
    dog_ids: [],
    service_type: 'walk_60',
    scheduled_time: '',
    client_time_block: 'morning',
    duration_minutes: 60,
    notes: '',
    recurrence: blankRecurrence(),
  };
}

export default function AdminCalendarPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [range, setRange] = useState(() => {
    const now = new Date();
    return { start: startOfWeek(now, { locale: enCA }), end: addDays(endOfWeek(now, { locale: enCA }), 1) };
  });
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

  // Load team members (admin users)
  const { data: teamMembers } = useQuery({
    queryKey: ['admin-team'],
    queryFn: () => api.get('/admin/team').then(r => r.data.data),
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
    const payload: any = {
      user_id:           parseInt(newForm.user_id),
      assigned_to:       newForm.assigned_to ? parseInt(newForm.assigned_to) : undefined,
      dog_ids:           newForm.dog_ids,
      service_type:      newForm.service_type,
      scheduled_time:    newForm.scheduled_time,
      client_time_block: newForm.client_time_block,
      duration_minutes:  newForm.duration_minutes,
      notes:             newForm.notes || undefined,
    };
    if (newForm.recurrence.enabled) {
      payload.recurrence = {
        frequency:       newForm.recurrence.frequency,
        interval:        newForm.recurrence.interval,
        days_of_week:    newForm.recurrence.frequency === 'weekly' ? newForm.recurrence.days_of_week : undefined,
        end_type:        newForm.recurrence.end_type,
        end_after_count: newForm.recurrence.end_type === 'after' ? newForm.recurrence.end_after_count : undefined,
        end_date:        newForm.recurrence.end_type === 'on_date' ? newForm.recurrence.end_date : undefined,
      };
    }
    createAppointment.mutate(payload);
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
            date={currentDate}
            onNavigate={(newDate) => {
              setCurrentDate(newDate);
              const weekStart = startOfWeek(newDate, { locale: enCA });
              const weekEnd = addDays(endOfWeek(newDate, { locale: enCA }), 1);
              setRange({ start: weekStart, end: weekEnd });
            }}
            defaultView={Views.WEEK}
            step={15}
            timeslots={4}
            min={new Date(1970, 0, 1, 6, 0)}
            max={new Date(1970, 0, 1, 21, 0)}
            style={{ height: 600, padding: 16 }}
            onRangeChange={(r: any) => {
              if (Array.isArray(r)) {
                setRange({ start: r[0], end: addDays(r[r.length - 1], 1) });
              } else {
                setRange({ start: r.start, end: r.end });
              }
            }}
            onSelectEvent={(e: any) => setSelected(e.resource)}
            eventPropGetter={(e: any) => {
              let bg = '#6492D8'; // blue for regular visits
              let textColor = 'white';
              if (e.resource.service_type === 'day_boarding') {
                bg = '#C8BFB6'; // taupe
                textColor = '#3B2F2A';
              } else if (e.resource.service_type === 'overnight') {
                bg = '#F6F3EE'; // cream
                textColor = '#3B2F2A';
              }
              return {
                style: {
                  backgroundColor: bg,
                  borderRadius: 6,
                  border: e.resource.service_type === 'overnight' ? '1px solid #C8BFB6' : 'none',
                  color: textColor,
                  fontSize: 12,
                },
              };
            }}
          />
        </Card>
      )}

      {/* Appointment detail modal */}
      <Modal open={!!selected && !completing} onClose={() => setSelected(null)} title="Appointment" size="lg">
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <button className="font-semibold text-espresso hover:text-gold transition-colors text-left" onClick={() => { setSelected(null); navigate(`/admin/clients/${selected.user_id}`); }}>{selected.user?.name}</button>
                <div className="text-sm text-taupe flex flex-wrap gap-x-2">
                  {selected.dogs?.map((d: any, i: number) => (
                    <span key={d.id}>
                      <button className="hover:text-gold transition-colors underline" onClick={() => { setSelected(null); navigate(`/admin/clients/${selected.user_id}?dog=${d.id}`); }}>{d.name}</button>
                      {i < selected.dogs.length - 1 && ','}
                    </span>
                  ))}
                </div>
              </div>
              <Badge variant={statusBadge(selected.status)}>{selected.status.replace('_', ' ')}</Badge>
            </div>
            {selected.user?.client_profile?.address && (
              <div className="text-sm">
                <span className="text-taupe">Address: </span>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selected.user.client_profile.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue hover:text-gold transition-colors underline"
                >
                  {selected.user.client_profile.address}
                </a>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-taupe">Service:</span> {selected.service_type.replace(/_/g, ' ')}</div>
              <div><span className="text-taupe">Duration:</span> {formatDuration(selected.duration_minutes)}</div>
              <div><span className="text-taupe">Time:</span> {format(new Date(selected.scheduled_time), 'h:mm a')}</div>
              <div><span className="text-taupe">Date:</span> {format(new Date(selected.scheduled_time), 'MMM d, yyyy')}</div>
              {selected.assigned_admin && (
                <div><span className="text-taupe">Team Member:</span> {selected.assigned_admin.name}</div>
              )}
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
      <Modal open={completing} onClose={() => setCompleting(false)} title="Complete Visit" size="md">
        {selected && (
          <div className="space-y-4">
            <div>
              <label className="label">Mileage (km)</label>
              <input type="number" step="0.1" className="input" value={reportForm.distance_km}
                placeholder="e.g. 3.5"
                onChange={e => setReportForm(f => ({ ...f, distance_km: e.target.value }))} />
              {selected.user?.clientProfile?.address && (
                <button
                  type="button"
                  className="text-xs text-blue hover:underline mt-1"
                  onClick={async () => {
                    try {
                      // Build address list: find today's appointments in order and calculate route
                      const todaysAppts = (data ?? [])
                        .filter((a: any) => a.scheduled_time?.startsWith(selected.scheduled_time?.substring(0, 10)))
                        .filter((a: any) => a.user?.clientProfile?.address)
                        .sort((a: any, b: any) => a.scheduled_time.localeCompare(b.scheduled_time));
                      const addresses = todaysAppts.map((a: any) => {
                        const p = a.user.clientProfile;
                        return [p.address, p.city, p.province].filter(Boolean).join(', ');
                      });
                      if (addresses.length < 2) return;
                      const res = await api.post('/admin/time-mileage/estimate', { addresses });
                      setReportForm(f => ({ ...f, distance_km: String(res.data.data.total_km) }));
                    } catch { /* silently fail if Google Maps not configured */ }
                  }}
                >
                  Auto-calculate from today's route
                </button>
              )}
            </div>
            <div>
              <label className="label">Internal Notes</label>
              <textarea rows={3} className="input resize-none" value={reportForm.notes}
                placeholder="Notes visible only to you…"
                onChange={e => setReportForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex items-center justify-between mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setCompleting(false);
                  navigate(`/admin/report-cards/new?appointment_id=${selected.id}`);
                }}
              >
                Write Report Card
              </Button>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setCompleting(false)}>Cancel</Button>
                <Button
                  loading={complete.isPending}
                  onClick={() => complete.mutate(selected.id)}
                >
                  Complete Visit
                </Button>
              </div>
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

          {/* Team member */}
          <div>
            <label className="label">Team Member</label>
            <select
              className="input"
              value={newForm.assigned_to}
              onChange={e => setNewForm(f => ({ ...f, assigned_to: e.target.value }))}
            >
              <option value="">— Unassigned —</option>
              {(teamMembers ?? []).map((m: any) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Service type */}
            <div>
              <label className="label">Service *</label>
              <select
                className="input"
                value={newForm.service_type}
                onChange={e => {
                  const svc = SERVICE_TYPES.find(s => s.value === e.target.value)!;
                  setNewForm(f => ({ ...f, service_type: e.target.value, duration_minutes: svc.defaultDuration }));
                }}
              >
                {SERVICE_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>

            {/* Duration */}
            <div>
              <label className="label">Duration *</label>
              {(() => {
                const svc = SERVICE_TYPES.find(s => s.value === newForm.service_type)!;
                const durations = svc.durations;
                const isFixed = durations.length === 1 && svc.value !== 'custom';
                return (
                  <select
                    className="input"
                    value={newForm.duration_minutes}
                    disabled={isFixed}
                    onChange={e => setNewForm(f => ({ ...f, duration_minutes: parseInt(e.target.value) }))}
                  >
                    {svc.value === 'custom' && newForm.duration_minutes === 0 && (
                      <option value={0} disabled>Select duration</option>
                    )}
                    {durations.map(d => (
                      <option key={d} value={d}>{formatDuration(d)}</option>
                    ))}
                  </select>
                );
              })()}
            </div>

            {/* Date */}
            <div>
              <label className="label">Date *</label>
              <input
                type="date"
                className="input"
                value={newForm.scheduled_time ? newForm.scheduled_time.split('T')[0] : ''}
                onChange={e => {
                  const time = newForm.scheduled_time ? newForm.scheduled_time.split('T')[1] || '09:00' : '09:00';
                  const dt = `${e.target.value}T${time}`;
                  setNewForm(f => ({ ...f, scheduled_time: dt, client_time_block: getTimeBlock(dt) }));
                }}
              />
            </div>

            {/* Time */}
            <div>
              <label className="label">Time *</label>
              <select
                className="input"
                value={newForm.scheduled_time ? newForm.scheduled_time.split('T')[1]?.substring(0, 5) || '' : ''}
                onChange={e => {
                  const date = newForm.scheduled_time ? newForm.scheduled_time.split('T')[0] : '';
                  const dt = `${date}T${e.target.value}`;
                  setNewForm(f => ({ ...f, scheduled_time: dt, client_time_block: getTimeBlock(dt) }));
                }}
              >
                <option value="" disabled>Select time</option>
                {TIME_SLOTS.map(t => (
                  <option key={t} value={t}>{formatTime12(t)}</option>
                ))}
              </select>
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

          {/* Recurrence */}
          <div className="border border-taupe/30 rounded-lg p-4 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newForm.recurrence.enabled}
                onChange={e => setNewForm(f => ({ ...f, recurrence: { ...f.recurrence, enabled: e.target.checked } }))}
                className="accent-espresso"
              />
              <span className="text-sm font-medium">Make this recurring</span>
            </label>

            {newForm.recurrence.enabled && (
              <div className="space-y-3 pt-1">
                {/* Frequency & interval */}
                <div className="flex items-center gap-2 text-sm">
                  <span>Repeat every</span>
                  <input
                    type="number"
                    min={1}
                    max={52}
                    className="input w-16 text-center"
                    value={newForm.recurrence.interval}
                    onChange={e => setNewForm(f => ({ ...f, recurrence: { ...f.recurrence, interval: parseInt(e.target.value) || 1 } }))}
                  />
                  <select
                    className="input w-auto"
                    value={newForm.recurrence.frequency}
                    onChange={e => setNewForm(f => ({ ...f, recurrence: { ...f.recurrence, frequency: e.target.value as any } }))}
                  >
                    <option value="daily">{newForm.recurrence.interval === 1 ? 'day' : 'days'}</option>
                    <option value="weekly">{newForm.recurrence.interval === 1 ? 'week' : 'weeks'}</option>
                    <option value="monthly">{newForm.recurrence.interval === 1 ? 'month' : 'months'}</option>
                  </select>
                </div>

                {/* Days of week (weekly only) */}
                {newForm.recurrence.frequency === 'weekly' && (
                  <div>
                    <label className="label text-xs mb-1">Repeat on</label>
                    <div className="flex gap-1">
                      {DAYS_OF_WEEK.map(day => (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => {
                            setNewForm(f => {
                              const days = f.recurrence.days_of_week.includes(day.value)
                                ? f.recurrence.days_of_week.filter(d => d !== day.value)
                                : [...f.recurrence.days_of_week, day.value];
                              return { ...f, recurrence: { ...f.recurrence, days_of_week: days } };
                            });
                          }}
                          className={`w-9 h-9 rounded-full text-xs font-medium border transition-colors ${
                            newForm.recurrence.days_of_week.includes(day.value)
                              ? 'bg-espresso text-cream border-espresso'
                              : 'border-taupe text-espresso hover:bg-cream'
                          }`}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* End condition */}
                <div>
                  <label className="label text-xs mb-1">Ends</label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" name="recur-end" checked={newForm.recurrence.end_type === 'never'}
                        onChange={() => setNewForm(f => ({ ...f, recurrence: { ...f.recurrence, end_type: 'never' } }))}
                        className="accent-espresso" />
                      Never
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" name="recur-end" checked={newForm.recurrence.end_type === 'after'}
                        onChange={() => setNewForm(f => ({ ...f, recurrence: { ...f.recurrence, end_type: 'after' } }))}
                        className="accent-espresso" />
                      After
                      <input type="number" min={1} max={100} className="input w-16 text-center"
                        value={newForm.recurrence.end_after_count}
                        onChange={e => setNewForm(f => ({ ...f, recurrence: { ...f.recurrence, end_after_count: parseInt(e.target.value) || 1 } }))}
                        disabled={newForm.recurrence.end_type !== 'after'}
                      />
                      occurrences
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" name="recur-end" checked={newForm.recurrence.end_type === 'on_date'}
                        onChange={() => setNewForm(f => ({ ...f, recurrence: { ...f.recurrence, end_type: 'on_date' } }))}
                        className="accent-espresso" />
                      On
                      <input type="date" className="input w-auto"
                        value={newForm.recurrence.end_date}
                        onChange={e => setNewForm(f => ({ ...f, recurrence: { ...f.recurrence, end_date: e.target.value } }))}
                        disabled={newForm.recurrence.end_type !== 'on_date'}
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}
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
