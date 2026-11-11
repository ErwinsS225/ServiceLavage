import { LogOut, Sun, Moon } from 'lucide-react';
import { BrandLogo, buttonStyles } from '../ui/designSystem';
import { useTheme } from '../../context/ThemeContext';

/**
 * En-tête du portail : identité, thème, déconnexion.
 * Extrait de `OwnerPortal`, dont il représentait un quart du rendu.
 */
export function PortalHeader({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const { isDarkMode, toggleDarkMode } = useTheme();

  return (
    <header className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-4">
        <BrandLogo size="md" showTagline={true} />
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] block">
            Compte actif
          </span>
          <span className="text-xs font-mono text-[var(--text-secondary)] font-medium">{email}</span>
        </div>
        <button
          type="button"
          aria-label={isDarkMode ? 'Passer en mode clair' : 'Passer en mode sombre'}
          className={buttonStyles({ variant: 'outline', size: 'sm' })}
          onClick={toggleDarkMode}
        >
          {isDarkMode ? (
            <Sun className="w-3.5 h-3.5 mr-1.5 text-amber-300" />
          ) : (
            <Moon className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
          )}
          {isDarkMode ? 'Clair' : 'Sombre'}
        </button>
        <button
          type="button"
          className={buttonStyles({ variant: 'outline', size: 'sm' })}
          onClick={onSignOut}
        >
          <LogOut className="w-3.5 h-3.5 mr-1.5 text-[var(--text-muted)]" />
          Se déconnecter
        </button>
      </div>
    </header>
  );
}
