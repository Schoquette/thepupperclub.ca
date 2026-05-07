import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { format } from 'date-fns';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { CreditCard, Banknote, ArrowRightLeft, Building2 } from 'lucide-react';

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
      const { data } = await api.post('/client/billing/setup-intent');
      const clientSecret = data.client_secret;
      const card = elements.getElement(CardElement);
      const { setupIntent, error: setupError } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: { card: card! },
      });
      if (setupError) throw new Error(setupError.message);
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

function PadSetupForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [institutionNumber, setInstitutionNumber] = useState('');
  const [transitNumber, setTransitNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [email, setEmail] = useState('');

  // Load user info for pre-fill
  const { data: profile } = useQuery({
    queryKey: ['client-profile-pad'],
    queryFn: () => api.get('/client/profile').then(r => r.data.data),
  });

  React.useEffect(() => {
    if (profile) {
      setAccountHolder(profile.name || '');
      setEmail(profile.email || '');
    }
  }, [profile]);

  const handleSave = async () => {
    if (!stripe) return;
    if (!institutionNumber || !transitNumber || !accountNumber || !accountHolder || !email) {
      setError('Please fill in all fields.');
      return;
    }
    if (institutionNumber.length !== 3) {
      setError('Institution number must be 3 digits.');
      return;
    }
    if (transitNumber.length !== 5) {
      setError('Transit number must be 5 digits.');
      return;
    }
    if (accountNumber.length < 5 || accountNumber.length > 12) {
      setError('Account number must be between 5 and 12 digits.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/client/billing/setup-intent-pad');
      const clientSecret = data.client_secret;

      const { setupIntent, error: setupError } = await stripe.confirmAcssDebitSetup(clientSecret, {
        payment_method: {
          billing_details: {
            name: accountHolder,
            email: email,
          },
          acss_debit: {
            institution_number: institutionNumber,
            transit_number: transitNumber,
            account_number: accountNumber,
          },
        },
      });

      if (setupError) throw new Error(setupError.message);
      await api.post('/client/billing/payment-method', {
        payment_method_id: setupIntent!.payment_method,
      });
      onSuccess();
    } catch (e: any) {
      setError(e.message || 'Failed to set up bank account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-taupe">Enter your Canadian bank account details below.</p>
      <div>
        <label className="text-xs font-medium text-taupe block mb-1">Account Holder Name</label>
        <input
          type="text"
          className="input w-full"
          value={accountHolder}
          onChange={e => setAccountHolder(e.target.value)}
          placeholder="Full name on the account"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-taupe block mb-1">Email</label>
        <input
          type="email"
          className="input w-full"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="your@email.com"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-taupe block mb-1">Institution # (3 digits)</label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={3}
            className="input w-full"
            value={institutionNumber}
            onChange={e => setInstitutionNumber(e.target.value.replace(/\D/g, '').slice(0, 3))}
            placeholder="e.g. 001"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-taupe block mb-1">Transit # (5 digits)</label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={5}
            className="input w-full"
            value={transitNumber}
            onChange={e => setTransitNumber(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="e.g. 12345"
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-taupe block mb-1">Account Number (5-12 digits)</label>
        <input
          type="text"
          inputMode="numeric"
          maxLength={12}
          className="input w-full"
          value={accountNumber}
          onChange={e => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 12))}
          placeholder="Your account number"
        />
      </div>
      <p className="text-xs text-taupe">
        You can find these numbers on a cheque or in your online banking app.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button loading={loading} onClick={handleSave} className="w-full">
        Authorize Pre-Authorized Debit
      </Button>
    </div>
  );
}

const METHOD_OPTIONS = [
  { value: 'credit_card', label: 'Credit Card (2% fee)', icon: CreditCard },
  { value: 'e_transfer', label: 'E-Transfer (no fee)', icon: ArrowRightLeft },
  { value: 'interac_pad', label: 'Pre-Authorized Debit (no fee)', icon: Building2 },
  { value: 'cash', label: 'Cash (no fee)', icon: Banknote },
];

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

  const [methodSuccessMsg, setMethodSuccessMsg] = useState('');
  const [methodError, setMethodError] = useState('');

  const updateMethod = useMutation({
    mutationFn: (method: string) => api.patch('/client/profile', { billing_method: method }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-profile'] });
      setMethodError('');
      setMethodSuccessMsg('Updated!');
      setTimeout(() => setMethodSuccessMsg(''), 2500);
    },
    onError: (err: any) => {
      setMethodError(err.response?.data?.message || 'Failed to update payment method.');
    },
  });

  if (profileLoading || pmLoading) return <PageLoader />;

  const cp = profile?.client_profile;
  const currentMethod = cp?.billing_method ?? 'credit_card';

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
          </div>
        </Card>
      )}

      {/* Payment method selection */}
      <Card>
        <CardHeader title="Payment Method" />
        {methodSuccessMsg && <span className="text-sm text-green-600 font-medium">{methodSuccessMsg}</span>}
        {methodError && <p className="text-sm text-red-600">{methodError}</p>}
        <div className="space-y-3">
          {METHOD_OPTIONS.map(opt => {
            const Icon = opt.icon;
            const selected = currentMethod === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => !selected && updateMethod.mutate(opt.value)}
                className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                  selected
                    ? 'border-gold bg-gold/5'
                    : 'border-taupe/20 hover:border-taupe/40'
                }`}
              >
                <Icon className={`w-5 h-5 ${selected ? 'text-gold' : 'text-taupe'}`} />
                <div className="flex-1">
                  <div className={`text-sm font-semibold ${selected ? 'text-espresso' : 'text-taupe'}`}>
                    {opt.label}
                  </div>
                  {opt.value === 'credit_card' && (
                    <div className="text-xs text-taupe mt-0.5">A 2% transaction fee applies to credit card payments</div>
                  )}
                  {opt.value === 'e_transfer' && selected && (
                    <div className="text-xs text-taupe mt-0.5">Send to sophie@thepupperclub.ca before your billing date</div>
                  )}
                  {opt.value === 'interac_pad' && selected && (
                    <div className="text-xs text-taupe mt-0.5">Set up automatic bank account debits — no fees applied</div>
                  )}
                  {opt.value === 'cash' && selected && (
                    <div className="text-xs text-taupe mt-0.5">Leave at your service address before your billing date</div>
                  )}
                </div>
                {selected && (
                  <span className="text-xs font-semibold text-gold bg-gold/10 px-2 py-1 rounded-full">Selected</span>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Card on file — show for Credit Card */}
      {currentMethod === 'credit_card' && (
        <Card>
          <CardHeader title="Card on File" />
          {pm ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4 bg-cream/40 rounded-xl p-4">
                <CreditCard className="w-8 h-8 text-taupe" />
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
            <p className="text-sm text-taupe mb-4">Add a card to enable automatic payments.</p>
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

          <div className="mt-4 p-3 bg-gold/5 border border-gold/20 rounded-lg">
            <p className="text-xs text-espresso">
              A 2% credit card surcharge will be added to all invoices paid by credit card.
              Your payment information is securely stored by Stripe and never touches our servers.
            </p>
          </div>
        </Card>
      )}

      {/* Pre-Authorized Debit (PAD) setup */}
      {currentMethod === 'interac_pad' && (
        <Card>
          <CardHeader title="Pre-Authorized Debit Setup" />
          {pm && pm.type === 'acss_debit' && !addingCard ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4 bg-cream/40 rounded-xl p-4">
                <Building2 className="w-8 h-8 text-taupe" />
                <div>
                  <div className="font-semibold text-espresso">
                    {pm.bank_name || 'Bank Account'} ending in {pm.last4}
                  </div>
                  <div className="text-xs text-taupe">
                    Institution {pm.institution_number} &middot; Transit {pm.transit_number}
                  </div>
                </div>
              </div>
              <button
                className="text-sm text-gold hover:text-espresso font-medium transition-colors"
                onClick={() => setAddingCard(true)}
              >
                Replace bank account
              </button>
            </div>
          ) : (
            <>
              {pm && pm.type !== 'acss_debit' && !addingCard ? (
                <div className="space-y-4">
                  <p className="text-sm text-taupe">You currently have a card on file. Set up a bank account for pre-authorized debit instead.</p>
                  <Button size="sm" onClick={() => setAddingCard(true)}>Set Up Bank Account</Button>
                </div>
              ) : (
                <Elements stripe={stripePromise}>
                  <PadSetupForm
                    onSuccess={() => {
                      setAddingCard(false);
                      qc.invalidateQueries({ queryKey: ['client-payment-method'] });
                    }}
                  />
                </Elements>
              )}
            </>
          )}

          <div className="mt-4 p-3 bg-gold/5 border border-gold/20 rounded-lg">
            <p className="text-xs text-espresso">
              No additional fees for pre-authorized debit payments.
              Your bank account information is securely stored by Stripe and never touches our servers.
              By setting up PAD, you authorize The Pupper Club to debit your account for monthly invoices.
            </p>
          </div>
        </Card>
      )}

      {/* E-Transfer instructions */}
      {currentMethod === 'e_transfer' && (
        <Card>
          <CardHeader title="E-Transfer Instructions" />
          <div className="space-y-2 text-sm">
            <p className="text-espresso">
              Please send your e-Transfer to <strong>sophie@thepupperclub.ca</strong> before the <strong>first day of your service month</strong>.
            </p>
            <p className="text-taupe text-xs">
              Auto-deposit is enabled — no security question required.
            </p>
          </div>
        </Card>
      )}

      {/* Cash instructions */}
      {currentMethod === 'cash' && (
        <Card>
          <CardHeader title="Cash / Cheque Instructions" />
          <div className="space-y-2 text-sm">
            <p className="text-espresso">
              Cash or cheque can be left at your service address on the <strong>first visit of your service month</strong>.
            </p>
            <p className="text-taupe text-xs">
              Please ensure payment is in an envelope labelled with your name.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
