import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Message } from '@pupper/shared';
import { format } from 'date-fns';
import api from '@/lib/api';

interface Reaction {
  emoji: string;
  count: number;
  reacted_by_me: boolean;
}

interface Props {
  message: Message & {
    sender?: { id: number; name: string; role: string };
    edited_at?: string | null;
    reactions?: Reaction[];
  };
  currentUserId: number;
  onEdit?: (message: any) => void;
  onDelete?: (message: any) => void;
  onReact?: (messageId: number, emoji: string) => void;
}

const MOOD_EMOJI = { great: '🐾', good: '😊', okay: '😐', anxious: '😟', unwell: '🤒' };
const REACTION_EMOJIS = ['👍', '👎', '❤️', '😂', '😢', '🙏', '🎉', '🐾'];

/** Returns true if the text is 1–5 emojis with no other characters. */
function isEmojiOnly(text: unknown): boolean {
  if (typeof text !== 'string' || !text.trim()) return false;
  const t = text.trim();
  if (t.length > 12) return false; // rough guard: most 1-5 emojis are ≤ 12 chars
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

// Inline reaction picker shown on hover
function ReactionPicker({ onReact }: { onReact: (emoji: string) => void }) {
  return (
    <div className="absolute bottom-full mb-1 bg-white rounded-2xl shadow-lg border border-cream px-2 py-1.5 flex gap-1 z-20">
      {REACTION_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onReact(emoji)}
          className="text-lg hover:scale-125 transition-transform px-0.5"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

export default function MessageBubble({ message, currentUserId, onEdit, onDelete, onReact }: Props) {
  const isOwn = message.sender_id === currentUserId;
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker on outside click
  useEffect(() => {
    if (!showPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPicker]);

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
        {/* Header */}
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

        {/* Body */}
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
    return (
      <div className="mx-auto max-w-sm bg-espresso/5 rounded-xl p-4 text-center">
        <div className="font-semibold text-espresso text-sm">{meta?.title}</div>
        <p className="text-sm text-taupe mt-1">{message.body}</p>
        <div className="text-xs text-taupe mt-2">{format(new Date(message.created_at), 'h:mm a')}</div>
      </div>
    );
  }

  // Standard text bubble
  const canMutate = isOwn && message.type === 'text' &&
    new Date(message.created_at).getTime() > Date.now() - 2 * 60 * 60 * 1000;

  const reactions = message.reactions ?? [];
  const emojiOnly = message.type === 'text' && isEmojiOnly(message.body);

  return (
    <div className={`group flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} w-full`}>
        {/* Edit/Delete controls — appear on hover for own messages within 2h */}
        {canMutate && (
          <div className="self-center mr-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
            {onEdit && (
              <button
                onClick={() => onEdit(message)}
                className="text-taupe hover:text-espresso text-xs px-2 py-1 rounded bg-cream"
                title="Edit"
              >
                ✏️
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(message)}
                className="text-taupe hover:text-red-500 text-xs px-2 py-1 rounded bg-cream"
                title="Delete"
              >
                🗑️
              </button>
            )}
          </div>
        )}

        {/* Reaction picker trigger */}
        {onReact && (
          <div ref={pickerRef} className="relative self-center mr-1">
            <button
              onClick={() => setShowPicker(v => !v)}
              className={`opacity-0 group-hover:opacity-100 transition-opacity text-taupe hover:text-gold text-xs px-1.5 py-1 rounded bg-cream ${isOwn ? 'order-first mr-2' : ''}`}
              title="React"
            >
              😊
            </button>
            {showPicker && (
              <ReactionPicker
                onReact={(emoji) => {
                  onReact(message.id, emoji);
                  setShowPicker(false);
                }}
              />
            )}
          </div>
        )}

        {emojiOnly ? (
          <div className="px-1 py-0.5">
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
                ? 'bg-gold text-white rounded-br-sm'
                : 'bg-white shadow-card text-espresso rounded-bl-sm'
            }`}
          >
            {!isOwn && (
              <div className="text-xs font-semibold mb-1 text-taupe">{message.sender?.name}</div>
            )}
            <p className="leading-relaxed">{message.body}</p>
            <div className={`text-xs mt-1 ${isOwn ? 'text-white/70' : 'text-taupe'}`}>
              {format(new Date(message.created_at), 'h:mm a')}
              {(message as any).edited_at && ' · Edited'}
              {isOwn && message.read_at && !((message as any).edited_at) && ' · Read'}
            </div>
          </div>
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
                  ? 'bg-gold/15 border-gold/40 text-espresso'
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
