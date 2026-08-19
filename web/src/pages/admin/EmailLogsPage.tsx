import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { format } from 'date-fns';
import { Mail, XCircle, CheckCircle, X } from 'lucide-react';

function EmailPreviewModal({ id, onClose }: { id: number; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['email-log-preview', id],
    queryFn: () => api.get(`/admin/email-logs/${id}`).then(r => r.data.data),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <p className="text-xs text-gray-400 mb-0.5">{data?.to_email}</p>
            <h2 className="font-semibold text-gray-800 truncate">{data?.subject ?? 'Loading…'}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0 mt-0.5">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-hidden relative">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <PageLoader />
            </div>
          ) : data?.body_html ? (
            <iframe
              srcDoc={data.body_html}
              title="Email preview"
              className="w-full h-full border-0"
              sandbox="allow-same-origin"
              style={{ minHeight: '60vh' }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-2">
              <Mail className="w-8 h-8 opacity-40" />
              <p className="text-sm">Preview not available for this email.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EmailLogsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [previewId, setPreviewId] = useState<number | null>(null);

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
                  <tr
                    key={log.id}
                    className="border-b border-cream last:border-0 hover:bg-cream/50 cursor-pointer"
                    onClick={() => setPreviewId(log.id)}
                  >
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

      {previewId && (
        <EmailPreviewModal id={previewId} onClose={() => setPreviewId(null)} />
      )}
    </div>
  );
}
