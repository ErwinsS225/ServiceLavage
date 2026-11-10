import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X, XCircle } from 'lucide-react';

/**
 * Notifications globales (toasts).
 *
 * Écrit à la main plutôt qu'avec `sonner` : ce dont l'application a besoin —
 * afficher un message de succès ou d'erreur au-dessus de l'écran, sans voler le
 * focus — tient en peu de lignes testables, et une bibliothèque supplémentaire
 * se justifie par des fonctions qu'on n'utilise pas ici (promesses, actions
 * dans le toast, positions multiples, thème). Le jour où il faudra cliquer
 * dans un toast pour annuler une action, on rouvrira la question.
 *
 * Accessibilité : deux régions live — `polite` pour les succès, `assertive`
 * pour les erreurs. Le message est doublé d'une icône : la couleur seule ne
 * doit jamais porter l'information.
 *
 * Un toast ne remplace pas l'erreur en ligne : une erreur de champ reste sous
 * son champ (`FormField`), un toast signale le résultat d'une action.
 */

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  variant: ToastVariant;
  message: string;
  /** Détail technique (message serveur) affiché en second plan. */
  detail?: string;
  /** Durée en ms ; `null` garde le toast jusqu'à fermeture manuelle. */
  duration: number | null;
}

/**
 * Émission de toasts. L'objet est créé une fois par provider : sa référence ne
 * change jamais, il peut donc entrer dans une dépendance de `useMemo` ou
 * `useEffect` sans provoquer de boucle.
 */
export interface ToastActions {
  push: (input: Omit<Toast, 'id' | 'duration'> & { duration?: number | null }) => string;
  success: (message: string, detail?: string) => string;
  error: (message: string, detail?: string) => string;
  info: (message: string, detail?: string) => string;
  warning: (message: string, detail?: string) => string;
  dismiss: (id: string) => void;
}

interface ToastApi extends ToastActions {
  toasts: Toast[];
  clear: () => void;
}

/** Actions seules : contexte séparé pour que leur valeur reste stable. */
const ToastActionsContext = createContext<ToastActions | null>(null);
const ToastListContext = createContext<{ toasts: Toast[]; clear: () => void } | null>(null);

/**
 * Durées par défaut. Une erreur reste plus longtemps : elle demande une
 * lecture, pas un simple coup d'œil.
 */
const DEFAULT_DURATION: Record<ToastVariant, number> = {
  success: 3500,
  info: 5000,
  warning: 6000,
  error: 8000,
};

/** Trois toasts au maximum à l'écran : au-delà, ils se recouvrent et se nuisent. */
const MAX_VISIBLE = 3;

let sequence = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts(previous => previous.filter(toast => toast.id !== id));
  }, []);

  const push = useCallback<ToastActions['push']>(
    input => {
      sequence += 1;
      const id = `toast-${sequence}`;
      const duration = input.duration === undefined ? DEFAULT_DURATION[input.variant] : input.duration;
      setToasts(previous => {
        const next = [
          ...previous,
          { id, variant: input.variant, message: input.message, detail: input.detail, duration },
        ];
        // Les plus anciens cèdent la place aux nouveaux.
        return next.slice(-MAX_VISIBLE);
      });
      if (duration !== null) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        );
      }
      return id;
    },
    [dismiss],
  );

  const actions = useMemo<ToastActions>(
    () => ({
      push,
      success: (message, detail) => push({ variant: 'success', message, detail }),
      error: (message, detail) => push({ variant: 'error', message, detail }),
      info: (message, detail) => push({ variant: 'info', message, detail }),
      warning: (message, detail) => push({ variant: 'warning', message, detail }),
      dismiss,
    }),
    [push, dismiss],
  );

  const list = useMemo(() => ({ toasts, clear: () => setToasts([]) }), [toasts]);

  // Tous les minuteurs doivent être annulés au démontage, sinon un toast
  // programmé après un changement d'écran rappelle setState sur un composant
  // disparu.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  return (
    <ToastActionsContext.Provider value={actions}>
      <ToastListContext.Provider value={list}>
        {children}
        <ToastViewport toasts={toasts} onDismiss={dismiss} />
      </ToastListContext.Provider>
    </ToastActionsContext.Provider>
  );
}

/**
 * Émission seule. C'est la forme à utiliser dans les dépendances : la
 * référence ne bouge jamais.
 */
export function useToastActions(): ToastActions {
  const context = useContext(ToastActionsContext);
  if (!context) throw new Error('useToastActions doit être utilisé sous <ToastProvider>.');
  return context;
}

/** Émission + liste courante (pour un écran de débogage ou un test). */
export function useToast(): ToastApi {
  const actions = useToastActions();
  const list = useContext(ToastListContext);
  if (!list) throw new Error('useToast doit être utilisé sous <ToastProvider>.');
  return { ...actions, toasts: list.toasts, clear: list.clear };
}

const STYLES: Record<ToastVariant, { box: string; icon: React.ReactNode }> = {
  success: {
    box: 'border-emerald-500/40 bg-emerald-950/90 text-emerald-100',
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
  },
  error: {
    box: 'border-rose-500/40 bg-rose-950/90 text-rose-100',
    icon: <XCircle className="w-4 h-4 text-rose-400" />,
  },
  warning: {
    box: 'border-amber-500/40 bg-amber-950/90 text-amber-100',
    icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
  },
  info: {
    box: 'border-sky-500/40 bg-sky-950/90 text-sky-100',
    icon: <Info className="w-4 h-4 text-sky-400" />,
  },
};

function ToastViewport({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  const polite = toasts.filter(toast => toast.variant !== 'error');
  const assertive = toasts.filter(toast => toast.variant === 'error');

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[min(22rem,calc(100vw-2rem))]">
      {/* Deux régions : une erreur doit interrompre, un succès attend son tour. */}
      <div aria-live="polite" className="flex flex-col gap-2">
        {polite.map(toast => (
          <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </div>
      <div aria-live="assertive" className="flex flex-col gap-2">
        {assertive.map(toast => (
          <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </div>
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const style = STYLES[toast.variant];
  return (
    <div
      className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 shadow-xl backdrop-blur-sm ${style.box}`}
    >
      <span className="mt-0.5 shrink-0">{style.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold leading-snug">{toast.message}</p>
        {toast.detail && <p className="text-[11px] opacity-80 mt-0.5 break-words">{toast.detail}</p>}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Fermer la notification"
        className="shrink-0 rounded p-1 opacity-70 hover:opacity-100 transition-opacity"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
