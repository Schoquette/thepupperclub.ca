import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { useAuth } from '@/contexts/AuthContext';
import MessageBubble from '@/components/shared/MessageBubble';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { Search, SquarePen, ArrowLeft, Image, SmilePlus, X, CreditCard, FileText, ChevronRight, ExternalLink, Clock, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Link } from 'react-router-dom';

/* ── Date separator ─────────────────────────────────────────────────── */
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

/* ── Main component ─────────────────────────────────────────────────── */
export default function AdminInboxPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  // Chat list search
  const [search, setSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Mobile: show conversation panel
  const [mobileShowChat, setMobileShowChat] = useState(!!clientId);

  useEffect(() => {
    setMobileShowChat(!!clientId);
  }, [clientId]);

  /* ── Inbox data ──────────────────────────────────────────────────── */
  const { data: inboxData, isLoading: inboxLoading } = useQuery({
    queryKey: ['admin-inbox'],
    queryFn: () => api.get('/admin/conversations').then(r => r.data),
    refetchInterval: 10_000,
  });

  const conversations: any[] = useMemo(() => {
    const all: any[] = inboxData?.data ?? [];
    return [...all].sort((a, b) => {
      const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return tb - ta;
    });
  }, [inboxData]);

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c: any) => {
      const clientName = (c.user?.name ?? '').toLowerCase();
      const dogNames = (c.user?.dogs ?? []).map((d: any) => d.name.toLowerCase()).join(' ');
      return clientName.includes(q) || dogNames.includes(q);
    });
  }, [conversations, search]);

  /* ── Clients list for new message ────────────────────────────────── */
  const { data: clientsData } = useQuery({
    queryKey: ['admin-clients-for-inbox'],
    queryFn: () => api.get('/admin/clients').then(r => r.data),
  });

  const existingUserIds = useMemo(
    () => new Set(conversations.map((c: any) => c.user_id)),
    [conversations],
  );

  // When searching, also show clients without conversations that match
  const newMsgMatches = useMemo(() => {
    if (!search.trim()) return [];
    const all: any[] = clientsData?.data ?? [];
    const q = search.toLowerCase();
    return all
      .filter((c: any) => !existingUserIds.has(c.id))
      .filter((c: any) => {
        const name = (c.name ?? '').toLowerCase();
        const dogs = (c.dogs ?? []).map((d: any) => d.name.toLowerCase()).join(' ');
        return name.includes(q) || dogs.includes(q);
      });
  }, [clientsData, search, existingUserIds]);

  /* ── Conversation data ───────────────────────────────────────────── */
  const [text, setText] = useState('');
  const [chatError, setChatError] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBody, setEditBody] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: number; sender?: { name: string }; body: string | null; type: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const msgContainerRef = useRef<HTMLDivElement>(null);

  // Billing sidebar
  const [billingOpen, setBillingOpen] = useState(false);

  // In-conversation search
  const [msgSearchOpen, setMsgSearchOpen] = useState(false);
  const [msgSearchQuery, setMsgSearchQuery] = useState('');
  const [msgSearchIndex, setMsgSearchIndex] = useState(0);
  const msgSearchInputRef = useRef<HTMLInputElement>(null);

  const { data: convData, isLoading: convLoading, error: convError } = useQuery({
    queryKey: ['conversation', clientId],
    queryFn: () => api.get(`/conversations/${clientId}`).then(r => r.data),
    refetchInterval: 5_000,
    retry: 2,
    enabled: !!clientId,
  });

  // Billing data for selected client
  const { data: invoicesData } = useQuery<any>({
    queryKey: ['client-invoices', clientId],
    queryFn: () => api.get('/admin/invoices', { params: { user_id: clientId } }).then(r => r.data),
    enabled: !!clientId && billingOpen,
  });

  const { data: serviceReqData } = useQuery<any>({
    queryKey: ['client-service-requests', clientId],
    queryFn: () => api.get('/admin/service-requests').then(r => r.data),
    enabled: !!clientId && billingOpen,
  });

  const clientInvoices = useMemo(() => {
    const all: any[] = invoicesData?.data ?? [];
    const upcoming = all.filter((inv: any) => ['draft', 'sent'].includes(inv.status));
    const overdue = all.filter((inv: any) => inv.status === 'overdue');
    const past = all.filter((inv: any) => ['paid', 'void'].includes(inv.status));
    return { upcoming, overdue, past };
  }, [invoicesData]);

  const clientServiceRequests = useMemo(() => {
    const all: any[] = serviceReqData?.data ?? [];
    return all.filter((sr: any) => String(sr.user_id) === clientId && ['pending', 'counter_offered'].includes(sr.status));
  }, [serviceReqData, clientId]);

  useEffect(() => {
    if (!msgSearchOpen) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [convData, msgSearchOpen]);

  // Reset state when switching conversations
  useEffect(() => {
    setText('');
    setReplyTo(null);
    setChatError('');
    setEditingId(null);
    setMsgSearchOpen(false);
    setMsgSearchQuery('');
    setBillingOpen(false);
  }, [clientId]);

  const msgSearchMatches: number[] = useMemo(() => {
    if (!msgSearchQuery.trim() || !convData?.data) return [];
    const q = msgSearchQuery.toLowerCase();
    return convData.data
      .map((msg: any, i: number) => (msg.body?.toLowerCase().includes(q) ? i : -1))
      .filter((i: number) => i >= 0);
  }, [msgSearchQuery, convData]);

  useEffect(() => {
    if (msgSearchMatches.length > 0 && msgContainerRef.current) {
      const idx = msgSearchMatches[msgSearchIndex] ?? msgSearchMatches[0];
      const el = msgContainerRef.current.querySelector(`[data-msg-index="${idx}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [msgSearchIndex, msgSearchMatches]);

  /* ── Mutations ───────────────────────────────────────────────────── */
  const send = useMutation({
    mutationFn: () => api.post(`/conversations/${clientId}/messages`, {
      body: text,
      reply_to_id: replyTo?.id ?? null,
    }),
    onSuccess: () => {
      setText('');
      setReplyTo(null);
      setChatError('');
      qc.invalidateQueries({ queryKey: ['conversation', clientId] });
      qc.invalidateQueries({ queryKey: ['admin-inbox'] });
    },
    onError: (e: any) => setChatError(e.response?.data?.message || 'Failed to send message.'),
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
      setChatError('');
      qc.invalidateQueries({ queryKey: ['conversation', clientId] });
      qc.invalidateQueries({ queryKey: ['admin-inbox'] });
    },
    onError: (e: any) => setChatError(e.response?.data?.message || 'Failed to send photo.'),
  });

  const editMsg = useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) =>
      api.patch(`/messages/${id}`, { body }),
    onSuccess: () => {
      setEditingId(null);
      setChatError('');
      qc.invalidateQueries({ queryKey: ['conversation', clientId] });
    },
    onError: (e: any) => setChatError(e.response?.data?.message || 'Failed to edit message.'),
  });

  const deleteMsg = useMutation({
    mutationFn: (id: number) => api.delete(`/messages/${id}`),
    onSuccess: () => { setChatError(''); qc.invalidateQueries({ queryKey: ['conversation', clientId] }); },
    onError: (e: any) => setChatError(e.response?.data?.message || 'Failed to delete message.'),
  });

  const reactMsg = useMutation({
    mutationFn: ({ id, emoji }: { id: number; emoji: string }) =>
      api.post(`/messages/${id}/reactions`, { emoji }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversation', clientId] }),
  });

  /* ── Handlers ────────────────────────────────────────────────────── */
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
      const end = ta.selectionEnd ?? text.length;
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

  const selectConversation = (userId: number) => {
    navigate(`/admin/inbox/${userId}`);
    setSearch('');
  };

  // Find current conversation metadata
  const activeConv = conversations.find((c: any) => String(c.user_id) === clientId);
  const activeName = activeConv?.user?.name ?? '';
  const activeDogs = (activeConv?.user?.dogs ?? []).map((d: any) => d.name).join(', ');

  /* ── Render ──────────────────────────────────────────────────────── */
  return (
    <div className="-mx-4 md:-mx-6 -my-6 md:-my-8 flex h-[calc(100vh-3.5rem)] md:h-screen">
      {/* ─── LEFT PANEL: Chat list ─────────────────────────────────── */}
      <div className={`${clientId && mobileShowChat ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 lg:w-96 border-r border-cream bg-white flex-shrink-0`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-cream">
          <h1 className="font-display text-lg text-espresso tracking-wide">Messages</h1>
          <button
            onClick={() => { setSearch(''); setTimeout(() => searchInputRef.current?.focus(), 50); }}
            className="p-2 rounded-lg text-taupe hover:text-gold hover:bg-cream transition-colors"
            title="New message"
          >
            <SquarePen className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 bg-cream/60 rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-taupe flex-shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              className="flex-1 bg-transparent text-sm text-espresso placeholder-taupe focus:outline-none"
              placeholder="Search clients or dogs..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-taupe hover:text-espresso">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {inboxLoading ? (
            <div className="flex justify-center py-12">
              <PageLoader />
            </div>
          ) : filtered.length === 0 && newMsgMatches.length === 0 ? (
            <p className="text-center py-12 text-taupe text-sm">
              {search ? 'No matching conversations' : 'No conversations yet'}
            </p>
          ) : (
            <>
              {filtered.map((conv: any) => {
                const isActive = String(conv.user_id) === clientId;
                const isUnread = conv.unread_count_admin > 0;
                const dogNames = (conv.user?.dogs ?? []).map((d: any) => d.name).join(', ');

                return (
                  <button
                    key={conv.id}
                    onClick={() => selectConversation(conv.user_id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-cream/50 ${
                      isActive
                        ? 'bg-gold/10 border-l-2 border-l-gold'
                        : isUnread
                          ? 'bg-gold/5 hover:bg-cream/50'
                          : 'hover:bg-cream/30'
                    }`}
                  >
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${isUnread ? 'bg-gold' : 'bg-taupe/50'}`}>
                      {conv.user?.name?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm truncate ${isUnread ? 'font-bold text-espresso' : 'font-medium text-espresso'}`}>
                          {conv.user?.name || `Client #${conv.user_id}`}
                        </span>
                        {isUnread && (
                          <Badge variant="gold">{conv.unread_count_admin}</Badge>
                        )}
                      </div>
                      {dogNames && (
                        <div className="text-xs text-gold/80 truncate">{dogNames}</div>
                      )}
                      <p className={`text-xs truncate mt-0.5 ${isUnread ? 'text-espresso' : 'text-taupe'}`}>
                        {conv.last_message?.body || 'No messages yet'}
                      </p>
                    </div>
                    <div className="text-[10px] text-taupe flex-shrink-0 self-start mt-1">
                      {conv.last_message_at
                        ? formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true })
                        : ''}
                    </div>
                  </button>
                );
              })}

              {/* New conversation matches (clients without existing conversations) */}
              {newMsgMatches.length > 0 && (
                <>
                  <div className="px-4 py-2 bg-gold/5 border-b border-cream/50">
                    <span className="text-[10px] font-semibold text-gold uppercase tracking-wide">Start New Conversation</span>
                  </div>
                  {newMsgMatches.map((c: any) => {
                    const dogNames = (c.dogs ?? []).map((d: any) => d.name).join(', ');
                    return (
                      <button
                        key={`new-${c.id}`}
                        onClick={() => selectConversation(c.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-cream/50 hover:bg-cream/30"
                      >
                        <div className="h-10 w-10 rounded-full flex items-center justify-center text-espresso font-bold text-sm flex-shrink-0 bg-taupe/20 border border-dashed border-taupe/40">
                          {c.name?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-espresso truncate block">{c.name}</span>
                          {dogNames && (
                            <div className="text-xs text-gold/80 truncate">{dogNames}</div>
                          )}
                          <p className="text-xs text-taupe mt-0.5">No messages yet</p>
                        </div>
                        <SquarePen className="w-3.5 h-3.5 text-taupe/50 flex-shrink-0" />
                      </button>
                    );
                  })}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ─── RIGHT PANEL: Conversation + Billing ─────────────────────── */}
      <div className={`${!clientId || !mobileShowChat ? 'hidden md:flex' : 'flex'} flex-1 bg-cream/30 min-w-0`}>
        {/* Conversation column */}
        <div className="flex flex-col flex-1 min-w-0">
        {!clientId ? (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center text-taupe gap-3">
            <div className="w-16 h-16 rounded-full bg-cream flex items-center justify-center">
              <svg className="w-8 h-8 text-taupe/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
            </div>
            <p className="text-sm">Select a conversation to start messaging</p>
          </div>
        ) : (
          <>
            {/* Conversation header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-cream">
              <button
                onClick={() => { navigate('/admin/inbox'); setMobileShowChat(false); }}
                className="md:hidden text-taupe hover:text-espresso p-1"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className={`h-9 w-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${activeConv?.unread_count_admin > 0 ? 'bg-gold' : 'bg-taupe/50'}`}>
                {activeName?.charAt(0) || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-espresso truncate">{activeName || `Client #${clientId}`}</div>
                {activeDogs && <div className="text-xs text-taupe truncate">{activeDogs}</div>}
              </div>
              <button
                onClick={() => {
                  if (msgSearchOpen) { setMsgSearchOpen(false); setMsgSearchQuery(''); setMsgSearchIndex(0); }
                  else { setMsgSearchOpen(true); setTimeout(() => msgSearchInputRef.current?.focus(), 50); }
                }}
                className={`p-1.5 rounded-lg transition-colors ${msgSearchOpen ? 'bg-gold/10 text-gold' : 'text-taupe hover:text-espresso hover:bg-cream'}`}
                title="Search messages"
              >
                <Search className="w-4 h-4" />
              </button>
              <button
                onClick={() => setBillingOpen(v => !v)}
                className={`p-1.5 rounded-lg transition-colors ${billingOpen ? 'bg-gold/10 text-gold' : 'text-taupe hover:text-espresso hover:bg-cream'}`}
                title="Billing & Invoices"
              >
                <CreditCard className="w-4 h-4" />
              </button>
            </div>

            {/* In-conversation search bar */}
            {msgSearchOpen && (
              <div className="flex items-center gap-2 bg-white border-b border-cream px-4 py-2">
                <Search className="w-4 h-4 text-taupe flex-shrink-0" />
                <input
                  ref={msgSearchInputRef}
                  type="text"
                  className="flex-1 text-sm border-0 focus:outline-none text-espresso placeholder-taupe bg-transparent"
                  placeholder="Search messages..."
                  value={msgSearchQuery}
                  onChange={e => { setMsgSearchQuery(e.target.value); setMsgSearchIndex(0); }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && msgSearchMatches.length > 1) setMsgSearchIndex(i => (i + 1) % msgSearchMatches.length);
                    else if (e.key === 'Escape') { setMsgSearchOpen(false); setMsgSearchQuery(''); }
                  }}
                />
                {msgSearchQuery && (
                  <span className="text-xs text-taupe whitespace-nowrap">
                    {msgSearchMatches.length > 0 ? `${msgSearchIndex + 1} of ${msgSearchMatches.length}` : 'No results'}
                  </span>
                )}
                {msgSearchMatches.length > 1 && (
                  <div className="flex gap-0.5">
                    <button onClick={() => setMsgSearchIndex(i => (i - 1 + msgSearchMatches.length) % msgSearchMatches.length)} className="text-taupe hover:text-espresso p-0.5">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>
                    </button>
                    <button onClick={() => setMsgSearchIndex(i => (i + 1) % msgSearchMatches.length)} className="text-taupe hover:text-espresso p-0.5">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                    </button>
                  </div>
                )}
                <button onClick={() => { setMsgSearchOpen(false); setMsgSearchQuery(''); }} className="text-taupe hover:text-espresso p-0.5">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Messages area */}
            {convLoading ? (
              <div className="flex-1 flex items-center justify-center"><PageLoader /></div>
            ) : convError ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <p className="text-red-600 text-sm">Failed to load conversation.</p>
                <p className="text-taupe text-xs">{(convError as any)?.response?.data?.message || (convError as Error).message}</p>
              </div>
            ) : (
              <>
                <div ref={msgContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                  {convData?.data?.map((msg: any, i: number) => {
                    const msgDate = new Date(msg.created_at);
                    const prevDate = i > 0 ? new Date(convData.data[i - 1].created_at) : null;
                    const showDate = !prevDate || msgDate.toDateString() !== prevDate.toDateString();
                    const isMatch = msgSearchQuery && msgSearchMatches.includes(i);
                    const isCurrentMatch = isMatch && msgSearchMatches[msgSearchIndex] === i;

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
                                onChange={e => setEditBody(e.target.value)}
                                autoFocus
                              />
                              <div className="flex gap-2 justify-end">
                                <button className="text-xs text-taupe hover:text-espresso" onClick={() => setEditingId(null)}>Cancel</button>
                                <Button size="sm" loading={editMsg.isPending} onClick={() => editMsg.mutate({ id: msg.id, body: editBody })}>Save</Button>
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
                              onEdit={(m: any) => { setEditingId(m.id); setEditBody(m.body ?? ''); }}
                              onDelete={(m: any) => { if (window.confirm('Delete this message?')) deleteMsg.mutate(m.id); }}
                              onUnsend={(m: any) => { if (window.confirm('Unsend this message? It will be removed for everyone.')) deleteMsg.mutate(m.id); }}
                              onReact={(id: number, emoji: string) => reactMsg.mutate({ id, emoji })}
                              onReply={(m: any) => { setReplyTo({ id: m.id, sender: m.sender, body: m.body, type: m.type }); textareaRef.current?.focus(); }}
                            />
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>

                {/* Chat error */}
                {chatError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700 flex items-center justify-between mx-4">
                    <span>{chatError}</span>
                    <button onClick={() => setChatError('')} className="text-red-400 hover:text-red-600 ml-3">&times;</button>
                  </div>
                )}

                {/* Reply preview */}
                {replyTo && (
                  <div className="flex items-center gap-2 bg-cream/60 border-l-2 border-gold mx-4 rounded-t-xl px-4 py-2 -mb-1">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-espresso truncate">
                        Replying to {replyTo.sender?.name ?? 'message'}
                      </div>
                      <div className="text-xs text-taupe truncate">
                        {replyTo.type === 'photo' ? 'Photo' : (replyTo.body ?? '').slice(0, 60)}
                      </div>
                    </div>
                    <button onClick={() => setReplyTo(null)} className="text-taupe hover:text-espresso text-lg leading-none">&times;</button>
                  </div>
                )}

                {/* Input bar */}
                <div className={`flex items-center gap-2 bg-white border-t border-cream p-3 mx-0 ${replyTo ? '' : ''}`}>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                  <button
                    className="text-taupe hover:text-gold transition-colors p-1.5 rounded hover:bg-cream"
                    title="Send a photo"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sendPhoto.isPending}
                  >
                    {sendPhoto.isPending ? (
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    ) : (
                      <Image className="w-5 h-5" />
                    )}
                  </button>

                  <button
                    className="text-taupe hover:text-gold transition-colors p-1.5 rounded hover:bg-cream"
                    title="Emoji"
                    onClick={() => setShowEmojiPicker(v => !v)}
                  >
                    <SmilePlus className="w-5 h-5" />
                  </button>
                  {showEmojiPicker && ReactDOM.createPortal(
                    <div className="fixed inset-0 z-50 flex items-end justify-center pb-24 sm:items-center sm:pb-0" onClick={() => setShowEmojiPicker(false)}>
                      <div className="absolute inset-0 bg-black/20" />
                      <div className="relative bg-white rounded-2xl shadow-2xl border border-cream p-3 grid grid-cols-8 gap-1" onClick={e => e.stopPropagation()}>
                        {QUICK_EMOJIS.map(e => (
                          <button key={e} className="text-2xl hover:scale-110 active:scale-95 rounded p-1.5 hover:bg-cream transition-all" onClick={() => insertEmoji(e)}>{e}</button>
                        ))}
                      </div>
                    </div>,
                    document.body,
                  )}

                  <textarea
                    ref={textareaRef}
                    rows={1}
                    className="flex-1 resize-none border-0 focus:outline-none text-sm text-espresso placeholder-taupe self-center bg-transparent"
                    placeholder="Type a message..."
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                  <Button size="sm" disabled={!text.trim()} loading={send.isPending} onClick={() => send.mutate()}>
                    Send
                  </Button>
                </div>
              </>
            )}
          </>
        )}
        </div>{/* end conversation column */}

        {/* ─── BILLING SIDEBAR ─────────────────────────────────────── */}
        {clientId && billingOpen && (
          <BillingSidebar
            clientId={clientId}
            clientName={activeName}
            invoices={clientInvoices}
            serviceRequests={clientServiceRequests}
            onClose={() => setBillingOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

/* ── Billing Sidebar Component ──────────────────────────────────────── */
function BillingSidebar({
  clientId,
  clientName,
  invoices,
  serviceRequests,
  onClose,
}: {
  clientId: string;
  clientName: string;
  invoices: { upcoming: any[]; overdue: any[]; past: any[] };
  serviceRequests: any[];
  onClose: () => void;
}) {
  const formatServiceType = (type: string) => {
    if (type === 'walk_30') return '30-Min Visit';
    if (type === 'walk_60') return '60-Min Visit';
    return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const formatTimeBlock = (block: string) =>
    ({ early_morning: '6-9 AM', morning: '9 AM-12 PM', midday: '12-3 PM', afternoon: '3-6 PM', evening: '6-9 PM' }[block] ?? block);

  const statusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-taupe/10 text-taupe';
      case 'sent': return 'bg-blue/10 text-blue';
      case 'overdue': return 'bg-red-50 text-red-600';
      case 'paid': return 'bg-green-50 text-green-600';
      case 'void': return 'bg-taupe/10 text-taupe line-through';
      default: return 'bg-taupe/10 text-taupe';
    }
  };

  return (
    <div className="hidden lg:flex flex-col w-80 border-l border-cream bg-white flex-shrink-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-cream">
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-gold" />
          <span className="text-sm font-semibold text-espresso">Billing</span>
        </div>
        <div className="flex items-center gap-1">
          <Link
            to={`/admin/clients/${clientId}`}
            className="p-1.5 rounded-lg text-taupe hover:text-gold hover:bg-cream transition-colors"
            title="View client profile"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
          <button onClick={onClose} className="p-1.5 rounded-lg text-taupe hover:text-espresso hover:bg-cream transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Overdue invoices */}
        {invoices.overdue.length > 0 && (
          <div className="px-4 py-3 border-b border-cream">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertCircle className="w-3.5 h-3.5 text-red-500" />
              <span className="text-xs font-semibold text-red-600 uppercase tracking-wide">
                Overdue ({invoices.overdue.length})
              </span>
            </div>
            <div className="space-y-2">
              {invoices.overdue.map((inv: any) => (
                <InvoiceRow key={inv.id} inv={inv} statusColor={statusColor} />
              ))}
            </div>
          </div>
        )}

        {/* Upcoming / Open invoices */}
        <div className="px-4 py-3 border-b border-cream">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-espresso uppercase tracking-wide">
              Open Invoices
            </span>
            <Link
              to={`/admin/invoices/new?user_id=${clientId}`}
              className="text-[10px] text-gold hover:underline font-medium"
            >
              + New Invoice
            </Link>
          </div>
          {invoices.upcoming.length === 0 ? (
            <p className="text-xs text-taupe py-2">No open invoices</p>
          ) : (
            <div className="space-y-2">
              {invoices.upcoming.map((inv: any) => (
                <InvoiceRow key={inv.id} inv={inv} statusColor={statusColor} />
              ))}
            </div>
          )}
        </div>

        {/* Pending service requests */}
        <div className="px-4 py-3 border-b border-cream">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-espresso uppercase tracking-wide">
              Pending Requests
            </span>
            <Link
              to="/admin/service-requests"
              className="text-[10px] text-gold hover:underline font-medium"
            >
              View All
            </Link>
          </div>
          {serviceRequests.length === 0 ? (
            <p className="text-xs text-taupe py-2">No pending requests</p>
          ) : (
            <div className="space-y-2">
              {serviceRequests.map((sr: any) => (
                <Link
                  key={sr.id}
                  to="/admin/service-requests"
                  className="block bg-cream/40 rounded-lg p-2.5 hover:bg-cream/70 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-espresso">
                      {formatServiceType(sr.service_type)}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      sr.status === 'pending' ? 'bg-gold/10 text-gold' : 'bg-blue/10 text-blue'
                    }`}>
                      {sr.status === 'counter_offered' ? 'Counter' : 'Pending'}
                    </span>
                  </div>
                  <div className="text-[11px] text-taupe mt-1">
                    {format(new Date(sr.preferred_date + 'T00:00'), 'MMM d, yyyy')} · {formatTimeBlock(sr.preferred_time_block)}
                  </div>
                  {sr.dogs?.length > 0 && (
                    <div className="text-[10px] text-taupe/70 mt-0.5">
                      {sr.dogs.map((d: any) => d.name).join(', ')}
                    </div>
                  )}
                  {sr.notes && (
                    <div className="text-[10px] text-taupe mt-1 truncate italic">"{sr.notes}"</div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Past invoices */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-espresso uppercase tracking-wide">
              Past Invoices
            </span>
            <Link
              to={`/admin/invoices?user_id=${clientId}`}
              className="text-[10px] text-gold hover:underline font-medium"
            >
              View All
            </Link>
          </div>
          {invoices.past.length === 0 ? (
            <p className="text-xs text-taupe py-2">No past invoices</p>
          ) : (
            <div className="space-y-2">
              {invoices.past.slice(0, 10).map((inv: any) => (
                <InvoiceRow key={inv.id} inv={inv} statusColor={statusColor} />
              ))}
              {invoices.past.length > 10 && (
                <Link to={`/admin/invoices?user_id=${clientId}`} className="text-xs text-gold hover:underline block text-center py-1">
                  +{invoices.past.length - 10} more
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Invoice row helper ─────────────────────────────────────────────── */
function InvoiceRow({ inv, statusColor }: { inv: any; statusColor: (s: string) => string }) {
  return (
    <Link
      to={`/admin/invoices/${inv.id}`}
      className="block bg-cream/40 rounded-lg p-2.5 hover:bg-cream/70 transition-colors group"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-espresso">{inv.invoice_number}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${statusColor(inv.status)}`}>
          {inv.status}
        </span>
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-sm font-semibold text-espresso">${Number(inv.total ?? 0).toFixed(2)}</span>
        {inv.due_date && (
          <span className="text-[10px] text-taupe flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {format(new Date(inv.due_date + 'T00:00'), 'MMM d')}
          </span>
        )}
      </div>
      {inv.billing_period_start && inv.billing_period_end && (
        <div className="text-[10px] text-taupe mt-0.5">
          {format(new Date(inv.billing_period_start + 'T00:00'), 'MMM d')} — {format(new Date(inv.billing_period_end + 'T00:00'), 'MMM d, yyyy')}
        </div>
      )}
    </Link>
  );
}
