import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { useAuth } from '@/contexts/AuthContext';
import MessageBubble from '@/components/shared/MessageBubble';

const QUICK_EMOJIS = [
  '😊', '😂', '❤️', '🥰', '😢', '😮', '🙏', '👍',
  '👎', '🎉', '🐾', '🐶', '😅', '💪', '🔥', '✨',
];

export default function AdminConversationPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
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
    queryKey: ['conversation', clientId],
    queryFn: () => api.get(`/conversations/${clientId}`).then((r) => r.data),
    refetchInterval: 5_000,
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
    mutationFn: () => api.post(`/conversations/${clientId}/messages`, { body: text }),
    onSuccess: () => {
      setText('');
      qc.invalidateQueries({ queryKey: ['conversation', clientId] });
      qc.invalidateQueries({ queryKey: ['admin-inbox'] });
    },
  });

  const sendPhoto = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('photo', file);
      return api.post(`/conversations/${clientId}/photo`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversation', clientId] });
      qc.invalidateQueries({ queryKey: ['admin-inbox'] });
    },
  });

  const editMsg = useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) =>
      api.patch(`/messages/${id}`, { body }),
    onSuccess: () => {
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ['conversation', clientId] });
    },
  });

  const deleteMsg = useMutation({
    mutationFn: (id: number) => api.delete(`/messages/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversation', clientId] }),
  });

  const reactMsg = useMutation({
    mutationFn: ({ id, emoji }: { id: number; emoji: string }) =>
      api.post(`/messages/${id}/reactions`, { emoji }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversation', clientId] }),
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
    <div className="flex flex-col h-[calc(100vh-2rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate('/admin/inbox')} className="text-taupe hover:text-espresso">
          ←
        </button>
        <div>
          <h1 className="page-title text-lg">Conversation</h1>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-4">
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
      <div className="flex gap-3 bg-white rounded-xl shadow-card p-3 mt-2">
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
            <div className="absolute bottom-full left-0 mb-1 bg-white rounded-xl shadow-lg border border-cream p-2 grid grid-cols-8 gap-0.5 z-20">
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
          placeholder="Type a message..."
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
