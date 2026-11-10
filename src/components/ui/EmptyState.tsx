import React from 'react';

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-[#10131a]/50 p-8 text-center flex flex-col items-center justify-center space-y-3">
      {icon && (
        <div className="w-12 h-12 rounded-xl bg-[var(--surface-elevated)] border border-[#292f3f] flex items-center justify-center text-[var(--text-secondary)] mb-1">
          {icon}
        </div>
      )}
      <div className="space-y-1 max-w-sm">
        <h4 className="text-sm font-bold text-[var(--text-primary)]">{title}</h4>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{description}</p>
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
