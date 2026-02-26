import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { format } from 'date-fns';

export default function AdminInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['admin-invoice', id],
    queryFn: () => api.get(`/admin/invoices/${id}`).then(r => r.data.data),
  });

  const markPaid = useMutation({
    mutationFn: () => api.post(`/admin/invoices/${id}/mark-paid`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-invoice', id] }),
  });

  const sendInvoice = useMutation({
    mutationFn: () => api.post(`/admin/invoices/${id}/send`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-invoice', id] }),
  });

  if (isLoading) return <PageLoader />;
  if (!invoice) return <div className="text-center py-12 text-taupe">Invoice not found.</div>;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/admin/invoices')} className="text-taupe hover:text-espresso">←</button>
        <div className="flex-1">
          <h1 className="page-title text-xl">{invoice.invoice_number}</h1>
          <Badge variant={statusBadge(invoice.status)} className="mt-1">{invoice.status}</Badge>
        </div>
        <div className="flex gap-2">
          {invoice.status === 'draft' && (
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
            {invoice.due_date && <div className="text-taupe text-xs">Due {format(new Date(invoice.due_date), 'MMMM d, yyyy')}</div>}
            {invoice.paid_at && <div className="text-green-600 text-xs font-semibold">Paid {format(new Date(invoice.paid_at), 'MMM d')}</div>}
          </div>
        </div>

        {/* Line items */}
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
      </Card>
    </div>
  );
}
