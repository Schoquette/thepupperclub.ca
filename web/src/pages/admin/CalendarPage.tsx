import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enCA } from 'date-fns/locale';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
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

export default function AdminCalendarPage() {
  const qc = useQueryClient();
  const [range, setRange] = useState({ start: new Date(), end: new Date() });
  const [selected, setSelected] = useState<any>(null);
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

  const events = (data ?? []).map((appt: any) => ({
    id: appt.id,
    title: `${appt.user?.name} — ${appt.dogs?.map((d: any) => d.name).join(', ')}`,
    start: new Date(appt.scheduled_time),
    end: new Date(new Date(appt.scheduled_time).getTime() + appt.duration_minutes * 60_000),
    resource: appt,
  }));

  return (
    <div className="space-y-6">
      <h1 className="page-title">Calendar</h1>

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
                Submit Report
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
