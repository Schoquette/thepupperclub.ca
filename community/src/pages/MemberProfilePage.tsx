import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import MemberSafetyMenu from '@/components/MemberSafetyMenu';
import VerifiedBadge from '@/components/VerifiedBadge';
import AuthImage from '@/components/AuthImage';

interface Recommendation {
  id: number;
  body: string;
  author_id: number;
  author_name: string;
  created_at: string | null;
  mine?: boolean;
  hidden?: boolean;
}

interface MemberPet {
  id: number;
  species: 'dog' | 'cat' | 'other';
  species_other: string | null;
  name: string;
  photo_url: string | null;
  age_years: number | null;
  sex: string | null;
  spayed_neutered: boolean | null;
  notes: string | null;
  care_instructions: string | null;
  species_data: Record<string, any>;
}

interface MemberProfile {
  id: number;
  introduction: string | null;
  availability: string[];
  need_availability: string[];
  care_offered: string[];
  care_needed: string[];
  verified: boolean;
  is_self: boolean;
  connected: boolean;
  full_view: boolean;
  viewer_verified: boolean;
  pets_summary: { dog: number; cat: number; other: number };
  // full-view only
  display_name?: string;
  photo_url?: string | null;
  pets?: MemberPet[];
  recommendations: Recommendation[];
  hidden_recommendations?: Recommendation[];
  my_recommendation?: { id: number; body: string } | null;
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

const SPECIES_LABEL: Record<MemberPet['species'], string> = {
  dog: 'Dog', cat: 'Cat', other: 'Other',
};

function petSummaryText(s: MemberProfile['pets_summary']): string {
  const parts: string[] = [];
  if (s.dog) parts.push(`${s.dog} ${s.dog === 1 ? 'dog' : 'dogs'}`);
  if (s.cat) parts.push(`${s.cat} ${s.cat === 1 ? 'cat' : 'cats'}`);
  if (s.other) parts.push(`${s.other} other`);
  return parts.length ? parts.join(' · ') : 'No pets listed';
}

export default function MemberProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [data, setData] = useState<MemberProfile | null>(null);
  const [error, setError] = useState('');
  const [composing, setComposing] = useState(false);
  const [recBody, setRecBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [showVerifyGate, setShowVerifyGate] = useState(false);

  // Connect flow (only available when viewer is verified and not yet connected)
  const [showConnect, setShowConnect] = useState(false);
  const [connectNote, setConnectNote] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError('');
    try {
      const res = await api.get<{ data: MemberProfile }>(`/community/members/${id}`);
      setData(res.data.data);
      setRecBody(res.data.data.my_recommendation?.body ?? '');
    } catch (err: any) {
      if (err.response?.status === 404) {
        navigate('/network', { replace: true });
        return;
      }
      setError(err.response?.data?.message ?? 'Couldn’t load this profile.');
    }
  }, [id, navigate]);

  useEffect(() => { void load(); }, [load]);

  const saveRec = async () => {
    if (!data || data.is_self || !recBody.trim()) return;
    setSaving(true);
    try {
      await api.post('/community/recommendations', {
        subject_id: data.id,
        body: recBody.trim(),
      });
      setComposing(false);
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Couldn’t save your recommendation.');
    } finally {
      setSaving(false);
    }
  };

  const deleteRec = async () => {
    if (!data?.my_recommendation) return;
    if (!confirm('Remove your recommendation?')) return;
    try {
      await api.delete(`/community/recommendations/${data.my_recommendation.id}`);
      await load();
    } catch {
      setError('Couldn’t remove that recommendation.');
    }
  };

  const setHidden = async (recId: number, hidden: boolean) => {
    try {
      await api.patch(`/community/recommendations/${recId}/visibility`, { hidden });
      await load();
    } catch {
      setError('Couldn’t update visibility.');
    }
  };

  const submitConnection = async () => {
    if (!data) return;
    setConnecting(true);
    try {
      await api.post('/community/connections', {
        recipient_id: data.id,
        note: connectNote.trim() || null,
      });
      setShowConnect(false);
      setRequestSent(true);
    } catch (err: any) {
      if (err.response?.data?.requires_verification) {
        setShowConnect(false);
        setShowVerifyGate(true);
        return;
      }
      setError(err.response?.data?.message ?? 'Couldn’t send that request.');
    } finally {
      setConnecting(false);
    }
  };

  const onConnectClick = () => {
    if (!data) return;
    if (!data.viewer_verified) { setShowVerifyGate(true); return; }
    setShowConnect(true);
  };

  const headingName = data?.is_self
    ? 'Your profile'
    : data?.full_view
      ? data.display_name
      : 'A neighbour';

  return (
    <div className="min-h-screen px-8 py-12">
      <header className="max-w-4xl mx-auto flex items-center justify-between mb-12">
        <p className="label-caps text-blue">The Pupper Club &mdash; Community</p>
        <div className="flex items-center gap-6">
          <Link to="/discover" className="label-caps text-taupe hover:text-espresso">Discover</Link>
          <Link to="/network" className="label-caps text-taupe hover:text-espresso">Network</Link>
          <Link to="/messages" className="label-caps text-taupe hover:text-espresso">Messages</Link>
          <Link to="/home" className="label-caps text-taupe hover:text-espresso">Home</Link>
          <button onClick={signOut} className="label-caps text-taupe hover:text-espresso">Sign Out</button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto">
        {!data ? (
          <p className="text-sm text-taupe text-center py-16">Loading...</p>
        ) : (
          <>
            <div className="flex items-start gap-5 mb-6 flex-wrap">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-cream flex items-center justify-center text-3xl shrink-0">
                {data.full_view && data.photo_url ? (
                  <AuthImage src={data.photo_url} alt={data.display_name ?? ''} className="w-full h-full object-cover" fallback={<span>🙂</span>} />
                ) : (
                  <span className={data.full_view ? '' : 'opacity-50'}>🙂</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-display text-3xl text-espresso">{headingName}</h1>
                  <VerifiedBadge verified={data.verified} />
                </div>
                {!data.full_view && (
                  <p className="text-xs text-taupe mt-1">{petSummaryText(data.pets_summary)}</p>
                )}
              </div>
            </div>

            {data.introduction && (
              <p className="text-espresso/85 leading-relaxed mb-6">{data.introduction}</p>
            )}

            {(data.availability.length > 0 || data.care_offered.length > 0) && (
              <div className="mb-4">
                <p className="label-caps text-taupe text-[10px] mb-1.5">Can help</p>
                <div className="flex flex-wrap gap-1.5">
                  {data.availability.map((a) => (
                    <span key={`av-${a}`} className="text-[11px] bg-cream rounded-full px-2.5 py-1 text-espresso">{AVAIL_LABELS[a] ?? a}</span>
                  ))}
                  {data.care_offered.map((c) => (
                    <span key={`co-${c}`} className="text-[11px] bg-blue/10 rounded-full px-2.5 py-1 text-blue">{CARE_LABELS[c] ?? c}</span>
                  ))}
                </div>
              </div>
            )}

            {(data.need_availability.length > 0 || data.care_needed.length > 0) && (
              <div className="mb-8">
                <p className="label-caps text-taupe text-[10px] mb-1.5">Sometimes needs</p>
                <div className="flex flex-wrap gap-1.5">
                  {data.need_availability.map((a) => (
                    <span key={`na-${a}`} className="text-[11px] bg-cream rounded-full px-2.5 py-1 text-espresso">{AVAIL_LABELS[a] ?? a}</span>
                  ))}
                  {data.care_needed.map((c) => (
                    <span key={`cn-${c}`} className="text-[11px] bg-gold/15 rounded-full px-2.5 py-1 text-espresso">{CARE_LABELS[c] ?? c}</span>
                  ))}
                </div>
              </div>
            )}

            {!data.is_self && (
              <div className="flex items-center gap-3 mb-10 flex-wrap">
                {data.full_view ? (
                  <button
                    onClick={() => navigate(`/messages/${data.id}`)}
                    className="btn-blue-outline"
                    style={{ padding: '8px 18px', fontSize: 12 }}
                  >
                    Message
                  </button>
                ) : requestSent ? (
                  <button disabled className="btn-blue-outline opacity-60" style={{ padding: '8px 18px', fontSize: 12 }}>
                    Request Sent
                  </button>
                ) : (
                  <button
                    onClick={onConnectClick}
                    className="btn-blue-outline"
                    style={{ padding: '8px 18px', fontSize: 12 }}
                  >
                    {data.viewer_verified ? 'Connect' : 'Verify to Connect'}
                  </button>
                )}
                <MemberSafetyMenu
                  memberId={data.id}
                  memberName={data.full_view ? (data.display_name ?? 'this neighbour') : 'this neighbour'}
                  onBlocked={() => navigate('/discover', { replace: true })}
                />
              </div>
            )}

            {!data.is_self && !data.full_view && (
              <div className="bg-blue/5 border border-blue/30 rounded-2xl p-5 mb-10">
                <p className="label-caps text-blue mb-2">Names and photos are unlocked at connection</p>
                <p className="text-sm text-espresso/85 leading-relaxed">
                  When you and a neighbour both verify your identity and accept
                  a connection, you&rsquo;ll both see each other&rsquo;s name,
                  photo, and pets. Until then, you both stay anonymous.
                </p>
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-6">
                {error}
              </div>
            )}

            {/* Pets — only on full_view */}
            {data.full_view && data.pets && data.pets.length > 0 && (
              <section className="mb-12">
                <h2 className="font-display text-xl text-espresso mb-4">Pets</h2>
                <ul className="space-y-3">
                  {data.pets.map((p) => (
                    <li key={p.id} className="bg-white border border-taupe/20 rounded-2xl p-5">
                      <div className="flex items-start gap-4">
                        <div className="w-16 h-16 rounded-full overflow-hidden bg-cream flex items-center justify-center text-2xl shrink-0">
                          {p.photo_url ? (
                            <AuthImage src={p.photo_url} alt={p.name} className="w-full h-full object-cover" fallback={<span>🐾</span>} />
                          ) : (
                            <span>🐾</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-display text-lg text-espresso">{p.name}</p>
                          <p className="text-xs text-taupe mb-2">
                            {p.species === 'other' && p.species_other ? p.species_other : SPECIES_LABEL[p.species]}
                            {typeof p.age_years === 'number' ? ` · ${p.age_years} yr` : ''}
                            {p.sex ? ` · ${p.sex}` : ''}
                          </p>
                          {p.notes && (
                            <p className="text-sm text-espresso/85 leading-relaxed mb-2">{p.notes}</p>
                          )}
                          {p.care_instructions && (
                            <div className="mt-2">
                              <p className="label-caps text-taupe text-[10px] mb-1">Care instructions</p>
                              <p className="text-sm text-espresso/85 leading-relaxed whitespace-pre-line">{p.care_instructions}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Recommendations section */}
            <section className="mb-12">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-xl text-espresso">Recommendations</h2>
                {!data.is_self && data.full_view && !data.my_recommendation && (
                  <button
                    onClick={() => setComposing(true)}
                    className="text-sm text-blue hover:underline"
                  >
                    + Add a recommendation
                  </button>
                )}
              </div>
              <p className="text-xs text-taupe mb-5 leading-relaxed">
                A specific moment is more meaningful than a general kind
                word. There are no scores or ratings &mdash; just notes
                from neighbours.
              </p>

              {!data.is_self && data.full_view && data.my_recommendation && (
                <div className="bg-blue/5 border border-blue/20 rounded-2xl p-5 mb-4">
                  <p className="label-caps text-blue mb-2">Yours</p>
                  <p className="text-sm text-espresso/90 leading-relaxed mb-3">
                    &ldquo;{data.my_recommendation.body}&rdquo;
                  </p>
                  <div className="flex gap-3">
                    <button onClick={() => setComposing(true)} className="text-xs text-blue hover:underline">Edit</button>
                    <button onClick={deleteRec} className="text-xs text-taupe hover:text-red-500">Remove</button>
                  </div>
                </div>
              )}

              {data.recommendations.filter((r) => !r.mine).length === 0 && !data.is_self ? (
                <p className="text-sm text-taupe italic">No recommendations yet.</p>
              ) : (
                <ul className="space-y-3">
                  {data.recommendations
                    .filter((r) => !r.mine)
                    .map((r) => (
                      <li key={r.id} className="bg-white border border-taupe/20 rounded-2xl p-5">
                        <p className="text-sm text-espresso/90 leading-relaxed mb-2">
                          &ldquo;{r.body}&rdquo;
                        </p>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-taupe">
                            &mdash; {r.author_name}
                            {r.created_at && ` · ${format(new Date(r.created_at), 'MMM yyyy')}`}
                          </p>
                          {data.is_self && (
                            <button
                              onClick={() => setHidden(r.id, true)}
                              className="text-xs text-taupe hover:text-espresso"
                            >
                              Hide from profile
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                </ul>
              )}

              {data.is_self && data.hidden_recommendations && data.hidden_recommendations.length > 0 && (
                <div className="mt-8">
                  <h3 className="label-caps text-taupe mb-3">Hidden from your profile</h3>
                  <ul className="space-y-3">
                    {data.hidden_recommendations.map((r) => (
                      <li key={r.id} className="bg-cream/60 border border-taupe/20 rounded-2xl p-5">
                        <p className="text-sm text-espresso/80 leading-relaxed italic mb-2">
                          &ldquo;{r.body}&rdquo;
                        </p>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-taupe">&mdash; {r.author_name}</p>
                          <button onClick={() => setHidden(r.id, false)} className="text-xs text-blue hover:underline">
                            Show on profile
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </>
        )}

        {composing && data && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
            onClick={() => setComposing(false)}
          >
            <div className="bg-white rounded-2xl max-w-md w-full p-7" onClick={(e) => e.stopPropagation()}>
              <p className="label-caps text-blue mb-3">A note for {data.display_name}</p>
              <h2 className="font-display text-xl text-espresso mb-3">
                {data.my_recommendation ? 'Edit your recommendation' : 'Leave a recommendation'}
              </h2>
              <p className="text-sm text-espresso/80 mb-4 leading-relaxed">
                A specific moment is more meaningful than a general kind
                word. Try &ldquo;Sat with our cat the weekend we were away
                &mdash; sent a photo every evening.&rdquo;
              </p>
              <textarea
                rows={5}
                maxLength={320}
                value={recBody}
                onChange={(e) => setRecBody(e.target.value)}
                className="field-input resize-none mb-2"
              />
              <p className="text-xs text-taupe text-right mb-4">{recBody.length}/320</p>
              <div className="flex items-center justify-end gap-3">
                <button onClick={() => setComposing(false)} className="label-caps text-taupe hover:text-espresso px-3">Cancel</button>
                <button onClick={saveRec} disabled={!recBody.trim() || saving} className="btn-blue disabled:opacity-60">
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showConnect && data && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6" onClick={() => setShowConnect(false)}>
            <div className="bg-white rounded-2xl max-w-md w-full p-7" onClick={(e) => e.stopPropagation()}>
              <p className="label-caps text-blue mb-3">Connect with a neighbour</p>
              <h2 className="font-display text-xl text-espresso mb-3">Send a short note</h2>
              <p className="text-sm text-espresso/80 mb-3 leading-relaxed">
                They&rsquo;ll see your note along with your full profile.
                If they accept, you&rsquo;ll both unlock names, photos and pets.
              </p>
              <textarea
                rows={4}
                maxLength={280}
                value={connectNote}
                onChange={(e) => setConnectNote(e.target.value)}
                placeholder="Hi! I live nearby and would love to be in your network."
                className="field-input resize-none mb-2"
              />
              <p className="text-xs text-taupe text-right mb-4">{connectNote.length}/280</p>
              <div className="flex items-center justify-end gap-3">
                <button onClick={() => setShowConnect(false)} className="label-caps text-taupe hover:text-espresso px-3">Cancel</button>
                <button onClick={submitConnection} disabled={connecting} className="btn-blue disabled:opacity-60">
                  {connecting ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showVerifyGate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6" onClick={() => setShowVerifyGate(false)}>
            <div className="bg-white rounded-2xl max-w-md w-full p-7" onClick={(e) => e.stopPropagation()}>
              <p className="label-caps text-blue mb-3">Verify your identity</p>
              <h2 className="font-display text-xl text-espresso mb-3">A small step to keep everyone safe</h2>
              <p className="text-sm text-espresso/85 mb-3 leading-relaxed">
                Before connecting, we ask everyone to verify with a
                government photo ID + selfie.
              </p>
              <p className="text-sm text-espresso/85 mb-5 leading-relaxed">
                There&rsquo;s a one-time <strong>$5 fee</strong> to cover the
                cost of the ID check. We don&rsquo;t profit from it.
              </p>
              <div className="flex items-center justify-end gap-3">
                <button onClick={() => setShowVerifyGate(false)} className="label-caps text-taupe hover:text-espresso px-3">Maybe later</button>
                <button onClick={() => { setShowVerifyGate(false); navigate('/verify'); }} className="btn-blue">Verify ($5)</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
