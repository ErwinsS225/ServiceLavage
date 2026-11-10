import React from 'react';

export function Table({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
      <table className={`w-full text-left text-sm text-slate-300 ${className}`}>{children}</table>
    </div>
  );
}

export function TableHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <thead className={`bg-[var(--surface-elevated)] text-[11px] uppercase tracking-wider text-[var(--text-secondary)] font-semibold border-b border-[var(--border-subtle)] ${className}`}>
      {children}
    </thead>
  );
}

export function TableBody({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <tbody className={`divide-y divide-[var(--border-subtle)] bg-[var(--surface-card)] ${className}`}>{children}</tbody>;
}

export function TableRow({ children, className = '', onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <tr
      onClick={onClick}
      className={`transition-colors hover:bg-white/[0.02] ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {children}
    </tr>
  );
}

export function TableHead({
  children,
  align = 'left',
  className = '',
}: {
  children: React.ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
}) {
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return <th className={`px-4 py-3 font-semibold ${alignClass} ${className}`}>{children}</th>;
}

export function TableCell({
  children,
  align = 'left',
  className = '',
}: {
  children: React.ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
}) {
  const alignClass = align === 'right' ? 'text-right font-mono tabular-nums' : align === 'center' ? 'text-center' : 'text-left';
  return <td className={`px-4 py-3.5 text-xs sm:text-sm text-slate-200 ${alignClass} ${className}`}>{children}</td>;
}
