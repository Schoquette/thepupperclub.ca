import React from 'react';
import { clsx } from 'clsx';

type BadgeVariant = 'gold' | 'green' | 'red' | 'blue' | 'gray' | 'taupe';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variants: Record<BadgeVariant, string> = {
  gold:  'bg-yellow-100 text-yellow-800',
  green: 'bg-green-100 text-green-800',
  red:   'bg-red-100 text-red-800',
  blue:  'bg-blue-100 text-blue-800',
  gray:  'bg-gray-100 text-gray-700',
  taupe: 'bg-stone-100 text-stone-700',
};

export function Badge({ variant = 'gray', children, className }: BadgeProps) {
  return (
    <span className={clsx(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
      variants[variant],
      className
    )}>
      {children}
    </span>
  );
}

export function statusBadge(status: string): BadgeVariant {
  switch (status) {
    case 'active':    return 'green';
    case 'pending':   return 'gold';
    case 'inactive':  return 'gray';
    case 'paid':      return 'green';
    case 'sent':      return 'blue';
    case 'overdue':   return 'red';
    case 'draft':     return 'gray';
    case 'cancelled': return 'red';
    case 'completed': return 'green';
    case 'scheduled': return 'blue';
    case 'checked_in':return 'gold';
    default:          return 'gray';
  }
}
