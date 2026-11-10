import React from 'react';
import { AlertCircle } from 'lucide-react';

export const formControlStyles = {
  input:
    'w-full rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-strong)] px-4 py-2.5 text-sm text-white placeholder:text-[var(--text-muted)] outline-none transition-all duration-150 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed',
  select:
    'w-full rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-strong)] px-4 py-2.5 text-sm text-white outline-none transition-all duration-150 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50',
  textarea:
    'w-full rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-strong)] px-4 py-2.5 text-sm text-white placeholder:text-[var(--text-muted)] outline-none transition-all duration-150 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50',
};

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`${formControlStyles.input} ${error ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : ''} ${className}`}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', error, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={`${formControlStyles.select} ${error ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : ''} ${className}`}
        {...props}
      >
        {children}
      </select>
    );
  },
);
Select.displayName = 'Select';

export function FormField({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  className = '',
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="block text-xs font-semibold text-slate-300">
        {label}
        {required && (
          <span className="text-rose-400 ml-1" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-rose-400 flex items-center gap-1.5 mt-1 font-medium">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p className="text-[11px] text-[var(--text-secondary)] mt-1">{hint}</p>
      ) : null}
    </div>
  );
}
