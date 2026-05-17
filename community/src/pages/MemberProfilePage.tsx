import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface Recommendation {
  id: number;
  body: string;
  author_id: number;
  author_name: string;
  created_at: string | null;
  mine?: boolean;
  hidden?: boolean;
}

interface MemberProfile {
  id: number;
  display_name: string;
  introduction: string | null;
  availability: string[];
  is_self: boolean;
  recommendations: Recommendation[];
  hidden_recommendations: Recommendation[];
  my_recommendation: { id: number; body: string } | null;
}

const AVAIL_LABELS: Record<string, string> = {
  mornings: 'Mornings',
  weekdays: 'Weekdays',
  evenings: 'Evenings',
  weekends: 'Weekends',
  ad_hoc:   'Ad hoc',
};

export default function MemberProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [data, setData] = useState<MemberProfile | null>(null);
  const [error, setError] = useState('');
  const [composing, setComposing] = useState(false);
  const [recBody, setRecBody] = useState('');
  const [saving, setSaving] = useState(false);

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
            <h1 className="font-display text-3xl text-espresso mb-3">
              {data.is_self ? 'Your profile' : data.display_name}
            </h1>

            {data.introduction && (
              <p className="text-espresso/85 leading-relaxed mb-6">{data.introduction}</p>
            )}

            {data.availability.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-10">
                {data.availability.map((a) => (
                  <span key={a} className="text-[11px] bg-cream rounded-full px-2.5 py-1 text-espresso">
                    {AVAIL_LABELS[a] ?? a}
                  </span>
                ))}
              </div>
            )}

            {!data.is_self && (
              <div className="flex items-center gap-3 mb-12">
                <button
                  onClick={() => navigate(`/messages/${data.id}`)}
                  className="btn-blue-outline"
                  style={{ padding: '8px 18px', fontSize: 12 }}
                >
                  Message
                </button>
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-6">
                {error}
              </div>
            )}

            {/* Recommendations section */}
            <section className="mb-12">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-xl text-espresso">Recommendations</h2>
                {!data.is_self && !data.my_recommendation && (
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

              {/* My recommendation (editable) */}
              {!data.is_self && data.my_recommendation && (
                <div className="bg-blue/5 border border-blue/20 rounded-2xl p-5 mb-4">
                  <p className="label-caps text-blue mb-2">Yours</p>
                  <p className="text-sm text-espresso/90 leading-relaxed mb-3">
                    &ldquo;{data.my_recommendation.body}&rdquo;
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setComposing(true)}
                      className="text-xs text-blue hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={deleteRec}
                      className="text-xs text-taupe hover:text-red-500"
                    >
                      Remove
                    </button>
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

              {/* Hidden recs (only when looking at our own profile) */}
              {data.is_self && data.hidden_recommendations.length > 0 && (
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
                          <button
                            onClick={() => setHidden(r.id, false)}
                            className="text-xs text-blue hover:underline"
                          >
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

        {/* Compose / edit recommendation modal */}
        {composing && data && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
            onClick={() => setComposing(false)}
          >
            <div
              className="bg-white rounded-2xl max-w-md w-full p-7"
              onClick={(e) => e.stopPropagation()}
            >
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
                <button onClick={() => setComposing(false)} className="label-caps text-taupe hover:text-espresso px-3">
                  Cancel
                </button>
                <button
                  onClick={saveRec}
                  disabled={!recBody.trim() || saving}
                  className="btn-blue disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
