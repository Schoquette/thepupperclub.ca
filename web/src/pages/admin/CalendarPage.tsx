import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay, endOfWeek, addDays, isBefore, startOfDay, parseISO, differenceInDays } from 'date-fns';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { enCA } from 'date-fns/locale';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import 'react-big-calendar/lib/css/react-big-calendar.css';

/** Format a Date as YYYY-MM-DDTHH:mm in local time (no UTC conversion) */
function toLocalISO(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const locales = { 'en-CA': enCA };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

const STATUS_COLORS: Record<string, string> = {
  scheduled:  '#6492D8',
  checked_in: '#C9A24D',
  completed:  '#9CA3AF',
  cancelled:  '#C8BFB6',
};

const SERVICE_TYPES = [
  { value: 'walk_30',      label: '30-Minute Visit',   defaultDuration: 30,   durations: [30] },
  { value: 'walk_60',      label: '60-Minute Visit',   defaultDuration: 60,   durations: [60] },
  { value: 'custom',       label: 'Custom Visit',      defaultDuration: 0,    durations: [15, 45, 75, 90, 120] },
  { value: 'day_boarding', label: 'Day Boarding',       defaultDuration: 480,  durations: [480] },
  { value: 'overnight',    label: 'Overnight Boarding', defaultDuration: 1440, durations: [1440] },
];

const TIME_BLOCKS = [
  { value: 'early_morning', label: '6–9 AM',      startHour: 6,  endHour: 9 },
  { value: 'morning',       label: '9 AM–12 PM',  startHour: 9,  endHour: 12 },
  { value: 'midday',        label: '12–3 PM',     startHour: 12, endHour: 15 },
  { value: 'afternoon',     label: '3–6 PM',      startHour: 15, endHour: 18 },
  { value: 'evening',       label: '6–9 PM',      startHour: 18, endHour: 21 },
];

function getTimeBlock(dateTimeStr: string): string {
  if (!dateTimeStr) return 'morning';
  const hour = new Date(dateTimeStr).getHours();
  if (hour >= 18) return 'evening';
  if (hour >= 15) return 'afternoon';
  if (hour >= 12) return 'midday';
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

const BUFFER_MINUTES = 15;

type ScheduleWarning = {
  type: 'overlap' | 'buffer';
  clientName: string;
  time: string;
};

function getScheduleWarnings(
  assignedTo: string,
  scheduledTime: string,
  durationMinutes: number,
  appointments: any[],
  excludeId?: number,
): ScheduleWarning[] {
  if (!assignedTo || !scheduledTime || !durationMinutes) return [];

  const assignedToNum = parseInt(assignedTo);
  if (isNaN(assignedToNum)) return [];

  const newStart = new Date(scheduledTime).getTime();
  const newEnd = newStart + durationMinutes * 60_000;

  if (isNaN(newStart)) return [];

  const warnings: ScheduleWarning[] = [];

  for (const appt of appointments) {
    if (appt.id === excludeId) continue;
    if (appt.status === 'cancelled') continue;
    if (appt.assigned_admin?.id !== assignedToNum) continue;

    const localStr = appt.scheduled_time?.replace(/[Zz]$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
    const otherStart = new Date(localStr).getTime();
    const otherEnd = otherStart + appt.duration_minutes * 60_000;

    if (isNaN(otherStart)) continue;

    const clientName = appt.user?.name || 'Unknown';
    const timeLabel = formatTime12(
      `${String(new Date(otherStart).getHours()).padStart(2, '0')}:${String(new Date(otherStart).getMinutes()).padStart(2, '0')}`
    );

    // Check overlap: apptStart < otherEnd AND apptEnd > otherStart
    if (newStart < otherEnd && newEnd > otherStart) {
      warnings.push({ type: 'overlap', clientName, time: timeLabel });
      continue;
    }

    // Check buffer: gap between appointments < 15 min
    const gapAfter = otherStart - newEnd; // gap when other is after new
    const gapBefore = newStart - otherEnd; // gap when new is after other

    if ((gapAfter >= 0 && gapAfter < BUFFER_MINUTES * 60_000) ||
        (gapBefore >= 0 && gapBefore < BUFFER_MINUTES * 60_000)) {
      warnings.push({ type: 'buffer', clientName, time: timeLabel });
    }
  }

  return warnings;
}

function ScheduleWarningBanner({ warnings }: { warnings: ScheduleWarning[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 space-y-1">
      {warnings.map((w, i) => (
        <p key={i} className="text-sm text-amber-800 font-medium">
          {w.type === 'overlap'
            ? `Warning: This overlaps with ${w.clientName} at ${w.time}`
            : `Warning: Less than 15 min buffer before/after ${w.clientName} at ${w.time}`}
        </p>
      ))}
    </div>
  );
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

const DnDCalendar = withDragAndDrop(Calendar);

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

  // Drag-and-drop confirm
  const [dragPending, setDragPending] = useState<{ appointment: any; newStart: Date; newEnd: Date } | null>(null);

  // Edit appointment
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);
  const [editError, setEditError] = useState('');

  // "Send Update?" prompt after save
  const [notifyPrompt, setNotifyPrompt] = useState<{ appointmentId: number; payload: any } | null>(null);

  // Scope prompt for recurring edits: "just this one" or "all future"
  const [scopePrompt, setScopePrompt] = useState<{ appointmentId: number; payload: any; isRecurring: boolean } | null>(null);

  // Delete appointment
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; hasRecurrence: boolean } | null>(null);

  // Visit completion report form (legacy – still used for check-out)
  const [completing, setCompleting] = useState(false);
  const [reportForm, setReportForm] = useState({ distance_km: '', notes: '' });
  const [mileageFrom, setMileageFrom] = useState('');

  // Auto-fetch mileage when Complete Visit modal opens
  useEffect(() => {
    if (!completing || !selected) return;
    setMileageFrom('');
    api.get(`/admin/time-mileage/appointment/${selected.id}`)
      .then(res => {
        setReportForm(f => ({ ...f, distance_km: String(res.data.data.distance_km) }));
        setMileageFrom(res.data.data.from || '');
      })
      .catch(() => {}); // silently fail if Maps not configured
  }, [completing, selected?.id]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-appointments', range],
    queryFn: () =>
      api.get('/admin/appointments', {
        params: {
          start: toLocalISO(range.start),
          end: toLocalISO(range.end),
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

  // Load dog birthdays
  const { data: birthdaysData } = useQuery({
    queryKey: ['admin-dog-birthdays'],
    queryFn: () => api.get('/admin/dogs/birthdays').then(r => r.data.data),
  });

  // Scheduling status for current week
  const weekStart = format(startOfWeek(currentDate, { locale: enCA }), 'yyyy-MM-dd');
  const { data: schedulingData } = useQuery({
    queryKey: ['scheduling-status', weekStart],
    queryFn: () => api.get('/admin/appointments/scheduling-status', { params: { week_start: weekStart } }).then(r => r.data),
  });

  // Load dogs for selected client
  const selectedClientId = newForm.user_id ? parseInt(newForm.user_id) : null;
  const { data: clientDetail } = useQuery({
    queryKey: ['admin-client-dogs', selectedClientId],
    queryFn: () => api.get(`/admin/clients/${selectedClientId}`).then(r => r.data.data),
    enabled: !!selectedClientId,
  });
  const clientDogs: any[] = (clientDetail?.dogs ?? []).filter((d: any) => d.is_active);

  const [checkInError, setCheckInError] = useState('');
  const [calSuccess, setCalSuccess] = useState('');
  const checkIn = useMutation({
    mutationFn: (id: number) => api.post(`/admin/appointments/${id}/check-in`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-appointments'] }); setSelected(null); setCheckInError(''); setCalSuccess('Checked in!'); setTimeout(() => setCalSuccess(''), 2500); },
    onError: (err: any) => { setCheckInError(err.response?.data?.message || 'Check-in failed.'); },
  });

  const [completeError, setCompleteError] = useState('');
  const complete = useMutation({
    mutationFn: async (id: number) => {
      const payload: Record<string, any> = {};
      if (reportForm.distance_km) payload.distance_km = reportForm.distance_km;
      if (reportForm.notes) payload.notes = reportForm.notes;
      return api.post(`/admin/appointments/${id}/complete`, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-appointments'] });
      setSelected(null); setCompleting(false);
      setCompleteError('');
      setCalSuccess('Visit completed!'); setTimeout(() => setCalSuccess(''), 2500);
    },
    onError: (err: any) => { setCompleteError(err.response?.data?.message || 'Failed to complete visit.'); },
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

  const updateAppointment = useMutation({
    mutationFn: ({ id, ...payload }: any) => api.patch(`/admin/appointments/${id}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-appointments'] });
      setEditing(false);
      setEditForm(null);
      setEditError('');
      setDragPending(null);
    },
    onError: (err: any) => {
      setEditError(err.response?.data?.message ?? 'Failed to update appointment.');
    },
  });

  const deleteAppointment = useMutation({
    mutationFn: ({ id, scope }: { id: number; scope: string }) => api.delete(`/admin/appointments/${id}`, { data: { scope } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-appointments'] });
      setSelected(null);
      setDeleteConfirm(null);
      setCalSuccess('Appointment deleted.'); setTimeout(() => setCalSuccess(''), 2500);
    },
  });

  const [emailMsg, setEmailMsg] = useState('');
  const emailSchedule = useMutation({
    mutationFn: (date: string) => api.post('/admin/appointments/email-schedule', { date }),
    onSuccess: (res) => { setEmailMsg(res.data.message); setTimeout(() => setEmailMsg(''), 4000); },
    onError: (err: any) => { setEmailMsg(err.response?.data?.message || 'Failed to send.'); setTimeout(() => setEmailMsg(''), 4000); },
  });

  const exportCalendarCSV = () => {
    const visible = (data ?? []).filter((a: any) => a.status !== 'cancelled');
    if (!visible.length) return;
    const headers = ['Date', 'Time', 'End', 'Client', 'Dogs', 'Service', 'Address', 'Status'];
    const rows = visible.map((a: any) => {
      const localStr = a.scheduled_time?.replace(/[Zz]$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
      const d = new Date(localStr);
      const end = new Date(d.getTime() + a.duration_minutes * 60_000);
      const addr = a.user?.client_profile?.address || a.user?.clientProfile?.address || '';
      const city = a.user?.client_profile?.city || a.user?.clientProfile?.city || '';
      return [
        format(d, 'yyyy-MM-dd'),
        format(d, 'h:mm a'),
        format(end, 'h:mm a'),
        a.user?.name || '',
        a.dogs?.map((dog: any) => dog.name).join(', ') || '',
        (a.service_type === 'walk_30' ? '30-Minute Visit' : a.service_type === 'walk_60' ? '60-Minute Visit' : a.service_type?.replace(/_/g, ' ')) || '',
        [addr, city].filter(Boolean).join(', '),
        a.status,
      ];
    });
    const csv = [headers, ...rows].map(r => r.map((c: string) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schedule-${format(range.start, 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCalendarPDF = () => {
    const visible = (data ?? []).filter((a: any) => a.status !== 'cancelled');
    if (!visible.length) return;
    const printWin = window.open('', '_blank');
    if (!printWin) return;
    let tableRows = '';
    visible.forEach((a: any) => {
      const localStr = a.scheduled_time?.replace(/[Zz]$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
      const d = new Date(localStr);
      const end = new Date(d.getTime() + a.duration_minutes * 60_000);
      const addr = a.user?.client_profile?.address || a.user?.clientProfile?.address || '';
      const city = a.user?.client_profile?.city || a.user?.clientProfile?.city || '';
      tableRows += `<tr>
        <td>${format(d, 'EEE, MMM d')}</td>
        <td>${format(d, 'h:mm a')} – ${format(end, 'h:mm a')}</td>
        <td>${a.user?.name || '—'}</td>
        <td>${a.dogs?.map((dog: any) => dog.name).join(', ') || ''}</td>
        <td>${a.service_type === 'walk_30' ? '30-Minute Visit' : a.service_type === 'walk_60' ? '60-Minute Visit' : (a.service_type || '').replace(/_/g, ' ')}</td>
        <td>${[addr, city].filter(Boolean).join(', ')}</td>
      </tr>`;
    });
    printWin.document.write(`<!DOCTYPE html><html><head><title>Schedule</title>
      <style>body{font-family:Arial,sans-serif;padding:20px;color:#3B2F2A;}
      h1{font-size:18px;margin-bottom:4px;}
      p{font-size:13px;color:#888;margin:0 0 16px;}
      table{width:100%;border-collapse:collapse;font-size:12px;}
      th{background:#6492D8;color:#fff;padding:8px;text-align:left;text-transform:uppercase;font-size:10px;letter-spacing:0.5px;}
      td{padding:8px;border-bottom:1px solid #e9e4df;}</style></head><body>
      <h1>The Pupper Club — Schedule</h1>
      <p>${format(range.start, 'MMM d, yyyy')} – ${format(range.end, 'MMM d, yyyy')}</p>
      <table><thead><tr><th>Date</th><th>Time</th><th>Client</th><th>Dogs</th><th>Service</th><th>Address</th></tr></thead>
      <tbody>${tableRows}</tbody></table></body></html>`);
    printWin.document.close();
    printWin.print();
  };

  const handleDragDrop = useCallback(({ event, start, end }: any) => {
    const appt = event.resource;
    if (appt.status === 'completed' || appt.status === 'cancelled') return;
    if (isBefore(start, new Date())) return; // don't allow moving to the past
    setDragPending({ appointment: appt, newStart: start, newEnd: end });
  }, []);

  const confirmDrag = () => {
    if (!dragPending) return;
    const { appointment, newStart, newEnd } = dragPending;
    const durationMin = Math.round((newEnd.getTime() - newStart.getTime()) / 60_000);
    const payload: any = {
      id: appointment.id,
      scheduled_time: toLocalISO(newStart),
      client_time_block: getTimeBlock(toLocalISO(newStart)),
      duration_minutes: durationMin,
    };
    // Show notify prompt instead of saving directly
    setNotifyPrompt({ appointmentId: appointment.id, payload });
    setDragPending(null);
  };

  const handleEditSave = () => {
    if (!editForm) return;
    const payload: any = {
      service_type: editForm.service_type,
      duration_minutes: editForm.duration_minutes,
      scheduled_time: editForm.scheduled_time,
      client_time_block: getTimeBlock(editForm.scheduled_time),
      notes: editForm.notes || null,
      dog_ids: editForm.dog_ids,
    };
    if (editForm.assigned_to !== undefined) {
      payload.assigned_to = editForm.assigned_to || null;
    }
    const isRecurring = !!(editForm.recurrence_rule || editForm.recurrence_parent_id);
    setEditing(false);
    if (isRecurring) {
      // Ask scope first, then notify
      setScopePrompt({ appointmentId: editForm.id, payload, isRecurring: true });
    } else {
      // Go straight to notify prompt
      setNotifyPrompt({ appointmentId: editForm.id, payload });
    }
  };

  const handleScopeDecision = (scope: 'single' | 'future_all') => {
    if (!scopePrompt) return;
    const { appointmentId, payload } = scopePrompt;
    setScopePrompt(null);
    setNotifyPrompt({ appointmentId, payload: { ...payload, scope } });
  };

  const handleNotifyDecision = (sendNotification: boolean) => {
    if (!notifyPrompt) return;
    const { appointmentId, payload } = notifyPrompt;
    updateAppointment.mutate({ ...payload, id: appointmentId, notify_client: sendNotification });
    setNotifyPrompt(null);
  };

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

  // Cancelled appointments this week
  const cancelledThisWeek = useMemo(() => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    return (data ?? []).filter((appt: any) => {
      if (appt.status !== 'cancelled') return false;
      const localStr = appt.scheduled_time?.replace(/[Zz]$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
      const d = new Date(localStr);
      return d >= weekStart && d <= weekEnd;
    });
  }, [data, currentDate]);

  const appointmentEvents = (data ?? []).filter((appt: any) => appt.status !== 'cancelled').map((appt: any) => {
    // Parse as local time — strip trailing Z/offset so JS doesn't convert from UTC
    const localStr = appt.scheduled_time?.replace(/[Zz]$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
    const start = new Date(localStr);
    const end = new Date(start.getTime() + appt.duration_minutes * 60_000);
    return {
      id: appt.id,
      title: `${appt.user?.name} — ${appt.dogs?.map((d: any) => d.name).join(', ')}`,
      start,
      end,
      allDay: false,
      resource: appt,
    };
  });

  // Birthday events for calendar
  const birthdayEvents = (birthdaysData ?? []).map((b: any) => {
    const bday = parseISO(b.next_birthday);
    return {
      id: `bday-${b.id}`,
      title: `${b.name}'s Birthday (${b.turning_age}!)`,
      start: bday,
      end: bday,
      allDay: true,
      resource: { _isBirthday: true, ...b },
    };
  });

  const events = [...appointmentEvents, ...birthdayEvents];

  const today = startOfDay(new Date());

  const dayPropGetter = useCallback((date: Date) => {
    if (isBefore(date, today)) {
      return { style: { backgroundColor: '#f0ede8', opacity: 0.6 } };
    }
    return {};
  }, []);

  // Schedule overlap/buffer warnings for the new appointment form
  const newFormWarnings = useMemo(() => getScheduleWarnings(
    newForm.assigned_to,
    newForm.scheduled_time,
    newForm.duration_minutes,
    data ?? [],
  ), [newForm.assigned_to, newForm.scheduled_time, newForm.duration_minutes, data]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="page-title">Calendar</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="secondary" onClick={() => emailSchedule.mutate(format(currentDate, 'yyyy-MM-dd'))} disabled={emailSchedule.isPending}>
            {emailSchedule.isPending ? 'Sending...' : 'Email Today\'s Schedule'}
          </Button>
          <Button size="sm" variant="secondary" onClick={exportCalendarCSV}>Export CSV</Button>
          <Button size="sm" variant="secondary" onClick={exportCalendarPDF}>Export PDF</Button>
          <Button size="sm" onClick={() => { setCreatingAppt(true); setCreateError(''); }}>
            + New Appointment
          </Button>
        </div>
      </div>
      {emailMsg && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm text-green-700 font-medium">{emailMsg}</div>
      )}

      {/* Scheduling Status Dashboard */}
      <SchedulingDashboard
        data={schedulingData}
        onSchedule={(userId: number) => {
          const f = blankForm();
          f.user_id = String(userId);
          setNewForm(f);
          setCreateError('');
          setCreatingAppt(true);
        }}
      />

      {/* Cancellation Notices */}
      {cancelledThisWeek.length > 0 && (
        <Card padding="none">
          <div className="px-5 py-3 bg-red-50 border-b border-red-100 flex items-center gap-2">
            <span className="text-red-500 font-semibold text-sm">Cancellations This Week ({cancelledThisWeek.length})</span>
          </div>
          <div className="divide-y divide-cream">
            {cancelledThisWeek.map((appt: any) => {
              const localStr = appt.scheduled_time?.replace(/[Zz]$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
              const d = new Date(localStr);
              return (
                <div key={appt.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="h-8 w-8 rounded-full bg-red-100 text-red-500 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {appt.user?.name?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-espresso">{appt.user?.name}</span>
                    <span className="text-sm text-taupe ml-2">
                      {appt.dogs?.map((d: any) => d.name).join(', ')}
                    </span>
                  </div>
                  <div className="text-sm text-taupe flex-shrink-0">
                    {format(d, 'EEE, MMM d')} at {format(d, 'h:mm a')}
                  </div>
                  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">
                    Cancelled
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {isLoading ? <PageLoader /> : (
        <Card padding="none" className="overflow-hidden">
          <DnDCalendar
            localizer={localizer}
            events={events}
            date={currentDate}
            onNavigate={(newDate: Date) => {
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
            selectable
            onSelectSlot={(slotInfo: any) => {
              const f = blankForm();
              f.scheduled_time = toLocalISO(slotInfo.start);
              setNewForm(f);
              setCreateError('');
              setCreatingAppt(true);
            }}
            onSelectEvent={(e: any) => {
              if (e.resource?._isBirthday) {
                navigate(`/admin/clients/${e.resource.user_id}`);
                return;
              }
              setSelected(e.resource);
            }}
            onEventDrop={handleDragDrop}
            onEventResize={handleDragDrop}
            resizable
            draggableAccessor={(event: any) => !event.resource?._isBirthday && !isBefore(event.start, today)}
            dayPropGetter={dayPropGetter}
            eventPropGetter={(e: any) => {
              if (e.resource?._isBirthday) {
                return {
                  style: {
                    backgroundColor: '#C9A24D',
                    borderRadius: 6,
                    border: 'none',
                    color: 'white',
                    fontSize: 12,
                    fontWeight: 600,
                  },
                };
              }
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

      {/* Today's Appointments */}
      {calSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm text-green-700 font-medium">{calSuccess}</div>
      )}
      {checkInError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">{checkInError}</div>
      )}
      <TodaysAppointments
        appointments={data ?? []}
        onCheckIn={(id: number) => { setCheckInError(''); checkIn.mutate(id); }}
        checkInPending={checkIn.isPending}
        onSelect={(appt: any) => setSelected(appt)}
      />

      {/* Upcoming Birthdays */}
      <UpcomingBirthdays birthdays={birthdaysData ?? []} />

      {/* Appointment detail modal */}
      <Modal open={!!selected && !completing && !editing} onClose={() => setSelected(null)} title="Appointment" size="lg">
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
              <div className="flex items-center gap-2">
                {selected.status !== 'completed' && selected.status !== 'cancelled' && (
                  <button
                    onClick={() => {
                      // Format scheduled_time to YYYY-MM-DDTHH:mm for the form
                      const dt = new Date(selected.scheduled_time);
                      const yyyy = dt.getFullYear();
                      const mm = String(dt.getMonth() + 1).padStart(2, '0');
                      const dd = String(dt.getDate()).padStart(2, '0');
                      const hh = String(dt.getHours()).padStart(2, '0');
                      const min = String(dt.getMinutes()).padStart(2, '0');
                      const formattedTime = `${yyyy}-${mm}-${dd}T${hh}:${min}`;

                      setEditForm({
                        id: selected.id,
                        user_id: selected.user_id,
                        service_type: selected.service_type,
                        duration_minutes: selected.duration_minutes,
                        scheduled_time: formattedTime,
                        notes: selected.notes || '',
                        dog_ids: selected.dogs?.map((d: any) => d.id) ?? [],
                        assigned_to: selected.assigned_admin?.id?.toString() ?? '',
                        recurrence_rule: selected.recurrence_rule,
                        recurrence_parent_id: selected.recurrence_parent_id,
                      });
                      setEditing(true);
                      setEditError('');
                    }}
                    className="p-1.5 rounded-lg hover:bg-cream transition-colors"
                    title="Edit appointment"
                  >
                    <svg className="w-4 h-4 text-taupe hover:text-espresso" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                )}
                <Badge variant={statusBadge(selected.status)}>{selected.status.replace('_', ' ')}</Badge>
              </div>
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
            {(() => {
              const apptDate = new Date(selected.scheduled_time);
              const todayStr = format(new Date(), 'yyyy-MM-dd');
              const apptStr = format(apptDate, 'yyyy-MM-dd');
              const isToday = todayStr === apptStr;
              const isRecurring = !!(selected.recurrence_rule || selected.recurrence_parent_id);
              return (
                <>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-taupe">Service:</span> {selected.service_type === 'walk_30' ? '30-Minute Visit' : selected.service_type === 'walk_60' ? '60-Minute Visit' : selected.service_type.replace(/_/g, ' ')}</div>
                    <div><span className="text-taupe">Duration:</span> {formatDuration(selected.duration_minutes)}</div>
                    <div><span className="text-taupe">Time:</span> {format(apptDate, 'h:mm a')}</div>
                    <div><span className="text-taupe">Date:</span> {format(apptDate, 'MMM d, yyyy')}</div>
                    {selected.assigned_admin && (
                      <div><span className="text-taupe">Team Member:</span> {selected.assigned_admin.name}</div>
                    )}
                    {isRecurring && (
                      <div className="col-span-2"><span className="text-taupe">Recurring:</span> Yes</div>
                    )}
                  </div>
                  {selected.notes && <p className="text-sm text-taupe bg-cream rounded-lg p-3">{selected.notes}</p>}
                  <div className="flex items-center justify-between mt-4">
                    <div>
                      {selected.status !== 'completed' && selected.status !== 'cancelled' && (
                        <button
                          onClick={() => setDeleteConfirm({ id: selected.id, hasRecurrence: isRecurring })}
                          className="text-sm text-red-500 hover:text-red-700 hover:underline"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                    <div className="flex gap-3">
                      {selected.status === 'scheduled' && (
                        isToday ? (
                          <Button loading={checkIn.isPending} onClick={() => checkIn.mutate(selected.id)}>
                            Check In
                          </Button>
                        ) : (
                          <span className="text-xs text-taupe italic self-center">Check-in available on {format(apptDate, 'MMM d')}</span>
                        )
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
                </>
              );
            })()}
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
              {mileageFrom && (
                <p className="text-xs text-taupe mt-1">Auto-calculated from: {mileageFrom}</p>
              )}
            </div>
            <div>
              <label className="label">Internal Notes</label>
              <textarea rows={3} className="input resize-none" value={reportForm.notes}
                placeholder="Notes visible only to you…"
                onChange={e => setReportForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            {completeError && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{completeError}</p>
            )}
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
          {newForm.user_id && (() => {
            const cl = (clientsData ?? []).find((c: any) => String(c.id) === String(newForm.user_id));
            const profile = cl?.client_profile;
            const days = (profile?.preferred_walk_days ?? []).map((d: string) =>
              ({ monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' })[d] || d);
            const times = (profile?.preferred_walk_times ?? []).map((t: string) =>
              ({ early_morning: 'Early Morning (6–9am)', morning: 'Morning (9am–12pm)', midday: 'Midday (12–3pm)', afternoon: 'Afternoon (3–6pm)', evening: 'Evening (6–9pm)', morning_7_10: 'Morning (9am–12pm)', midday_11_2: 'Midday (12–3pm)', afternoon_3_6: 'Afternoon (3–6pm)', evening_6_9: 'Evening (6–9pm)' })[t] || t);
            return (days.length > 0 || times.length > 0) ? (
              <div className="text-xs text-blue-600 mt-1.5 space-y-0.5">
                {days.length > 0 && <div>Preferred Days: {days.join(', ')}</div>}
                {times.length > 0 && <div>Preferred Times: {times.join(', ')}</div>}
              </div>
            ) : null;
          })()}
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
                min={format(new Date(), 'yyyy-MM-dd')}
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

          {/* Schedule overlap/buffer warnings */}
          <ScheduleWarningBanner warnings={newFormWarnings} />

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
              disabled={!newForm.user_id || newForm.dog_ids.length === 0 || !newForm.scheduled_time || isBefore(new Date(newForm.scheduled_time), new Date())}
              onClick={handleCreate}
            >
              Create Appointment
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit appointment modal */}
      <Modal
        open={editing && !!editForm}
        onClose={() => { setEditing(false); setEditForm(null); setEditError(''); }}
        title="Edit Appointment"
        size="lg"
      >
        {editForm && (
          <EditAppointmentForm
            editForm={editForm}
            setEditForm={setEditForm}
            editError={editError}
            teamMembers={teamMembers}
            appointments={data ?? []}
            onCancel={() => { setEditing(false); setEditForm(null); setEditError(''); }}
            onSave={handleEditSave}
            isPending={updateAppointment.isPending}
          />
        )}
      </Modal>

      {/* Drag confirm modal */}
      <Modal open={!!dragPending} onClose={() => setDragPending(null)} title="Move Appointment">
        {dragPending && (
          <div className="space-y-4">
            <p className="text-sm text-espresso">
              Move <span className="font-semibold">{dragPending.appointment.user?.name}</span>'s appointment to{' '}
              <span className="font-semibold">{format(dragPending.newStart, 'EEEE, MMM d · h:mm a')}</span>?
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDragPending(null)}>Cancel</Button>
              <Button onClick={confirmDrag}>Confirm</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Recurring edit scope prompt */}
      <Modal open={!!scopePrompt} onClose={() => setScopePrompt(null)} title="Edit Recurring Appointment">
        <div className="space-y-4">
          <p className="text-sm text-espresso">
            This appointment is part of a recurring series. Apply your changes to:
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setScopePrompt(null)}>Cancel</Button>
            <Button size="sm" onClick={() => handleScopeDecision('single')}>
              Just This One
            </Button>
            <Button size="sm" onClick={() => handleScopeDecision('future_all')}>
              All Future Events
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Appointment">
        <div className="space-y-4">
          <p className="text-sm text-espresso">
            {deleteConfirm?.hasRecurrence
              ? 'This appointment is part of a recurring series. What would you like to delete?'
              : 'Are you sure you want to delete this appointment?'}
          </p>
          {deleteAppointment.isError && (
            <p className="text-sm text-red-600">{(deleteAppointment.error as any)?.response?.data?.message ?? 'Delete failed.'}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            {deleteConfirm?.hasRecurrence ? (
              <>
                <button
                  onClick={() => deleteConfirm && deleteAppointment.mutate({ id: deleteConfirm.id, scope: 'single' })}
                  disabled={deleteAppointment.isPending}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Just This One
                </button>
                <button
                  onClick={() => deleteConfirm && deleteAppointment.mutate({ id: deleteConfirm.id, scope: 'future_all' })}
                  disabled={deleteAppointment.isPending}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                >
                  All Future Events
                </button>
              </>
            ) : (
              <button
                onClick={() => deleteConfirm && deleteAppointment.mutate({ id: deleteConfirm.id, scope: 'single' })}
                disabled={deleteAppointment.isPending}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteAppointment.isPending ? 'Deleting…' : 'Yes, Delete'}
              </button>
            )}
          </div>
        </div>
      </Modal>

      {/* Send Update prompt */}
      <Modal open={!!notifyPrompt} onClose={() => setNotifyPrompt(null)} title="Send Update to Client?">
        <div className="space-y-4">
          <p className="text-sm text-espresso">
            Would you like to notify the client about this change? They will be notified through their preferred channel (app, email, or SMS).
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => handleNotifyDecision(false)} loading={updateAppointment.isPending}>
              Do Not Send Update
            </Button>
            <Button onClick={() => handleNotifyDecision(true)} loading={updateAppointment.isPending}>
              Send Update
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function EditAppointmentForm({ editForm, setEditForm, editError, teamMembers, appointments, onCancel, onSave, isPending }: {
  editForm: any;
  setEditForm: (fn: any) => void;
  editError: string;
  teamMembers: any;
  appointments: any[];
  onCancel: () => void;
  onSave: () => void;
  isPending: boolean;
}) {
  // Load dogs for the client
  const { data: clientDetail } = useQuery({
    queryKey: ['admin-client-dogs', editForm.user_id],
    queryFn: () => api.get(`/admin/clients/${editForm.user_id}`).then(r => r.data.data),
    enabled: !!editForm.user_id,
  });
  const clientDogs: any[] = (clientDetail?.dogs ?? []).filter((d: any) => d.is_active);

  const toggleDog = (dogId: number) => {
    setEditForm((f: any) => ({
      ...f,
      dog_ids: f.dog_ids.includes(dogId)
        ? f.dog_ids.filter((id: number) => id !== dogId)
        : [...f.dog_ids, dogId],
    }));
  };

  const dateStr = editForm.scheduled_time ? editForm.scheduled_time.substring(0, 10) : '';
  const timeStr = editForm.scheduled_time ? editForm.scheduled_time.substring(11, 16) || '' : '';

  // Schedule overlap/buffer warnings for the edit form
  const editWarnings = useMemo(() => getScheduleWarnings(
    editForm.assigned_to,
    editForm.scheduled_time,
    editForm.duration_minutes,
    appointments,
    editForm.id,
  ), [editForm.assigned_to, editForm.scheduled_time, editForm.duration_minutes, appointments, editForm.id]);

  return (
    <div className="space-y-4">
      {/* Dogs */}
      {clientDogs.length > 0 && (
        <div>
          <label className="label">Dogs</label>
          <div className="flex gap-2 flex-wrap">
            {clientDogs.map((d: any) => (
              <button
                key={d.id}
                type="button"
                onClick={() => toggleDog(d.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  editForm.dog_ids.includes(d.id)
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
          value={editForm.assigned_to}
          onChange={e => setEditForm((f: any) => ({ ...f, assigned_to: e.target.value }))}
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
          <label className="label">Service</label>
          <select
            className="input"
            value={editForm.service_type}
            onChange={e => {
              const svc = SERVICE_TYPES.find(s => s.value === e.target.value)!;
              setEditForm((f: any) => ({ ...f, service_type: e.target.value, duration_minutes: svc.defaultDuration || f.duration_minutes }));
            }}
          >
            {SERVICE_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        {/* Duration */}
        <div>
          <label className="label">Duration</label>
          {(() => {
            const svc = SERVICE_TYPES.find(s => s.value === editForm.service_type)!;
            const durations = svc.durations;
            const isFixed = durations.length === 1 && svc.value !== 'custom';
            return (
              <select
                className="input"
                value={editForm.duration_minutes}
                disabled={isFixed}
                onChange={e => setEditForm((f: any) => ({ ...f, duration_minutes: parseInt(e.target.value) }))}
              >
                {durations.map((d: number) => (
                  <option key={d} value={d}>{formatDuration(d)}</option>
                ))}
              </select>
            );
          })()}
        </div>

        {/* Date */}
        <div>
          <label className="label">Date</label>
          <input
            type="date"
            className="input"
            min={format(new Date(), 'yyyy-MM-dd')}
            value={dateStr}
            onChange={e => {
              const time = timeStr || '09:00';
              setEditForm((f: any) => ({ ...f, scheduled_time: `${e.target.value}T${time}` }));
            }}
          />
        </div>

        {/* Time */}
        <div>
          <label className="label">Time</label>
          <select
            className="input"
            value={timeStr}
            onChange={e => {
              const date = dateStr;
              setEditForm((f: any) => ({ ...f, scheduled_time: `${date}T${e.target.value}` }));
            }}
          >
            <option value="" disabled>Select time</option>
            {TIME_SLOTS.map(t => (
              <option key={t} value={t}>{formatTime12(t)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Schedule overlap/buffer warnings */}
      <ScheduleWarningBanner warnings={editWarnings} />

      {/* Notes */}
      <div>
        <label className="label">Notes</label>
        <textarea
          rows={2}
          className="input resize-none"
          value={editForm.notes}
          onChange={e => setEditForm((f: any) => ({ ...f, notes: e.target.value }))}
          placeholder="Any special instructions…"
        />
      </div>

      {editError && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{editError}</p>
      )}

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button
          loading={isPending}
          disabled={editForm.dog_ids.length === 0 || !editForm.scheduled_time || isBefore(new Date(editForm.scheduled_time), new Date())}
          onClick={onSave}
        >
          Save Changes
        </Button>
      </div>
    </div>
  );
}

// ── Today's Appointments + Map ─────────────────────────────────────────────

function TodaysAppointments({ appointments, onCheckIn, checkInPending, onSelect }: {
  appointments: any[];
  onCheckIn: (id: number) => void;
  checkInPending: boolean;
  onSelect: (appt: any) => void;
}) {
  const [checkingInId, setCheckingInId] = useState<number | null>(null);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todaysAppts = appointments
    .filter((a: any) => a.scheduled_time?.startsWith(todayStr) && a.status !== 'cancelled')
    .sort((a: any, b: any) => a.scheduled_time.localeCompare(b.scheduled_time));

  if (todaysAppts.length === 0) return null;

  const hasAddresses = todaysAppts.some((a: any) => a.user?.client_profile?.address);

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-lg font-display text-espresso mb-4">Today's Appointments</h2>
        <div className="divide-y divide-cream">
          {todaysAppts.map((appt: any, index: number) => {
            const time = format(new Date(appt.scheduled_time), 'h:mm a');
            const dogNames = appt.dogs?.map((d: any) => d.name).join(', ') || '—';
            const address = appt.user?.client_profile?.address;
            const isScheduled = appt.status === 'scheduled';
            const isCheckedIn = appt.status === 'checked_in';

            return (
              <div key={appt.id} className="flex items-center gap-3 py-3">
                {/* Order number */}
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-espresso text-cream flex items-center justify-center text-xs font-bold">
                  {index + 1}
                </div>

                {/* Left: time + dog name */}
                <button
                  className="flex-1 min-w-0 text-left hover:bg-cream/50 rounded-lg px-2 py-1 -mx-2 -my-1 transition-colors"
                  onClick={() => onSelect(appt)}
                >
                  <div className="text-sm font-semibold text-espresso">{time}</div>
                  <div className="text-sm text-taupe truncate">{dogNames}</div>
                  {isCheckedIn && <span className="text-xs text-gold font-medium">Checked in</span>}
                  {appt.status === 'completed' && <span className="text-xs text-green-600 font-medium">Completed</span>}
                </button>

                {/* Right: address + buttons */}
                <div className="flex-shrink-0 flex items-center gap-2">
                  {address && (
                    <span className="text-xs text-taupe max-w-[180px] truncate hidden sm:inline" title={address}>
                      {address}
                    </span>
                  )}
                  {address && (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue/10 text-blue hover:bg-blue/20 transition-colors"
                    >
                      Map
                    </a>
                  )}
                  {isScheduled && (
                    <button
                      onClick={() => { setCheckingInId(appt.id); onCheckIn(appt.id); }}
                      disabled={checkInPending && checkingInId === appt.id}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gold text-white hover:bg-gold/90 transition-colors disabled:opacity-50"
                    >
                      {checkInPending && checkingInId === appt.id ? 'Checking in…' : 'Check In'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Map — lazy loaded on expand */}
      {hasAddresses && <RouteMap appointments={todaysAppts} />}
    </div>
  );
}

// ── Route Map (lazy-loaded) ─────────────────────────────────────────────────

function RouteMap({ appointments }: { appointments: any[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState('');

  const addressAppts = appointments.filter((a: any) => a.user?.client_profile?.address);

  // Load Google Maps script only when expanded
  useEffect(() => {
    if (!expanded) return;
    const key = (import.meta as any).env?.VITE_GOOGLE_MAPS_KEY;
    if (!key) { setMapError('Google Maps API key not configured.'); return; }

    const existingScript = document.getElementById('google-maps-script');
    if (existingScript) {
      const google = (window as any).google;
      if (google?.maps) { setMapLoaded(true); return; }
      // Script tag exists but hasn't loaded yet — wait for it
      existingScript.addEventListener('load', () => setMapLoaded(true));
      existingScript.addEventListener('error', () => setMapError('Failed to load Google Maps.'));
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=marker`;
    script.async = true;
    script.onload = () => setMapLoaded(true);
    script.onerror = () => setMapError('Failed to load Google Maps.');
    document.head.appendChild(script);
  }, [expanded]);

  // Render map when loaded
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !expanded) return;
    const google = (window as any).google;
    if (!google?.maps) return;
    if (addressAppts.length === 0) return;

    const geocoder = new google.maps.Geocoder();
    const map = new google.maps.Map(mapRef.current, {
      zoom: 11,
      center: { lat: 49.2827, lng: -122.7931 },
      mapTypeControl: false,
      streetViewControl: false,
    });

    const bounds = new google.maps.LatLngBounds();
    let resolved = 0;

    addressAppts.forEach((appt: any, index: number) => {
      const address = appt.user.client_profile.address;
      const label = String(index + 1);
      const dogNames = appt.dogs?.map((d: any) => d.name).join(', ') || 'Appointment';

      geocoder.geocode({ address }, (results: any, status: any) => {
        resolved++;
        if (status !== 'OK' || !results?.[0]) {
          if (resolved === addressAppts.length && bounds.isEmpty?.()) {
            setMapError('Could not geocode any addresses.');
          }
          return;
        }
        const pos = results[0].geometry.location;
        bounds.extend(pos);

        const marker = new google.maps.Marker({
          position: pos,
          map,
          label: { text: label, color: 'white', fontWeight: 'bold', fontSize: '14px' },
          title: `${label}. ${dogNames} — ${address}`,
        });

        const infoWindow = new google.maps.InfoWindow({
          content: `<div style="font-size:13px"><strong>${label}. ${dogNames}</strong><br>${format(new Date(appt.scheduled_time), 'h:mm a')}<br><span style="color:#666">${address}</span></div>`,
        });
        marker.addListener('click', () => infoWindow.open(map, marker));

        // Fit bounds after all geocodes complete
        if (resolved === addressAppts.length) {
          if (addressAppts.length > 1) {
            map.fitBounds(bounds, 60);
          } else {
            map.setCenter(pos);
            map.setZoom(14);
          }
        }
      });
    });
  }, [mapLoaded, expanded]);

  return (
    <Card>
      <button
        className="flex items-center justify-between w-full text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <h2 className="text-lg font-display text-espresso">Route Map</h2>
        <svg
          className={`w-5 h-5 text-taupe transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="mt-3">
          {mapError ? (
            <p className="text-xs text-red-500 text-center py-8">{mapError}</p>
          ) : !mapLoaded ? (
            <p className="text-xs text-taupe text-center py-8">Loading map...</p>
          ) : null}
          <div ref={mapRef} className={`w-full h-[400px] rounded-xl overflow-hidden ${!mapLoaded || mapError ? 'hidden' : ''}`} />
        </div>
      )}
    </Card>
  );
}

// ── Upcoming Birthdays ──────────────────────────────────────────────────────

function UpcomingBirthdays({ birthdays }: { birthdays: any[] }) {
  const navigate = useNavigate();

  // Show birthdays in the next 30 days, plus any today
  const upcoming = birthdays.filter((b: any) => {
    const days = differenceInDays(parseISO(b.next_birthday), startOfDay(new Date()));
    return days >= 0 && days <= 30;
  });

  if (upcoming.length === 0) return null;

  return (
    <Card>
      <h2 className="text-lg font-display text-espresso mb-4">Upcoming Birthdays</h2>
      <div className="divide-y divide-cream">
        {upcoming.map((b: any) => {
          const bday = parseISO(b.next_birthday);
          const days = differenceInDays(bday, startOfDay(new Date()));
          const label = days === 0 ? 'Today!' : days === 1 ? 'Tomorrow' : `in ${days} days`;

          return (
            <div key={b.id} className="flex items-center gap-3 py-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gold/20 text-gold flex items-center justify-center text-sm font-bold">
                {b.turning_age}
              </div>
              <div className="flex-1 min-w-0">
                <button
                  className="text-sm font-semibold text-espresso hover:text-gold transition-colors text-left"
                  onClick={() => navigate(`/admin/clients/${b.user_id}`)}
                >
                  {b.name}
                </button>
                <div className="text-xs text-taupe">{b.owner_name}</div>
              </div>
              <div className="flex-shrink-0 text-right">
                <div className="text-sm text-espresso">{format(bday, 'MMM d')}</div>
                <div className={`text-xs font-medium ${days === 0 ? 'text-gold' : 'text-taupe'}`}>
                  {label}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Scheduling Status Dashboard ─────────────────────────────────────────────

function SchedulingDashboard({ data, onSchedule }: { data: any; onSchedule: (userId: number) => void }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(true);

  if (!data?.data || data.data.length === 0) return null;

  const clients: any[] = data.data;
  const under = clients.filter((c: any) => c.status === 'under');
  const over = clients.filter((c: any) => c.status === 'over');
  const ok = clients.filter((c: any) => c.status === 'ok');
  const paused = clients.filter((c: any) => c.status === 'paused');

  const weekLabel = data.week_start
    ? `Week of ${format(parseISO(data.week_start), 'MMM d')}`
    : 'This Week';

  return (
    <Card>
      <button
        className="flex items-center justify-between w-full text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-display text-espresso">Scheduling Status</h2>
          <span className="text-xs text-taupe">{weekLabel}</span>
        </div>
        <div className="flex items-center gap-3">
          {under.length > 0 && (
            <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
              {under.length} need{under.length === 1 ? 's' : ''} scheduling
            </span>
          )}
          {over.length > 0 && (
            <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              {over.length} over-scheduled
            </span>
          )}
          <svg
            className={`w-5 h-5 text-taupe transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          {/* Under-scheduled clients (need attention) */}
          {under.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">Needs Scheduling</p>
              <div className="divide-y divide-cream">
                {under.map((c: any) => (
                  <SchedulingRow key={c.user_id} client={c} onSchedule={onSchedule} onNavigate={() => navigate(`/admin/clients/${c.user_id}`)} />
                ))}
              </div>
            </div>
          )}

          {/* Over-scheduled clients */}
          {over.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2">Over-Scheduled</p>
              <div className="divide-y divide-cream">
                {over.map((c: any) => (
                  <SchedulingRow key={c.user_id} client={c} onSchedule={onSchedule} onNavigate={() => navigate(`/admin/clients/${c.user_id}`)} />
                ))}
              </div>
            </div>
          )}

          {/* On-track clients (collapsible) */}
          {ok.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-2">On Track ({ok.length})</p>
              <div className="divide-y divide-cream">
                {ok.map((c: any) => (
                  <SchedulingRow key={c.user_id} client={c} onSchedule={onSchedule} onNavigate={() => navigate(`/admin/clients/${c.user_id}`)} />
                ))}
              </div>
            </div>
          )}

          {/* Paused clients */}
          {paused.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-taupe uppercase tracking-wide mb-2">Paused ({paused.length})</p>
              <div className="divide-y divide-cream">
                {paused.map((c: any) => (
                  <SchedulingRow key={c.user_id} client={c} onSchedule={onSchedule} onNavigate={() => navigate(`/admin/clients/${c.user_id}`)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function SchedulingRow({ client, onSchedule, onNavigate }: { client: any; onSchedule: (userId: number) => void; onNavigate: () => void }) {
  const c = client;
  const statusColors: Record<string, string> = {
    under: 'text-red-600 bg-red-50',
    over: 'text-amber-600 bg-amber-50',
    ok: 'text-green-600 bg-green-50',
    paused: 'text-taupe bg-cream',
  };

  const dayLabels: Record<string, string> = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };
  const timeLabels: Record<string, string> = { early_morning: 'Early Morning', morning: 'Morning', midday: 'Midday', afternoon: 'Afternoon', evening: 'Evening', morning_7_10: 'Morning', midday_11_2: 'Midday', afternoon_3_6: 'Afternoon', evening_6_9: 'Evening' };
  const prefDays = (c.preferred_days || []).map((d: string) => dayLabels[d] || d);
  const prefTimes = (c.preferred_times || []).map((t: string) => timeLabels[t] || t);

  return (
    <div className="flex items-center gap-3 py-2.5">
      <button className="flex-1 min-w-0 text-left" onClick={onNavigate}>
        <div className="text-sm font-semibold text-espresso hover:text-gold transition-colors">{c.name}</div>
        <div className="text-xs text-taupe">{c.dogs?.join(', ')}{c.plan ? ` — ${c.plan}` : ''}</div>
        {(prefDays.length > 0 || prefTimes.length > 0) && (
          <div className="text-xs text-blue-600 mt-0.5">
            {prefDays.length > 0 && <span>Preferred Days: {prefDays.join(', ')}</span>}
            {prefDays.length > 0 && prefTimes.length > 0 && <span> · </span>}
            {prefTimes.length > 0 && <span>Times: {prefTimes.join(', ')}</span>}
          </div>
        )}
      </button>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${statusColors[c.status] ?? ''}`}>
          {c.scheduled}/{c.quota}
        </span>
        {c.status === 'under' && (
          <button
            onClick={() => onSchedule(c.user_id)}
            className="px-3 py-1 rounded-lg text-xs font-semibold bg-gold text-white hover:bg-gold/90 transition-colors"
          >
            Schedule
          </button>
        )}
      </div>
    </div>
  );
}
