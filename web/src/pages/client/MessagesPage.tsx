import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import MessageBubble from '@/components/shared/MessageBubble';
import { format, isToday, isYesterday } from 'date-fns';

function DateSeparator({ date }: { date: Date }) {
  let label: string;
  if (isToday(date)) label = 'Today';
  else if (isYesterday(date)) label = 'Yesterday';
  else label = format(date, 'EEEE, MMMM d, yyyy');

  return (
    <div className="flex justify-center my-2">
      <span className="text-[11px] text-taupe bg-cream/70 px-3 py-0.5 rounded-full">
        {label}
      </span>
    </div>
  );
}

const QUICK_EMOJIS = [
  '😊', '😂', '❤️', '🥰', '😢', '😮', '🙏', '👍',
  '👎', '🎉', '🐾', '🐶', '😅', '💪', '🔥', '✨',
];

export default function ClientMessagesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const msgContainerRef = useRef<HTMLDivElement>(null);

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBody, setEditBody] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Reply state
  const [replyTo, setReplyTo] = useState<{ id: number; sender?: { name: string }; body: string | null; type: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['client-conversation'],
    queryFn: () => api.get(`/conversations/${user?.id}`).then((r) => r.data),
    refetchInterval: 5_000,
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!searchOpen) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [data, searchOpen]);

  // Compute search matches
  const searchMatches: number[] = React.useMemo(() => {
    if (!searchQuery.trim() || !data?.data) return [];
    const q = searchQuery.toLowerCase();
    return data.data
      .map((msg: any, i: number) => (msg.body?.toLowerCase().includes(q) ? i : -1))
      .filter((i: number) => i >= 0);
  }, [searchQuery, data]);

  useEffect(() => {
    if (searchMatches.length > 0 && msgContainerRef.current) {
      const idx = searchMatches[searchIndex] ?? searchMatches[0];
      const el = msgContainerRef.current.querySelector(`[data-msg-index="${idx}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [searchIndex, searchMatches]);

  const toggleSearch = () => {
    if (searchOpen) {
      setSearchOpen(false);
      setSearchQuery('');
      setSearchIndex(0);
    } else {
      setSearchOpen(true);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  };

  const send = useMutation({
    mutationFn: () => api.post(`/conversations/${user?.id}/messages`, {
      body: text,
      reply_to_id: replyTo?.id ?? null,
    }),
    onSuccess: () => {
      setText('');
      setReplyTo(null);
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

  const confirmUnsend = (msg: any) => {
    if (window.confirm('Unsend this message? It will be removed for everyone.')) deleteMsg.mutate(msg.id);
  };

  const startReply = (msg: any) => {
    setReplyTo({ id: msg.id, sender: msg.sender, body: msg.body, type: msg.type });
    textareaRef.current?.focus();
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 12rem)' }}>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-xl text-white">Messages</h1>
        <button
          onClick={toggleSearch}
          className={`p-1.5 rounded-lg transition-colors ${searchOpen ? 'bg-gold/10 text-gold' : 'text-taupe hover:text-espresso hover:bg-cream'}`}
          title="Search messages"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </button>
      </div>

      {searchOpen && (
        <div className="flex items-center gap-2 bg-white shadow-card rounded-xl px-3 py-2 mb-3">
          <svg className="w-4 h-4 text-taupe flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            className="flex-1 text-sm border-0 focus:outline-none text-espresso placeholder-taupe"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setSearchIndex(0); }}
            onKeyDown={e => {
              if (e.key === 'Enter' && searchMatches.length > 1) {
                setSearchIndex(i => (i + 1) % searchMatches.length);
              } else if (e.key === 'Escape') {
                toggleSearch();
              }
            }}
          />
          {searchQuery && (
            <span className="text-xs text-taupe whitespace-nowrap">
              {searchMatches.length > 0 ? `${searchIndex + 1} of ${searchMatches.length}` : 'No results'}
            </span>
          )}
          {searchMatches.length > 1 && (
            <div className="flex gap-0.5">
              <button onClick={() => setSearchIndex(i => (i - 1 + searchMatches.length) % searchMatches.length)} className="text-taupe hover:text-espresso p-0.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>
              </button>
              <button onClick={() => setSearchIndex(i => (i + 1) % searchMatches.length)} className="text-taupe hover:text-espresso p-0.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
              </button>
            </div>
          )}
          <button onClick={toggleSearch} className="text-taupe hover:text-espresso p-0.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Messages */}
      <div ref={msgContainerRef} className="flex-1 overflow-y-auto space-y-3 pr-1">
        {!data?.data?.length && (
          <div className="text-center py-12">
            <div className="text-4xl mb-2">🐾</div>
            <p className="text-taupe text-sm">No messages yet. Say hi to Sophie!</p>
          </div>
        )}
        {data?.data?.map((msg: any, i: number) => {
          const msgDate = new Date(msg.created_at);
          const prevDate = i > 0 ? new Date(data.data[i - 1].created_at) : null;
          const showDate = !prevDate || msgDate.toDateString() !== prevDate.toDateString();

          const isMatch = searchQuery && searchMatches.includes(i);
          const isCurrentMatch = isMatch && searchMatches[searchIndex] === i;

          return (
            <React.Fragment key={msg.id}>
              {showDate && <DateSeparator date={msgDate} />}
              {editingId === msg.id ? (
                <div className="flex justify-end">
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
                <div
                  data-msg-index={i}
                  className={`transition-colors rounded-xl ${isCurrentMatch ? 'bg-gold/20 ring-2 ring-gold/40' : isMatch ? 'bg-gold/10' : ''}`}
                >
                  <MessageBubble
                    message={msg}
                    currentUserId={user?.id ?? 0}
                    onEdit={startEdit}
                    onDelete={confirmDelete}
                    onUnsend={confirmUnsend}
                    onReact={(id, emoji) => reactMsg.mutate({ id, emoji })}
                    onReply={startReply}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Reply preview banner */}
      {replyTo && (
        <div className="flex items-center gap-2 bg-cream/60 border-l-2 border-gold rounded-t-xl px-4 py-2 -mb-1">
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-espresso truncate">
              Replying to {replyTo.sender?.name ?? 'message'}
            </div>
            <div className="text-xs text-taupe truncate">
              {replyTo.type === 'photo' ? '📷 Photo' : (replyTo.body ?? '').slice(0, 60)}
            </div>
          </div>
          <button
            onClick={() => setReplyTo(null)}
            className="text-taupe hover:text-espresso text-lg leading-none"
          >
            &times;
          </button>
        </div>
      )}

      {/* Input */}
      <div className={`flex items-center gap-2 bg-white shadow-card p-3 ${replyTo ? 'rounded-b-xl' : 'rounded-xl mt-3'}`}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          className="text-taupe hover:text-gold transition-colors p-1.5 rounded hover:bg-cream"
          title="Send a photo"
          onClick={() => fileInputRef.current?.click()}
          disabled={sendPhoto.isPending}
        >
          {sendPhoto.isPending ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21zM10.5 8.25a1.125 1.125 0 11-2.25 0 1.125 1.125 0 012.25 0z" />
            </svg>
          )}
        </button>

        {/* Emoji picker */}
        <button
          className="text-taupe hover:text-gold transition-colors p-1.5 rounded hover:bg-cream"
          title="Emoji"
          onClick={() => setShowEmojiPicker(v => !v)}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
          </svg>
        </button>
        {showEmojiPicker && ReactDOM.createPortal(
          <div
            className="fixed inset-0 z-50 flex items-end justify-center pb-24 sm:items-center sm:pb-0"
            onClick={() => setShowEmojiPicker(false)}
          >
            <div className="absolute inset-0 bg-black/20" />
            <div
              className="relative bg-white rounded-2xl shadow-2xl border border-cream p-3 grid grid-cols-8 gap-1"
              onClick={e => e.stopPropagation()}
            >
              {QUICK_EMOJIS.map(e => (
                <button
                  key={e}
                  className="text-2xl hover:scale-110 active:scale-95 rounded p-1.5 hover:bg-cream transition-all"
                  onClick={() => insertEmoji(e)}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}

        <textarea
          ref={textareaRef}
          rows={1}
          className="flex-1 resize-none border-0 focus:outline-none text-sm text-espresso placeholder-taupe self-center"
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
