import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import type { Message } from '@pupper/shared';
import { format } from 'date-fns';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

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

// Loads an attachment image as a blob and renders it as <img>.
// Falls back to a non-image preview chip if the mime type isn't an image.
function InlineAttachment({
  messageId,
  index,
  attachment,
  onOpen,
}: {
  messageId: number;
  index: number;
  attachment: { mime_type?: string; original_name?: string };
  onOpen: (blobUrl: string, name: string) => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const isImage = (attachment.mime_type ?? '').startsWith('image/');

  useEffect(() => {
    if (!isImage) return;
    let url = '';
    api
      .get(`/messages/${messageId}/attachment/${index}`, { responseType: 'blob' })
      .then((r) => {
        url = URL.createObjectURL(r.data);
        setSrc(url);
      })
      .catch(() => {});
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [messageId, index, isImage]);

  const handleDownload = async () => {
    try {
      const res = await api.get(`/messages/${messageId}/attachment/${index}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.original_name || 'file';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* swallow */
    }
  };

  if (!isImage) {
    return (
      <button
        onClick={handleDownload}
        className="flex items-center gap-2 bg-cream/80 hover:bg-cream border border-taupe/20 rounded-xl px-3 py-2 transition-colors w-full text-left"
      >
        <svg className="w-4 h-4 text-espresso flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        <span className="text-sm font-medium text-espresso truncate">
          {attachment.original_name || 'File'}
        </span>
      </button>
    );
  }

  if (!src) {
    return <div className="h-40 w-40 bg-cream animate-pulse rounded-xl" />;
  }

  return (
    <img
      src={src}
      alt={attachment.original_name || 'Photo'}
      className="rounded-xl cursor-zoom-in max-h-56 max-w-full object-cover shadow-card"
      onClick={() => onOpen(src, attachment.original_name || 'photo.jpg')}
    />
  );
}

// Renders 1..N attachments in a grid plus a shared lightbox.
function AttachmentGrid({
  messageId,
  attachments,
}: {
  messageId: number;
  attachments: Array<{ mime_type?: string; original_name?: string }>;
}) {
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);

  if (!attachments.length) return null;

  const handleDownload = () => {
    if (!lightbox) return;
    const a = document.createElement('a');
    a.href = lightbox.url;
    a.download = lightbox.name;
    a.click();
  };

  const gridCols = attachments.length === 1 ? 'grid-cols-1' : 'grid-cols-2';

  return (
    <>
      <div className={`grid ${gridCols} gap-1.5`}>
        {attachments.map((att, i) => (
          <InlineAttachment
            key={i}
            messageId={messageId}
            index={i}
            attachment={att}
            onOpen={(url, name) => setLightbox({ url, name })}
          />
        ))}
      </div>

      {lightbox && createPortal(
        <div
          className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative max-w-4xl w-full mx-4 flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightbox.url}
              alt={lightbox.name}
              className="max-h-[75vh] max-w-full rounded-2xl object-contain shadow-2xl"
            />
            <div className="flex gap-3 mt-5">
              <button
                onClick={handleDownload}
                className="bg-white text-espresso px-5 py-2 rounded-xl text-sm font-semibold hover:bg-cream transition-colors"
              >
                ↓ Download
              </button>
              <button
                onClick={() => setLightbox(null)}
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

// Photo bubble with tap-to-expand lightbox and download button.
function PhotoBubble({
  message,
  isOwn,
}: {
  message: Props['message'];
  isOwn: boolean;
}) {
  const meta = message.metadata as any;
  const isBroadcastAttachment = meta?.broadcast === true;
  const [open, setOpen] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isBroadcastAttachment) return; // Don't fetch blob for broadcast attachments
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
  }, [message.id, isBroadcastAttachment]);

  const download = () => {
    if (isBroadcastAttachment) {
      // Download broadcast attachment via authenticated endpoint
      api.get(`/messages/${message.id}/photo`, { responseType: 'blob' }).then((r) => {
        const url = URL.createObjectURL(r.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = meta?.original_name || (message.body as string) || 'file';
        a.click();
        URL.revokeObjectURL(url);
      });
      return;
    }
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = (message.body as string) || 'photo.jpg';
    a.click();
  };

  // Broadcast attachments: show as "File Attached" with download icon
  if (isBroadcastAttachment) {
    return (
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
        <div>
          <button
            onClick={download}
            className="flex items-center gap-2 bg-cream/80 hover:bg-cream border border-taupe/20 rounded-xl px-4 py-2.5 transition-colors"
          >
            <svg className="w-4 h-4 text-espresso" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span className="text-sm font-medium text-espresso">
              {meta?.original_name || 'File Attached'}
            </span>
          </button>
          <div className={`text-xs mt-1 text-taupe ${isOwn ? 'text-right' : ''}`}>
            {format(new Date(message.created_at), 'h:mm a')}
          </div>
        </div>
      </div>
    );
  }

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

    const reportLink = isOwn
      ? `/admin/report-cards/${meta.report_id}`
      : '/client/report-cards';

    return (
      <div className="mx-auto max-w-sm bg-white rounded-2xl shadow-card overflow-hidden border-l-4 border-gold">
        <div className="bg-espresso px-4 py-3">
          <div className="font-display text-cream text-sm tracking-wide">Visit Report Card 🐾</div>
          {meta.dog_names && (
            <div className="text-cream/80 text-xs mt-1">{meta.dog_names}</div>
          )}
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
            <p className="text-sm text-espresso mb-3">{meta.notes}</p>
          )}

          {meta.has_photo && (
            <div className="text-xs text-taupe mb-2">
              📷 {(meta.photo_count ?? 1) > 1 ? `${meta.photo_count} photos` : 'Photo included'}
            </div>
          )}

          <div className="flex items-center justify-between mt-2">
            <div className="text-xs text-taupe">
              {format(new Date(message.created_at), 'h:mm a')}
            </div>
            <Link
              to={reportLink}
              className="text-xs font-semibold text-gold hover:text-espresso transition-colors"
            >
              View Full Report →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (message.type === 'invoice') {
    const meta = message.metadata as any;
    const invoiceLink = isOwn
      ? `/admin/invoices/${meta.invoice_id}`
      : `/client/invoices/${meta.invoice_id}`;

    return (
      <div className="mx-auto max-w-sm bg-white rounded-2xl shadow-card p-5 border-l-4 border-blue">
        <div className="font-display text-espresso text-sm mb-2">Invoice #{meta.invoice_number}</div>
        <div className="text-2xl font-bold text-espresso mb-1">${Number(meta.total ?? 0).toFixed(2)}</div>
        {meta.due_date && <div className="text-xs text-taupe">Due {format(new Date(meta.due_date + 'T00:00'), 'MMMM d, yyyy')}</div>}
        {meta.billing_period_start && meta.billing_period_end && (
          <div className="text-xs text-taupe mt-1">
            {format(new Date(meta.billing_period_start + 'T00:00'), 'MMM d')} – {format(new Date(meta.billing_period_end + 'T00:00'), 'MMM d, yyyy')}
          </div>
        )}
        <div className="flex items-center justify-between mt-3">
          <div className="text-xs text-taupe">
            {format(new Date(message.created_at), 'h:mm a')}
          </div>
          <Link
            to={invoiceLink}
            className="text-xs font-semibold text-gold hover:text-espresso transition-colors"
          >
            View Invoice →
          </Link>
        </div>
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
    const notificationAttachments = (meta?.attachments ?? []) as Array<{ mime_type?: string; original_name?: string }>;

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
          {notificationAttachments.length > 0 && (
            <div className="mt-3">
              <AttachmentGrid messageId={message.id} attachments={notificationAttachments} />
            </div>
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
  const textMeta = message.metadata as any;
  const messageAttachments = (textMeta?.attachments ?? []) as Array<{ mime_type?: string; original_name?: string }>;
  const hasAttachments = messageAttachments.length > 0;
  const hasBody = !!(message.body && message.body.trim());

  const canMutate = isOwn && message.type === 'text' && hasBody && !hasAttachments &&
    new Date(message.created_at).getTime() > Date.now() - 2 * 60 * 60 * 1000;

  const reactions = message.reactions ?? [];
  const emojiOnly = message.type === 'text' && !hasAttachments && isEmojiOnly(message.body);
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
        ) : hasAttachments && !hasBody ? (
          // Attachment-only message — no text bubble background, just the photos
          <div className="max-w-[75%] flex flex-col">
            {replyTo && <ReplyPreview replyTo={replyTo} isOwn={isOwn} />}
            {!isOwn && (
              <div className="text-xs font-semibold mb-1 text-taupe">{message.sender?.name}</div>
            )}
            <AttachmentGrid messageId={message.id} attachments={messageAttachments} />
            <div className={`text-xs mt-1 text-taupe ${isOwn ? 'text-right' : ''}`}>
              {format(new Date(message.created_at), 'h:mm a')}
              {isOwn && message.read_at && ' · Read'}
            </div>
          </div>
        ) : (
          <div
            className={`max-w-[75%] rounded-2xl text-sm overflow-hidden ${
              isOwn
                ? 'bg-blue text-white rounded-br-sm'
                : 'bg-white shadow-card text-espresso rounded-bl-sm'
            }`}
          >
            {hasAttachments && (
              <div className="p-1.5 pb-0">
                <AttachmentGrid messageId={message.id} attachments={messageAttachments} />
              </div>
            )}
            <div className="px-4 py-2.5">
              {replyTo && <ReplyPreview replyTo={replyTo} isOwn={isOwn} />}
              {!isOwn && (
                <div className="text-xs font-semibold mb-1 text-taupe">{message.sender?.name}</div>
              )}
              {hasBody && <p className="leading-relaxed whitespace-pre-wrap">{message.body}</p>}
              <div className={`text-xs mt-1 ${isOwn ? 'text-white/70' : 'text-taupe'}`}>
                {format(new Date(message.created_at), 'h:mm a')}
                {(message as any).edited_at && ' · Edited'}
                {isOwn && message.read_at && ' · Read'}
                {(message.metadata as any)?.source === 'email' && ' · via email'}
              </div>
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
