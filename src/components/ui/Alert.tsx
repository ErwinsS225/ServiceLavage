import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

export interface AlertProps {
  variant?: 'info' | 'warning' | 'success' | 'error';
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Message d'état en ligne.
 *
 * Deux corrections par rapport à la version précédente, toutes deux mesurées :
 *
 * 1. **Contraste en mode clair.** Le texte utilisait `text-rose-300` sur
 *    `bg-rose-500/10`. Sur fond sombre c'est excellent (8,83:1) ; sur fond
 *    blanc, la même paire tombe à **1,66:1**, très en dessous du minimum de
 *    4,5:1. Les couleurs de texte sont désormais des jetons qui basculent avec
 *    le thème (`--alert-*-text`), pas des teintes choisies pour un seul fond.
 *
 * 2. **Rôle ARIA correct.** `role="alert"` sur un message de succès fait
 *    interrompre la lecture en cours pour dire « c'est enregistré » : c'est
 *    agressif et, répété, épuisant. `role="status"` (poli) suffit pour un
 *    succès ou une information ; `role="alert"` (assertif) est réservé à ce qui
 *    bloque l'utilisateur — une erreur, un avertissement.
 *
 * La couleur n'est jamais seule porteuse du sens : chaque variante a une icône
 * et, quand il y a un titre, un texte explicite.
 */
export function Alert({ variant = 'info', title, children, action, className = '' }: AlertProps) {
  const configs = {
    info: {
      role: 'status' as const,
      icon: <Info className="w-4 h-4 text-[var(--alert-info-icon)] shrink-0 mt-0.5" aria-hidden="true" />,
      box: 'border-[var(--alert-info-border)] bg-[var(--alert-info-bg)] text-[var(--alert-info-text)]',
    },
    warning: {
      // Un avertissement peut faire perdre du travail : il interrompt.
      role: 'alert' as const,
      icon: (
        <AlertTriangle
          className="w-4 h-4 text-[var(--alert-warning-icon)] shrink-0 mt-0.5"
          aria-hidden="true"
        />
      ),
      box: 'border-[var(--alert-warning-border)] bg-[var(--alert-warning-bg)] text-[var(--alert-warning-text)]',
    },
    success: {
      role: 'status' as const,
      icon: (
        <CheckCircle2
          className="w-4 h-4 text-[var(--alert-success-icon)] shrink-0 mt-0.5"
          aria-hidden="true"
        />
      ),
      box: 'border-[var(--alert-success-border)] bg-[var(--alert-success-bg)] text-[var(--alert-success-text)]',
    },
    error: {
      // Une erreur empêche d'avancer : elle interrompt.
      role: 'alert' as const,
      icon: (
        <AlertCircle className="w-4 h-4 text-[var(--alert-error-icon)] shrink-0 mt-0.5" aria-hidden="true" />
      ),
      box: 'border-[var(--alert-error-border)] bg-[var(--alert-error-bg)] text-[var(--alert-error-text)]',
    },
  };

  const c = configs[variant];

  return (
    <div
      role={c.role}
      className={`rounded-xl border ${c.box} p-3.5 text-xs sm:text-sm flex items-start gap-3 ${className}`}
    >
      {c.icon}
      <div className="flex-1 space-y-1">
        {title && <h3 className="font-semibold">{title}</h3>}
        <div className="leading-relaxed">{children}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
