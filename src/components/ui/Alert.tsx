import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

export interface AlertProps {
  variant?: 'info' | 'warning' | 'success' | 'error';
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function Alert({
  variant = 'info',
  title,
  children,
  action,
  className = '',
}: AlertProps) {
  const configs = {
    info: {
      role: 'status',
      icon: <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />,
      border: 'border-sky-500/30',
      bg: 'bg-sky-500/10',
      text: 'text-sky-300',
    },
    warning: {
      role: 'alert',
      icon: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />,
      border: 'border-amber-500/30',
      bg: 'bg-amber-500/10',
      text: 'text-amber-300',
    },
    success: {
      role: 'status',
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />,
      border: 'border-emerald-500/30',
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-300',
    },
    error: {
      role: 'alert',
      icon: <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />,
      border: 'border-rose-500/30',
      bg: 'bg-rose-500/10',
      text: 'text-rose-300',
    },
  };

  const c = configs[variant];

  return (
    <div
      role={c.role}
      className={`rounded-xl border ${c.border} ${c.bg} p-3.5 text-xs sm:text-sm ${c.text} flex items-start gap-3 ${className}`}
    >
      {c.icon}
      <div className="flex-1 space-y-1">
        {title && <h4 className="font-semibold">{title}</h4>}
        <div className="leading-relaxed">{children}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
