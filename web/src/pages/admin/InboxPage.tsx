import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { formatDistanceToNow } from 'date-fns';

export default function AdminInboxPage() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-inbox'],
    queryFn: () => api.get('/admin/conversations').then(r => r.data),
    refetchInterval: 10_000,
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <h1 className="page-title">Messages</h1>

      <Card padding="none">
        {data?.data?.length === 0 && (
          <p className="text-center py-12 text-taupe">No conversations yet.</p>
        )}
        <div className="divide-y divide-cream">
          {data?.data?.map((conv: any) => (
            <div
              key={conv.id}
              className="flex items-center gap-4 px-6 py-4 hover:bg-cream/50 cursor-pointer transition-colors"
              onClick={() => navigate(`/admin/inbox/${conv.user_id}`)}
            >
              <div className="h-10 w-10 rounded-full bg-gold flex items-center justify-center text-white font-bold flex-shrink-0">
                {conv.user?.name?.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-espresso text-sm">{conv.user?.name}</span>
                  {conv.unread_count_admin > 0 && (
                    <Badge variant="gold">{conv.unread_count_admin}</Badge>
                  )}
                  <span className={`text-xs ml-auto ${
                    conv.status === 'needs_follow_up' ? 'text-red-500' :
                    conv.status === 'resolved' ? 'text-green-600' : 'text-taupe'
                  }`}>
                    {conv.status?.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-sm text-taupe truncate mt-0.5">
                  {conv.last_message?.body || 'No messages yet'}
                </p>
              </div>
              <div className="text-xs text-taupe flex-shrink-0">
                {conv.last_message_at
                  ? formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true })
                  : ''}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
