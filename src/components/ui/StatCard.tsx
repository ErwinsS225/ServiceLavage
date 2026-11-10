import React from 'react';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon?: React.ReactNode;
  trend?: { label: string; positive?: boolean };
}

export function StatCard({
  title,
  value,
  subtext,
  icon,
  trend,
}: StatCardProps) {
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 sm:p-5 flex flex-col justify-between">
      <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
        <span className="font-medium">{title}</span>
        {icon && <span className="p-1.5 rounded-lg bg-[var(--surface-elevated)] text-slate-300 border border-[#2a3040]">{icon}</span>}
      </div>
      <div className="mt-3">
        <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-[var(--text-primary)] tracking-tight">
          {value}
        </div>
        {subtext && <p className="text-xs text-[var(--text-secondary)] mt-1">{subtext}</p>}
        {trend && (
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-medium mt-2 ${
              trend.positive ? 'text-emerald-400' : 'text-[var(--text-secondary)]'
            }`}
          >
            {trend.label}
          </span>
        )}
      </div>
    </div>
  );
}
