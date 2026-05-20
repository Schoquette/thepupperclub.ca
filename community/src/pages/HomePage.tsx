import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { open as openExternal } from '@tauri-apps/plugin-shell';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export default function HomePage() {
  const { member, signOut, refreshMember } = useAuth();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [verificationStartedAt, setVerificationStartedAt] = useState<number | null>(null);
  const pollRef = useRef<number | null>(null);

  const isVerified  = member?.status === 'verified';
  const isSuspended = member?.status === 'suspended';
  const hasProfile  = !!(member?.introduction && member.introduction.trim().length > 0);

  // Poll /me while verification is mid-flight so the UI flips to
  // "Verified" as soon as the Stripe webhook updates the row.
  useEffect(() => {
    if (!verificationStartedAt) return;
    pollRef.current = window.setInterval(async () => {
      const m = await refreshMember();
      if (m && m.status === 'verified') {
        clearInterval(pollRef.current!);
        setVerificationStartedAt(null);
      } else if (Date.now() - verificationStartedAt > 10 * 60_000) {
        clearInterval(pollRef.current!);
        setVerificationStartedAt(null);
      }
    }, 8_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [verificationStartedAt, refreshMember]);

  // Refresh once when the window regains focus — typical pattern after
  // the user returns from the system browser.
  useEffect(() => {
    const onFocus = () => { void refreshMember(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshMember]);

  const beginVerification = async () => {
    setError('');
    setStarting(true);
    try {
      const res = await api.post('/community/verification/start');
      const url = res.data?.url as string | undefined;
      if (!url) throw new Error('No verification URL returned.');
      await openExternal(url);
      setVerificationStartedAt(Date.now());
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Unable to start verification. Please try again.');
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="min-h-screen px-8 py-12">
      <header className="max-w-4xl mx-auto flex items-center justify-between mb-12">
        <p className="label-caps text-blue">The Pupper Club &mdash; Community</p>
        <button onClick={signOut} className="label-caps text-taupe hover:text-espresso">
          Sign Out
        </button>
      </header>

      <main className="max-w-2xl mx-auto">
        <h1 className="font-display text-3xl text-espresso mb-3">Hi, {member?.name?.split(' ')[0] ?? 'neighbour'}.</h1>

        {isSuspended ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8">
            <p className="label-caps text-red-700 mb-3">Account Suspended</p>
            <p className="text-espresso/80 leading-relaxed">
              This account has been temporarily suspended. Please reach out
              to support if you believe this is in error.
            </p>
          </div>
        ) : !hasProfile ? (
          <>
            <p className="text-espresso/80 leading-relaxed mb-10">
              Welcome. A short profile gets you ready to connect with
              neighbours nearby.
            </p>
            <div className="bg-white border border-taupe/20 rounded-2xl p-8">
              <p className="label-caps text-blue mb-3">First Step</p>
              <h2 className="font-display text-xl text-espresso mb-3">Set up your profile</h2>
              <p className="text-espresso/80 mb-6 leading-relaxed">
                Add a short intro and tell us when you&rsquo;re typically
                available. We&rsquo;ll also ask for your address so we can
                find neighbours nearby &mdash; it&rsquo;s stored as a coarse
                area and never shown to other members.
              </p>
              <Link to="/profile-setup" className="btn-blue">Set Up Profile &rarr;</Link>
            </div>
          </>
        ) : (
          <>
            <p className="text-espresso/80 leading-relaxed mb-10">
              You&rsquo;re all set. Head into Discover to see neighbours
              within your radius.
            </p>
            <div className="bg-white border border-taupe/20 rounded-2xl p-8 text-center">
              <p className="label-caps text-blue mb-3">{isVerified ? 'Verified' : 'Welcome'}</p>
              <h2 className="font-display text-xl text-espresso mb-3">Welcome to the Community.</h2>
              <Link to="/discover" className="btn-blue">Browse Neighbours &rarr;</Link>
              {member && (
                <p className="text-xs text-taupe mt-5 space-x-4">
                  <Link to={`/member/${member.id}`} className="hover:text-espresso underline">View my profile</Link>
                  <Link to="/settings/blocks" className="hover:text-espresso underline">Blocked neighbours</Link>
                </p>
              )}
            </div>
          </>
        )}

        {/* Optional verification card. Shown to anyone who isn't already
            verified (or suspended). Verification adds a small trust badge
            on your profile — it isn't required to use the Community. */}
        {!isSuspended && !isVerified && (
          <div className="bg-cream/60 border border-blue/20 rounded-2xl p-7 mt-8">
            <p className="label-caps text-blue mb-3">Optional</p>
            <h3 className="font-display text-lg text-espresso mb-2">Verify your identity</h3>
            <p className="text-sm text-espresso/80 mb-5 leading-relaxed">
              A quick ID + selfie check (about a minute, via Stripe Identity)
              adds a small &ldquo;Verified&rdquo; badge to your profile.
              Neighbours sometimes feel more comfortable connecting with
              verified members &mdash; but it&rsquo;s entirely up to you.
            </p>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">
                {error}
              </div>
            )}

            {verificationStartedAt ? (
              <>
                <p className="text-sm text-espresso/80 mb-3">
                  Verification opened in your browser. Complete it there,
                  then come back &mdash; we&rsquo;ll update your status
                  automatically.
                </p>
                <button
                  onClick={beginVerification}
                  disabled={starting}
                  className="btn-blue-outline disabled:opacity-60"
                >
                  {starting ? 'Opening...' : 'Re-open Verification'}
                </button>
              </>
            ) : (
              <button
                onClick={beginVerification}
                disabled={starting}
                className="btn-blue-outline disabled:opacity-60"
              >
                {starting ? 'Preparing...' : 'Verify My Identity'}
              </button>
            )}

            <p className="text-xs text-taupe mt-4">
              Your ID is reviewed by Stripe Identity. We only see whether
              the check passed.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
