import React from 'react';
import type { Message } from '@pupper/shared';
import { format } from 'date-fns';

interface Props {
  message: Message & { sender?: { id: number; name: string; role: string } };
  currentUserId: number;
}

const MOOD_EMOJI = { great: '🐾', good: '😊', okay: '😐', anxious: '😟', unwell: '🤒' };

export default function MessageBubble({ message, currentUserId }: Props) {
  const isOwn = message.sender_id === currentUserId;

  if (message.type === 'visit_report') {
    const meta = message.metadata as any;
    return (
      <div className="mx-auto max-w-sm bg-white rounded-2xl shadow-card p-5 border-l-4 border-gold">
        <div className="font-display text-espresso text-sm mb-3">Visit Report 🐾</div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: '🐕 Walked', value: true },
            { label: '🚿 Eliminated', value: meta.eliminated },
            { label: '🥩 Ate Well', value: meta.ate_well },
            { label: '💧 Hydrated', value: meta.drank_water },
          ].map(({ label, value }) => (
            <div key={label} className={`rounded-lg p-2 text-center text-xs ${value ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
              {label}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm mb-2">
          <span className="text-2xl">{MOOD_EMOJI[meta.mood as keyof typeof MOOD_EMOJI] ?? '😊'}</span>
          <span className="capitalize">{meta.mood}</span>
        </div>
        {meta.notes && <p className="text-xs text-taupe italic">{meta.notes}</p>}
        {meta.photo_urls?.length > 0 && (
          <div className="grid grid-cols-2 gap-1 mt-3">
            {meta.photo_urls.slice(0, 4).map((url: string, i: number) => (
              <img key={i} src={url} alt="Walk photo" className="rounded-lg object-cover h-24 w-full" />
            ))}
          </div>
        )}
        <div className="text-xs text-taupe mt-2">{format(new Date(message.created_at), 'h:mm a')}</div>
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
  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
        isOwn
          ? 'bg-gold text-white rounded-br-sm'
          : 'bg-white shadow-card text-espresso rounded-bl-sm'
      }`}>
        {!isOwn && (
          <div className="text-xs font-semibold mb-1 text-taupe">{message.sender?.name}</div>
        )}
        <p className="leading-relaxed">{message.body}</p>
        <div className={`text-xs mt-1 ${isOwn ? 'text-white/70' : 'text-taupe'}`}>
          {format(new Date(message.created_at), 'h:mm a')}
          {isOwn && message.read_at && ' · Read'}
        </div>
      </div>
    </div>
  );
}
