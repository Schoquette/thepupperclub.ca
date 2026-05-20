import { FormEvent, useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import VerifiedBadge from '@/components/VerifiedBadge';
import AuthImage from '@/components/AuthImage';
import PageShell from '@/components/PageShell';

interface NetworkMember {
  id: number;
  display_name: string;
  photo_url: string | null;
  introduction: string | null;
  availability: string[];
  verified?: boolean;
  anonymous?: boolean;
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

interface InvitesPayload {
  referral_code: string;
  invite_url: string;
  invites: {
    id: number;
    email: string;
    status: 'sent' | 'accepted' | 'expired';
    sent_at: string | null;
    accepted_at: string | null;
  }[];
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
  const [data, setData] = useState<ConnectionsPayload | null>(null);
  const [invites, setInvites] = useState<InvitesPayload | null>(null);
  const [error, setError] = useState('');

  // Invite-by-email form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteNote, setInviteNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sentFlash, setSentFlash] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<ConnectionsPayload>('/community/connections');
      setData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Couldn’t load your network.');
    }
  }, []);

  const loadInvites = useCallback(async () => {
    try {
      const res = await api.get<InvitesPayload>('/community/invites');
      setInvites(res.data);
    } catch {
      // Non-fatal — invite section just won't appear.
    }
  }, []);

  useEffect(() => { void load(); void loadInvites(); }, [load, loadInvites]);

  const submitInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setSending(true);
    setError('');
    setSentFlash(null);
    try {
      await api.post('/community/invites', {
        email: inviteEmail.trim(),
        note: inviteNote.trim() || null,
      });
      setSentFlash(`Invite sent to ${inviteEmail.trim()}.`);
      setInviteEmail('');
      setInviteNote('');
      await loadInvites();
    } catch (err: any) {
      const data = err.response?.data;
      const first = data?.errors ? Object.values(data.errors).flat()[0] : null;
      setError((first as string) ?? data?.message ?? 'Couldn’t send that invite.');
    } finally {
      setSending(false);
    }
  };

  const cancelInvite = async (id: number) => {
    if (!confirm('Remove this invite from your list? They’ll keep the email and link if they decide to join.')) return;
    try {
      await api.delete(`/community/invites/${id}`);
      await loadInvites();
    } catch {
      setError('Couldn’t remove that invite.');
    }
  };

  const copyInviteLink = async () => {
    if (!invites?.invite_url) return;
    try {
      await navigator.clipboard.writeText(invites.invite_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Couldn’t copy the link. Select it manually and copy.');
    }
  };

  const shareInviteLink = async () => {
    if (!invites?.invite_url) return;
    const shareData = {
      title: 'The Pupper Club Community',
      text: 'You never know who could be down the street, and longing to be besties with your pup! Join me on The Pupper Club Community.',
      url: invites.invite_url,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch { /* user cancelled */ }
    } else {
      void copyInviteLink();
    }
  };

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
    <PageShell back="/home" crumbs={[{ label: 'Home', to: '/home' }, { label: 'My Network' }]}>
        <h1 className="font-display text-3xl text-espresso mb-3">My network.</h1>
        <p className="text-espresso/80 leading-relaxed mb-10">
          The neighbours you&rsquo;ve connected with, your pending
          requests, and the friends you&rsquo;ve invited.
        </p>

        {/* ───────── Invite a friend ───────── */}
        <section className="bg-white border border-taupe/20 rounded-2xl p-7 mb-12">
          <h2 className="font-display text-xl text-espresso mb-2">Invite friends &amp; neighbours</h2>
          <p className="text-sm text-espresso/80 leading-relaxed mb-3">
            The Community gets better with every neighbour who joins. You
            never know who could be down the street, and longing to be
            besties with your pup!
          </p>
          <p className="text-sm text-espresso/80 leading-relaxed mb-5">
            Send a direct email invite, or grab your join link and share
            it in neighbourhood groups, building chats, or on social media
            to grow the network around you.
          </p>

          {sentFlash && (
            <div className="rounded-lg bg-blue/10 border border-blue/20 px-4 py-3 text-sm text-blue mb-4">
              {sentFlash}
            </div>
          )}

          <form onSubmit={submitInvite} className="space-y-3 mb-7">
            <div>
              <label className="field-label" htmlFor="invite_email">Send an email invite</label>
              <input
                id="invite_email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="friend@example.com"
                className="field-input"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="invite_note">Optional note</label>
              <textarea
                id="invite_note"
                value={inviteNote}
                onChange={(e) => setInviteNote(e.target.value)}
                rows={3}
                maxLength={600}
                placeholder="Hey! I’ve been using this and thought you’d love it. The Community is small and verified, no marketplace stuff."
                className="field-input resize-none"
              />
            </div>
            <div className="flex items-center justify-end">
              <button type="submit" disabled={sending || !inviteEmail.trim()} className="btn-blue disabled:opacity-60">
                {sending ? 'Sending...' : 'Send invite'}
              </button>
            </div>
          </form>

          <div className="border-t border-taupe/20 pt-6">
            <p className="label-caps text-espresso mb-2">Or share your join link</p>
            <p className="text-xs text-taupe leading-relaxed mb-3">
              Anyone using this link can sign up &mdash; it doesn&rsquo;t
              auto-connect them to you, so you stay in control of who&rsquo;s
              in your network. Great for community Facebook groups,
              building chats, Reddit threads, or Instagram stories.
            </p>
            {invites ? (
              <>
                <div className="flex items-stretch gap-2 mb-3">
                  <input
                    type="text"
                    readOnly
                    value={invites.invite_url}
                    onClick={(e) => (e.currentTarget as HTMLInputElement).select()}
                    className="field-input flex-1 text-xs"
                  />
                  <button
                    type="button"
                    onClick={copyInviteLink}
                    className="btn-blue-outline whitespace-nowrap"
                    style={{ padding: '8px 18px', fontSize: 12 }}
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={shareInviteLink}
                  className="text-sm text-blue hover:underline"
                >
                  Share via apps...
                </button>
              </>
            ) : (
              <p className="text-sm text-taupe">Loading your link...</p>
            )}
          </div>

          {invites && invites.invites.length > 0 && (
            <div className="border-t border-taupe/20 pt-6 mt-6">
              <p className="label-caps text-espresso mb-3">Your invites</p>
              <ul className="divide-y divide-taupe/20">
                {invites.invites.map((iv) => (
                  <li key={iv.id} className="flex items-center justify-between gap-3 py-3 first:pt-0">
                    <div className="min-w-0">
                      <p className="text-sm text-espresso truncate">{iv.email}</p>
                      <p className="text-xs text-taupe">
                        {iv.status === 'accepted'
                          ? 'Joined'
                          : iv.status === 'expired'
                            ? 'Expired'
                            : 'Awaiting sign-up'}
                      </p>
                    </div>
                    {iv.status !== 'accepted' && (
                      <button
                        onClick={() => cancelInvite(iv.id)}
                        className="text-xs text-taupe hover:text-red-500"
                      >
                        Remove
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

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
    </PageShell>
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
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-cream flex items-center justify-center text-base shrink-0">
                    {c.member?.photo_url ? (
                      <AuthImage src={c.member.photo_url} alt={c.member.display_name} className="w-full h-full object-cover" fallback={<span>🙂</span>} />
                    ) : (
                      <span className={c.member?.anonymous ? 'opacity-50' : ''}>🙂</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
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
                      <VerifiedBadge verified={c.member?.verified} />
                    </div>
                  </div>
                </div>
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
