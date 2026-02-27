import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface StripePrice {
  id: string;
  amount: number | null;
  currency: string;
  nickname: string | null;
  type: string;
  interval: string | null;
}

interface StripeProduct {
  id: string;
  name: string;
  description: string | null;
  prices: StripePrice[];
}

interface LineItem {
  description: string;
  quantity: number;
  unit_price: string;
  service_date: string;
}

const emptyLine = (): LineItem => ({
  description: '',
  quantity: 1,
  unit_price: '',
  service_date: '',
});

const GST_RATE = 0.05;
const CC_SURCHARGE = 0.029;

export default function InvoiceCreatePage() {
  const navigate = useNavigate();

  const [userId, setUserId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);
  const [error, setError] = useState('');

  const { data: clients } = useQuery({
    queryKey: ['clients-list'],
    queryFn: () => api.get('/admin/clients').then(r => r.data.data),
  });

  const { data: stripeProducts } = useQuery<StripeProduct[]>({
    queryKey: ['stripe-products'],
    queryFn: () => api.get('/admin/stripe/products').then(r => r.data.data),
    staleTime: 5 * 60 * 1000, // cache 5 min
  });

  const addFromStripe = (product: StripeProduct, price: StripePrice) => {
    const label = price.nickname ? `${product.name} — ${price.nickname}` : product.name;
    setLines(prev => [...prev.filter(l => l.description || l.unit_price), {
      description: label,
      quantity: 1,
      unit_price: price.amount?.toString() ?? '',
      service_date: '',
    }]);
  };

  const create = useMutation({
    mutationFn: (payload: object) => api.post('/admin/invoices', payload),
    onSuccess: (res) => navigate(`/admin/invoices/${res.data.data.id}`),
    onError: (err: any) => setError(err.response?.data?.message ?? 'Failed to create invoice.'),
  });

  const updateLine = (idx: number, field: keyof LineItem, value: string | number) => {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };

  const removeLine = (idx: number) => setLines(prev => prev.filter((_, i) => i !== idx));

  // Preview totals
  const subtotal = lines.reduce((sum, l) => {
    const qty = Number(l.quantity) || 0;
    const price = Number(l.unit_price) || 0;
    return sum + qty * price;
  }, 0);
  const gst = subtotal * GST_RATE;
  const surcharge = subtotal > 0 ? (subtotal + gst) * CC_SURCHARGE : 0;
  const total = subtotal + gst + surcharge;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!userId) { setError('Please select a client.'); return; }
    const validLines = lines.filter(l => l.description && Number(l.unit_price) > 0);
    if (!validLines.length) { setError('Add at least one line item.'); return; }

    create.mutate({
      user_id: Number(userId),
      due_date: dueDate || undefined,
      notes: notes || undefined,
      line_items: validLines.map(l => ({
        description:  l.description,
        quantity:     Number(l.quantity),
        unit_price:   Number(l.unit_price),
        service_date: l.service_date || undefined,
      })),
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/admin/invoices')} className="text-taupe hover:text-espresso text-sm">
          ← Back
        </button>
        <h1 className="page-title">New Invoice</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Client + meta */}
        <Card>
          <CardHeader title="Invoice Details" />
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Client</label>
              <select
                className="input"
                value={userId}
                onChange={e => setUserId(e.target.value)}
                required
              >
                <option value="">Select client…</option>
                {clients?.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Due Date</label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
            <div>
              <label className="label">Notes (optional)</label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes…" />
            </div>
          </div>
        </Card>

        {/* Line items */}
        <Card>
          <CardHeader title="Line Items" />

          {/* Stripe quick-add */}
          {stripeProducts && stripeProducts.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-semibold text-taupe uppercase tracking-wide mb-2">
                Quick add from Stripe
              </div>
              <div className="flex flex-wrap gap-2">
                {stripeProducts.map(product =>
                  product.prices.map(price => (
                    <button
                      key={price.id}
                      type="button"
                      onClick={() => addFromStripe(product, price)}
                      className="inline-flex items-center gap-1.5 bg-cream hover:bg-gold/10 border border-taupe/30 hover:border-gold/50 text-espresso text-xs px-3 py-1.5 rounded-full transition-colors"
                    >
                      <span className="font-medium">{product.name}</span>
                      {price.nickname && (
                        <span className="text-taupe">· {price.nickname}</span>
                      )}
                      {price.amount !== null && (
                        <span className="text-gold font-semibold ml-0.5">
                          ${price.amount.toFixed(2)}
                          {price.interval ? `/${price.interval}` : ''}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
              <div className="border-t border-cream mt-4 mb-3" />
            </div>
          )}

          <div className="space-y-3">
            {lines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5">
                  {idx === 0 && <label className="label">Description</label>}
                  <Input
                    placeholder="e.g. Dog walk — Mon Jan 6"
                    value={line.description}
                    onChange={e => updateLine(idx, 'description', e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  {idx === 0 && <label className="label">Qty</label>}
                  <Input
                    type="number" min="1"
                    value={line.quantity}
                    onChange={e => updateLine(idx, 'quantity', Number(e.target.value))}
                  />
                </div>
                <div className="col-span-2">
                  {idx === 0 && <label className="label">Unit $</label>}
                  <Input
                    type="number" step="0.01" min="0" placeholder="0.00"
                    value={line.unit_price}
                    onChange={e => updateLine(idx, 'unit_price', e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  {idx === 0 && <label className="label">Date</label>}
                  <Input
                    type="date"
                    value={line.service_date}
                    onChange={e => updateLine(idx, 'service_date', e.target.value)}
                  />
                </div>
                <div className="col-span-1 flex items-end pb-1">
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      className="text-taupe hover:text-red-500 text-lg leading-none"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setLines(p => [...p, emptyLine()])}
              className="text-sm text-blue hover:underline mt-1"
            >
              + Add line item
            </button>
          </div>
        </Card>

        {/* Totals preview */}
        {subtotal > 0 && (
          <Card padding="sm">
            <div className="ml-auto w-56 space-y-1 text-sm">
              {[
                { label: 'Subtotal',   value: subtotal },
                { label: 'GST (5%)',   value: gst },
                { label: 'CC Fee (2.9%)', value: surcharge },
              ].map(row => (
                <div key={row.label} className="flex justify-between text-taupe">
                  <span>{row.label}</span>
                  <span>${row.value.toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-espresso pt-2 border-t border-taupe/30">
                <span>Total (CAD)</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>
          </Card>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => navigate('/admin/invoices')}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending}>
            Create Invoice
          </Button>
        </div>
      </form>
    </div>
  );
}
