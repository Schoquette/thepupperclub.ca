import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { format } from 'date-fns';
import { Download, Heart, CreditCard, CheckCircle } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_KEY ?? '');

const METHOD_LABELS: Record<string, string> = {
  credit_card: 'Credit Card',
  e_transfer: 'E-Transfer',
  interac_pad: 'Interac/PAD',
  cash: 'Cash',
};

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

export default function ClientInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [paying, setPaying] = useState(false);
  const [tipping, setTipping] = useState(false);
  const [tipAmount, setTipAmount] = useState<number | null>(null);
  const [customTip, setCustomTip] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [tipError, setTipError] = useState('');

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['client-invoice', id],
    queryFn: () => api.get(`/client/invoices/${id}`).then(r => r.data.data),
  });

  const addTip = useMutation({
    mutationFn: () => api.post(`/client/invoices/${id}/tip`, {
      amount: tipAmount ?? Number(customTip),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-invoice', id] });
      qc.invalidateQueries({ queryKey: ['client-invoices'] });
      setTipping(false);
      setTipAmount(null);
      setCustomTip('');
      setTipError('');
    },
    onError: (err: any) => {
      setTipError(err.response?.data?.message || 'Failed to add tip. Please try again.');
    },
  });

  const downloadPdf = async () => {
    setPdfLoading(true);
    try {
      const response = await api.get(`/client/invoices/${id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoice?.invoice_number ?? id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to download PDF.');
    } finally {
      setPdfLoading(false);
    }
  };

  if (isLoading) return <PageLoader />;
  if (!invoice) return <div className="text-center py-12 text-taupe">Invoice not found.</div>;

  const isVoid = invoice.status === 'void';
  const isDue = ['sent', 'overdue'].includes(invoice.status);

  const displaySubtotal = Number(invoice.subtotal) || (invoice.line_items ?? []).reduce((s: number, li: any) => s + Number(li.total), 0);
  const displayGst = Number(invoice.gst) || Math.round(displaySubtotal * 0.05 * 100) / 100;

  const billingPeriodStr = invoice.billing_period_start && invoice.billing_period_end
    ? `${format(new Date(invoice.billing_period_start), 'MMMM d, yyyy')} - ${format(new Date(invoice.billing_period_end), 'MMMM d, yyyy')}`
    : null;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => navigate('/client/invoices')} className="text-taupe hover:text-espresso text-lg">&larr;</button>
        <h1 className="font-display text-xl text-espresso whitespace-nowrap">{invoice.invoice_number}</h1>
        <Badge variant={statusBadge(invoice.status)}>{invoice.status}</Badge>
        <div className="flex-1" />
        <div className="flex gap-2 flex-wrap">
          {isDue && (
            <Button size="sm" onClick={() => setPaying(true)}>Pay Now</Button>
          )}
          {invoice.status === 'paid' && !invoice.tip && (
            <Button size="sm" variant="outline" onClick={() => setTipping(true)}>
              <Heart className="w-3.5 h-3.5 mr-1" /> Add Tip
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={downloadPdf} loading={pdfLoading} disabled={pdfLoading}>
            <Download className="w-3.5 h-3.5 mr-1" /> {pdfLoading ? 'Downloading...' : 'PDF'}
          </Button>
        </div>
      </div>

      {/* Invoice card */}
      <Card className="relative overflow-hidden !p-0">
        {isVoid && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <span
              className="text-[120px] font-black tracking-[0.2em] text-taupe/15 select-none"
              style={{ transform: 'rotate(-30deg)' }}
            >
              VOID
            </span>
          </div>
        )}

        {/* Branded header */}
        <div className="bg-cream px-8 py-5 flex items-center justify-between">
          <img src="/logo.png" alt="The Pupper Club" className="h-12" />
          <div className="text-right text-espresso/70 text-xs leading-relaxed">
            <div className="font-display text-sm text-espresso tracking-wide">INVOICE</div>
            <div>{invoice.invoice_number}</div>
            <div>{format(new Date(invoice.created_at), 'MMMM d, yyyy')}</div>
          </div>
        </div>

        {/* Gold accent line */}
        <div className="h-1 bg-gold" />

        <div className={`p-8 ${isVoid ? 'opacity-50' : ''}`}>
          {/* From / Bill To */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 mb-8">
            <div>
              <div className="text-[11px] font-semibold text-gold uppercase tracking-widest mb-2">From</div>
              <div className="text-sm text-espresso font-semibold">The Pupper Club</div>
              <div className="text-sm text-taupe">Sophie Choquette</div>
              <div className="text-sm text-taupe">Port Moody, BC</div>
              <div className="text-sm text-taupe">sophie@thepupperclub.ca</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold text-gold uppercase tracking-widest mb-2">Bill To</div>
              <div className="text-sm text-espresso font-semibold">{invoice.user?.name}</div>
              <div className="text-sm text-taupe">{invoice.user?.email}</div>
              {invoice.user?.client_profile?.address && (
                <>
                  <div className="text-sm text-taupe">{invoice.user.client_profile.address}</div>
                  <div className="text-sm text-taupe">
                    {[invoice.user.client_profile.city, invoice.user.client_profile.province, invoice.user.client_profile.postal_code].filter(Boolean).join(', ')}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Due date & billing period */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-6 pb-4 border-b border-cream">
            <div>
              {billingPeriodStr && (
                <div className="text-sm text-espresso">
                  <span className="text-taupe">Service period:</span> {billingPeriodStr}
                </div>
              )}
            </div>
            <div className="text-right">
              {invoice.due_date && (
                <div className="text-sm text-espresso">
                  <span className="text-taupe">Due:</span> {format(new Date(invoice.due_date), 'MMMM d, yyyy')}
                </div>
              )}
              {invoice.paid_at && (
                <div className="text-green-600 text-sm font-semibold mt-1">
                  Paid {format(new Date(invoice.paid_at), 'MMMM d, yyyy')}
                </div>
              )}
            </div>
          </div>

          {/* Line items table */}
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-cream text-espresso">
                  <th className="py-2.5 px-3 text-left text-xs font-semibold uppercase tracking-wider">Description</th>
                  <th className="py-2.5 px-3 text-left text-xs font-semibold uppercase tracking-wider">Date</th>
                  <th className="py-2.5 px-3 text-center text-xs font-semibold uppercase tracking-wider w-16">Qty</th>
                  <th className="py-2.5 px-3 text-right text-xs font-semibold uppercase tracking-wider w-24">Unit Price</th>
                  <th className="py-2.5 px-3 text-right text-xs font-semibold uppercase tracking-wider w-24">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.line_items?.map((item: any, idx: number) => (
                  <tr key={item.id} className={`border-b border-cream ${idx % 2 === 1 ? 'bg-cream/30' : ''}`}>
                    <td className="py-2.5 px-3 text-espresso">{item.description}</td>
                    <td className="py-2.5 px-3 text-taupe">{item.service_date ? format(new Date(item.service_date), 'MMM d, yyyy') : '\u2014'}</td>
                    <td className="py-2.5 px-3 text-center text-taupe">{item.quantity}</td>
                    <td className="py-2.5 px-3 text-right text-taupe">${Number(item.unit_price).toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right font-medium text-espresso">${Number(item.total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="ml-auto w-full sm:w-72 space-y-2 text-sm">
            {[
              { label: 'Subtotal', value: displaySubtotal },
              { label: 'GST (5%)', value: displayGst },
              Number(invoice.credit_card_surcharge) > 0 && { label: 'CC Surcharge (2%)', value: invoice.credit_card_surcharge },
              Number(invoice.tip) > 0 && { label: 'Tip', value: invoice.tip },
            ].filter(Boolean).map((row: any) => (
              <div key={row.label} className="flex justify-between py-0.5">
                <span className="text-taupe">{row.label}</span>
                <span className="text-espresso">${Number(row.value).toFixed(2)}</span>
              </div>
            ))}
            <div className={`flex justify-between pt-3 mt-1 border-t-2 border-gold font-bold text-base ${isVoid ? 'line-through text-taupe' : 'text-espresso'}`}>
              <span>Total (CAD)</span>
              <span>${Number(invoice.total).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Sections below main content */}
        <div className="px-8 pb-8">
          {/* Payment terms */}
          {(() => {
            const method = invoice.billing_method || invoice.user?.client_profile?.billing_method;
            if (!method || isVoid) return null;
            return (
              <div className="p-4 bg-cream/50 rounded-lg border border-cream text-sm mb-4">
                <div className="font-semibold text-espresso mb-1">
                  Payment Terms &mdash; {METHOD_LABELS[method] ?? method}
                </div>
                {method === 'credit_card' && (
                  <p className="text-taupe text-xs">Charged automatically to card on file. A 2% credit card surcharge is applied.</p>
                )}
                {method === 'e_transfer' && (
                  <p className="text-taupe text-xs">Please send your e-Transfer to sophie@thepupperclub.ca before the due date.</p>
                )}
                {method === 'interac_pad' && (
                  <p className="text-taupe text-xs">Charged automatically via Interac/Visa Debit or Bank Debit (PAD) through Stripe.</p>
                )}
                {method === 'cash' && (
                  <p className="text-taupe text-xs">Cash or cheque can be left at the service address on the first visit of the service period.</p>
                )}
              </div>
            );
          })()}

          {/* Notes */}
          {!isVoid && (billingPeriodStr || invoice.notes) && (
            <div className="text-xs text-taupe italic border-t border-cream pt-3 space-y-1">
              {billingPeriodStr && <p>{billingPeriodStr}</p>}
              {invoice.notes && <p>{invoice.notes}</p>}
            </div>
          )}

          {/* Footer */}
          {!isVoid && (
            <div className="text-center text-xs text-taupe/60 mt-6 pt-4 border-t border-cream">
              Thank you for choosing The Pupper Club! &middot; sophie@thepupperclub.ca &middot; Port Moody, BC
            </div>
          )}
        </div>
      </Card>

      {/* Payment modal */}
      <Modal open={paying} onClose={() => setPaying(false)} title="Pay Invoice">
        {paying && (
          <Elements stripe={stripePromise}>
            <PaymentForm
              invoice={invoice}
              onSuccess={() => {
                setPaying(false);
                qc.invalidateQueries({ queryKey: ['client-invoice', id] });
                qc.invalidateQueries({ queryKey: ['client-invoices'] });
              }}
            />
          </Elements>
        )}
      </Modal>

      {/* Tip modal */}
      <Modal open={tipping} onClose={() => { setTipping(false); setTipError(''); }} title="Add a Tip">
        {tipping && (
          <div className="space-y-4">
            <p className="text-sm text-taupe text-center">Show Sophie some love!</p>
            <div className="grid grid-cols-4 gap-2">
              {[10, 15, 20].map(pct => {
                const sub = Number(invoice.subtotal) || displaySubtotal;
                const amt = Math.round(sub * pct / 100 * 100) / 100;
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
            {tipError && <p className="text-sm text-red-600">{tipError}</p>}
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
