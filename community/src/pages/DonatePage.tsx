import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import PageShell from '@/components/PageShell';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Window { __TAURI_INTERNALS__?: any }
}

async function openUrl(url: string): Promise<void> {
  if (window.__TAURI_INTERNALS__) {
    try {
      const mod: any = await import('@tauri-apps/plugin-shell');
      await mod.open(url);
      return;
    } catch { /* fall through */ }
  }
  window.location.assign(url);
}

const PRESETS_CAD = [5, 10, 20, 50];
const MIN_CENTS = 100;        // $1
const MAX_CENTS = 1_000_00;   // $1,000

export default function DonatePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [amount, setAmount] = useState<number>(10); // dollars
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [thanked, setThanked] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('thanks') === '1') setThanked(true);
  }, [location.search]);

  const effectiveCents = useCallback((): number | null => {
    if (custom.trim()) {
      const n = Number(custom);
      if (!isFinite(n) || n <= 0) return null;
      const cents = Math.round(n * 100);
      if (cents < MIN_CENTS) return null;
      if (cents > MAX_CENTS) return MAX_CENTS;
      return cents;
    }
    return Math.round(amount * 100);
  }, [custom, amount]);

  const startCheckout = async () => {
    const cents = effectiveCents();
    if (!cents) {
      setError('Pick a preset or enter an amount of at least $1.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await api.post<{ url: string }>('/community/donations/checkout', { amount_cents: cents });
      const url = res.data?.url;
      if (!url) throw new Error('Stripe did not return a URL.');
      await openUrl(url);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Couldn’t open the donation page. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell back="/home" crumbs={[{ label: 'Home', to: '/home' }, { label: 'Say Thanks' }]}>
      {thanked ? (
        <div className="bg-white border border-blue/30 rounded-2xl p-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue/10 text-blue mb-5">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </div>
          <h1 className="font-display text-2xl text-espresso mb-3">Thank you, truly.</h1>
          <p className="text-espresso/80 leading-relaxed max-w-md mx-auto">
            Your contribution helps keep the Community running and lets us
            keep building thoughtfully.
          </p>
          <div className="mt-6">
            <button onClick={() => navigate('/home')} className="btn-blue">Back to Home</button>
          </div>
        </div>
      ) : (
        <>
          <h1 className="font-display text-3xl text-espresso mb-3">Say Thanks!</h1>
          <p className="text-espresso/80 leading-relaxed mb-8">
            Donations are entirely optional &mdash; they help us cover
            hosting, keep the lights on, and put time into making the
            Community better. Every bit means a lot.
          </p>

          <div className="bg-white border border-taupe/20 rounded-2xl p-7 space-y-5">
            <div>
              <p className="label-caps text-espresso mb-3">Pick an amount (CAD)</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {PRESETS_CAD.map((v) => {
                  const active = !custom && amount === v;
                  return (
                    <button
                      type="button"
                      key={v}
                      onClick={() => { setAmount(v); setCustom(''); setError(''); }}
                      className={`px-3 py-3 rounded-xl border-2 text-sm font-medium transition ${
                        active
                          ? 'bg-blue text-white border-blue'
                          : 'bg-transparent text-espresso border-taupe/40 hover:border-blue'
                      }`}
                    >
                      ${v}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label htmlFor="custom_amount" className="label-caps text-espresso block mb-2">Or another amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-espresso/60">$</span>
                <input
                  id="custom_amount"
                  type="number"
                  inputMode="decimal"
                  min={1}
                  step="0.01"
                  value={custom}
                  onChange={(e) => { setCustom(e.target.value); setError(''); }}
                  placeholder="Any amount over $1"
                  className="field-input pl-7"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-taupe leading-relaxed max-w-xs">
                You&rsquo;ll finish on Stripe&rsquo;s secure checkout page.
                We never see your card details.
              </p>
              <button
                onClick={startCheckout}
                disabled={busy}
                className="btn-blue disabled:opacity-60"
              >
                {busy ? 'Opening...' : 'Continue to Stripe'}
              </button>
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}
