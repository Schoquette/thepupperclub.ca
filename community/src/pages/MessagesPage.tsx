import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, isToday, isYesterday } from 'date-fns';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface ConversationRow {
  id: number;
  other_id: number;
  other_name: string;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
}

export default function MessagesPage() {
  const { signOut } = useAuth();
  const [rows, setRows] = useState<ConversationRow[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.get('/community/conversations')
      .then((res) => {
        if (cancelled) return;
        setRows(res.data?.data ?? []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.response?.data?.message ?? 'Couldn’t load messages.');
      });
    return () => { cancelled = true; };
  }, []);

  const formatWhen = (iso: string | null): string => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isToday(d))    return format(d, 'h:mm a');
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'MMM d');
  };

  return (
    <div className="min-h-screen px-8 py-12">
      <header className="max-w-4xl mx-auto flex items-center justify-between mb-12">
        <p className="label-caps text-blue">The Pupper Club &mdash; Community</p>
        <div className="flex items-center gap-6">
          <Link to="/discover" className="label-caps text-taupe hover:text-espresso">Discover</Link>
          <Link to="/network" className="label-caps text-taupe hover:text-espresso">Network</Link>
          <Link to="/broadcasts" className="label-caps text-taupe hover:text-espresso">Broadcasts</Link>
          <Link to="/home" className="label-caps text-taupe hover:text-espresso">Home</Link>
          <button onClick={signOut} className="label-caps text-taupe hover:text-espresso">Sign Out</button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto">
        <h1 className="font-display text-3xl text-espresso mb-3">Messages.</h1>
        <p className="text-espresso/80 leading-relaxed mb-10">
          Private conversations with neighbours you&rsquo;ve connected with.
        </p>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-6">
            {error}
          </div>
        )}

        {rows === null ? (
          <p className="text-sm text-taupe text-center py-12">Loading...</p>
        ) : rows.length === 0 ? (
          <div className="bg-white border border-taupe/20 rounded-2xl p-12 text-center">
            <h2 className="font-display text-xl text-espresso mb-3">No conversations yet.</h2>
            <p className="text-espresso/80 leading-relaxed">
              When you message a connected neighbour for the first time,
              it&rsquo;ll appear here.
            </p>
          </div>
        ) : (
          <ul className="bg-white border border-taupe/20 rounded-2xl divide-y divide-cream">
            {rows.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/messages/${r.other_id}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-cream/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-base text-espresso truncate">
                        {r.other_name}
                      </span>
                      {r.unread_count > 0 && (
                        <span className="text-[10px] bg-blue text-white rounded-full px-2 py-0.5 font-bold">
                          {r.unread_count}
                        </span>
                      )}
                    </div>
                    {r.last_message && (
                      <p className="text-sm text-taupe truncate mt-0.5">{r.last_message}</p>
                    )}
                  </div>
                  <div className="text-xs text-taupe whitespace-nowrap">
                    {formatWhen(r.last_message_at)}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
