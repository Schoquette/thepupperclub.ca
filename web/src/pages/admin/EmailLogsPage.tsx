import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { format } from 'date-fns';
import { Mail, XCircle, CheckCircle } from 'lucide-react';

export default function EmailLogsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['email-logs', search, statusFilter],
    queryFn: () => api.get('/admin/email-logs', {
      params: { search: search || undefined, status: statusFilter || undefined },
    }).then(r => r.data),
  });

  const logs: any[] = data?.data ?? [];

  return (
    <div className="space-y-6">
      <h1 className="page-title">Email Log</h1>

      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Search by email or subject..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border border-taupe/30 rounded-lg px-3 py-2 text-sm text-espresso focus:outline-none focus:ring-2 focus:ring-gold/40"
        >
          <option value="">All statuses</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {isLoading ? <PageLoader /> : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cream text-left">
                  <th className="px-6 py-4 font-semibold text-espresso">Status</th>
                  <th className="px-6 py-4 font-semibold text-espresso">To</th>
                  <th className="px-6 py-4 font-semibold text-espresso">Subject</th>
                  <th className="px-6 py-4 font-semibold text-espresso">Type</th>
                  <th className="px-6 py-4 font-semibold text-espresso">Date</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log: any) => (
                  <tr key={log.id} className="border-b border-cream last:border-0 hover:bg-cream/50">
                    <td className="px-6 py-4">
                      {log.status === 'sent' ? (
                        <span className="flex items-center gap-1.5 text-green-600">
                          <CheckCircle className="w-4 h-4" /> Sent
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-red-600">
                          <XCircle className="w-4 h-4" /> Failed
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-espresso">{log.to_email}</div>
                      {log.user?.name && (
                        <div className="text-xs text-taupe">{log.user.name}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-espresso max-w-xs truncate">{log.subject}</div>
                      {log.error_message && (
                        <div className="text-xs text-red-600 mt-0.5 max-w-xs truncate">{log.error_message}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-taupe">{log.mail_class || '—'}</td>
                    <td className="px-6 py-4 text-xs text-taupe whitespace-nowrap">
                      {log.created_at ? format(new Date(log.created_at), 'MMM d, h:mm a') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {logs.length === 0 && (
            <div className="text-center py-12 text-taupe">
              <Mail className="w-8 h-8 mx-auto mb-2 text-taupe/50" />
              <p>No emails found.</p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
