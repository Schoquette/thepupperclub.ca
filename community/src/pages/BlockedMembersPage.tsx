import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface BlockEntry {
  id: number;
  member_id: number;
  display_name: string;
  reason: string | null;
  created_at: string | null;
}

export default function BlockedMembersPage() {
  const { signOut } = useAuth();
  const [rows, setRows] = useState<BlockEntry[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await api.get<{ data: BlockEntry[] }>('/community/blocks');
      setRows(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Couldn’t load your blocks.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const unblock = async (id: number) => {
    if (!confirm('Unblock this neighbour? They still won\'t be told you ever blocked them.')) return;
    try {
      await api.delete(`/community/blocks/${id}`);
      await load();
    } catch {
      setError('Couldn’t unblock.');
    }
  };

  return (
    <div className="min-h-screen px-8 py-12">
      <header className="max-w-4xl mx-auto flex items-center justify-between mb-12">
        <p className="label-caps text-blue">The Pupper Club &mdash; Community</p>
        <div className="flex items-center gap-6">
          <Link to="/home" className="label-caps text-taupe hover:text-espresso">Home</Link>
          <button onClick={signOut} className="label-caps text-taupe hover:text-espresso">Sign Out</button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto">
        <h1 className="font-display text-3xl text-espresso mb-3">Blocked neighbours.</h1>
        <p className="text-espresso/80 leading-relaxed mb-10">
          People you&rsquo;ve blocked. They&rsquo;re hidden from your
          discovery, network, and messages &mdash; and you&rsquo;re hidden
          from theirs. They&rsquo;re never told.
        </p>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-6">
            {error}
          </div>
        )}

        {rows === null ? (
          <p className="text-sm text-taupe text-center py-12">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-taupe italic text-center py-12">You haven’t blocked anyone.</p>
        ) : (
          <ul className="bg-white border border-taupe/20 rounded-2xl divide-y divide-cream">
            {rows.map((b) => (
              <li key={b.id} className="px-5 py-4 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-base text-espresso">{b.display_name}</h3>
                  {b.reason && <p className="text-sm text-espresso/80 italic mt-1">&ldquo;{b.reason}&rdquo;</p>}
                  {b.created_at && (
                    <p className="text-xs text-taupe mt-1">
                      Blocked {format(new Date(b.created_at), 'MMM d, yyyy')}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => unblock(b.id)}
                  className="text-sm text-blue hover:underline whitespace-nowrap"
                >
                  Unblock
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
