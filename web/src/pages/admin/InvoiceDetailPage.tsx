import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { format } from 'date-fns';
import { Download, Send, Bell, CheckCircle } from 'lucide-react';

interface LineItem {
  id?: number;
  description: string;
  quantity: number;
  unit_price: number;
  total?: number;
}

const METHOD_LABELS: Record<string, string> = {
  credit_card: 'Credit Card',
  e_transfer: 'E-Transfer',
  interac_pad: 'Interac/PAD',
  cash: 'Cash',
};

export default function AdminInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [applyCcSurcharge, setApplyCcSurcharge] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);
  const [discountDesc, setDiscountDesc] = useState('Discount');
  const [discountAmount, setDiscountAmount] = useState('');

  // Message preview modal state
  const [messageModal, setMessageModal] = useState<'resend' | 'reminder' | null>(null);
  const [messageText, setMessageText] = useState('');

  // Success toast
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['admin-invoice', id],
    queryFn: () => api.get(`/admin/invoices/${id}`).then(r => r.data.data),
  });

  const { data: stripeProducts } = useQuery<any[]>({
    queryKey: ['stripe-products'],
    queryFn: () => api.get('/admin/stripe/products').then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
    enabled: editing,
  });

  const startEditing = () => {
    if (!invoice) return;
    setDueDate(invoice.due_date ? invoice.due_date.substring(0, 10) : '');
    setNotes(invoice.notes ?? '');
    setApplyCcSurcharge(!!invoice.apply_cc_surcharge);
    setLineItems((invoice.line_items ?? []).map((li: any) => ({
      id: li.id,
      description: li.description,
      quantity: li.quantity,
      unit_price: Number(li.unit_price),
    })));
    setEditing(true);
  };

  const buildDefaultMessage = (type: 'resend' | 'reminder') => {
    if (!invoice) return '';
    const total = `$${Number(invoice.total).toFixed(2)}`;
    const period = invoice.billing_period_start && invoice.billing_period_end
      ? ` Service period: ${format(new Date(invoice.billing_period_start), 'MMMM d, yyyy')} - ${format(new Date(invoice.billing_period_end), 'MMMM d, yyyy')}.`
      : '';
    if (type === 'resend') {
      return `Invoice #${invoice.invoice_number} for ${total} is ready.${period}${invoice.due_date ? ` Payment is due by ${format(new Date(invoice.due_date), 'MMMM d, yyyy')}.` : ''}`;
    }
    return `Friendly reminder: your payment of ${total} (Invoice #${invoice.invoice_number}) is due${invoice.due_date ? ` on ${format(new Date(invoice.due_date), 'MMMM d, yyyy')}` : ' soon'}.${period} If you'd like to update your payment method, you can do so in your portal.`;
  };

  const openMessageModal = (type: 'resend' | 'reminder') => {
    setMessageText(buildDefaultMessage(type));
    setMessageModal(type);
  };

  // Error state for mutations
  const [mutError, setMutError] = useState('');

  const markPaid = useMutation({
    mutationFn: () => api.post(`/admin/invoices/${id}/mark-paid`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-invoice', id] });
      showToast('Invoice marked as paid.');
    },
    onError: (e: any) => setMutError(e.response?.data?.message || 'Failed to mark as paid.'),
  });

  const sendInvoice = useMutation({
    mutationFn: () => api.post(`/admin/invoices/${id}/send`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-invoice', id] });
      showToast('Invoice sent to client.');
    },
    onError: (e: any) => setMutError(e.response?.data?.message || 'Failed to send invoice.'),
  });

  const saveEdit = useMutation({
    mutationFn: () => api.patch(`/admin/invoices/${id}`, {
      due_date: dueDate || null,
      notes: notes || null,
      apply_cc_surcharge: applyCcSurcharge,
      line_items: lineItems,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-invoice', id] });
      setEditing(false);
      showToast('Changes saved.');
    },
    onError: (e: any) => setMutError(e.response?.data?.message || 'Failed to save changes.'),
  });

  const resendInvoice = useMutation({
    mutationFn: (message: string) => api.post(`/admin/invoices/${id}/resend`, { message }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-invoice', id] });
      setMessageModal(null);
      showToast('Invoice re-sent to client.');
    },
    onError: (e: any) => setMutError(e.response?.data?.message || 'Failed to re-send invoice.'),
  });

  const sendReminderMut = useMutation({
    mutationFn: (message: string) => api.post(`/admin/invoices/${id}/reminder`, { message }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-invoice', id] });
      setMessageModal(null);
      showToast('Payment reminder sent.');
    },
    onError: (e: any) => setMutError(e.response?.data?.message || 'Failed to send reminder.'),
  });

  const voidInvoice = useMutation({
    mutationFn: () => api.post(`/admin/invoices/${id}/void`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-invoice', id] });
      showToast('Invoice voided.');
    },
    onError: (e: any) => setMutError(e.response?.data?.message || 'Failed to void invoice.'),
  });

  const applyDiscount = useMutation({
    mutationFn: () => api.post(`/admin/invoices/${id}/discount`, {
      description: discountDesc,
      amount: Number(discountAmount),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-invoice', id] });
      setShowDiscount(false);
      setDiscountDesc('Discount');
      setDiscountAmount('');
      showToast('Discount applied.');
    },
    onError: (e: any) => setMutError(e.response?.data?.message || 'Failed to apply discount.'),
  });

  const downloadPdf = async () => {
    setPdfLoading(true);
    try {
      const response = await api.get(`/admin/invoices/${id}/pdf`, { responseType: 'blob' });
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

  const addLineItem = () => setLineItems(prev => [...prev, { description: '', quantity: 1, unit_price: 0 }]);
  const removeLineItem = (i: number) => setLineItems(prev => prev.filter((_, idx) => idx !== i));
  const updateLineItem = (i: number, field: keyof LineItem, value: string | number) => {
    setLineItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  };

  const editTotal = lineItems.reduce((sum, li) => sum + li.quantity * li.unit_price, 0);

  if (isLoading) return <PageLoader />;
  if (!invoice) return <div className="text-center py-12 text-taupe">Invoice not found.</div>;

  const isVoid = invoice.status === 'void';
  const canEdit = ['draft', 'sent'].includes(invoice.status);

  // Compute subtotal/GST with fallback for older invoices missing these values
  const displaySubtotal = Number(invoice.subtotal) || (invoice.line_items ?? []).reduce((s: number, li: any) => s + Number(li.total), 0);
  const displayGst = Number(invoice.gst) || Math.round(displaySubtotal * 0.05 * 100) / 100;

  const billingPeriodStr = invoice.billing_period_start && invoice.billing_period_end
    ? `${format(new Date(invoice.billing_period_start), 'MMMM d, yyyy')} - ${format(new Date(invoice.billing_period_end), 'MMMM d, yyyy')}`
    : null;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Success toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-in fade-in slide-in-from-top-2">
          <CheckCircle className="w-4 h-4 text-green-600" />
          {toast}
        </div>
      )}

      {/* Mutation error */}
      {mutError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700 flex items-center justify-between">
          <span>{mutError}</span>
          <button onClick={() => setMutError('')} className="text-red-400 hover:text-red-600 ml-3">&times;</button>
        </div>
      )}

      {/* Message preview modal (Re-Send / Reminder) */}
      <Modal
        open={!!messageModal}
        onClose={() => setMessageModal(null)}
        title={messageModal === 'resend' ? 'Re-Send Invoice' : 'Send Payment Reminder'}
      >
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-taupe uppercase tracking-wide mb-1">To</div>
            <div className="text-sm text-espresso font-medium">{invoice.user?.name} ({invoice.user?.email})</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-taupe uppercase tracking-wide mb-1">Invoice</div>
            <div className="text-sm text-espresso">{invoice.invoice_number} &middot; ${Number(invoice.total).toFixed(2)} CAD</div>
          </div>
          <div>
            <label className="text-xs font-semibold text-taupe uppercase tracking-wide mb-1 block">Message</label>
            <textarea
              className="input w-full text-sm"
              rows={5}
              value={messageText}
              onChange={e => setMessageText(e.target.value)}
            />
            <p className="text-xs text-taupe mt-1">This message will be sent via chat and their preferred notification channels (app/email/SMS).</p>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-cream">
            <Button variant="outline" size="sm" onClick={() => setMessageModal(null)}>Cancel</Button>
            <Button
              size="sm"
              loading={messageModal === 'resend' ? resendInvoice.isPending : sendReminderMut.isPending}
              onClick={() => {
                if (messageModal === 'resend') {
                  resendInvoice.mutate(messageText);
                } else {
                  sendReminderMut.mutate(messageText);
                }
              }}
            >
              <Send className="w-3.5 h-3.5 mr-1" /> Send
            </Button>
          </div>
        </div>
      </Modal>

      {/* Header bar — invoice number, badge, and action buttons all on one row */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => navigate('/admin/invoices')} className="text-taupe hover:text-espresso text-lg">&larr;</button>
        <h1 className="font-display text-xl text-espresso whitespace-nowrap">{invoice.invoice_number}</h1>
        <Badge variant={statusBadge(invoice.status)}>{invoice.status}</Badge>
        <div className="flex-1" />
        <div className="flex gap-2 flex-wrap">
          {canEdit && !editing && (
            <Button size="sm" variant="outline" onClick={startEditing}>Edit</Button>
          )}
          {invoice.status === 'draft' && !editing && (
            <Button
              size="sm"
              onClick={() => { if (confirm('Send this invoice to the client?')) sendInvoice.mutate(); }}
              loading={sendInvoice.isPending}
            >
              <Send className="w-3.5 h-3.5 mr-1" /> Send to Client
            </Button>
          )}
          {['sent', 'overdue'].includes(invoice.status) && (
            <>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => { if (confirm('Mark this invoice as paid?')) markPaid.mutate(); }}
                loading={markPaid.isPending}
              >
                Mark Paid
              </Button>
              <Button size="sm" variant="outline" onClick={() => openMessageModal('resend')}>
                <Send className="w-3.5 h-3.5 mr-1" /> Re-Send
              </Button>
              <Button size="sm" variant="outline" onClick={() => openMessageModal('reminder')}>
                <Bell className="w-3.5 h-3.5 mr-1" /> Send Reminder
              </Button>
            </>
          )}
          {['draft', 'sent', 'overdue'].includes(invoice.status) && (
            <Button
              size="sm"
              variant="outline"
              className="text-red-500 border-red-200 hover:bg-red-50"
              onClick={() => { if (confirm('Are you sure you want to void this invoice? This cannot be undone.')) voidInvoice.mutate(); }}
              loading={voidInvoice.isPending}
            >
              Void
            </Button>
          )}
          {!isVoid && (
            <Button size="sm" variant="outline" onClick={downloadPdf} loading={pdfLoading} disabled={pdfLoading}>
              <Download className="w-3.5 h-3.5 mr-1" /> {pdfLoading ? 'Downloading...' : 'PDF'}
            </Button>
          )}
        </div>
      </div>

      {/* Invoice card */}
      <Card className="relative overflow-hidden !p-0">
        {/* VOID watermark */}
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
              {editing ? (
                <Input
                  label="Due date"
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                />
              ) : (
                <>
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
                </>
              )}
            </div>
          </div>

          {/* Line items */}
          {editing ? (
            <div className="space-y-3 mb-6">
              {/* Stripe quick-add */}
              {stripeProducts && stripeProducts.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs font-semibold text-taupe uppercase tracking-wide mb-2">Quick add from Stripe</div>
                  <div className="flex flex-wrap gap-2">
                    {stripeProducts.map((product: any) =>
                      product.prices?.map((price: any) => (
                        <button
                          key={price.id}
                          type="button"
                          onClick={() => {
                            const label = price.nickname ? `${product.name} — ${price.nickname}` : product.name;
                            setLineItems(prev => [...prev, { description: label, quantity: 1, unit_price: price.amount ?? 0 }]);
                          }}
                          className="inline-flex items-center gap-1.5 bg-cream hover:bg-gold/10 border border-taupe/30 hover:border-gold/50 text-espresso text-xs px-3 py-1.5 rounded-full transition-colors"
                        >
                          <span className="font-medium">{product.name}</span>
                          {price.amount !== null && (
                            <span className="text-gold font-semibold ml-0.5">
                              ${price.amount.toFixed(2)}{price.interval ? `/${price.interval}` : ''}
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                  <div className="border-t border-cream mt-3" />
                </div>
              )}

              <div className="text-xs font-semibold text-taupe uppercase tracking-wide">Line Items</div>
              {lineItems.map((item, i) => (
                <div key={i} className="grid grid-cols-[1fr_50px_80px_28px] sm:grid-cols-[1fr_60px_90px_28px] gap-2 items-center">
                  <input
                    className="input text-sm"
                    placeholder="Description"
                    value={item.description}
                    onChange={e => updateLineItem(i, 'description', e.target.value)}
                  />
                  <input
                    className="input text-sm text-center"
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={e => updateLineItem(i, 'quantity', Number(e.target.value))}
                  />
                  <input
                    className="input text-sm text-right"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Price"
                    value={item.unit_price}
                    onChange={e => updateLineItem(i, 'unit_price', Number(e.target.value))}
                  />
                  <button onClick={() => removeLineItem(i)} className="text-red-400 hover:text-red-600 text-lg leading-none">&times;</button>
                </div>
              ))}
              <button onClick={addLineItem} className="text-sm text-gold hover:text-espresso font-medium">+ Add line item</button>
              <div className="text-right text-sm font-semibold text-espresso mt-2">
                Estimated subtotal: ${editTotal.toFixed(2)} + GST
              </div>
              <label className="flex items-center gap-3 cursor-pointer pt-2">
                <input
                  type="checkbox"
                  checked={applyCcSurcharge}
                  onChange={e => setApplyCcSurcharge(e.target.checked)}
                  className="h-4 w-4 rounded border-taupe text-gold focus:ring-gold"
                />
                <span className="text-sm text-espresso font-medium">Apply credit card surcharge (2%)</span>
              </label>
              <textarea
                className="input w-full text-sm"
                rows={2}
                placeholder="Notes (optional)"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
                <Button size="sm" loading={saveEdit.isPending} onClick={() => saveEdit.mutate()}>Save Changes</Button>
              </div>
            </div>
          ) : (
            <>
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
                      <td className="py-2.5 px-3 text-taupe">{item.service_date ? format(new Date(item.service_date), 'MMM d, yyyy') : '—'}</td>
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
            </>
          )}
        </div>

        {/* Sections below the main content — outside the opacity wrapper */}
        {!editing && (
          <div className="px-8 pb-8">
            {/* Discount — only on editable invoices */}
            {canEdit && !isVoid && (
              <div className="mb-4">
                {showDiscount ? (
                  <div className="p-3 bg-cream/50 rounded-lg border border-cream space-y-3 sm:space-y-0 sm:flex sm:items-end sm:gap-2">
                    <div className="flex-1">
                      <label className="text-xs font-medium text-taupe">Description</label>
                      <input className="input text-sm w-full" value={discountDesc} onChange={e => setDiscountDesc(e.target.value)} />
                    </div>
                    <div className="sm:w-28">
                      <label className="text-xs font-medium text-taupe">Amount ($)</label>
                      <input className="input text-sm w-full" type="number" step="0.01" min="0.01" value={discountAmount} onChange={e => setDiscountAmount(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => applyDiscount.mutate()} loading={applyDiscount.isPending} disabled={!discountAmount || Number(discountAmount) <= 0}>Apply</Button>
                      <Button size="sm" variant="outline" onClick={() => setShowDiscount(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowDiscount(true)} className="text-sm text-gold hover:text-espresso font-medium">+ Apply Discount</button>
                )}
              </div>
            )}

            {/* Payment terms — fall back to client profile billing method */}
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

            {/* Billing period / Notes */}
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
        )}
      </Card>
    </div>
  );
}
