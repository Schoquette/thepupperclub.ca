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
import { format } from 'date-fns';

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

export default function AdminServiceRequestsPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<any>(null);
  const [action, setAction] = useState<'approve' | 'decline' | 'counter' | null>(null);
  const [scheduledTime, setScheduledTime] = useState('');
  const [adminResponse, setAdminResponse] = useState('');
  const [counterBlock, setCounterBlock] = useState('morning');
  const [counterDate, setCounterDate] = useState('');
  const [apiError, setApiError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-service-requests'],
    queryFn: () => api.get('/admin/service-requests').then(r => r.data),
    refetchInterval: 30_000,
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
      respond.mutate({ action: 'approve', admin_response: adminResponse, scheduled_time: scheduledTime });
    } else if (action === 'decline') {
      respond.mutate({ action: 'decline', admin_response: adminResponse });
    } else if (action === 'counter') {
      respond.mutate({ action: 'counter', admin_response: adminResponse, counter_time_block: counterBlock, counter_date: counterDate });
    }
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <h1 className="page-title">Service Requests</h1>

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
                    // Pre-fill with requested date + start of their preferred time block
                    const date = sr.preferred_date ? String(sr.preferred_date).substring(0, 10) : '';
                    const time = TIME_BLOCK_DEFAULTS[sr.preferred_time_block] ?? '09:00';
                    setScheduledTime(date ? `${date}T${time}` : '');
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

      <Modal open={!!action && !!selected} onClose={() => { setSelected(null); setAction(null); setApiError(null); setScheduledTime(''); setAdminResponse(''); }} title="Respond to Request">
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
              <Input
                label="Scheduled date & time"
                type="datetime-local"
                step={900}
                value={scheduledTime}
                onChange={e => setScheduledTime(e.target.value)}
              />
            )}
            {action === 'counter' && (
              <div className="grid grid-cols-2 gap-3">
                <Input label="Counter date" type="date" value={counterDate} onChange={e => setCounterDate(e.target.value)} />
                <div>
                  <label className="label">Time block</label>
                  <select className="input" value={counterBlock} onChange={e => setCounterBlock(e.target.value)}>
                    {Object.entries(TIME_BLOCK_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
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
              <Button variant="outline" onClick={() => { setSelected(null); setAction(null); setApiError(null); setScheduledTime(''); setAdminResponse(''); }}>Cancel</Button>
              <Button
                loading={respond.isPending}
                variant={action === 'decline' ? 'danger' : 'primary'}
                disabled={action === 'approve' && !scheduledTime}
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
