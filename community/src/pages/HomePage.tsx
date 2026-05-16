import { useEffect, useRef, useState } from 'react';
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
  const isPending   = member?.status === 'pending_verification';
  const isSuspended = member?.status === 'suspended';

  // Poll /me while the member is mid-verification so the UI flips to
  // "Verified" as soon as the Stripe webhook updates the row. Stops as
  // soon as the status moves or after 10 minutes.
  useEffect(() => {
    if (!verificationStartedAt) return;
    pollRef.current = window.setInterval(async () => {
      const m = await refreshMember();
      if (m && m.status !== 'pending_verification') {
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

        {isVerified ? (
          <>
            <p className="text-espresso/80 leading-relaxed mb-10">
              You&rsquo;re verified. Browsing nearby neighbours, sending care
              broadcasts, and messaging are coming in the next update.
            </p>
            <div className="bg-white border border-taupe/20 rounded-2xl p-8">
              <p className="label-caps text-blue mb-3">Verified</p>
              <h2 className="font-display text-xl text-espresso mb-2">Welcome to the Community.</h2>
              <p className="text-espresso/80 leading-relaxed">
                When neighbour discovery opens up, you&rsquo;ll see a small list
                of people within walking distance &mdash; no addresses shown,
                just approximate distance and a short intro.
              </p>
            </div>
          </>
        ) : isSuspended ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8">
            <p className="label-caps text-red-700 mb-3">Account Suspended</p>
            <p className="text-espresso/80 leading-relaxed">
              This account has been temporarily suspended. Please reach out to
              support if you believe this is in error.
            </p>
          </div>
        ) : (
          <>
            <p className="text-espresso/80 leading-relaxed mb-10">
              You&rsquo;re signed in. Before you can browse other neighbours or
              broadcast a care request, we&rsquo;ll need to verify your identity.
            </p>

            <div className="bg-white border border-taupe/20 rounded-2xl p-8">
              <p className="label-caps text-blue mb-3">Next Step</p>
              <h2 className="font-display text-xl text-espresso mb-3">Verify your identity</h2>
              <p className="text-espresso/80 mb-6 leading-relaxed">
                You&rsquo;ll upload a government-issued ID and take a quick
                selfie through our verification partner, Stripe Identity.
                Most members are verified in under a minute.
              </p>

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">
                  {error}
                </div>
              )}

              {verificationStartedAt ? (
                <div className="space-y-3">
                  <p className="text-sm text-espresso/80">
                    Verification opened in your browser. Complete the steps
                    there, then come back &mdash; we&rsquo;ll update your
                    status automatically.
                  </p>
                  <button
                    onClick={beginVerification}
                    disabled={starting}
                    className="btn-blue-outline disabled:opacity-60"
                  >
                    {starting ? 'Opening...' : 'Re-open Verification'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={beginVerification}
                  disabled={starting}
                  className="btn-blue disabled:opacity-60"
                >
                  {starting ? 'Preparing...' : 'Begin Verification →'}
                </button>
              )}

              <p className="text-xs text-taupe mt-4">
                Your ID is reviewed by Stripe Identity and is never visible to
                other neighbours. We only see whether the check passed.
              </p>
            </div>
          </>
        )}

        <div className="mt-10 text-center text-sm text-taupe">
          Status: <span className="text-espresso font-semibold uppercase tracking-wider">{member?.status?.replace(/_/g, ' ') ?? '—'}</span>
          {isPending && verificationStartedAt && (
            <span className="ml-2 text-blue">&middot; checking for updates...</span>
          )}
        </div>
      </main>
    </div>
  );
}
