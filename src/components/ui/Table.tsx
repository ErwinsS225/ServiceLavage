import React from 'react';

export function Table({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-[#232834]">
      <table className={`w-full text-left text-sm text-slate-300 ${className}`}>{children}</table>
    </div>
  );
}

export function TableHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <thead className={`bg-[#171b24] text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-[#232834] ${className}`}>
      {children}
    </thead>
  );
}

export function TableBody({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <tbody className={`divide-y divide-[#1e2330] bg-[#12151c] ${className}`}>{children}</tbody>;
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
