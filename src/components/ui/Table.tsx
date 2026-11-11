import React from 'react';

export function Table({
  children,
  className = '',
  label,
}: {
  children: React.ReactNode;
  className?: string;
  /**
   * Nom du tableau, pour les lecteurs d'écran. Un tableau sans nom est annoncé
   * comme « tableau » sans que l'utilisateur sache ce qu'il liste — il y en a
   * un par module, donc la confusion est certaine.
   */
  label?: string;
}) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
      <table
        aria-label={label}
        className={`w-full text-left text-sm text-[var(--text-primary)] ${className}`}
      >
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <thead
      className={`bg-[var(--surface-elevated)] text-[11px] uppercase tracking-wider text-[var(--text-secondary)] font-semibold border-b border-[var(--border-subtle)] ${className}`}
    >
      {children}
    </thead>
  );
}

export function TableBody({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <tbody className={`divide-y divide-[var(--border-subtle)] bg-[var(--surface-card)] ${className}`}>
      {children}
    </tbody>
  );
}

export function TableRow({
  children,
  className = '',
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
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
  // `scope="col"` : sans lui, l'association en-tête/cellule dépend du
  // navigateur (heuristique). Un lecteur d'écran annonce alors « 5 000 » sans
  // dire « Tarif ».
  return (
    <th scope="col" className={`px-4 py-3 font-semibold ${alignClass} ${className}`}>
      {children}
    </th>
  );
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
  const alignClass =
    align === 'right'
      ? 'text-right font-mono tabular-nums'
      : align === 'center'
        ? 'text-center'
        : 'text-left';
  return (
    <td className={`px-4 py-3.5 text-xs sm:text-sm text-slate-200 ${alignClass} ${className}`}>{children}</td>
  );
}
