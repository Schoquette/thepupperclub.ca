import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { format } from 'date-fns';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { CreditCard, Heart, CheckCircle } from 'lucide-react';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_KEY ?? '');

function PaymentForm({ invoice, onSuccess }: { invoice: any; onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [useNewCard, setUseNewCard] = useState(false);

  const { data: savedCard } = useQuery({
    queryKey: ['client-payment-method'],
    queryFn: () => api.get('/client/billing/payment-method').then(r => r.data.data),
  });

  const handlePaySaved = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: pmData } = await api.get('/client/billing/payment-method');
      const pmId = pmData.data?.id;
      // Use the stored payment method ID from profile
      const profileRes = await api.get('/client/profile');
      const storedPmId = profileRes.data.data?.client_profile?.stripe_payment_method_id;
      if (!storedPmId) throw new Error('No saved card found.');
      await api.post(`/client/invoices/${invoice.id}/pay`, { payment_method_id: storedPmId });
      onSuccess();
    } catch (e: any) {
      setError(e.response?.data?.message || e.message || 'Payment failed.');
    } finally {
      setLoading(false);
    }
  };

  const handlePayNew = async () => {
    if (!stripe || !elements) return;
    setLoading(true);
    setError('');
    try {
      const card = elements.getElement(CardElement);
      const { paymentMethod, error: pmErr } = await stripe.createPaymentMethod({
        type: 'card',
        card: card!,
      });
      if (pmErr) throw new Error(pmErr.message);
      await api.post(`/client/invoices/${invoice.id}/pay`, {
        payment_method_id: paymentMethod!.id,
      });
      onSuccess();
    } catch (e: any) {
      setError(e.response?.data?.message || e.message || 'Payment failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="text-3xl font-bold text-espresso">${Number(invoice.total).toFixed(2)}</div>
        <div className="text-taupe text-sm">{invoice.invoice_number}</div>
      </div>

      {savedCard && !useNewCard ? (
        <>
          <div className="flex items-center gap-3 bg-cream/40 rounded-xl p-4">
            <CreditCard className="w-6 h-6 text-taupe" />
            <div>
              <div className="font-semibold text-espresso capitalize">{savedCard.brand} ending in {savedCard.last4}</div>
              <div className="text-xs text-taupe">Expires {savedCard.exp_month}/{savedCard.exp_year}</div>
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button className="w-full" loading={loading} onClick={handlePaySaved}>
            Pay ${Number(invoice.total).toFixed(2)}
          </Button>
          <button onClick={() => setUseNewCard(true)} className="text-sm text-gold hover:text-espresso font-medium w-full text-center">
            Use a different card
          </button>
        </>
      ) : (
        <>
          <div className="rounded-lg border border-taupe p-3">
            <CardElement options={{ style: { base: { fontSize: '14px', color: '#3B2F2A', '::placeholder': { color: '#C8BFB6' } } } }} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button className="w-full" loading={loading} onClick={handlePayNew}>
            Pay ${Number(invoice.total).toFixed(2)}
          </Button>
          {savedCard && (
            <button onClick={() => setUseNewCard(false)} className="text-sm text-gold hover:text-espresso font-medium w-full text-center">
              Use saved card
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default function ClientInvoicesPage() {
  const qc = useQueryClient();
  const [paying, setPaying] = useState<any>(null);
  const [tipping, setTipping] = useState<any>(null);
  const [tipAmount, setTipAmount] = useState<number | null>(null);
  const [customTip, setCustomTip] = useState('');

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['client-profile'],
    queryFn: () => api.get('/client/profile').then(r => r.data.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['client-invoices'],
    queryFn: () => api.get('/client/invoices').then(r => r.data.data),
  });

  const addTip = useMutation({
    mutationFn: () => api.post(`/client/invoices/${tipping?.id}/tip`, {
      amount: tipAmount ?? Number(customTip),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-invoices'] });
      setTipping(null); setTipAmount(null); setCustomTip('');
    },
  });

  if (isLoading || profileLoading) return <PageLoader />;

  const cp = profile?.client_profile;
  const dueInvoices = data?.filter((i: any) => ['sent', 'overdue'].includes(i.status)) ?? [];
  const pastInvoices = data?.filter((i: any) => !['sent', 'overdue'].includes(i.status)) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl text-espresso">Invoices</h1>
        <Link
          to="/client/billing"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gold/10 border border-gold/30 text-gold hover:bg-gold/20 font-semibold text-sm transition-colors"
        >
          <CreditCard className="w-4 h-4" /> Payment Method
        </Link>
      </div>

      {/* Package + Due invoices side-by-side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Your Package */}
        <Card>
          <CardHeader title="Your Package" />
          {cp?.subscription_plan ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-taupe">Plan</span>
                <span className="font-semibold text-espresso capitalize">{cp.subscription_plan}</span>
              </div>
              {cp.subscription_amount && (
                <div className="flex justify-between">
                  <span className="text-taupe">Monthly</span>
                  <span className="font-semibold text-espresso">${Number(cp.subscription_amount).toFixed(2)} CAD</span>
                </div>
              )}
              {cp.billing_method && (
                <div className="flex justify-between">
                  <span className="text-taupe">Payment</span>
                  <span className="font-semibold text-espresso">
                    {{ credit_card: 'Credit Card', e_transfer: 'E-Transfer', interac_pad: 'Interac/PAD', cash: 'Cash' }[cp.billing_method as string] ?? cp.billing_method}
                  </span>
                </div>
              )}
              {cp.next_billing_date && (
                <div className="flex justify-between">
                  <span className="text-taupe">Next billing</span>
                  <span className="font-semibold text-espresso">{format(new Date(cp.next_billing_date), 'MMMM d, yyyy')}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-taupe">No active package.</p>
          )}
        </Card>

        {/* Due Invoices or All Clear */}
        <Card>
          <CardHeader title="Balance Due" />
          {dueInvoices.length > 0 ? (
            <div className="space-y-3">
              {dueInvoices.map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-xl">
                  <div>
                    <div className="font-mono text-xs text-taupe">{inv.invoice_number}</div>
                    <div className="font-bold text-espresso">${Number(inv.total).toFixed(2)}</div>
                    {inv.billing_period_start && inv.billing_period_end && (
                      <div className="text-xs text-taupe mt-0.5">
                        {format(new Date(inv.billing_period_start), 'MMM d')} – {format(new Date(inv.billing_period_end), 'MMM d, yyyy')}
                      </div>
                    )}
                    {inv.due_date && (
                      <div className="text-xs text-red-500 mt-0.5">Due {format(new Date(inv.due_date), 'MMM d, yyyy')}</div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Badge variant={statusBadge(inv.status)}>{inv.status}</Badge>
                    {(!inv.billing_method || inv.billing_method === 'credit_card' || inv.billing_method === 'interac_pad') && (
                      <Button size="sm" onClick={() => setPaying(inv)}>Pay Now</Button>
                    )}
                  </div>
                </div>
              ))}
              {/* Payment instructions for non-card due invoices */}
              {dueInvoices.some((i: any) => i.billing_method === 'e_transfer') && (
                <div className="p-2 bg-cream/50 rounded-lg text-xs text-taupe border border-cream">
                  E-Transfer to <strong className="text-espresso">sophie@thepupperclub.ca</strong> before the first day of your service month.
                </div>
              )}
              {dueInvoices.some((i: any) => i.billing_method === 'cash') && (
                <div className="p-2 bg-cream/50 rounded-lg text-xs text-taupe border border-cream">
                  Cash or cheque can be left at your service address on the first visit of your service month.
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-espresso">You're up to date!</p>
              <p className="text-xs text-taupe mt-1">Thanks for being an amazing client.</p>
            </div>
          )}
        </Card>
      </div>

      {/* Past invoices */}
      {pastInvoices.length > 0 && (
        <div>
          <h2 className="font-display text-lg text-espresso mb-3">Past Invoices</h2>
          <div className="space-y-3">
            {pastInvoices.map((inv: any) => (
              <Card key={inv.id} padding="sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-mono text-xs text-taupe">{inv.invoice_number}</div>
                    <div className="font-bold text-espresso mt-0.5">${Number(inv.total).toFixed(2)}</div>
                    {inv.billing_period_start && inv.billing_period_end && (
                      <div className="text-xs text-taupe mt-0.5">
                        {format(new Date(inv.billing_period_start), 'MMM d')} – {format(new Date(inv.billing_period_end), 'MMM d, yyyy')}
                      </div>
                    )}
                    {inv.due_date && !inv.billing_period_start && (
                      <div className="text-xs text-taupe mt-0.5">{format(new Date(inv.due_date), 'MMM d, yyyy')}</div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant={statusBadge(inv.status)}>{inv.status}</Badge>
                    {inv.status === 'paid' && !inv.tip && (
                      <Button size="sm" variant="outline" onClick={() => setTipping(inv)}>
                        <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> Add Tip</span>
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {data?.length === 0 && (
        <Card>
          <p className="text-center py-8 text-taupe">No invoices yet.</p>
        </Card>
      )}

      {/* Payment modal */}
      <Modal open={!!paying} onClose={() => setPaying(null)} title="Pay Invoice">
        {paying && (
          <Elements stripe={stripePromise}>
            <PaymentForm
              invoice={paying}
              onSuccess={() => {
                setPaying(null);
                qc.invalidateQueries({ queryKey: ['client-invoices'] });
              }}
            />
          </Elements>
        )}
      </Modal>

      {/* Tip modal */}
      <Modal open={!!tipping} onClose={() => setTipping(null)} title="Add a Tip">
        {tipping && (
          <div className="space-y-4">
            <p className="text-sm text-taupe text-center">Show Sophie some love! 🐾</p>
            <div className="grid grid-cols-4 gap-2">
              {[10, 15, 20].map(pct => {
                const amt = Math.round(Number(tipping.subtotal) * pct / 100 * 100) / 100;
                return (
                  <button key={pct} onClick={() => { setTipAmount(amt); setCustomTip(''); }}
                    className={`rounded-xl py-3 text-sm font-semibold border transition-colors ${
                      tipAmount === amt ? 'bg-gold text-white border-gold' : 'border-taupe text-espresso hover:bg-cream'
                    }`}>
                    {pct}%<br /><span className="text-xs font-normal">${amt}</span>
                  </button>
                );
              })}
              <button onClick={() => setTipAmount(null)}
                className={`rounded-xl py-3 text-sm font-semibold border transition-colors ${
                  tipAmount === null && customTip ? 'bg-gold text-white border-gold' : 'border-taupe text-espresso hover:bg-cream'
                }`}>
                Custom
              </button>
            </div>
            {tipAmount === null && (
              <input type="number" step="0.01" min="0.50" placeholder="Enter amount"
                value={customTip} onChange={e => setCustomTip(e.target.value)}
                className="input" />
            )}
            <Button
              className="w-full"
              loading={addTip.isPending}
              disabled={!tipAmount && !customTip}
              onClick={() => addTip.mutate()}
            >
              Add Tip ${tipAmount ?? Number(customTip || 0).toFixed(2)}
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
