import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, endOfWeek, addDays } from 'date-fns';
import { enCA } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PageLoader } from '@/components/ui/LoadingSpinner';

const locales = { 'en-CA': enCA };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

const STATUS_COLORS: Record<string, string> = {
  scheduled:  '#6492D8',
  checked_in: '#C9A24D',
  completed:  '#22c55e',
};

const MOOD_OPTIONS = [
  { key: 'great', label: 'Great', emoji: '🐾' },
  { key: 'good', label: 'Good', emoji: '😊' },
  { key: 'okay', label: 'Okay', emoji: '😐' },
  { key: 'anxious', label: 'Anxious', emoji: '😟' },
  { key: 'unwell', label: 'Unwell', emoji: '🤒' },
];

const ENERGY_OPTIONS = ['low', 'normal', 'high', 'hyper'];

export default function MyCalendarPage() {
  const qc = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [range, setRange] = useState(() => ({
    start: startOfWeek(new Date(), { locale: enCA }),
    end: addDays(endOfWeek(new Date(), { locale: enCA }), 1),
  }));
  const [selected, setSelected] = useState<any>(null);
  const [completing, setCompleting] = useState(false);
  const [mood, setMood] = useState('good');
  const [energy, setEnergy] = useState('normal');
  const [eliminated, setEliminated] = useState(false);
  const [ateWell, setAteWell] = useState(false);
  const [drankWater, setDrankWater] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['my-appointments', range.start.toISOString(), range.end.toISOString()],
    queryFn: () => api.get('/admin/my/appointments', {
      params: { start: range.start.toISOString(), end: range.end.toISOString(), per_page: 200 },
    }).then(r => r.data.data ?? []),
  });

  const resetReport = () => {
    setMood('good'); setEnergy('normal'); setEliminated(false);
    setAteWell(false); setDrankWater(false); setNotes(''); setError('');
  };

  const checkIn = useMutation({
    mutationFn: (id: number) => api.post(`/admin/appointments/${id}/check-in`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-appointments'] }); setSelected(null); },
    onError: () => setError('Could not check in. Please try again.'),
  });

  const complete = useMutation({
    mutationFn: (id: number) => api.post(`/admin/appointments/${id}/complete`, {
      mood, energy_level: energy, eliminated, ate_well: ateWell, drank_water: drankWater,
      notes: notes || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-appointments'] });
      setSelected(null); setCompleting(false); resetReport();
    },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Could not complete visit. Please try again.'),
  });

  const events = (data ?? []).map((appt: any) => ({
    id: appt.id,
    title: `${appt.user?.name ?? ''} — ${appt.dogs?.map((d: any) => d.name).join(', ') ?? ''}`,
    start: new Date(appt.scheduled_time),
    end: new Date(new Date(appt.scheduled_time).getTime() + 30 * 60 * 1000),
    resource: appt,
  }));

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

      {/* Detail modal */}
      <Modal open={!!selected && !completing} onClose={() => { setSelected(null); setError(''); }} title="Visit" size="md">
        {selected && (
          <div className="space-y-4">
            <div>
              <div className="font-semibold text-espresso">{selected.user?.name}</div>
              <div className="text-sm text-taupe">{selected.dogs?.map((d: any) => d.name).join(', ') || 'No dogs listed'}</div>
            </div>
            <div className="text-sm text-taupe">
              {format(new Date(selected.scheduled_time), 'EEEE, MMM d · h:mm a')}
            </div>
            <div className="text-sm text-espresso capitalize">
              {selected.service_type?.replace(/_/g, ' ')} · {selected.client_time_block?.replace(/_/g, ' ')}
            </div>
            <div className="text-sm">
              Status: <span className="capitalize font-medium text-espresso">{selected.status?.replace(/_/g, ' ')}</span>
            </div>

            {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</div>}

            {selected.status === 'scheduled' && (
              <Button onClick={() => checkIn.mutate(selected.id)} loading={checkIn.isPending} className="w-full">
                🐾 Check In
              </Button>
            )}
            {selected.status === 'checked_in' && (
              <Button onClick={() => { setError(''); setCompleting(true); }} className="w-full">
                ✓ Complete Visit
              </Button>
            )}
            {selected.status === 'completed' && selected.visit_report && (
              <div className="text-sm text-taupe">
                Mood: <span className="capitalize text-espresso">{selected.visit_report.mood}</span>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Complete visit modal */}
      <Modal open={completing} onClose={() => { setCompleting(false); setSelected(null); resetReport(); }} title="Complete Visit" size="md">
        {selected && (
          <div className="space-y-4">
            {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</div>}

            <div>
              <div className="text-sm font-semibold text-espresso mb-2">Mood</div>
              <div className="flex flex-wrap gap-2">
                {MOOD_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setMood(opt.key)}
                    className={`px-3 py-2 rounded-lg text-sm border ${mood === opt.key ? 'bg-gold text-white border-gold' : 'border-taupe text-espresso'}`}
                  >
                    {opt.emoji} {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold text-espresso mb-2">Energy Level</div>
              <div className="flex flex-wrap gap-2">
                {ENERGY_OPTIONS.map(key => (
                  <button
                    key={key}
                    onClick={() => setEnergy(key)}
                    className={`px-3 py-2 rounded-lg text-sm border capitalize ${energy === key ? 'bg-gold text-white border-gold' : 'border-taupe text-espresso'}`}
                  >
                    {key}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold text-espresso mb-2">Quick Checks</div>
              <div className="space-y-2">
                {[
                  { label: '💩 Eliminated', val: eliminated, set: setEliminated },
                  { label: '🍗 Ate Well', val: ateWell, set: setAteWell },
                  { label: '💧 Drank Water', val: drankWater, set: setDrankWater },
                ].map(({ label, val, set }) => (
                  <label key={label} className="flex items-center gap-3 text-sm text-espresso">
                    <input type="checkbox" checked={val} onChange={() => set(!val)} className="h-4 w-4" />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold text-espresso mb-2">Notes (optional)</div>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="How did the visit go?"
                rows={3}
                className="w-full border border-taupe rounded-lg p-3 text-sm"
              />
            </div>

            <Button
              onClick={() => complete.mutate(selected.id)}
              loading={complete.isPending}
              className="w-full"
            >
              Complete & Notify Client
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
