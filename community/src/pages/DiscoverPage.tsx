import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import PageShell from '@/components/PageShell';

interface Neighbour {
  id: number;
  introduction: string | null;
  availability: string[];
  need_availability: string[];
  care_offered: string[];
  care_needed: string[];
  verified: boolean;
  distance_label: string;
  pets_summary: { dog: number; cat: number; other: number };
}

const AVAIL_LABELS: Record<string, string> = {
  mornings: 'Mornings',
  weekdays: 'Weekdays',
  evenings: 'Evenings',
  weekends: 'Weekends',
  ad_hoc:   'Ad hoc',
};

const CARE_LABELS: Record<string, string> = {
  dog_walk:  'Dog walks',
  drop_in:   'Drop-in visits',
  overnight: 'Overnight stays',
  multi_day: 'Multi-day care',
};

function petSummaryText(s: Neighbour['pets_summary']): string {
  const parts: string[] = [];
  if (s.dog) parts.push(`${s.dog} ${s.dog === 1 ? 'dog' : 'dogs'}`);
  if (s.cat) parts.push(`${s.cat} ${s.cat === 1 ? 'cat' : 'cats'}`);
  if (s.other) parts.push(`${s.other} other`);
  return parts.length ? parts.join(' · ') : 'No pets listed';
}

export default function DiscoverPage() {
  const { member } = useAuth();
  const navigate = useNavigate();
  const isVerified = member?.status === 'verified';
  const [neighbours, setNeighbours] = useState<Neighbour[] | null>(null);
  const [emptyMessage, setEmptyMessage] = useState<string>('');
  const [error, setError] = useState('');

  const [requestTarget, setRequestTarget] = useState<Neighbour | null>(null);
  const [requestNote, setRequestNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<Set<number>>(new Set());

  // Modal for unverified viewers explaining the $5 ID-verification fee.
  const [showVerifyGate, setShowVerifyGate] = useState(false);

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

  const onConnectClick = (n: Neighbour) => {
    if (!isVerified) { setShowVerifyGate(true); return; }
    setRequestTarget(n);
  };

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
      if (err.response?.data?.requires_verification) {
        setRequestTarget(null);
        setShowVerifyGate(true);
        return;
      }
      setError(err.response?.data?.message ?? 'Couldn’t send that request.');
    } finally {
      setSending(false);
    }
  };

  const radiusKm = member?.radius_meters ? (member.radius_meters / 1000).toFixed(1) : '1';

  return (
    <PageShell back="/home" crumbs={[{ label: 'Home', to: '/home' }, { label: 'Discover' }]}>
        <h1 className="font-display text-3xl text-espresso mb-3">Your neighbours.</h1>
        <p className="text-espresso/80 leading-relaxed mb-6">
          Members within about {radiusKm} km of you. Names and photos stay
          hidden until both you and a neighbour verify and connect.
        </p>

        {!isVerified && (
          <div className="bg-blue/5 border border-blue/30 rounded-2xl p-5 mb-8">
            <p className="label-caps text-blue mb-2">You&rsquo;re browsing anonymously</p>
            <p className="text-sm text-espresso/85 leading-relaxed mb-3">
              You can see who&rsquo;s nearby and what they care about. To send
              a connection request or unlock full profiles, verify your
              identity ($5 covers the ID check).
            </p>
            <button
              onClick={() => navigate('/verify')}
              className="btn-blue"
              style={{ padding: '8px 18px', fontSize: 12 }}
            >
              Verify my identity
            </button>
          </div>
        )}

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
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-14 h-14 rounded-full bg-cream flex items-center justify-center text-xl shrink-0 select-none">
                        <span className="opacity-50">🙂</span>
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-display text-lg text-espresso">A neighbour</h3>
                        <p className="text-xs text-taupe label-caps">{n.distance_label}</p>
                        <p className="text-xs text-taupe mt-0.5">{petSummaryText(n.pets_summary)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => onConnectClick(n)}
                      disabled={alreadyRequested}
                      className="btn-blue-outline disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ padding: '8px 18px', fontSize: 12 }}
                    >
                      {alreadyRequested ? 'Request Sent' : isVerified ? 'Connect' : 'Verify to Connect'}
                    </button>
                  </div>
                  {n.introduction && (
                    <p className="text-sm text-espresso/85 leading-relaxed mb-3">{n.introduction}</p>
                  )}
                  {(n.availability.length > 0 || n.care_offered.length > 0) && (
                    <div className="mt-3">
                      <p className="label-caps text-taupe text-[10px] mb-1.5">Can help</p>
                      <div className="flex flex-wrap gap-1.5">
                        {n.availability.map((a) => (
                          <span key={`av-${a}`} className="text-[11px] bg-cream rounded-full px-2.5 py-1 text-espresso">
                            {AVAIL_LABELS[a] ?? a}
                          </span>
                        ))}
                        {n.care_offered.map((c) => (
                          <span key={`co-${c}`} className="text-[11px] bg-blue/10 rounded-full px-2.5 py-1 text-blue">
                            {CARE_LABELS[c] ?? c}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {(n.need_availability.length > 0 || n.care_needed.length > 0) && (
                    <div className="mt-3">
                      <p className="label-caps text-taupe text-[10px] mb-1.5">Sometimes needs</p>
                      <div className="flex flex-wrap gap-1.5">
                        {n.need_availability.map((a) => (
                          <span key={`na-${a}`} className="text-[11px] bg-cream rounded-full px-2.5 py-1 text-espresso">
                            {AVAIL_LABELS[a] ?? a}
                          </span>
                        ))}
                        {n.care_needed.map((c) => (
                          <span key={`cn-${c}`} className="text-[11px] bg-gold/15 rounded-full px-2.5 py-1 text-espresso">
                            {CARE_LABELS[c] ?? c}
                          </span>
                        ))}
                      </div>
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
              <p className="label-caps text-blue mb-3">Connect with a neighbour</p>
              <h2 className="font-display text-xl text-espresso mb-4">Send a short note</h2>
              <p className="text-sm text-espresso/80 mb-3 leading-relaxed">
                They&rsquo;ll see your note along with your full profile. If
                they accept, you&rsquo;ll both unlock names, photos, and pets.
              </p>
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

        {showVerifyGate && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
            onClick={() => setShowVerifyGate(false)}
          >
            <div
              className="bg-white rounded-2xl max-w-md w-full p-7"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="label-caps text-blue mb-3">Verify your identity</p>
              <h2 className="font-display text-xl text-espresso mb-3">A small step to keep everyone safe</h2>
              <p className="text-sm text-espresso/85 mb-3 leading-relaxed">
                Before connecting with a neighbour, we ask everyone to verify
                their identity with a government photo ID + selfie.
              </p>
              <p className="text-sm text-espresso/85 mb-5 leading-relaxed">
                There&rsquo;s a one-time <strong>$5 fee</strong> to cover the
                cost of the ID check. We don&rsquo;t profit from it — it just
                keeps the network real and respectful.
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowVerifyGate(false)}
                  className="label-caps text-taupe hover:text-espresso px-3"
                >
                  Maybe later
                </button>
                <button
                  onClick={() => { setShowVerifyGate(false); navigate('/verify'); }}
                  className="btn-blue"
                >
                  Verify ($5)
                </button>
              </div>
            </div>
          </div>
        )}
    </PageShell>
  );
}
