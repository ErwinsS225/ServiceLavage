import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

export function buttonStyles({
  variant = 'primary',
  size = 'md',
  className = '',
}: {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
} = {}) {
  // Utilizing CSS variables from src/index.css for radius, focus ring, transition, and spacing
  const baseClasses =
    'relative inline-flex items-center justify-center font-medium transition-all duration-150 rounded-[var(--radius-xl)] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-canvas)] disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98] whitespace-nowrap cursor-pointer';

  const sizeClasses = {
    sm: 'text-xs px-3 py-1.5 gap-1.5 min-h-[32px]',
    md: 'text-sm px-4 py-2.5 gap-2 min-h-[40px]',
    lg: 'text-base px-5 py-3 gap-2.5 min-h-[48px]',
  };

  const variantClasses = {
    primary:
      'bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] active:opacity-90 text-white shadow-[var(--shadow-sm)] border border-indigo-400/30 focus-visible:ring-[var(--brand-accent)]',
    secondary:
      'bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border-subtle)] shadow-[var(--shadow-sm)] focus-visible:ring-[var(--border-strong)]',
    outline:
      'bg-transparent hover:bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border-strong)] focus-visible:ring-[var(--brand-primary)]',
    ghost:
      'bg-transparent hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:ring-[var(--border-strong)]',
    danger:
      'bg-rose-600/90 hover:bg-rose-500 text-white shadow-[var(--shadow-sm)] border border-rose-500/30 focus-visible:ring-rose-400',
    success:
      'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[var(--shadow-sm)] border border-emerald-500/30 focus-visible:ring-emerald-400',
  };

  return `${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`;
}

export function Button({
  type = 'button',
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  children,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={buttonStyles({ variant, size, className })}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin motion-safe-keep text-current" />
      ) : (
        <>
          {icon && iconPosition === 'left' && <span className="shrink-0">{icon}</span>}
          <span>{children}</span>
          {icon && iconPosition === 'right' && <span className="shrink-0">{icon}</span>}
        </>
      )}
    </button>
  );
}
