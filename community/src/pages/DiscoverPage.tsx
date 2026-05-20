import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import VerifiedBadge from '@/components/VerifiedBadge';

interface Neighbour {
  id: number;
  display_name: string;
  introduction: string | null;
  availability: string[];
  verified: boolean;
  distance_label: string;
}

const AVAIL_LABELS: Record<string, string> = {
  mornings: 'Mornings',
  weekdays: 'Weekdays',
  evenings: 'Evenings',
  weekends: 'Weekends',
  ad_hoc:   'Ad hoc',
};

export default function DiscoverPage() {
  const { member, signOut } = useAuth();
  const [neighbours, setNeighbours] = useState<Neighbour[] | null>(null);
  const [emptyMessage, setEmptyMessage] = useState<string>('');
  const [error, setError] = useState('');

  const [requestTarget, setRequestTarget] = useState<Neighbour | null>(null);
  const [requestNote, setRequestNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;
    api.get('/community/neighbours')
      .then((res) => {
        if (cancelled) return;
        setNeighbours(res.data?.data ?? []);
        setEmptyMessage(res.data?.message ?? '');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.response?.data?.message ?? 'Couldn’t load neighbours.');
      });
    return () => { cancelled = true; };
  }, []);

  const sendRequest = async () => {
    if (!requestTarget) return;
    setSending(true);
    try {
      await api.post('/community/connections', {
        recipient_id: requestTarget.id,
        note: requestNote.trim() || null,
      });
      setSentTo((prev) => new Set(prev).add(requestTarget.id));
      setRequestTarget(null);
      setRequestNote('');
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Couldn’t send that request.');
    } finally {
      setSending(false);
    }
  };

  const radiusKm = member?.radius_meters ? (member.radius_meters / 1000).toFixed(1) : '1';

  return (
    <div className="min-h-screen px-8 py-12">
      <header className="max-w-4xl mx-auto flex items-center justify-between mb-12">
        <p className="label-caps text-blue">The Pupper Club &mdash; Community</p>
        <div className="flex items-center gap-6">
          <Link to="/network" className="label-caps text-taupe hover:text-espresso">Network</Link>
          <Link to="/broadcasts" className="label-caps text-taupe hover:text-espresso">Broadcasts</Link>
          <Link to="/messages" className="label-caps text-taupe hover:text-espresso">Messages</Link>
          <Link to="/home" className="label-caps text-taupe hover:text-espresso">Home</Link>
          <button onClick={signOut} className="label-caps text-taupe hover:text-espresso">Sign Out</button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto">
        <h1 className="font-display text-3xl text-espresso mb-3">Your neighbours.</h1>
        <p className="text-espresso/80 leading-relaxed mb-10">
          Verified members within about {radiusKm} km of you. First name and
          last initial only — no addresses, never an exact distance.
        </p>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-6">
            {error}
          </div>
        )}

        {neighbours === null ? (
          <div className="text-center py-16 text-taupe text-sm">Looking around...</div>
        ) : neighbours.length === 0 ? (
          <div className="bg-white border border-taupe/20 rounded-2xl p-12 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue/10 text-blue mb-5">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="10" r="3" />
                <path d="M12 2a8 8 0 0 0-8 8c0 7 8 12 8 12s8-5 8-12a8 8 0 0 0-8-8z" />
              </svg>
            </div>
            <h2 className="font-display text-xl text-espresso mb-3">Quiet here for now.</h2>
            <p className="text-espresso/80 leading-relaxed max-w-md mx-auto">
              {emptyMessage || 'We’re still gathering the first neighbours in your area. We’ll send you an email as soon as people start joining within your radius.'}
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {neighbours.map((n) => {
              const alreadyRequested = sentTo.has(n.id);
              return (
                <li key={n.id} className="bg-white border border-taupe/20 rounded-2xl p-6">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-display text-lg text-espresso">{n.display_name}</h3>
                        <VerifiedBadge verified={n.verified} />
                      </div>
                      <p className="text-xs text-taupe label-caps mt-1">{n.distance_label}</p>
                    </div>
                    <button
                      onClick={() => setRequestTarget(n)}
                      disabled={alreadyRequested}
                      className="btn-blue-outline disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ padding: '8px 18px', fontSize: 12 }}
                    >
                      {alreadyRequested ? 'Request Sent' : 'Connect'}
                    </button>
                  </div>
                  {n.introduction && (
                    <p className="text-sm text-espresso/85 leading-relaxed mb-3">{n.introduction}</p>
                  )}
                  {n.availability.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {n.availability.map((a) => (
                        <span key={a} className="text-[11px] bg-cream rounded-full px-2.5 py-1 text-espresso">
                          {AVAIL_LABELS[a] ?? a}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {requestTarget && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
            onClick={() => setRequestTarget(null)}
          >
            <div
              className="bg-white rounded-2xl max-w-md w-full p-7"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="label-caps text-blue mb-3">Connect with {requestTarget.display_name}</p>
              <h2 className="font-display text-xl text-espresso mb-4">Send a short note</h2>
              <textarea
                rows={4}
                maxLength={280}
                value={requestNote}
                onChange={(e) => setRequestNote(e.target.value)}
                placeholder="Hi! I live nearby and would love to be in your network. A small note about you helps — &ldquo;I work from home and walk my dog mornings.&rdquo;"
                className="field-input resize-none mb-2"
              />
              <p className="text-xs text-taupe text-right mb-4">{requestNote.length}/280</p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setRequestTarget(null)}
                  className="label-caps text-taupe hover:text-espresso px-3"
                >
                  Cancel
                </button>
                <button
                  onClick={sendRequest}
                  disabled={sending}
                  className="btn-blue disabled:opacity-60"
                >
                  {sending ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
