import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Message } from '@pupper/shared';
import { format } from 'date-fns';
import api from '@/lib/api';

interface Reaction {
  emoji: string;
  count: number;
  reacted_by_me: boolean;
}

interface ReplyTo {
  id: number;
  sender_id: number;
  type: string;
  body: string | null;
  sender?: { id: number; name: string };
}

interface Props {
  message: Message & {
    sender?: { id: number; name: string; role: string };
    edited_at?: string | null;
    reactions?: Reaction[];
    reply_to?: ReplyTo | null;
  };
  currentUserId: number;
  onEdit?: (message: any) => void;
  onDelete?: (message: any) => void;
  onUnsend?: (message: any) => void;
  onReact?: (messageId: number, emoji: string) => void;
  onReply?: (message: any) => void;
}

const MOOD_EMOJI = { great: '🐾', good: '😊', okay: '😐', anxious: '😟', unwell: '🤒' };
const REACTION_EMOJIS = ['👍', '👎', '❤️', '😂', '😢', '🙏', '🎉', '🐾'];

/** Returns true if the text is 1–5 emojis with no other characters. */
function isEmojiOnly(text: unknown): boolean {
  if (typeof text !== 'string' || !text.trim()) return false;
  const t = text.trim();
  if (t.length > 12) return false;
  const stripped = t.replace(/\p{Extended_Pictographic}/gu, '').trim();
  return stripped.length === 0;
}

// Fetches a photo via authenticated API and renders it as an <img>.
function AuthImage({
  messageId,
  alt,
  className,
  onClick,
}: {
  messageId: number;
  alt: string;
  className?: string;
  onClick?: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl = '';
    api
      .get(`/messages/${messageId}/photo`, { responseType: 'blob' })
      .then((r) => {
        objectUrl = URL.createObjectURL(r.data);
        setSrc(objectUrl);
      })
      .catch(() => {});
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [messageId]);

  if (!src) {
    return <div className="h-48 w-56 bg-cream animate-pulse rounded-2xl" />;
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onClick={onClick}
    />
  );
}

