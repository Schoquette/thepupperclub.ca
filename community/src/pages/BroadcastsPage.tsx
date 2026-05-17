import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

type CareType = 'walk' | 'drop_in' | 'overnight' | 'other';

const CARE_TYPE_LABELS: Record<CareType, string> = {
  walk:      'Walk',
  drop_in:   'Drop-in visit',
  overnight: 'Overnight',
  other:     'Other',
};

interface OutgoingBroadcast {
  id: number;
  care_type: CareType;
  starts_at: string | null;
  duration_minutes: number;
  context: string | null;
  status: 'open' | 'closed';
  closed_at: string | null;
  recipients_total: number;
  recipients_confirmed: number;
  recipients_declined: number;
  recipients_pending: number;
  confirmed_members: { id: number; display_name: string }[];
}

interface IncomingBroadcast {
  id: number;
  recipient_row_id: number;
  care_type: CareType;
  starts_at: string | null;
  duration_minutes: number;
  context: string | null;
  status: 'pending' | 'confirmed' | 'declined';
  sender: { id: number | null; display_name: string };
}

interface ConnectedMember {
  id: number;
  display_name: string;
}

export default function BroadcastsPage() {
  const { signOut } = useAuth();
  const [tab, setTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [incoming, setIncoming] = useState<IncomingBroadcast[] | null>(null);
  const [outgoing, setOutgoing] = useState<OutgoingBroadcast[] | null>(null);
  const [connections, setConnections] = useState<ConnectedMember[]>([]);
  const [error, setError] = useState('');
  const [composing, setComposing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [inc, out, conn] = await Promise.all([
        api.get('/community/broadcasts/incoming'),
        api.get('/community/broadcasts/outgoing'),
        api.get('/community/connections'),
      ]);
      setIncoming(inc.data?.data ?? []);
      setOutgoing(out.data?.data ?? []);
      setConnections(
        (conn.data?.accepted ?? [])
          .map((c: any) => c.member)
          .filter(Boolean) as ConnectedMember[],
      );
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Couldn’t load broadcasts.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const respond = async (broadcastId: number, action: 'confirm' | 'decline') => {
    try {
      await api.patch(`/community/broadcasts/${broadcastId}/respond`, { action });
      await load();
    } catch {
      setError('Couldn’t record your response.');
    }
  };

  const closeBroadcast = async (b: OutgoingBroadcast, confirmedId?: number) => {
    try {
      await api.patch(`/community/broadcasts/${b.id}/close`, {
        confirmed_with_id: confirmedId ?? null,
      });
      await load();
    } catch {
      setError('Couldn’t close that broadcast.');
    }
  };

  return (
    <div className="min-h-screen px-8 py-12">
      <header className="max-w-4xl mx-auto flex items-center justify-between mb-12">
        <p className="label-caps text-blue">The Pupper Club &mdash; Community</p>
        <div className="flex items-center gap-6">
          <Link to="/discover" className="label-caps text-taupe hover:text-espresso">Discover</Link>
          <Link to="/network" className="label-caps text-taupe hover:text-espresso">Network</Link>
          <Link to="/home" className="label-caps text-taupe hover:text-espresso">Home</Link>
          <button onClick={signOut} className="label-caps text-taupe hover:text-espresso">Sign Out</button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <h1 className="font-display text-3xl text-espresso">Care broadcasts.</h1>
          <button
            onClick={() => setComposing(true)}
            disabled={connections.length === 0}
            className="btn-blue disabled:opacity-50"
            title={connections.length === 0 ? 'Connect with neighbours first.' : ''}
          >
            New Broadcast
          </button>
        </div>
        <p className="text-espresso/80 leading-relaxed mb-8">
          Quietly ask connected neighbours for help with a one-off care task.
          Recipients see only their own copy &mdash; never who else got it,
          never who else has or hasn&rsquo;t responded.
        </p>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-6">
            {error}
          </div>
        )}

        <div className="flex gap-1 border-b border-taupe/30 mb-8">
          {(['incoming', 'outgoing'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition ${
                tab === t ? 'border-blue text-espresso' : 'border-transparent text-taupe hover:text-espresso'
              }`}
            >
              {t === 'incoming' ? 'From neighbours' : 'From you'}
            </button>
          ))}
        </div>

        {tab === 'incoming' ? (
          incoming === null ? (
            <p className="text-sm text-taupe text-center py-12">Loading...</p>
          ) : incoming.length === 0 ? (
            <p className="text-sm text-taupe italic text-center py-12">No broadcasts waiting for you.</p>
          ) : (
            <ul className="space-y-4">
              {incoming.map((b) => (
                <li key={b.id} className="bg-white border border-taupe/20 rounded-2xl p-6">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <p className="label-caps text-blue mb-1">{CARE_TYPE_LABELS[b.care_type]}</p>
                      <h3 className="font-display text-lg text-espresso">{b.sender.display_name}</h3>
                      <p className="text-xs text-taupe mt-1">
                        {formatWhen(b.starts_at, b.duration_minutes)}
                      </p>
                    </div>
                    {b.status === 'pending' ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => respond(b.id, 'decline')}
                          className="text-sm text-taupe hover:text-espresso"
                        >
                          Decline
                        </button>
                        <button
                          onClick={() => respond(b.id, 'confirm')}
                          className="btn-blue"
                          style={{ padding: '7px 16px', fontSize: 12 }}
                        >
                          I can help
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs label-caps text-taupe">
                        {b.status === 'confirmed' ? 'You said yes' : 'You declined'}
                      </span>
                    )}
                  </div>
                  {b.context && (
                    <p className="text-sm text-espresso/85 leading-relaxed">{b.context}</p>
                  )}
                </li>
              ))}
            </ul>
          )
        ) : outgoing === null ? (
          <p className="text-sm text-taupe text-center py-12">Loading...</p>
        ) : outgoing.length === 0 ? (
          <p className="text-sm text-taupe italic text-center py-12">No broadcasts yet.</p>
        ) : (
          <ul className="space-y-4">
            {outgoing.map((b) => (
              <li key={b.id} className="bg-white border border-taupe/20 rounded-2xl p-6">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <p className="label-caps text-blue mb-1">{CARE_TYPE_LABELS[b.care_type]}</p>
                    <p className="font-display text-lg text-espresso">
                      {formatWhen(b.starts_at, b.duration_minutes)}
                    </p>
                  </div>
                  <span className="text-xs label-caps text-taupe">
                    {b.status === 'closed' ? 'Closed' : 'Open'}
                  </span>
                </div>
                {b.context && <p className="text-sm text-espresso/85 leading-relaxed mb-3">{b.context}</p>}
                <p className="text-xs text-taupe mb-3">
                  Sent to {b.recipients_total} &middot; {b.recipients_confirmed} can help &middot; {b.recipients_declined} declined &middot; {b.recipients_pending} pending
                </p>
                {b.status === 'open' && b.confirmed_members.length > 0 && (
                  <div className="border-t border-cream pt-3 mt-3">
                    <p className="text-xs label-caps text-taupe mb-2">Available to help</p>
                    <ul className="space-y-2">
                      {b.confirmed_members.map((m) => (
                        <li key={m.id} className="flex items-center justify-between">
                          <span className="text-sm text-espresso">{m.display_name}</span>
                          <button
                            onClick={() => closeBroadcast(b, m.id)}
                            className="text-xs text-blue hover:underline"
                          >
                            Close with {m.display_name.split(' ')[0]}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {b.status === 'open' && (
                  <div className="mt-3 text-right">
                    <button
                      onClick={() => {
                        if (confirm('Close this broadcast? Recipients won\'t be able to respond.')) {
                          void closeBroadcast(b);
                        }
                      }}
                      className="text-xs text-taupe hover:text-espresso"
                    >
                      Close without choosing
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {composing && (
          <ComposeModal
            connections={connections}
            onClose={() => setComposing(false)}
            onSent={async () => {
              setComposing(false);
              setTab('outgoing');
              await load();
            }}
          />
        )}
      </main>
    </div>
  );
}

function formatWhen(iso: string | null, minutes: number): string {
  if (!iso) return '';
  const d = new Date(iso);
  const date = d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  const dur =
    minutes < 60 ? `${minutes} min`
    : minutes % 60 === 0 ? `${minutes / 60}h`
    : `${(minutes / 60).toFixed(1)}h`;
  return `${date} · ${dur}`;
}

function ComposeModal({
  connections,
  onClose,
  onSent,
}: {
  connections: ConnectedMember[];
  onClose: () => void;
  onSent: () => Promise<void>;
}) {
  const [careType, setCareType] = useState<CareType>('walk');
  const [startsAt, setStartsAt] = useState(() => {
    const next = new Date(Date.now() + 60 * 60 * 1000);
    next.setSeconds(0); next.setMilliseconds(0);
    return next.toISOString().slice(0, 16);
  });
  const [duration, setDuration] = useState(30);
  const [context, setContext] = useState('');
  const [recipientIds, setRecipientIds] = useState<Set<number>>(new Set());
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');

  const canSend = useMemo(
    () => recipientIds.size > 0 && !!startsAt && duration > 0,
    [recipientIds.size, startsAt, duration],
  );

  const toggleRecipient = (id: number) =>
    setRecipientIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    setErr('');
    try {
      await api.post('/community/broadcasts', {
        care_type:        careType,
        starts_at:        new Date(startsAt).toISOString(),
        duration_minutes: duration,
        context:          context.trim() || null,
        recipient_ids:    Array.from(recipientIds),
      });
      await onSent();
    } catch (e: any) {
      setErr(e.response?.data?.message ?? 'Couldn’t send the broadcast.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/40 px-6 py-12 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full p-7" onClick={(e) => e.stopPropagation()}>
        <p className="label-caps text-blue mb-3">New Care Broadcast</p>
        <h2 className="font-display text-xl text-espresso mb-6">What do you need help with?</h2>

        <div className="space-y-5">
          <div>
            <div className="field-label">Care type</div>
            <div className="flex flex-wrap gap-2 mt-1">
              {(Object.keys(CARE_TYPE_LABELS) as CareType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setCareType(t)}
                  className={`px-4 py-2 rounded-full border-2 text-sm transition ${
                    careType === t
                      ? 'bg-blue text-white border-blue'
                      : 'bg-transparent text-espresso border-taupe/40 hover:border-blue'
                  }`}
                >
                  {CARE_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="starts" className="field-label">When</label>
              <input
                id="starts"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="field-input"
              />
            </div>
            <div>
              <label htmlFor="dur" className="field-label">For how long?</label>
              <select
                id="dur"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="field-input"
              >
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={60}>1 hour</option>
                <option value={120}>2 hours</option>
                <option value={240}>4 hours</option>
                <option value={480}>8 hours</option>
                <option value={1440}>Overnight</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="ctx" className="field-label">A bit of context (optional)</label>
            <textarea
              id="ctx"
              rows={3}
              maxLength={1000}
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Mention the pets, the routine, anything that helps a neighbour picture the ask."
              className="field-input resize-none"
            />
          </div>

          <div>
            <div className="field-label">Send to</div>
            {connections.length === 0 ? (
              <p className="text-sm text-taupe italic mt-1">You haven’t connected with anyone yet.</p>
            ) : (
              <div className="max-h-44 overflow-y-auto border border-cream rounded-lg divide-y divide-cream mt-1">
                {connections.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-cream/50"
                  >
                    <input
                      type="checkbox"
                      checked={recipientIds.has(c.id)}
                      onChange={() => toggleRecipient(c.id)}
                      className="h-4 w-4 rounded border-taupe text-blue focus:ring-blue"
                    />
                    <span className="text-sm text-espresso">{c.display_name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {err && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {err}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button onClick={onClose} className="label-caps text-taupe hover:text-espresso px-3">Cancel</button>
            <button onClick={send} disabled={!canSend || sending} className="btn-blue disabled:opacity-60">
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
