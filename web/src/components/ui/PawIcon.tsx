import React from 'react';

export function PawIcon({ className = 'w-5 h-5', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <img
      src="/paw.png"
      alt=""
      className={className}
      style={{ objectFit: 'contain', ...style }}
    />
  );
}
