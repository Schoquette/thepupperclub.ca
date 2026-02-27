import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { format } from 'date-fns';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_KEY ?? '');

function AddCardForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!stripe || !elements) return;
    setLoading(true);
    setError('');
    try {
      // Step 1: Get setup intent from backend
      const { data } = await api.post('/client/billing/setup-intent');
      const clientSecret = data.client_secret;

      // Step 2: Confirm card setup with Stripe
      const card = elements.getElement(CardElement);
      const { setupIntent, error: setupError } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: { card: card! },
      });

      if (setupError) throw new Error(setupError.message);

      // Step 3: Save payment method to backend
      await api.post('/client/billing/payment-method', {
        payment_method_id: setupIntent!.payment_method,
      });

      onSuccess();
    } catch (e: any) {
      setError(e.message || 'Failed to save card.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-taupe/30 p-4 bg-cream/30">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '15px',
                color: '#3B2F2A',
                '::placeholder': { color: '#C8BFB6' },
              },
            },
          }}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button loading={loading} onClick={handleSave} className="w-full">
        Save Card
      </Button>
    </div>
  );
}

export default function ClientBillingPage() {
  const qc = useQueryClient();
  const [addingCard, setAddingCard] = useState(false);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['client-profile'],
    queryFn: () => api.get('/client/profile').then(r => r.data.data),
  });

  const { data: pm, isLoading: pmLoading } = useQuery({
    queryKey: ['client-payment-method'],
    queryFn: () => api.get('/client/billing/payment-method').then(r => r.data.data),
  });

  if (profileLoading || pmLoading) return <PageLoader />;

  const cp = profile?.client_profile;

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="font-display text-xl text-espresso">Billing</h1>

      {/* Subscription summary */}
      {cp?.subscription_plan && (
        <Card>
          <CardHeader title="Your Plan" />
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-taupe">Plan</span>
              <span className="font-semibold text-espresso capitalize">{cp.subscription_plan}</span>
            </div>
            {cp.subscription_amount && (
              <div className="flex justify-between">
                <span className="text-taupe">Monthly amount</span>
                <span className="font-semibold text-espresso">${Number(cp.subscription_amount).toFixed(2)} CAD</span>
              </div>
            )}
            {cp.next_billing_date && (
              <div className="flex justify-between">
                <span className="text-taupe">Next billing date</span>
                <span className="font-semibold text-espresso">
                  {format(new Date(cp.next_billing_date), 'MMMM d, yyyy')}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-taupe">Payment method</span>
              <span className="font-semibold text-espresso capitalize">
                {cp.billing_method?.replace('_', ' ') ?? 'Not set'}
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Saved card */}
      <Card>
        <CardHeader title="Payment Method" />
        {pm ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4 bg-cream/40 rounded-xl p-4">
              <div className="text-3xl">💳</div>
              <div>
                <div className="font-semibold text-espresso capitalize">{pm.brand} ending in {pm.last4}</div>
                <div className="text-xs text-taupe">Expires {pm.exp_month}/{pm.exp_year}</div>
              </div>
            </div>
            {!addingCard && (
              <button
                className="text-sm text-gold hover:text-espresso font-medium transition-colors"
                onClick={() => setAddingCard(true)}
              >
                Replace card
              </button>
            )}
          </div>
        ) : (
          <p className="text-sm text-taupe mb-4">No card on file. Add one to enable auto-pay.</p>
        )}

        {(!pm || addingCard) && (
          <div className="mt-4">
            <Elements stripe={stripePromise}>
              <AddCardForm
                onSuccess={() => {
                  setAddingCard(false);
                  qc.invalidateQueries({ queryKey: ['client-payment-method'] });
                }}
              />
            </Elements>
          </div>
        )}
      </Card>

      <p className="text-xs text-taupe">
        Your payment information is securely stored by Stripe and never touches our servers.
        Monthly invoices are generated automatically and charged on your billing date.
      </p>
    </div>
  );
}
