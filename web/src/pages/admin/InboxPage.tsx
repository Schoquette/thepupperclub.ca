import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { formatDistanceToNow } from 'date-fns';

function ConversationRow({ conv, onClick }: { conv: any; onClick: () => void }) {
  const isUnread = conv.unread_count_admin > 0;
  return (
    <div
      className={`flex items-center gap-4 px-6 py-4 hover:bg-cream/50 cursor-pointer transition-colors ${isUnread ? 'bg-gold/5' : ''}`}
      onClick={onClick}
    >
      <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${isUnread ? 'bg-gold' : 'bg-taupe/60'}`}>
        {conv.user?.name?.charAt(0) || '?'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm ${isUnread ? 'font-bold text-espresso' : 'font-semibold text-espresso'}`}>{conv.user?.name || conv.user?.email || `Client #${conv.user_id}`}</span>
          {isUnread && (
            <Badge variant="gold">{conv.unread_count_admin}</Badge>
          )}
          <span className={`text-xs ml-auto ${
            conv.status === 'needs_follow_up' ? 'text-red-500' :
            conv.status === 'resolved' ? 'text-green-600' : 'text-taupe'
          }`}>
            {conv.status?.replace('_', ' ')}
          </span>
        </div>
        <p className={`text-sm truncate mt-0.5 ${isUnread ? 'text-espresso font-medium' : 'text-taupe'}`}>
          {conv.last_message?.body || 'No messages yet'}
        </p>
      </div>
      <div className="text-xs text-taupe flex-shrink-0">
        {conv.last_message_at
          ? formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true })
          : ''}
      </div>
    </div>
  );
}

export default function AdminInboxPage() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-inbox'],
    queryFn: () => api.get('/admin/conversations').then(r => r.data),
    refetchInterval: 10_000,
  });

  const { unread, read } = useMemo(() => {
    const all: any[] = data?.data ?? [];
    // Sort by most recent first
    const sorted = [...all].sort((a, b) => {
      const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return tb - ta;
    });
    return {
      unread: sorted.filter((c: any) => c.unread_count_admin > 0),
      read: sorted.filter((c: any) => !c.unread_count_admin || c.unread_count_admin === 0),
    };
  }, [data]);

  if (isLoading) return <PageLoader />;

  const isEmpty = unread.length === 0 && read.length === 0;

  return (
    <div className="space-y-6">
      <h1 className="page-title">Messages</h1>

      {isEmpty && (
        <Card>
          <p className="text-center py-12 text-taupe">No conversations yet.</p>
        </Card>
      )}

      {unread.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gold uppercase tracking-wide mb-2 px-1">
            Unread ({unread.length})
          </h2>
          <Card padding="none">
            <div className="divide-y divide-cream">
              {unread.map((conv: any) => (
                <ConversationRow key={conv.id} conv={conv} onClick={() => navigate(`/admin/inbox/${conv.user_id}`)} />
              ))}
            </div>
          </Card>
        </div>
      )}

      {read.length > 0 && (
        <div>
          {unread.length > 0 && (
            <h2 className="text-xs font-semibold text-taupe uppercase tracking-wide mb-2 px-1">
              Read
            </h2>
          )}
          <Card padding="none">
            <div className="divide-y divide-cream">
              {read.map((conv: any) => (
                <ConversationRow key={conv.id} conv={conv} onClick={() => navigate(`/admin/inbox/${conv.user_id}`)} />
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
