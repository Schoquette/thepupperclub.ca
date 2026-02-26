import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { format } from 'date-fns';

export default function AdminInvoicesPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('');

  const { data: dashboard } = useQuery({
    queryKey: ['invoices-dashboard'],
    queryFn: () => api.get('/admin/invoices/dashboard').then(r => r.data.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-invoices', filter],
    queryFn: () => api.get('/admin/invoices', { params: { status: filter || undefined } }).then(r => r.data),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Invoices</h1>
        <Button onClick={() => navigate('/admin/invoices/new')}>+ Create Invoice</Button>
      </div>

      {/* Summary cards */}
      {dashboard && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Billed This Month',    value: dashboard.billed_this_month,    color: 'text-espresso' },
            { label: 'Collected',            value: dashboard.collected_this_month, color: 'text-green-600' },
            { label: 'Outstanding',          value: dashboard.outstanding,           color: 'text-red-500' },
          ].map(s => (
            <Card key={s.label} padding="sm">
              <div className={`text-2xl font-bold ${s.color}`}>${s.value.toFixed(0)}</div>
              <div className="text-xs text-taupe mt-0.5">{s.label}</div>
            </Card>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex rounded-lg border border-taupe/50 overflow-hidden text-sm w-fit">
        {['', 'draft', 'sent', 'paid', 'overdue'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 font-medium capitalize transition-colors ${
              filter === f ? 'bg-espresso text-cream' : 'text-espresso hover:bg-cream'
            }`}
          >
            {f || 'All'}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? <PageLoader /> : (
        <Card padding="none">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cream text-left">
                <th className="px-6 py-4 font-semibold text-espresso">Invoice #</th>
                <th className="px-6 py-4 font-semibold text-espresso">Client</th>
                <th className="px-6 py-4 font-semibold text-espresso">Total</th>
                <th className="px-6 py-4 font-semibold text-espresso">Status</th>
                <th className="px-6 py-4 font-semibold text-espresso">Due</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {data?.data?.map((inv: any) => (
                <tr key={inv.id} className="border-b border-cream last:border-0 hover:bg-cream/50">
                  <td className="px-6 py-4 font-mono text-sm font-medium">{inv.invoice_number}</td>
                  <td className="px-6 py-4">{inv.user?.name}</td>
                  <td className="px-6 py-4 font-semibold">${Number(inv.total).toFixed(2)}</td>
                  <td className="px-6 py-4"><Badge variant={statusBadge(inv.status)}>{inv.status}</Badge></td>
                  <td className="px-6 py-4 text-taupe text-xs">
                    {inv.due_date ? format(new Date(inv.due_date), 'MMM d') : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => navigate(`/admin/invoices/${inv.id}`)}
                      className="text-blue text-sm hover:underline"
                    >
                      View →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data?.data?.length && (
            <div className="text-center py-12 text-taupe">No invoices found.</div>
          )}
        </Card>
      )}
    </div>
  );
}
