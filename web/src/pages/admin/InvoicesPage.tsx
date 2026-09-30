import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { format } from 'date-fns';

export default function AdminInvoicesPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');

  const { data: dashboard } = useQuery({
    queryKey: ['invoices-dashboard', filter, clientFilter, monthFilter],
    queryFn: () => api.get('/admin/invoices/dashboard', {
      params: {
        status: filter || undefined,
        user_id: clientFilter || undefined,
        month: monthFilter || undefined,
      },
    }).then(r => r.data.data),
  });

  const { data: clients } = useQuery({
    queryKey: ['clients-list'],
    queryFn: () => api.get('/admin/clients').then(r => r.data.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-invoices', filter, clientFilter, monthFilter],
    queryFn: () => api.get('/admin/invoices', {
      params: {
        status: filter || undefined,
        user_id: clientFilter || undefined,
        month: monthFilter || undefined,
      },
    }).then(r => r.data),
  });

  const hasActiveFilters = !!(clientFilter || monthFilter);
  const monthLabel = monthFilter
    ? format(new Date(`${monthFilter}-01T00:00:00`), 'MMMM yyyy')
    : 'This Month';
  const filteredTotal = Number(dashboard?.filtered_total ?? 0);
  const filteredCount = dashboard?.filtered_count ?? data?.data?.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Invoices</h1>
        <Button onClick={() => navigate('/admin/invoices/new')}>+ Create Invoice</Button>
      </div>

      {/* Summary cards — reflect whatever filters are currently applied */}
      {dashboard && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: `Billed ${monthLabel}`,    value: dashboard.billed_this_month,    color: 'text-espresso' },
            { label: `Collected ${monthLabel}`, value: dashboard.collected_this_month, color: 'text-green-600' },
            { label: 'Outstanding',             value: dashboard.outstanding,           color: 'text-red-500' },
          ].map(s => (
            <Card key={s.label} padding="sm">
              <div className={`text-2xl font-bold ${s.color}`}>${Number(s.value ?? 0).toFixed(0)}</div>
              <div className="text-xs text-taupe mt-0.5">{s.label}</div>
            </Card>
          ))}
        </div>
      )}

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status tabs */}
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

        {/* Client filter */}
        <select
          value={clientFilter}
          onChange={e => setClientFilter(e.target.value)}
          className="text-sm border border-taupe/50 rounded-lg px-3 py-2 bg-white text-espresso focus:ring-1 focus:ring-gold"
        >
          <option value="">All Clients</option>
          {clients?.map((c: any) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Month filter */}
        <input
          type="month"
          value={monthFilter}
          onChange={e => setMonthFilter(e.target.value)}
          className="text-sm border border-taupe/50 rounded-lg px-3 py-2 bg-white text-espresso focus:ring-1 focus:ring-gold"
        />

        {hasActiveFilters && (
          <button
            onClick={() => { setClientFilter(''); setMonthFilter(''); }}
            className="text-xs text-taupe hover:text-espresso underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      {isLoading ? <PageLoader /> : (
        <Card padding="none">
          <div className="overflow-x-auto">
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
                    {inv.due_date ? inv.due_date ? format(new Date(String(inv.due_date).slice(0, 10) + 'T00:00:00'), 'MMM d') : '—' : '—'}
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
            {!!data?.data?.length && (
              <tfoot>
                <tr className="border-t-2 border-taupe/30 bg-cream/40">
                  <td className="px-6 py-3 font-semibold text-espresso" colSpan={2}>
                    Total ({filteredCount} invoice{filteredCount === 1 ? '' : 's'})
                  </td>
                  <td className="px-6 py-3 font-bold text-espresso">${filteredTotal.toFixed(2)}</td>
                  <td className="px-6 py-3" colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>
          </div>
          {!data?.data?.length && (
            <div className="text-center py-12 text-taupe">No invoices found.</div>
          )}
        </Card>
      )}
    </div>
  );
}
