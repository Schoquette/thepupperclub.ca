import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import MessageBubble from '@/components/shared/MessageBubble';

const QUICK_EMOJIS = ['😊', '❤️', '😂', '😢', '🙏', '👍', '🎉', '🐾'];

export default function ClientMessagesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBody, setEditBody] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['client-conversation'],
    queryFn: () => api.get(`/conversations/${user?.id}`).then((r) => r.data),
    refetchInterval: 5_000,
    enabled: !!user?.id,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [data]);

  // Close emoji picker on outside click
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handler = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmojiPicker]);

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

  const editMsg = useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) =>
      api.patch(`/messages/${id}`, { body }),
    onSuccess: () => {
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ['client-conversation'] });
    },
  });

  const deleteMsg = useMutation({
    mutationFn: (id: number) => api.delete(`/messages/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['client-conversation'] }),
  });

  const reactMsg = useMutation({
    mutationFn: ({ id, emoji }: { id: number; emoji: string }) =>
      api.post(`/messages/${id}/reactions`, { emoji }),
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

  const insertEmoji = (emoji: string) => {
    const ta = textareaRef.current;
    if (ta) {
      const start = ta.selectionStart ?? text.length;
      const end   = ta.selectionEnd ?? text.length;
      setText(prev => prev.slice(0, start) + emoji + prev.slice(end));
      // Restore focus + cursor after React re-render
      setTimeout(() => {
        ta.focus();
        ta.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    } else {
      setText(prev => prev + emoji);
    }
    setShowEmojiPicker(false);
  };

  const startEdit = (msg: any) => {
    setEditingId(msg.id);
    setEditBody(msg.body ?? '');
  };

  const confirmDelete = (msg: any) => {
    if (window.confirm('Delete this message?')) deleteMsg.mutate(msg.id);
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
        {data?.data?.map((msg: any) =>
          editingId === msg.id ? (
            <div key={msg.id} className="flex justify-end">
              <div className="max-w-[75%] w-full space-y-1">
                <textarea
                  rows={2}
                  className="w-full border border-gold rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gold/30"
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <button
                    className="text-xs text-taupe hover:text-espresso"
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </button>
                  <Button
                    size="sm"
                    loading={editMsg.isPending}
                    onClick={() => editMsg.mutate({ id: msg.id, body: editBody })}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <MessageBubble
              key={msg.id}
              message={msg}
              currentUserId={user?.id ?? 0}
              onEdit={startEdit}
              onDelete={confirmDelete}
              onReact={(id, emoji) => reactMsg.mutate({ id, emoji })}
            />
          )
        )}
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

        {/* Emoji picker */}
        <div className="relative" ref={emojiPickerRef}>
          <button
            className="text-taupe hover:text-gold transition-colors text-xl px-1"
            title="Emoji"
            onClick={() => setShowEmojiPicker(v => !v)}
          >
            😊
          </button>
          {showEmojiPicker && (
            <div className="absolute bottom-10 left-0 bg-white rounded-xl shadow-lg border border-cream p-2 grid grid-cols-4 gap-1 z-20">
              {QUICK_EMOJIS.map(e => (
                <button
                  key={e}
                  className="text-xl hover:bg-cream rounded p-1 transition-colors"
                  onClick={() => insertEmoji(e)}
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>

        <textarea
          ref={textareaRef}
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
