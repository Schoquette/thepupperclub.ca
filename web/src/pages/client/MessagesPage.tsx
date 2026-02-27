import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import MessageBubble from '@/components/shared/MessageBubble';

export default function ClientMessagesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['client-conversation'],
    queryFn: () =>
      api.get(`/conversations/${user?.id}`).then((r) => r.data),
    refetchInterval: 5_000,
    enabled: !!user?.id,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [data]);

  const send = useMutation({
    mutationFn: () => api.post(`/conversations/${user?.id}/messages`, { body: text }),
    onSuccess: () => {
      setText('');
      qc.invalidateQueries({ queryKey: ['client-conversation'] });
    },
  });

  const sendPhoto = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('photo', file);
      return api.post(`/conversations/${user?.id}/photo`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['client-conversation'] }),
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (text.trim()) send.mutate();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) sendPhoto.mutate(file);
    e.target.value = '';
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 12rem)' }}>
      <h1 className="font-display text-xl text-espresso mb-4">Messages</h1>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {!data?.data?.length && (
          <div className="text-center py-12">
            <div className="text-4xl mb-2">🐾</div>
            <p className="text-taupe text-sm">No messages yet. Say hi to Sophie!</p>
          </div>
        )}
        {data?.data?.map((msg: any) => (
          <MessageBubble key={msg.id} message={msg} currentUserId={user?.id ?? 0} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 mt-3 bg-white rounded-xl shadow-card p-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          className="text-taupe hover:text-gold transition-colors text-xl px-1"
          title="Send a photo"
          onClick={() => fileInputRef.current?.click()}
          disabled={sendPhoto.isPending}
        >
          {sendPhoto.isPending ? '⏳' : '📷'}
        </button>
        <textarea
          rows={2}
          className="flex-1 resize-none border-0 focus:outline-none text-sm text-espresso placeholder-taupe"
          placeholder="Type a message to Sophie..."
          value={text}
          onChange={(e) => setText(e.target.value)}
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
