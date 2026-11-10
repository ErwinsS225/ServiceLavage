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
    <div className="rounded-2xl border border-dashed border-[#2b3140] bg-[#10131a]/50 p-8 text-center flex flex-col items-center justify-center space-y-3">
      {icon && (
        <div className="w-12 h-12 rounded-xl bg-[#181c26] border border-[#292f3f] flex items-center justify-center text-slate-400 mb-1">
          {icon}
        </div>
      )}
      <div className="space-y-1 max-w-sm">
        <h4 className="text-sm font-bold text-white">{title}</h4>
        <p className="text-xs text-slate-400 leading-relaxed">{description}</p>
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
