import React, { useCallback, useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * Boîte de dialogue modale.
 *
 * Une modale qui ne fait que s'afficher n'est pas une modale : au clavier, le
 * focus continue de se promener dans la page en arrière-plan, et un lecteur
 * d'écran annonce du contenu que l'utilisateur ne peut pas voir. Ce composant
 * remplit les quatre conditions qui rendent une modale utilisable :
 *
 *  1. **le focus entre** dans la boîte à l'ouverture (sur le premier élément
 *     interactif, ou la boîte elle-même s'il n'y en a aucun) ;
 *  2. **il y reste** : `Tab` et `Maj+Tab` bouclent sur les éléments focusables
 *     de la modale, jamais sur le fond ;
 *  3. **il ressort** au bon endroit : à la fermeture, le focus revient sur
 *     l'élément qui avait ouvert la modale — sinon l'utilisateur clavier
 *     repart du début de la page ;
 *  4. **il est annoncé** : `role="dialog"`, `aria-modal`, et un titre relié par
 *     un identifiant **unique** (`useId`). Un identifiant fixe faisait que deux
 *     modales ouvertes en même temps étaient toutes deux étiquetées par le
 *     titre de la première.
 *
 * Le fond est `aria-hidden` et retiré de l'ordre de tabulation (une `div` ne
 * l'était de toute façon pas) : on ne peut donc pas le focus, ce qui est le
 * comportement attendu puisqu'il ne sert qu'au clic.
 */
export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  /** Élément qui avait le focus avant l'ouverture : il le récupère après. */
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  const focusInside = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const target = firstFocusable(dialog) ?? dialog;
    target.focus();
  }, []);

  // Mémorise l'origine du focus, puis le déplace dans la boîte.
  useEffect(() => {
    if (!isOpen) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Après le rendu : les enfants doivent exister pour être focusables.
    const frame = requestAnimationFrame(focusInside);
    return () => cancelAnimationFrame(frame);
  }, [isOpen, focusInside]);

  // Rend le focus à l'ouverture de la modale quand elle se ferme.
  useEffect(() => {
    if (isOpen) return;
    const origin = returnFocusRef.current;
    if (origin && document.contains(origin)) origin.focus();
    returnFocusRef.current = null;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = focusableElements(dialog);
      if (focusable.length === 0) {
        // Rien à parcourir : le focus reste sur la boîte, jamais derrière.
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-3xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/*
        Le fond ferme au clic mais n'est ni focusable ni annoncé : il est
        décoratif. Le fermer au clavier se fait par `Échap` ou par le bouton
        « Fermer », tous deux présents.
      */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        // `-1` autorise le focus programmatique sur la boîte elle-même quand
        // elle ne contient aucun élément interactif.
        tabIndex={-1}
        className={`relative w-full ${sizeClasses[size]} rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-card)] text-[var(--text-primary)] shadow-2xl my-8 z-10 overflow-hidden flex flex-col max-h-[90vh]`}
      >
        <div className="flex items-start justify-between gap-4 p-5 border-b border-[var(--border-subtle)]">
          <div>
            <h2 id={titleId} className="text-base font-bold text-[var(--text-primary)] tracking-tight">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="text-xs text-[var(--text-secondary)] mt-0.5">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">{children}</div>

        {footer && (
          <div className="p-4 sm:px-6 bg-[var(--surface-elevated)] border-t border-[var(--border-subtle)] flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Éléments atteignables au clavier, dans l'ordre du DOM.
 *
 * Les éléments `[tabindex="-1"]` sont exclus : ils sont focusables par script
 * mais pas par `Tab`, donc les inclure casserait la boucle. Les éléments
 * masqués (`display:none`, `visibility:hidden`) sont filtrés par
 * `offsetParent`, avec une exception pour `position:fixed`.
 */
function focusableElements(root: HTMLElement): HTMLElement[] {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(element => {
    if (element.hasAttribute('hidden')) return false;
    if (element.getAttribute('aria-hidden') === 'true') return false;
    // `offsetParent` est nul pour `display:none` ; il est aussi nul pour
    // `position:fixed`, d'où le second test.
    return element.offsetParent !== null || element.style.position === 'fixed';
  });
}

function firstFocusable(root: HTMLElement): HTMLElement | null {
  const elements = focusableElements(root);
  // `autoFocus` sur un champ n'entre pas en concurrence : il s'applique au
  // montage, cette fonction après. Le premier élément interactif reste le choix
  // prévisible.
  return elements[0] ?? null;
}
