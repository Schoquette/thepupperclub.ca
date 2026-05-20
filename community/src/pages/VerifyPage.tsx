import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import PageShell from '@/components/PageShell';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Window { __TAURI_INTERNALS__?: any }
}

/**
 * Open a URL either in the system browser (Tauri desktop) or by replacing
 * the current window (web build). Imported dynamically so the web bundle
 * doesn't try to resolve the Tauri-only module.
 */
async function openUrl(url: string): Promise<void> {
  if (window.__TAURI_INTERNALS__) {
    try {
      const mod: any = await import('@tauri-apps/plugin-shell');
      await mod.open(url);
      return;
    } catch {
      // fall through to plain window navigation
    }
  }
  window.location.assign(url);
}

interface VerificationStatus {
  status: 'pending_verification' | 'verified' | 'suspended' | 'closed';
  paid: boolean;
  paid_at: string | null;
  fee_cents: number;
  currency: string;
}

export default function VerifyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { member, refreshMember } = useAuth();
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [openedFlow, setOpenedFlow] = useState<'checkout' | 'id' | null>(null);
  const pollRef = useRef<number | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await api.get<VerificationStatus>('/community/verification/status');
      setStatus(res.data);
    } catch {
      setError('Couldn’t load verification status.');
    }
  }, []);

  useEffect(() => { void loadStatus(); }, [loadStatus]);

  // Poll status + member while a flow is mid-flight. Stripe webhooks are
  // async, so the UI flips automatically once payment or the ID check
  // succeeds without the user having to refresh.
  useEffect(() => {
    if (!openedFlow) return;
    const startedAt = Date.now();
    pollRef.current = window.setInterval(async () => {
      const [, m] = await Promise.all([loadStatus(), refreshMember()]);
      if (m?.status === 'verified') {
        if (pollRef.current) clearInterval(pollRef.current);
        setOpenedFlow(null);
        return;
      }
      if (Date.now() - startedAt > 10 * 60_000) {
        if (pollRef.current) clearInterval(pollRef.current);
        setOpenedFlow(null);
      }
    }, 6_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [openedFlow, loadStatus, refreshMember]);

  // Refresh when window regains focus — typical for returning from
  // system browser after Stripe Checkout / Identity.
  useEffect(() => {
    const onFocus = () => { void loadStatus(); void refreshMember(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadStatus, refreshMember]);

  // Honour the success/cancel return URLs from Stripe Checkout.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('paid') === '1') {
      setOpenedFlow('checkout');
      void loadStatus();
      void refreshMember();
    }
    if (params.get('id') === 'done') {
      setOpenedFlow('id');
      void refreshMember();
    }
  }, [location.search, loadStatus, refreshMember]);

  const startCheckout = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await api.post<{ url?: string; paid?: boolean }>('/community/verification/checkout');
      if (res.data?.paid) {
        await loadStatus();
        return;
      }
      const url = res.data?.url;
      if (!url) throw new Error('Stripe did not return a URL.');
      await openUrl(url);
      setOpenedFlow('checkout');
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Couldn’t open the checkout page. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const startIdCheck = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await api.post<{ url: string }>('/community/verification/start');
      const url = res.data?.url;
      if (!url) throw new Error('Stripe did not return a URL.');
      await openUrl(url);
      setOpenedFlow('id');
    } catch (err: any) {
      if (err.response?.data?.requires_payment) {
        setError('The $5 verification fee must be paid first.');
        await loadStatus();
        return;
      }
      setError(err.response?.data?.message ?? 'Couldn’t start the ID check. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const isVerified = member?.status === 'verified';
  const hasPaid    = status?.paid ?? false;
  const feeLabel   = status ? `$${(status.fee_cents / 100).toFixed(2)}` : '$5';

  return (
    <PageShell back="/home" crumbs={[{ label: 'Home', to: '/home' }, { label: 'Verify' }]}>
        <h1 className="font-display text-3xl text-espresso mb-3">Verify your identity</h1>
        <p className="text-espresso/80 leading-relaxed mb-8">
          Before connecting with neighbours or seeing names and photos, we ask
          everyone to verify their identity. It&rsquo;s a small step that
          keeps the network real and respectful.
        </p>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-6">
            {error}
          </div>
        )}

        {isVerified ? (
          <div className="bg-white border border-blue/30 rounded-2xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue/10 text-blue mb-5">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="font-display text-xl text-espresso mb-3">You&rsquo;re verified.</h2>
            <p className="text-espresso/80 mb-6 leading-relaxed max-w-md mx-auto">
              You can now connect with neighbours and see full profiles once
              they accept your request.
            </p>
            <button onClick={() => navigate('/discover')} className="btn-blue">
              Browse Neighbours
            </button>
          </div>
        ) : (
          <div className="space-y-5">

            {/* Step 1 — pay the verification fee */}
            <div className={`border rounded-2xl p-7 ${hasPaid ? 'bg-blue/5 border-blue/30' : 'bg-white border-taupe/20'}`}>
              <div className="flex items-center gap-3 mb-2">
                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold ${hasPaid ? 'bg-blue text-white' : 'bg-cream text-espresso border border-taupe/40'}`}>
                  {hasPaid ? '✓' : '1'}
                </span>
                <h2 className="font-display text-lg text-espresso">Cover the verification fee</h2>
              </div>
              <p className="text-sm text-espresso/85 leading-relaxed mb-4">
                Stripe Identity charges us per check. We pass that cost
                through &mdash; a one-time <strong>{feeLabel} CAD</strong>{' '}
                payment, no profit on our end.
              </p>
              {hasPaid ? (
                <p className="text-sm text-blue font-medium">Paid — thank you.</p>
              ) : (
                <button onClick={startCheckout} disabled={busy} className="btn-blue disabled:opacity-60">
                  {busy && openedFlow === null ? 'Opening...' : `Pay ${feeLabel}`}
                </button>
              )}
              {openedFlow === 'checkout' && !hasPaid && (
                <p className="text-xs text-taupe mt-3 leading-relaxed">
                  Checkout opened in your browser. Once payment goes through,
                  this page updates automatically.
                </p>
              )}
            </div>

            {/* Step 2 — ID + selfie via Stripe Identity */}
            <div className={`border rounded-2xl p-7 ${!hasPaid ? 'bg-cream/40 border-taupe/20 opacity-70' : 'bg-white border-taupe/20'}`}>
              <div className="flex items-center gap-3 mb-2">
                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold ${hasPaid ? 'bg-cream text-espresso border border-taupe/40' : 'bg-cream text-taupe border border-taupe/40'}`}>
                  2
                </span>
                <h2 className="font-display text-lg text-espresso">ID + selfie check</h2>
              </div>
              <p className="text-sm text-espresso/85 leading-relaxed mb-4">
                A quick photo of a government ID and a selfie, handled by
                Stripe Identity. Takes about a minute. We never see your ID
                images &mdash; only whether the check passed.
              </p>
              <button onClick={startIdCheck} disabled={!hasPaid || busy} className="btn-blue-outline disabled:opacity-50 disabled:cursor-not-allowed">
                {busy && openedFlow !== 'checkout' ? 'Opening...' : openedFlow === 'id' ? 'Re-open ID Check' : 'Start ID Check'}
              </button>
              {openedFlow === 'id' && (
                <p className="text-xs text-taupe mt-3 leading-relaxed">
                  Verification opened in your browser. Finish there, then
                  come back &mdash; we&rsquo;ll update your status
                  automatically.
                </p>
              )}
            </div>

            <p className="text-xs text-taupe leading-relaxed">
              By verifying, you agree to share your name, ID image, and
              selfie with Stripe Identity for the purpose of confirming your
              identity. The Pupper Club only learns whether the check passed
              or failed.
            </p>
          </div>
        )}
    </PageShell>
  );
}
