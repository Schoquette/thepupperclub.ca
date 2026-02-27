import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { format } from 'date-fns';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_KEY ?? '');

function PaymentForm({ invoice, onSuccess }: { invoice: any; onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePay = async () => {
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
      setError(e.message || 'Payment failed.');
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
      <div className="rounded-lg border border-taupe p-3">
        <CardElement options={{ style: { base: { fontSize: '14px', color: '#3B2F2A', '::placeholder': { color: '#C8BFB6' } } } }} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button className="w-full" loading={loading} onClick={handlePay}>
        Pay ${Number(invoice.total).toFixed(2)}
      </Button>
    </div>
  );
}

export default function ClientInvoicesPage() {
  const qc = useQueryClient();
  const [paying, setPaying] = useState<any>(null);
  const [tipping, setTipping] = useState<any>(null);
  const [tipAmount, setTipAmount] = useState<number | null>(null);
  const [customTip, setCustomTip] = useState('');

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

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl text-espresso">Invoices</h1>
        <Link to="/client/billing" className="text-sm text-gold hover:text-espresso font-medium transition-colors">
          💳 Payment Method
        </Link>
      </div>

      {data?.length === 0 && (
        <Card>
          <p className="text-center py-8 text-taupe">No invoices yet.</p>
        </Card>
      )}

      <div className="space-y-3">
        {data?.map((inv: any) => (
          <Card key={inv.id} padding="sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono text-xs text-taupe">{inv.invoice_number}</div>
                <div className="font-bold text-espresso mt-0.5">${Number(inv.total).toFixed(2)}</div>
                {inv.due_date && (
                  <div className="text-xs text-taupe mt-0.5">Due {format(new Date(inv.due_date), 'MMM d, yyyy')}</div>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge variant={statusBadge(inv.status)}>{inv.status}</Badge>
                {['sent', 'overdue'].includes(inv.status) && (
                  <Button size="sm" onClick={() => setPaying(inv)}>Pay Now</Button>
                )}
                {inv.status === 'paid' && !inv.tip && (
                  <Button size="sm" variant="outline" onClick={() => setTipping(inv)}>Add Tip 🎉</Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

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
