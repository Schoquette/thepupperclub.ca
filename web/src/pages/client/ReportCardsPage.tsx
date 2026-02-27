import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { format } from 'date-fns';

function ReportPhoto({ reportId }: { reportId: number }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let url = '';
    api
      .get(`/client/report-cards/${reportId}/photo`, { responseType: 'blob' })
      .then((r) => {
        url = URL.createObjectURL(r.data);
        setSrc(url);
      })
      .catch(() => {});
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [reportId]);

  if (!src) return <div className="w-full h-48 bg-cream animate-pulse rounded-xl" />;
  return <img src={src} alt="Visit" className="w-full max-h-64 object-cover rounded-xl" />;
}

export default function ClientReportCardsPage() {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['client-report-cards'],
    queryFn: () => api.get('/client/report-cards').then((r) => r.data),
  });

  const reports = data?.data ?? [];

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl text-espresso">Report Cards</h1>

      {reports.length === 0 ? (
        <Card>
          <p className="text-center py-8 text-taupe">No report cards yet.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((r: any) => {
            const isExpanded = expandedId === r.id;
            const checklist: Record<string, boolean> = r.checklist ?? {};
            const checkedItems = Object.entries(checklist)
              .filter(([k, v]) => k !== 'special_trip_details' && v)
              .map(([k]) => k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));

            return (
              <Card key={r.id} padding="sm">
                {/* Header row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : r.id)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div>
                    <div className="font-semibold text-espresso text-sm">
                      Visit Report
                    </div>
                    <div className="text-xs text-taupe mt-0.5">
                      {r.arrival_time
                        ? format(new Date(r.arrival_time), 'MMMM d, yyyy')
                        : format(new Date(r.sent_at), 'MMMM d, yyyy')}
                    </div>
                  </div>
                  <span className="text-taupe text-lg">{isExpanded ? '▲' : '▼'}</span>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="mt-4 space-y-4 border-t border-cream pt-4">
                    {/* Photo */}
                    {r.report_photo_path && <ReportPhoto reportId={r.id} />}

                    {/* Times */}
                    {(r.arrival_time || r.departure_time) && (
                      <div className="flex gap-6">
                        {r.arrival_time && (
                          <div>
                            <div className="text-[10px] text-taupe uppercase tracking-wide">Arrived</div>
                            <div className="font-bold text-espresso">
                              {format(new Date(r.arrival_time), 'h:mm a')}
                            </div>
                          </div>
                        )}
                        {r.departure_time && (
                          <div>
                            <div className="text-[10px] text-taupe uppercase tracking-wide">Departed</div>
                            <div className="font-bold text-espresso">
                              {format(new Date(r.departure_time), 'h:mm a')}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Checklist */}
                    {checkedItems.length > 0 && (
                      <div>
                        <div className="text-[10px] text-taupe uppercase tracking-wide mb-2">
                          Activities & Care
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {checkedItems.map((item) => (
                            <span
                              key={item}
                              className="inline-flex items-center gap-1 bg-cream text-espresso text-xs px-2.5 py-1 rounded-full"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-gold flex-shrink-0" />
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Special trip */}
                    {r.special_trip_details && (
                      <div className="bg-gold/10 border border-gold/20 rounded-lg px-3 py-2 text-sm">
                        <span className="font-semibold text-gold">Special Trip: </span>
                        {r.special_trip_details}
                      </div>
                    )}

                    {/* Notes */}
                    {r.notes && (
                      <div>
                        <div className="text-[10px] text-taupe uppercase tracking-wide mb-1">Notes</div>
                        <p className="text-sm text-espresso leading-relaxed">{r.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
