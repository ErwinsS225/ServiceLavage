import React from 'react';
import { theme } from '../../styles/theme';

export type StatusVariant =
  | 'en_attente'
  | 'en_cours'
  | 'termine'
  | 'annule'
  | 'active'
  | 'inactive'
  | 'warning'
  | 'success'
  | 'danger'
  | 'info'
  | 'neutral';

const STATUS_CONFIG: Record<
  StatusVariant,
  { label: string; text: string; bg: string; border: string; dot: string }
> = {
  en_attente: {
    label: 'En attente',
    ...theme.colors.status.warning,
  },
  en_cours: {
    label: 'En cours',
    ...theme.colors.status.info,
  },
  termine: {
    label: 'Terminée',
    ...theme.colors.status.success,
  },
  annule: {
    label: 'Annulée',
    ...theme.colors.status.danger,
  },
  active: {
    label: 'Actif',
    ...theme.colors.status.success,
  },
  inactive: {
    label: 'Inactif',
    ...theme.colors.status.neutral,
  },
  success: {
    label: 'Succès',
    ...theme.colors.status.success,
  },
  warning: {
    label: 'Attention',
    ...theme.colors.status.warning,
  },
  danger: {
    label: 'Alerte',
    ...theme.colors.status.danger,
  },
  info: {
    label: 'Info',
    ...theme.colors.status.info,
  },
  neutral: {
    label: 'Neutre',
    ...theme.colors.status.neutral,
  },
};

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'neutral' | 'outline';
  size?: 'sm' | 'md';
  className?: string;
}

export function Badge({ children, variant = 'neutral', size = 'md', className = '' }: BadgeProps) {
  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };

  const variantClasses = {
    primary: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/25',
    secondary: 'bg-sky-500/10 text-sky-400 border border-sky-500/25',
    neutral: 'bg-[var(--surface-elevated)] text-[var(--text-secondary)] border border-[var(--border-subtle)]',
    outline: 'bg-transparent text-[var(--text-primary)] border border-[var(--border-strong)]',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-[var(--radius-md)] ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({
  status,
  label,
  size = 'md',
  className = '',
}: {
  status: StatusVariant;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const conf = STATUS_CONFIG[status] || STATUS_CONFIG.neutral;
  const displayLabel = label ?? conf.label;

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1.5',
    md: 'text-xs px-2.5 py-1 gap-2',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-[var(--radius-md)] border ${conf.bg} ${conf.text} ${conf.border} ${sizeClasses[size]} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${conf.dot} shrink-0`} aria-hidden="true" />
      <span>{displayLabel}</span>
    </span>
  );
}
