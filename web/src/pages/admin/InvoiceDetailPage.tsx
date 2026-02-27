import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { format } from 'date-fns';

interface LineItem {
  id?: number;
  description: string;
  quantity: number;
  unit_price: number;
  total?: number;
}

export default function AdminInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['admin-invoice', id],
    queryFn: () => api.get(`/admin/invoices/${id}`).then(r => r.data.data),
    onSuccess: (data: any) => {
      setDueDate(data.due_date ? data.due_date.substring(0, 10) : '');
      setNotes(data.notes ?? '');
      setLineItems((data.line_items ?? []).map((li: any) => ({
        id: li.id,
        description: li.description,
        quantity: li.quantity,
        unit_price: Number(li.unit_price),
      })));
    },
  } as any);

  const markPaid = useMutation({
    mutationFn: () => api.post(`/admin/invoices/${id}/mark-paid`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-invoice', id] }),
  });

  const sendInvoice = useMutation({
    mutationFn: () => api.post(`/admin/invoices/${id}/send`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-invoice', id] }),
  });

  const saveEdit = useMutation({
    mutationFn: () => api.patch(`/admin/invoices/${id}`, {
      due_date: dueDate || null,
      notes: notes || null,
      line_items: lineItems,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-invoice', id] });
      setEditing(false);
    },
  });

  const addLineItem = () => setLineItems(prev => [...prev, { description: '', quantity: 1, unit_price: 0 }]);
  const removeLineItem = (i: number) => setLineItems(prev => prev.filter((_, idx) => idx !== i));
  const updateLineItem = (i: number, field: keyof LineItem, value: string | number) => {
    setLineItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  };

  const editTotal = lineItems.reduce((sum, li) => sum + li.quantity * li.unit_price, 0);

  if (isLoading) return <PageLoader />;
  if (!invoice) return <div className="text-center py-12 text-taupe">Invoice not found.</div>;

  const canEdit = ['draft', 'sent'].includes(invoice.status);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/admin/invoices')} className="text-taupe hover:text-espresso">←</button>
        <div className="flex-1">
          <h1 className="page-title text-xl">{invoice.invoice_number}</h1>
          <Badge variant={statusBadge(invoice.status)} className="mt-1">{invoice.status}</Badge>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {canEdit && !editing && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
          {invoice.status === 'draft' && !editing && (
            <Button size="sm" onClick={() => sendInvoice.mutate()} loading={sendInvoice.isPending}>
              Send to Client
            </Button>
          )}
          {['sent', 'overdue'].includes(invoice.status) && (
            <Button size="sm" variant="secondary" onClick={() => markPaid.mutate()} loading={markPaid.isPending}>
              Mark Paid
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => window.open(`/api/admin/invoices/${id}/pdf`, '_blank')}>
            Download PDF
          </Button>
        </div>
      </div>

      <Card>
        <div className="grid grid-cols-2 gap-4 text-sm mb-6">
          <div>
            <div className="text-taupe mb-1">Client</div>
            <div className="font-semibold text-espresso">{invoice.user?.name}</div>
            <div className="text-taupe">{invoice.user?.email}</div>
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
                {invoice.due_date && <div className="text-taupe text-xs">Due {format(new Date(invoice.due_date), 'MMMM d, yyyy')}</div>}
                {invoice.paid_at && <div className="text-green-600 text-xs font-semibold">Paid {format(new Date(invoice.paid_at), 'MMM d')}</div>}
              </>
            )}
          </div>
        </div>

        {/* Line items */}
        {editing ? (
          <div className="space-y-3 mb-6">
            <div className="text-xs font-semibold text-taupe uppercase tracking-wide">Line Items</div>
            {lineItems.map((item, i) => (
              <div key={i} className="grid grid-cols-[1fr_60px_80px_28px] gap-2 items-center">
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
                <button onClick={() => removeLineItem(i)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
              </div>
            ))}
            <button onClick={addLineItem} className="text-sm text-gold hover:text-espresso font-medium">+ Add line item</button>
            <div className="text-right text-sm font-semibold text-espresso mt-2">
              Estimated subtotal: ${editTotal.toFixed(2)} + GST
            </div>
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
            <table className="w-full text-sm mb-6">
              <thead>
                <tr className="border-b border-cream">
                  <th className="pb-2 text-left font-semibold text-espresso">Description</th>
                  <th className="pb-2 text-center font-semibold text-espresso">Qty</th>
                  <th className="pb-2 text-right font-semibold text-espresso">Unit</th>
                  <th className="pb-2 text-right font-semibold text-espresso">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.line_items?.map((item: any) => (
                  <tr key={item.id} className="border-b border-cream/50">
                    <td className="py-2.5 text-espresso">{item.description}</td>
                    <td className="py-2.5 text-center text-taupe">{item.quantity}</td>
                    <td className="py-2.5 text-right text-taupe">${Number(item.unit_price).toFixed(2)}</td>
                    <td className="py-2.5 text-right font-medium">${Number(item.total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="ml-auto w-64 space-y-1.5 text-sm">
              {[
                { label: 'Subtotal',     value: invoice.subtotal },
                { label: 'GST (5%)',     value: invoice.gst },
                invoice.credit_card_surcharge > 0 && { label: 'CC Fee (2.9%)', value: invoice.credit_card_surcharge },
                invoice.tip > 0 && { label: 'Tip',          value: invoice.tip },
              ].filter(Boolean).map((row: any) => (
                <div key={row.label} className="flex justify-between">
                  <span className="text-taupe">{row.label}</span>
                  <span>${Number(row.value).toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between pt-2 border-t border-taupe/30 font-bold text-espresso">
                <span>Total (CAD)</span>
                <span>${Number(invoice.total).toFixed(2)}</span>
              </div>
            </div>

            {invoice.notes && (
              <p className="text-xs text-taupe mt-4 italic border-t border-cream pt-3">{invoice.notes}</p>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
