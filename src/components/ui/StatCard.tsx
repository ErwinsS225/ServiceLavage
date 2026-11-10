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
    <div className="rounded-2xl border border-[#232834] bg-[#12151c] p-4 sm:p-5 flex flex-col justify-between">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="font-medium">{title}</span>
        {icon && <span className="p-1.5 rounded-lg bg-[#181c26] text-slate-300 border border-[#2a3040]">{icon}</span>}
      </div>
      <div className="mt-3">
        <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-white tracking-tight">
          {value}
        </div>
        {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
        {trend && (
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-medium mt-2 ${
              trend.positive ? 'text-emerald-400' : 'text-slate-400'
            }`}
          >
            {trend.label}
          </span>
        )}
      </div>
    </div>
  );
}
