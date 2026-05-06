import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { format } from 'date-fns';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

function ErrorRow({ log }: { log: any }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <tr className="border-b border-cream last:border-0 hover:bg-cream/50 align-top">
      <td className="px-6 py-4">
        <span className="inline-flex items-center gap-1.5 text-red-600 font-medium">
          <AlertTriangle className="w-4 h-4" />
          {log.type}
        </span>
      </td>
      <td className="px-6 py-4">
        <div className="text-espresso text-sm max-w-md">
          <div className={expanded ? '' : 'line-clamp-2'}>{log.message}</div>
          {log.context && (
            <>
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-blue hover:underline mt-1 flex items-center gap-0.5"
              >
                {expanded ? <><ChevronUp className="w-3 h-3" /> Hide details</> : <><ChevronDown className="w-3 h-3" /> Show details</>}
              </button>
              {expanded && (
                <pre className="mt-2 text-[11px] text-taupe bg-cream/50 rounded-lg p-3 overflow-x-auto max-h-48 whitespace-pre-wrap">
                  {log.context.file && <div className="font-medium text-espresso mb-1">{log.context.file}</div>}
                  {log.context.trace}
                </pre>
              )}
            </>
          )}
        </div>
      </td>
      <td className="px-6 py-4 text-taupe text-xs whitespace-nowrap">{log.user?.name || '—'}</td>
      <td className="px-6 py-4 text-xs text-taupe">
        <div className="whitespace-nowrap">{log.created_at ? format(new Date(log.created_at), 'MMM d, h:mm a') : '—'}</div>
        {log.url && <div className="text-[11px] text-taupe/70 truncate max-w-[200px] mt-0.5" title={log.url}>{log.url}</div>}
      </td>
    </tr>
  );
}

export default function ErrorLogsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['error-logs'],
    queryFn: () => api.get('/admin/error-logs').then(r => r.data),
  });

  const logs: any[] = data?.data ?? [];

  return (
    <div className="space-y-6">
      <h1 className="page-title">Error Log</h1>

      {isLoading ? <PageLoader /> : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cream text-left">
                  <th className="px-6 py-4 font-semibold text-espresso">Type</th>
                  <th className="px-6 py-4 font-semibold text-espresso">Message</th>
                  <th className="px-6 py-4 font-semibold text-espresso">User</th>
                  <th className="px-6 py-4 font-semibold text-espresso">Date</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log: any) => (
                  <ErrorRow key={log.id} log={log} />
                ))}
              </tbody>
            </table>
          </div>
          {logs.length === 0 && (
            <div className="text-center py-12 text-taupe">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-taupe/50" />
              <p>No errors recorded.</p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
