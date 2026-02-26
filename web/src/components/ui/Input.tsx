import React from 'react';
import { clsx } from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, className, id, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-semibold text-espresso">
          {label}
        </label>
      )}
      <input
        id={inputId}
        {...props}
        className={clsx(
          'w-full rounded-lg border bg-white px-3.5 py-2.5 text-espresso placeholder-taupe text-sm',
          'focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all',
          error ? 'border-red-400 focus:ring-red-400' : 'border-taupe',
          className
        )}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      {hint && !error && <p className="text-xs text-taupe">{hint}</p>}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className, id, ...props }: TextareaProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-semibold text-espresso">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        {...props}
        className={clsx(
          'w-full rounded-lg border bg-white px-3.5 py-2.5 text-espresso placeholder-taupe text-sm resize-none',
          'focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all',
          error ? 'border-red-400 focus:ring-red-400' : 'border-taupe',
          className
        )}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, error, options, className, id, ...props }: SelectProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-semibold text-espresso">
          {label}
        </label>
      )}
      <select
        id={inputId}
        {...props}
        className={clsx(
          'w-full rounded-lg border bg-white px-3.5 py-2.5 text-espresso text-sm',
          'focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all',
          error ? 'border-red-400 focus:ring-red-400' : 'border-taupe',
          className
        )}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
