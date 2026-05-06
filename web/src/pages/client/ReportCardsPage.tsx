import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

function ReportPhoto({ reportId, index }: { reportId: number; index: number }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let url = '';
    const token = localStorage.getItem('token');
    fetch(`/api/client/report-cards/${reportId}/photos/${index}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.blob();
      })
      .then((blob) => {
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => {});
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [reportId, index]);

  if (!src) return <div className="w-full h-48 bg-cream animate-pulse rounded-xl" />;
  return <img src={src} alt="Visit photo" className="w-full max-h-64 object-cover rounded-xl" />;
}

export default function ClientReportCardsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [commentDraft, setCommentDraft] = useState<Record<number, string>>({});
  const [changeDraft, setChangeDraft] = useState<Record<number, string>>({});
  const [successMsg, setSuccessMsg] = useState<Record<number, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['client-report-cards'],
    queryFn: () => api.get('/client/report-cards').then((r) => r.data),
  });

  const [errorMsg, setErrorMsg] = useState<Record<number, string>>({});

  const postComment = useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) =>
      api.post(`/client/report-cards/${id}/comments`, { body }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['client-report-cards'] });
      setCommentDraft((p) => ({ ...p, [vars.id]: '' }));
      setErrorMsg((p) => ({ ...p, [vars.id]: '' }));
    },
    onError: (e: any, vars) => {
      setErrorMsg((p) => ({ ...p, [vars.id]: e.response?.data?.message || 'Failed to post comment.' }));
    },
  });

  const deleteComment = useMutation({
    mutationFn: ({ reportId, commentId }: { reportId: number; commentId: number }) =>
      api.delete(`/client/report-cards/${reportId}/comments/${commentId}`),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['client-report-cards'] });
      setErrorMsg((p) => ({ ...p, [vars.reportId]: '' }));
    },
    onError: (e: any, vars) => {
      setErrorMsg((p) => ({ ...p, [vars.reportId]: e.response?.data?.message || 'Failed to delete comment.' }));
    },
  });

  const submitChange = useMutation({
    mutationFn: ({ id, change_request }: { id: number; change_request: string }) =>
      api.post(`/client/report-cards/${id}/change-request`, { change_request }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['client-report-cards'] });
      setSuccessMsg((p) => ({ ...p, [vars.id]: 'Change request submitted. Your walker has been notified.' }));
      setTimeout(() => setSuccessMsg((p) => ({ ...p, [vars.id]: '' })), 4000);
      setErrorMsg((p) => ({ ...p, [vars.id]: '' }));
    },
    onError: (e: any, vars) => {
      setErrorMsg((p) => ({ ...p, [vars.id]: e.response?.data?.message || 'Failed to submit change request.' }));
    },
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

            const photoPaths: string[] = r.photo_paths ?? [];
            const photoCount = photoPaths.length > 0 ? photoPaths.length : r.report_photo_path ? 1 : 0;

            const comments: any[] = r.comments ?? [];
            const draft = commentDraft[r.id] ?? '';
            const change = changeDraft[r.id] ?? '';
            const hasChangeRequest = !!r.change_request;

            return (
              <Card key={r.id} padding="sm">
                {/* Header row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : r.id)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div className="font-semibold text-espresso text-sm">
                    {format(new Date(r.arrival_time ?? r.sent_at), 'EEEE, MMMM d, yyyy')} | Visit Report
                  </div>
                  <span className="text-taupe text-lg">{isExpanded ? '▲' : '▼'}</span>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="mt-4 space-y-4 border-t border-cream pt-4">
                    {/* Photos */}
                    {photoCount > 0 && (
                      <div className={photoCount > 1 ? 'grid grid-cols-2 gap-2' : ''}>
                        {Array.from({ length: photoCount }).map((_, i) => (
                          <ReportPhoto key={i} reportId={r.id} index={i} />
                        ))}
                      </div>
                    )}

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
                        <div className="text-[10px] text-taupe uppercase tracking-wide mb-2">Activities & Care</div>
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

                    {/* Walker notes */}
                    {r.notes && (
                      <div>
                        <div className="text-[10px] text-taupe uppercase tracking-wide mb-1">Walker's Notes</div>
                        <p className="text-sm text-espresso leading-relaxed">{r.notes}</p>
                      </div>
                    )}

                    {/* Dog-specific data */}
                    {r.dog_data && Array.isArray(r.dog_data) && r.dog_data.length > 0 && (
                      <div className="space-y-3">
                        {r.dog_data.map((dd: any, i: number) => (
                          <div key={i} className="bg-cream/60 rounded-lg p-3">
                            <div className="font-medium text-sm text-espresso mb-1">{dd.name}</div>
                            {dd.checklist && (
                              <div className="flex flex-wrap gap-1 mb-1">
                                {Object.entries(dd.checklist as Record<string, boolean>)
                                  .filter(([, v]) => v)
                                  .map(([k]) => (
                                    <span key={k} className="inline-flex items-center gap-1 bg-white text-espresso text-xs px-2 py-0.5 rounded-full">
                                      <span className="w-1 h-1 rounded-full bg-gold" />
                                      {k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                    </span>
                                  ))}
                              </div>
                            )}
                            {dd.notes && <p className="text-xs text-taupe">{dd.notes}</p>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Error display */}
                    {errorMsg[r.id] && (
                      <p className="text-sm text-red-600">{errorMsg[r.id]}</p>
                    )}

                    {/* ── Comments ── */}
                    <div className="border-t border-cream pt-4 space-y-3">
                      <div className="text-[10px] text-taupe uppercase tracking-wide">Comments</div>

                      {/* Existing comments */}
                      {comments.length > 0 && (
                        <div className="space-y-2">
                          {comments.map((c: any) => (
                            <div key={c.id} className="bg-cream/60 rounded-lg px-3 py-2">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-espresso">{c.user?.name ?? 'Unknown'}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-taupe">
                                    {format(new Date(c.created_at), 'MMM d, h:mm a')}
                                  </span>
                                  {c.user_id === user?.id && (
                                    <button
                                      onClick={() => deleteComment.mutate({ reportId: r.id, commentId: c.id })}
                                      className="text-[10px] text-red-400 hover:text-red-600"
                                    >
                                      Delete
                                    </button>
                                  )}
                                </div>
                              </div>
                              <p className="text-sm text-espresso">{c.body}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* New comment */}
                      <div className="flex gap-2">
                        <Textarea
                          rows={1}
                          value={draft}
                          onChange={(e) => setCommentDraft((p) => ({ ...p, [r.id]: e.target.value }))}
                          placeholder="Leave a comment..."
                          className="flex-1"
                        />
                        <Button
                          size="sm"
                          loading={postComment.isPending}
                          disabled={!draft.trim()}
                          onClick={() => postComment.mutate({ id: r.id, body: draft.trim() })}
                        >
                          Post
                        </Button>
                      </div>
                    </div>

                    {/* ── Change Request ── */}
                    <div className="border-t border-cream pt-4 space-y-2">
                      <div className="text-[10px] text-taupe uppercase tracking-wide">
                        Anything you want to change moving forward?
                      </div>

                      {hasChangeRequest ? (
                        <div className="bg-cream/60 rounded-lg px-3 py-2">
                          <p className="text-sm text-espresso">{r.change_request}</p>
                          <p className="text-[10px] text-taupe mt-1">Your walker has been notified.</p>
                        </div>
                      ) : (
                        <>
                          <Textarea
                            rows={2}
                            value={change}
                            onChange={(e) => setChangeDraft((p) => ({ ...p, [r.id]: e.target.value }))}
                            placeholder="e.g. shorter walks, different route, more playtime..."
                          />
                          {change.trim() && (
                            <p className="text-xs text-taupe">
                              Your walker will be notified of this request in your messages.
                            </p>
                          )}
                          {successMsg[r.id] && (
                            <div className="bg-green-50 text-green-700 text-sm rounded-lg px-4 py-2 font-medium">
                              {successMsg[r.id]}
                            </div>
                          )}
                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              loading={submitChange.isPending}
                              disabled={!change.trim()}
                              onClick={() => submitChange.mutate({ id: r.id, change_request: change.trim() })}
                            >
                              Submit
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
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
