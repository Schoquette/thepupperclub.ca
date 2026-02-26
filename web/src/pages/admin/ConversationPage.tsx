import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useQuery as useRouterQuery } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import MessageBubble from '@/components/shared/MessageBubble';

export default function AdminConversationPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef(0);

  const { data, isLoading } = useQuery({
    queryKey: ['conversation', clientId],
    queryFn: () =>
      api.get(`/conversations/${clientId}`, {
        params: { since: lastIdRef.current },
      }).then(r => {
        const msgs = r.data.data;
        if (msgs.length) lastIdRef.current = msgs[msgs.length - 1].id;
        return r.data;
      }),
    refetchInterval: 5_000,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [data]);

  const send = useMutation({
    mutationFn: () => api.post(`/conversations/${clientId}/messages`, { body: text }),
    onSuccess: () => {
      setText('');
      qc.invalidateQueries({ queryKey: ['conversation', clientId] });
    },
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (text.trim()) send.mutate();
    }
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate('/admin/inbox')} className="text-taupe hover:text-espresso">←</button>
        <div>
          <h1 className="page-title text-lg">Conversation</h1>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-4">
        {data?.data?.map((msg: any) => (
          <MessageBubble key={msg.id} message={msg} currentUserId={user?.id ?? 0} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-3 bg-white rounded-xl shadow-card p-3 mt-2">
        <textarea
          rows={2}
          className="flex-1 resize-none border-0 focus:outline-none text-sm text-espresso placeholder-taupe"
          placeholder="Type a message..."
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Button
          size="sm"
          disabled={!text.trim()}
          loading={send.isPending}
          onClick={() => send.mutate()}
        >
          Send
        </Button>
      </div>
    </div>
  );
}
