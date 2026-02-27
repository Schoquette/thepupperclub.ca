import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Input';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { format } from 'date-fns';

export default function AdminBroadcastPage() {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [recipientMode, setRecipientMode] = useState<'all' | 'specific'>('all');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [success, setSuccess] = useState('');
  const [apiError, setApiError] = useState('');

  const { data: clientsData } = useQuery({
    queryKey: ['admin-clients-broadcast'],
    queryFn: () => api.get('/admin/clients').then(r => r.data.data),
  });

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['broadcast-history'],
    queryFn: () => api.get('/admin/notifications/history').then(r => r.data),
  });

  const send = useMutation({
    mutationFn: (payload: object) => api.post('/admin/notifications/broadcast', payload),
    onSuccess: (res) => {
      setSuccess(res.data.message ?? 'Broadcast sent!');
      setTitle('');
      setBody('');
      setSelectedIds([]);
      setApiError('');
      qc.invalidateQueries({ queryKey: ['broadcast-history'] });
    },
    onError: (err: any) => {
      setApiError(err.response?.data?.message ?? 'Failed to send broadcast.');
    },
  });

  const handleSend = () => {
    if (!title.trim() || !body.trim()) return;
    setSuccess('');
    setApiError('');
    send.mutate({
      title: title.trim(),
      body: body.trim(),
      recipients: recipientMode === 'all' ? ['all'] : selectedIds,
    });
  };

  const toggleClient = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Deduplicate broadcast history by title+body (same broadcast sent to multiple clients)
  const broadcasts = React.useMemo(() => {
    const all: any[] = historyData?.data ?? [];
    const seen = new Map<string, any & { count: number }>();
    for (const n of all) {
      if (n.data?.type !== 'broadcast') continue;
      const key = `${n.title}||${n.body}||${n.sent_at?.substring(0, 16)}`;
      if (seen.has(key)) {
        seen.get(key)!.count++;
      } else {
        seen.set(key, { ...n, count: 1 });
      }
    }
    return Array.from(seen.values());
  }, [historyData]);

  return (
    <div className="space-y-8">
      <h1 className="page-title">Broadcast Notifications</h1>

      {/* Compose */}
      <Card>
        <h2 className="text-lg font-display text-espresso mb-5">Send Broadcast</h2>
        <div className="space-y-4">
          <Input
            label="Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Holiday Schedule Update"
          />
          <Textarea
            label="Message"
            rows={4}
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Write your message to clients..."
          />

          {/* Recipients */}
          <div>
            <label className="label">Recipients</label>
            <div className="flex gap-3 mb-3">
              {(['all', 'specific'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setRecipientMode(mode)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium capitalize border transition-colors ${
                    recipientMode === mode
                      ? 'bg-espresso text-cream border-espresso'
                      : 'border-taupe text-espresso hover:bg-cream'
                  }`}
                >
                  {mode === 'all' ? 'All Clients' : 'Specific Clients'}
                </button>
              ))}
            </div>

            {recipientMode === 'specific' && (
              <div className="border border-cream rounded-lg divide-y divide-cream max-h-48 overflow-y-auto">
                {(clientsData ?? []).length === 0 && (
                  <p className="text-sm text-taupe p-3">No clients found.</p>
                )}
                {(clientsData ?? []).map((c: any) => (
                  <label key={c.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-cream/50">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(c.id)}
                      onChange={() => toggleClient(c.id)}
                      className="h-4 w-4 rounded border-taupe text-gold focus:ring-gold"
                    />
                    <span className="text-sm text-espresso">{c.name}</span>
                    <span className="text-xs text-taupe ml-auto">{c.email}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {success && (
            <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">{success}</p>
          )}
          {apiError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{apiError}</p>
          )}

          <div className="flex justify-end">
            <Button
              loading={send.isPending}
              disabled={!title.trim() || !body.trim() || (recipientMode === 'specific' && selectedIds.length === 0)}
              onClick={handleSend}
            >
              Send Broadcast
            </Button>
          </div>
        </div>
      </Card>

      {/* History */}
      <div>
        <h2 className="text-lg font-display text-espresso mb-3">Broadcast History</h2>
        {historyLoading ? (
          <PageLoader />
        ) : broadcasts.length === 0 ? (
          <Card>
            <p className="text-center py-8 text-taupe">No broadcasts sent yet.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {broadcasts.map((n: any, i: number) => (
              <Card key={i} padding="sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-espresso text-sm">{n.title}</div>
                    <div className="text-sm text-taupe mt-0.5 line-clamp-2">{n.body}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs text-taupe">
                      {n.sent_at ? format(new Date(n.sent_at), 'MMM d, yyyy · h:mm a') : '—'}
                    </div>
                    <div className="text-xs text-taupe mt-0.5">
                      {n.count} recipient{n.count !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