// Photo bubble with tap-to-expand lightbox and download button.
function PhotoBubble({
  message,
  isOwn,
}: {
  message: Props['message'];
  isOwn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    let url = '';
    api
      .get(`/messages/${message.id}/photo`, { responseType: 'blob' })
      .then((r) => {
        url = URL.createObjectURL(r.data);
        setBlobUrl(url);
      })
      .catch(() => {});
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [message.id]);

  const download = () => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = (message.body as string) || 'photo.jpg';
    a.click();
  };

  return (
    <>
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
        <div>
          {!blobUrl ? (
            <div className="h-48 w-56 bg-cream animate-pulse rounded-2xl" />
          ) : (
            <img
              src={blobUrl}
              alt="Photo"
              className="rounded-2xl cursor-zoom-in max-h-64 max-w-[18rem] object-cover shadow-card"
              onClick={() => setOpen(true)}
            />
          )}
          <div className={`text-xs mt-1 text-taupe ${isOwn ? 'text-right' : ''}`}>
            {format(new Date(message.created_at), 'h:mm a')}
            {isOwn && message.read_at && ' · Read'}
          </div>
        </div>
      </div>

      {open &&
        blobUrl &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center"
            onClick={() => setOpen(false)}
          >
            <div
              className="relative max-w-4xl w-full mx-4 flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={blobUrl}
                alt="Photo"
                className="max-h-[75vh] max-w-full rounded-2xl object-contain shadow-2xl"
              />
              <div className="flex gap-3 mt-5">
                <button
                  onClick={download}
                  className="bg-white text-espresso px-5 py-2 rounded-xl text-sm font-semibold hover:bg-cream transition-colors"
                >
                  ↓ Download
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="bg-white/20 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-white/30 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

// Reaction picker — full-screen overlay with centered pill
function ReactionPicker({ onReact, onClose }: { onReact: (emoji: string) => void; onClose: () => void }) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center pb-24 sm:items-center sm:pb-0"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20" />
      {/* Picker pill */}
      <div
        className="relative bg-white rounded-2xl shadow-2xl border border-cream px-4 py-3 flex gap-2"
        onClick={e => e.stopPropagation()}
      >
        {REACTION_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onReact(emoji)}
            className="text-2xl hover:scale-125 active:scale-95 transition-transform p-1"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}

// Reply preview shown above a message bubble
function ReplyPreview({ replyTo, isOwn }: { replyTo: ReplyTo; isOwn: boolean }) {
  const senderName = replyTo.sender?.name ?? 'Unknown';
  const bodyPreview = replyTo.type === 'photo'
    ? '📷 Photo'
    : (replyTo.body ?? '').slice(0, 80) + ((replyTo.body ?? '').length > 80 ? '...' : '');

  return (
    <div className={`flex items-start gap-1.5 mb-1.5 text-xs rounded-lg px-2.5 py-1.5 border-l-2 ${
      isOwn
        ? 'bg-white/20 border-white/50 text-white/80'
        : 'bg-cream/60 border-blue text-espresso/70'
    }`}>
      <div className="min-w-0">
        <div className="font-semibold truncate">{senderName}</div>
        <div className="truncate">{bodyPreview}</div>
      </div>
    </div>
  );
}

// Action menu for messages (hover or long-press)
function ActionBar({
  isOwn,
  canMutate,
  showPicker,
  setShowPicker,
  onEdit,
  onDelete,
  onUnsend,
  onReact,
  onReply,
}: {
  isOwn: boolean;
  canMutate: boolean;
  showPicker: boolean;
  setShowPicker: (v: boolean | ((p: boolean) => boolean)) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onUnsend?: () => void;
  onReact?: (emoji: string) => void;
  onReply?: () => void;
}) {
  return (
    <div className={`self-center opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 ${isOwn ? 'order-first mr-1' : 'ml-1'}`}>
      {/* Reply — available for all messages */}
      {onReply && (
        <button
          onClick={onReply}
          className="p-1 rounded hover:bg-cream transition-colors opacity-60 hover:opacity-100"
          title="Reply"
        >
          <img src="/icons/reply.png" alt="Reply" className="w-3.5 h-3.5" />
        </button>
      )}

      {/* React — available for received messages */}
      {!isOwn && onReact && (
        <>
          <button
            onClick={() => setShowPicker(v => !v)}
            className="text-taupe hover:text-gold p-1 rounded hover:bg-cream transition-colors"
            title="React"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          {showPicker && (
            <ReactionPicker
              onReact={(emoji) => { onReact(emoji); setShowPicker(false); }}
              onClose={() => setShowPicker(false)}
            />
          )}
        </>
      )}

      {/* Own-message actions */}
      {isOwn && canMutate && onEdit && (
        <button
          onClick={onEdit}
          className="text-taupe hover:text-espresso p-1 rounded hover:bg-cream transition-colors"
          title="Edit"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      )}
      {isOwn && canMutate && onUnsend && (
        <button
          onClick={onUnsend}
          className="text-taupe hover:text-orange-500 p-1 rounded hover:bg-cream transition-colors"
          title="Unsend"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.334 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
          </svg>
        </button>
      )}
      {isOwn && onDelete && (
        <button
          onClick={onDelete}
          className="text-taupe hover:text-red-500 p-1 rounded hover:bg-cream transition-colors"
          title="Delete"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default function MessageBubble({ message, currentUserId, onEdit, onDelete, onUnsend, onReact, onReply }: Props) {
  const isOwn = message.sender_id === currentUserId;
  const [showPicker, setShowPicker] = useState(false);

  if (message.type === 'photo') {
    return <PhotoBubble message={message} isOwn={isOwn} />;
  }

  if (message.type === 'visit_report') {
    const meta = message.metadata as any;
    const checklist: Record<string, boolean> = meta.checklist ?? {};
    const checkedItems = Object.entries(checklist)
      .filter(([k, v]) => k !== 'special_trip_details' && v)
      .map(([k]) => k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));

    return (
      <div className="mx-auto max-w-sm bg-white rounded-2xl shadow-card overflow-hidden border-l-4 border-gold">
        <div className="bg-espresso px-4 py-3">
          <div className="font-display text-cream text-sm tracking-wide">Visit Report Card 🐾</div>
          {(meta.arrival_time || meta.departure_time) && (
            <div className="flex gap-6 mt-2">
              {meta.arrival_time && (
                <div>
                  <div className="text-taupe text-[10px] uppercase tracking-wide">Arrived</div>
                  <div className="text-cream text-sm font-bold">
                    {format(new Date(meta.arrival_time), 'h:mm a')}
                  </div>
                </div>
              )}
              {meta.departure_time && (
                <div>
                  <div className="text-taupe text-[10px] uppercase tracking-wide">Departed</div>
                  <div className="text-cream text-sm font-bold">
                    {format(new Date(meta.departure_time), 'h:mm a')}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4">
          {checkedItems.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
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
          )}

          {meta.special_trip_details && (
            <div className="bg-gold/10 border border-gold/20 rounded-lg px-2.5 py-2 mb-3 text-xs">
              <span className="font-semibold text-gold">Special Trip: </span>
              <span className="text-espresso">{meta.special_trip_details}</span>
            </div>
          )}

          {meta.notes && (
            <p className="text-xs text-taupe italic line-clamp-2 mb-2">{meta.notes}</p>
          )}

          {meta.has_photo && (
            <div className="text-xs text-taupe mb-1">📷 Photo included</div>
          )}

          <div className="text-xs text-taupe mt-1">
            {format(new Date(message.created_at), 'h:mm a')}
          </div>
        </div>
      </div>
    );
  }

  if (message.type === 'invoice') {
    const meta = message.metadata as any;
    return (
      <div className="mx-auto max-w-sm bg-white rounded-2xl shadow-card p-5 border-l-4 border-blue">
        <div className="font-display text-espresso text-sm mb-2">Invoice #{meta.invoice_number}</div>
        <div className="text-2xl font-bold text-espresso mb-1">${meta.total?.toFixed(2)}</div>
        {meta.due_date && <div className="text-xs text-taupe">Due {meta.due_date}</div>}
        <div className="text-xs text-taupe mt-2">{format(new Date(message.created_at), 'h:mm a')}</div>
      </div>
    );
  }

  if (message.type === 'arrival') {
    return (
      <div className="text-center">
        <div className="inline-block bg-gold/10 border border-gold/30 rounded-full px-4 py-1.5 text-xs font-semibold text-gold">
          🐾 Walker arrived — {format(new Date(message.created_at), 'h:mm a')}
        </div>
      </div>
    );
  }

  if (message.type === 'notification') {
    const meta = message.metadata as any;
    const hasHtml = !!meta?.html_body;

    return (
      <div className="mx-auto max-w-md rounded-2xl overflow-hidden shadow-card border border-cream">
        <div className="bg-blue px-4 py-2.5 flex items-center gap-2">
          <span className="text-white text-sm">🐾</span>
          <span className="font-display text-white text-sm tracking-wide flex-1">{meta?.title || 'The Pupper Club'}</span>
        </div>

        <div className="bg-white p-4">
          {hasHtml ? (
            <div
              className="text-sm text-espresso leading-relaxed [&_a]:text-blue [&_a]:underline [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mb-1 [&_p]:mb-2 [&_ul]:pl-5 [&_ul]:mb-2 [&_ol]:pl-5 [&_ol]:mb-2 [&_li]:mb-0.5 [&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-2"
              dangerouslySetInnerHTML={{ __html: meta.html_body }}
            />
          ) : (
            <p className="text-sm text-espresso leading-relaxed">{message.body}</p>
          )}
          <div className="text-xs text-taupe mt-3">{format(new Date(message.created_at), 'h:mm a')}</div>
        </div>
      </div>
    );
  }

  if (message.type === 'pre_visit_prompt') {
    const meta = message.metadata as any;
    return (
      <div className="mx-auto max-w-sm bg-gold/5 border border-gold/20 rounded-2xl p-4 text-center">
        <div className="text-lg mb-1">🐾</div>
        <div className="font-semibold text-espresso text-sm">Walk Tomorrow!</div>
        <p className="text-sm text-taupe mt-1">{message.body}</p>
        {meta?.time_block && (
          <div className="mt-2 inline-block bg-gold/10 text-gold text-xs font-medium px-2.5 py-1 rounded-full">
            {meta.time_block}
          </div>
        )}
        <div className="text-xs text-taupe mt-2">{format(new Date(message.created_at), 'h:mm a')}</div>
      </div>
    );
  }

  // Standard text bubble
  const canMutate = isOwn && message.type === 'text' &&
    new Date(message.created_at).getTime() > Date.now() - 2 * 60 * 60 * 1000;

  const reactions = message.reactions ?? [];
  const emojiOnly = message.type === 'text' && isEmojiOnly(message.body);
  const replyTo = (message as any).reply_to as ReplyTo | null | undefined;

  return (
    <div className={`group flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
      <div className={`flex items-end ${isOwn ? 'justify-end' : 'justify-start'} w-full`}>
        {/* Action bar — left of own messages, right of received messages */}
        {isOwn && (
          <ActionBar
            isOwn={isOwn}
            canMutate={canMutate}
            showPicker={showPicker}
            setShowPicker={setShowPicker}
            onEdit={onEdit ? () => onEdit(message) : undefined}
            onDelete={onDelete ? () => onDelete(message) : undefined}
            onUnsend={onUnsend ? () => onUnsend(message) : undefined}
            onReply={onReply ? () => onReply(message) : undefined}
            onReact={onReact ? (emoji) => onReact(message.id, emoji) : undefined}
          />
        )}

        {emojiOnly ? (
          <div className="px-1 py-0.5">
            {replyTo && <ReplyPreview replyTo={replyTo} isOwn={isOwn} />}
            <p className="text-5xl leading-none select-none">{message.body}</p>
            <div className={`text-xs mt-1 ${isOwn ? 'text-taupe text-right' : 'text-taupe'}`}>
              {format(new Date(message.created_at), 'h:mm a')}
              {isOwn && message.read_at && ' · Read'}
            </div>
          </div>
        ) : (
          <div
            className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
              isOwn
                ? 'bg-blue text-white rounded-br-sm'
                : 'bg-white shadow-card text-espresso rounded-bl-sm'
            }`}
          >
            {replyTo && <ReplyPreview replyTo={replyTo} isOwn={isOwn} />}
            {!isOwn && (
              <div className="text-xs font-semibold mb-1 text-taupe">{message.sender?.name}</div>
            )}
            <p className="leading-relaxed">{message.body}</p>
            <div className={`text-xs mt-1 ${isOwn ? 'text-white/70' : 'text-taupe'}`}>
              {format(new Date(message.created_at), 'h:mm a')}
              {(message as any).edited_at && ' · Edited'}
              {isOwn && message.read_at && ' · Read'}
              {(message.metadata as any)?.source === 'email' && ' · via email'}
            </div>
          </div>
        )}

        {/* Action bar — right of received messages */}
        {!isOwn && (
          <ActionBar
            isOwn={isOwn}
            canMutate={false}
            showPicker={showPicker}
            setShowPicker={setShowPicker}
            onReply={onReply ? () => onReply(message) : undefined}
            onReact={onReact ? (emoji) => onReact(message.id, emoji) : undefined}
          />
        )}
      </div>

      {/* Reaction pills */}
      {reactions.length > 0 && (
        <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
          {reactions.map((r) => (
            <button
              key={r.emoji}
              onClick={() => onReact?.(message.id, r.emoji)}
              className={`flex items-center gap-0.5 text-xs rounded-full px-2 py-0.5 border transition-colors ${
                r.reacted_by_me
                  ? 'bg-blue/15 border-blue/40 text-espresso'
                  : 'bg-cream border-cream hover:border-taupe text-espresso'
              }`}
            >
              <span>{r.emoji}</span>
              <span className="font-medium">{r.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
