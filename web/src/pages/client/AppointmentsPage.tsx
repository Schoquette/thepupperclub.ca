import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { PageLoader } from '@/components/ui/LoadingSpinner';

const TIME_BLOCKS = [
  { value: 'early_morning', label: '7–10 AM (Early Morning)' },
  { value: 'morning',       label: '9–12 PM (Morning)' },
  { value: 'midday',        label: '11 AM–2 PM (Midday)' },
  { value: 'afternoon',     label: '2–5 PM (Afternoon)' },
  { value: 'evening',       label: '5–8 PM (Evening)' },
];

const SERVICE_TYPES = [
  { value: 'walk_30',     label: '30-Minute Walk' },
  { value: 'walk_60',     label: '60-Minute Walk' },
  { value: 'drop_in',     label: 'Drop-In Visit' },
  { value: 'overnight',   label: 'Overnight Stay' },
  { value: 'day_boarding',label: 'Day Boarding' },
];

export default function ClientAppointmentsPage() {
  const qc = useQueryClient();
  const [requestModal, setRequestModal] = useState(false);
  const [form, setForm] = useState({
    service_type: 'walk_30',
    preferred_time_block: 'morning',
    preferred_date: '',
    notes: '',
    dog_ids: [] as number[],
  });

  const { data: appointments, isLoading } = useQuery({
    queryKey: ['client-appointments'],
    queryFn: () => api.get('/client/appointments').then(r => r.data.data),
  });

  const { data: dogs } = useQuery({
    queryKey: ['client-dogs'],
    queryFn: () => api.get('/client/dogs').then(r => r.data.data),
  });

  const { data: requests } = useQuery({
    queryKey: ['client-service-requests'],
    queryFn: () => api.get('/client/service-requests').then(r => r.data.data),
  });

  const createRequest = useMutation({
    mutationFn: () => api.post('/client/service-requests', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-service-requests'] });
      setRequestModal(false);
      setForm({ service_type: 'walk_30', preferred_time_block: 'morning', preferred_date: '', notes: '', dog_ids: [] });
    },
  });

  const toggleDog = (id: number) => {
    setForm(f => ({
      ...f,
      dog_ids: f.dog_ids.includes(id) ? f.dog_ids.filter(d => d !== id) : [...f.dog_ids, id],
    }));
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl text-espresso">Walks & Appointments</h1>
        <Button size="sm" onClick={() => setRequestModal(true)}>+ Request Walk</Button>
      </div>

      {/* Upcoming appointments */}
      {appointments?.length === 0 ? (
        <Card>
          <p className="text-center py-8 text-taupe">No appointments scheduled yet.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {appointments?.map((appt: any) => (
            <Card key={appt.id} padding="sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-espresso text-sm capitalize">
                    {appt.service_type?.replace(/_/g, ' ')}
                  </div>
                  <div className="text-xs text-taupe mt-0.5">
                    {TIME_BLOCKS.find(t => t.value === appt.client_time_block)?.label ?? appt.client_time_block}
                    {' · '}
                    {appt.dogs?.map((d: any) => d.name).join(', ')}
                  </div>
                </div>
                <Badge variant={statusBadge(appt.status)}>{appt.status.replace('_', ' ')}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pending requests */}
      {requests?.filter((r: any) => r.status === 'pending').length > 0 && (
        <div>
          <h2 className="font-display text-base text-espresso mb-2">Pending Requests</h2>
          <div className="space-y-2">
            {requests?.filter((r: any) => r.status === 'pending').map((req: any) => (
              <Card key={req.id} padding="sm">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-espresso capitalize">
                    {req.service_type?.replace(/_/g, ' ')} · {TIME_BLOCKS.find(t => t.value === req.preferred_time_block)?.label}
                  </div>
                  <Badge variant="gold">Pending</Badge>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Request modal */}
      <Modal open={requestModal} onClose={() => setRequestModal(false)} title="Request a Walk">
        <div className="space-y-4">
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
            placeholder="Anything Sophie should know?"
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setRequestModal(false)}>Cancel</Button>
            <Button
              loading={createRequest.isPending}
              disabled={!form.preferred_date || form.dog_ids.length === 0}
              onClick={() => createRequest.mutate()}
            >
              Submit Request
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
