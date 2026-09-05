import React, { useState, useRef, useEffect } from 'react';

const EMOJIS = [
  '🐶', '🐕', '🐩', '🦮', '🐾', '🦴', '🎾', '🏃', '🚶', '🌳',
  '🌞', '🌧️', '💧', '🚗', '🏠', '😊', '😄', '😆', '🥰', '😅',
  '😬', '😴', '🥵', '🥶', '👏', '🎉', '❤️', '👍', '⚠️', '💩',
];

export function EmojiPickerButton({ onSelect }: { onSelect: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-taupe hover:text-gold transition-colors text-sm leading-none"
        title="Insert emoji"
      >
        😊
      </button>
      {open && (
        <div className="absolute z-20 right-0 mt-1 grid grid-cols-6 gap-1 bg-white border border-taupe/30 rounded-lg shadow-lg p-2 w-56">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onSelect(emoji);
                setOpen(false);
              }}
              className="text-lg hover:bg-cream rounded p-1 transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
