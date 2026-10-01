import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, endOfWeek, addDays } from 'date-fns';
import { enCA } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { PageLoader } from '@/components/ui/LoadingSpinner';

const locales = { 'en-CA': enCA };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

const STATUS_COLORS: Record<string, string> = {
  scheduled:  '#6492D8',
  checked_in: '#C9A24D',
  completed:  '#22c55e',
};

export default function MyCalendarPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [range, setRange] = useState(() => ({
    start: startOfWeek(new Date(), { locale: enCA }),
    end: addDays(endOfWeek(new Date(), { locale: enCA }), 1),
  }));
  const [selected, setSelected] = useState<any>(null);
  const [completing, setCompleting] = useState(false);
  const [reportForm, setReportForm] = useState({ distance_km: '', notes: '' });
  const [mileageFrom, setMileageFrom] = useState('');
  const [checkInError, setCheckInError] = useState('');
  const [completeError, setCompleteError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['my-appointments', range.start.toISOString(), range.end.toISOString()],
    queryFn: () => api.get('/admin/my/appointments', {
      params: { start: range.start.toISOString(), end: range.end.toISOString(), per_page: 200 },
    }).then(r => r.data.data ?? []),
  });

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
  }, [completing, selected?.id]); // eslint-disable-line

  const checkIn = useMutation({
    mutationFn: (id: number) => api.post(`/admin/appointments/${id}/check-in`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-appointments'] });
      setSelected(null); setCheckInError('');
    },
    onError: (err: any) => setCheckInError(err.response?.data?.message || 'Check-in failed.'),
  });

  const complete = useMutation({
    mutationFn: (id: number) => {
      const payload: Record<string, any> = {};
      if (reportForm.distance_km) payload.distance_km = reportForm.distance_km;
      if (reportForm.notes) payload.notes = reportForm.notes;
      return api.post(`/admin/appointments/${id}/complete`, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-appointments'] });
      setSelected(null); setCompleting(false); setCompleteError('');
      setReportForm({ distance_km: '', notes: '' });
    },
    onError: (err: any) => setCompleteError(err.response?.data?.message || 'Failed to complete visit.'),
  });

  const events = (data ?? []).map((appt: any) => ({
    id: appt.id,
    title: `${appt.user?.name ?? ''} — ${appt.dogs?.map((d: any) => d.name).join(', ') ?? ''}`,
    start: new Date(appt.scheduled_time),
    end: new Date(new Date(appt.scheduled_time).getTime() + 30 * 60 * 1000),
    resource: appt,
  }));

  const goToClient = (userId: number) => {
    setSelected(null);
    navigate(`/admin/clients/${userId}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display text-espresso">My Calendar</h1>
        <p className="text-sm text-taupe mt-1">Your assigned visits — read-only. Tap a visit to check in or complete it.</p>
      </div>

      {isLoading ? <PageLoader /> : (
        <Card padding="none" className="overflow-hidden">
          <Calendar
            localizer={localizer}
            events={events}
            date={currentDate}
            onNavigate={(newDate: Date) => {
              setCurrentDate(newDate);
              const weekStart = startOfWeek(newDate, { locale: enCA });
              const weekEnd = addDays(endOfWeek(newDate, { locale: enCA }), 1);
              setRange({ start: weekStart, end: weekEnd });
            }}
            onRangeChange={(r: any) => {
              if (Array.isArray(r)) {
                setRange({ start: r[0], end: addDays(r[r.length - 1], 1) });
              } else {
                setRange({ start: r.start, end: r.end });
              }
            }}
            defaultView={Views.WEEK}
            views={[Views.WEEK, Views.DAY, Views.AGENDA]}
            step={15}
            timeslots={4}
            min={new Date(1970, 0, 1, 6, 0)}
            max={new Date(1970, 0, 1, 21, 0)}
            style={{ height: 600, padding: 16 }}
            selectable={false}
            onSelectEvent={(e: any) => setSelected(e.resource)}
            eventPropGetter={(e: any) => ({
              style: {
                backgroundColor: STATUS_COLORS[e.resource?.status] ?? '#6492D8',
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
      <Modal open={!!selected && !completing} onClose={() => { setSelected(null); setCheckInError(''); }} title="Visit" size="md">
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <button
                  className="font-semibold text-espresso hover:text-gold transition-colors text-left"
                  onClick={() => goToClient(selected.user_id)}
                >
                  {selected.user?.name}
                </button>
                <div className="text-sm text-taupe flex flex-wrap gap-x-2">
                  {selected.dogs?.map((d: any, i: number) => (
                    <span key={d.id}>
                      <button className="hover:text-gold transition-colors underline" onClick={() => goToClient(selected.user_id)}>{d.name}</button>
                      {i < selected.dogs.length - 1 && ','}
                    </span>
                  ))}
                  {!selected.dogs?.length && 'No dogs listed'}
                </div>
              </div>
              <Badge variant={statusBadge(selected.status)}>{selected.status?.replace(/_/g, ' ')}</Badge>
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
              <div><span className="text-taupe">Service:</span> {selected.service_type === 'walk_30' ? '30-Minute Visit' : selected.service_type === 'walk_60' ? '60-Minute Visit' : selected.service_type === 'pack_hike' ? 'Group Hike' : selected.service_type?.replace(/_/g, ' ')}</div>
              <div><span className="text-taupe">Time:</span> {format(new Date(selected.scheduled_time), 'h:mm a')}</div>
              <div><span className="text-taupe">Date:</span> {format(new Date(selected.scheduled_time), 'MMM d, yyyy')}</div>
            </div>

            {selected.notes && <p className="text-sm text-taupe bg-cream rounded-lg p-3">{selected.notes}</p>}

            {checkInError && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{checkInError}</div>}

            <div className="flex items-center justify-end gap-3 mt-4">
              {selected.status === 'scheduled' && (
                <Button loading={checkIn.isPending} onClick={() => checkIn.mutate(selected.id)}>
                  Check In
                </Button>
              )}
              {selected.status === 'checked_in' && (
                <Button onClick={() => { setCompleteError(''); setCompleting(true); }}>
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

      {/* Complete visit modal — mirrors the admin calendar's flow exactly */}
      <Modal open={completing} onClose={() => setCompleting(false)} title="Complete Visit" size="md">
        {selected && (
          <div className="space-y-4">
            <div>
              <label className="label">Mileage (km)</label>
              <input
                type="number"
                step="0.1"
                className="input"
                value={reportForm.distance_km}
                placeholder="e.g. 3.5"
                onChange={e => setReportForm(f => ({ ...f, distance_km: e.target.value }))}
              />
              {mileageFrom && (
                <p className="text-xs text-taupe mt-1">Auto-calculated from: {mileageFrom}</p>
              )}
            </div>
            <div>
              <label className="label">Internal Notes</label>
              <textarea
                rows={3}
                className="input resize-none"
                value={reportForm.notes}
                placeholder="Notes visible only to you…"
                onChange={e => setReportForm(f => ({ ...f, notes: e.target.value }))}
              />
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
                <Button loading={complete.isPending} onClick={() => complete.mutate(selected.id)}>
                  Complete Visit
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
