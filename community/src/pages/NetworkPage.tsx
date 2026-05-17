import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface NetworkMember {
  id: number;
  display_name: string;
  introduction: string | null;
  availability: string[];
}

interface ConnectionEntry {
  id: number;
  status: 'pending' | 'accepted' | 'declined' | 'removed';
  note: string | null;
  created_at: string | null;
  member: NetworkMember | null;
}

interface ConnectionsPayload {
  incoming: ConnectionEntry[];
  outgoing: ConnectionEntry[];
  accepted: ConnectionEntry[];
}

const AVAIL_LABELS: Record<string, string> = {
  mornings: 'Mornings',
  weekdays: 'Weekdays',
  evenings: 'Evenings',
  weekends: 'Weekends',
  ad_hoc:   'Ad hoc',
};

export default function NetworkPage() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [data, setData] = useState<ConnectionsPayload | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.get<ConnectionsPayload>('/community/connections');
      setData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Couldn’t load your network.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const respond = async (id: number, action: 'accept' | 'decline') => {
    try {
      await api.patch(`/community/connections/${id}`, { action });
      await load();
    } catch {
      setError('Couldn’t update that request.');
    }
  };

  const remove = async (id: number) => {
    try {
      await api.delete(`/community/connections/${id}`);
      await load();
    } catch {
      setError('Couldn’t remove that connection.');
    }
  };

  return (
    <div className="min-h-screen px-8 py-12">
      <header className="max-w-4xl mx-auto flex items-center justify-between mb-12">
        <p className="label-caps text-blue">The Pupper Club &mdash; Community</p>
        <div className="flex items-center gap-6">
          <Link to="/discover" className="label-caps text-taupe hover:text-espresso">Discover</Link>
          <Link to="/broadcasts" className="label-caps text-taupe hover:text-espresso">Broadcasts</Link>
          <Link to="/messages" className="label-caps text-taupe hover:text-espresso">Messages</Link>
          <Link to="/home" className="label-caps text-taupe hover:text-espresso">Home</Link>
          <button onClick={signOut} className="label-caps text-taupe hover:text-espresso">Sign Out</button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto">
        <h1 className="font-display text-3xl text-espresso mb-3">Your network.</h1>
        <p className="text-espresso/80 leading-relaxed mb-10">
          The neighbours you&rsquo;ve connected with, plus any pending
          requests in either direction.
        </p>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-6">
            {error}
          </div>
        )}

        {!data ? (
          <div className="text-center py-16 text-taupe text-sm">Loading...</div>
        ) : (
          <div className="space-y-12">
            <Section
              title="Requests waiting for you"
              empty="No pending requests."
              entries={data.incoming}
              renderActions={(c) => (
                <div className="flex gap-2">
                  <button onClick={() => respond(c.id, 'decline')} className="text-sm text-taupe hover:text-espresso">
                    Decline
                  </button>
                  <button onClick={() => respond(c.id, 'accept')} className="btn-blue" style={{ padding: '7px 16px', fontSize: 12 }}>
                    Accept
                  </button>
                </div>
              )}
            />

            <Section
              title="Requests you sent"
              empty="Nothing pending."
              entries={data.outgoing}
              renderActions={(c) => (
                <button
                  onClick={() => {
                    if (confirm('Cancel this request?')) remove(c.id);
                  }}
                  className="text-sm text-taupe hover:text-espresso"
                >
                  Cancel
                </button>
              )}
            />

            <Section
              title="Connected"
              empty="You haven't connected with anyone yet. Head to Discover to see who's nearby."
              entries={data.accepted}
              renderActions={(c) => (
                <div className="flex items-center gap-3">
                  {c.member && (
                    <button
                      onClick={() => navigate(`/messages/${c.member!.id}`)}
                      className="btn-blue-outline"
                      style={{ padding: '6px 14px', fontSize: 12 }}
                    >
                      Message
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (confirm('Remove this connection? They won\'t be notified.')) remove(c.id);
                    }}
                    className="text-sm text-taupe hover:text-espresso"
                  >
                    Remove
                  </button>
                </div>
              )}
            />
          </div>
        )}
      </main>
    </div>
  );
}

function Section({
  title,
  empty,
  entries,
  renderActions,
}: {
  title: string;
  empty: string;
  entries: ConnectionEntry[];
  renderActions: (c: ConnectionEntry) => React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display text-lg text-espresso mb-4">{title}</h2>
      {entries.length === 0 ? (
        <p className="text-sm text-taupe italic">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {entries.map((c) => (
            <li key={c.id} className="bg-white border border-taupe/20 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4 mb-2">
                {c.member ? (
                  <Link
                    to={`/member/${c.member.id}`}
                    className="font-display text-base text-espresso hover:text-blue transition-colors"
                  >
                    {c.member.display_name}
                  </Link>
                ) : (
                  <h3 className="font-display text-base text-espresso">Unknown</h3>
                )}
                {renderActions(c)}
              </div>
              {c.note && (
                <p className="text-sm text-espresso/85 leading-relaxed italic mb-2">&ldquo;{c.note}&rdquo;</p>
              )}
              {c.member?.introduction && (
                <p className="text-sm text-espresso/85 leading-relaxed">{c.member.introduction}</p>
              )}
              {c.member?.availability && c.member.availability.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {c.member.availability.map((a) => (
                    <span key={a} className="text-[11px] bg-cream rounded-full px-2.5 py-1 text-espresso">
                      {AVAIL_LABELS[a] ?? a}
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
