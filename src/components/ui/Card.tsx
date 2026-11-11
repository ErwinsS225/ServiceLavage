import React from 'react';

export function Card({
  children,
  className = '',
  role,
  ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  role?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      role={role}
      aria-label={ariaLabel}
      className={`rounded-[var(--radius-2xl)] border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-primary)] shadow-[var(--shadow-card)] transition-all duration-200 ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className = '',
  action,
}: {
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={`p-5 sm:p-6 border-b border-[var(--border-subtle)] flex items-center justify-between gap-4 ${className}`}
    >
      <div className="space-y-1 min-w-0">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardTitle({
  children,
  className = '',
  as: Component = 'h2',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'span';
}) {
  return (
    <Component className={`text-base font-bold text-[var(--text-primary)] tracking-tight ${className}`}>
      {children}
    </Component>
  );
}

export function CardDescription({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <p className={`text-xs text-[var(--text-secondary)] leading-relaxed ${className}`}>{children}</p>;
}

export function CardContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`p-5 sm:p-6 ${className}`}>{children}</div>;
}

export function CardFooter({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`px-5 py-4 sm:px-6 bg-[var(--surface-elevated)] border-t border-[var(--border-subtle)] rounded-b-[var(--radius-2xl)] flex items-center justify-between gap-4 text-xs ${className}`}
    >
      {children}
    </div>
  );
}
