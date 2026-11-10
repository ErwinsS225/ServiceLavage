import { useCallback } from 'react';

/**
 * Lecture / écriture d'un instantané dans `localStorage`, avec validation.
 *
 * Le mode hors ligne du projet repose sur ces instantanés (catalogue et
 * clients de la station). Ils étaient lus et écrits à la main dans chaque
 * module, sans validation : un cache corrompu faisait planter le rendu au lieu
 * d'être ignoré. Ici la lecture est validée, l'écriture ne fait jamais échouer
 * l'appelant (un quota plein ne doit pas empêcher d'afficher des données
 * fraîches) et l'erreur est remontée pour que l'écran la montre.
 */
export interface LocalCache<T> {
  read: () => T | null;
  write: (value: T) => void;
  clear: () => void;
}

export function useLocalCache<T>(
  key: string | null,
  isValid: (value: unknown) => value is T,
): LocalCache<T> {
  const read = useCallback((): T | null => {
    if (!key) return null;
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValid(parsed)) throw new Error('Les données locales sont invalides ; elles ont été ignorées.');
    return parsed;
  }, [key, isValid]);

  const write = useCallback((value: T) => {
    if (!key) return;
    localStorage.setItem(key, JSON.stringify(value));
  }, [key]);

  const clear = useCallback(() => {
    if (key) localStorage.removeItem(key);
  }, [key]);

  return { read, write, clear };
}

/** Validateur simple : un tableau dont chaque élément passe `isItem`. */
export function isArrayOf<T>(isItem: (value: unknown) => value is T): (value: unknown) => value is T[] {
  return (value: unknown): value is T[] => Array.isArray(value) && value.every(isItem);
}
