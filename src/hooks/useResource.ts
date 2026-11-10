import { useCallback, useEffect, useRef, useState } from 'react';
import { describeError } from '../lib/queryResult';

/**
 * Chargement d'une ressource de station (catalogue, clients, inventaire…) avec
 * ses trois états et un rechargement explicite.
 *
 * Avant, chaque module recopiait `loading / error / reload` et un
 * `useEffect(..., [stationId, reload])`. Trois conséquences : un écran pouvait
 * oublier de réinitialiser `loading`, un autre oublier d'ignorer la réponse
 * d'une station déjà quittée, et aucun ne pouvait être testé sans DOM.
 *
 * Ici : une seule implémentation, qui ignore la réponse d'un chargement
 * périmé (`active`), qui remonte le message d'erreur traduit, et qui expose
 * `reload()` sans dépendre d'un compteur.
 */
export interface Resource<T> {
  data: T;
  loading: boolean;
  error: string;
  /** Recharge la ressource ; la promesse se résout à la fin du chargement. */
  reload: () => void;
  /** Remplace la donnée localement (après une création ou une mise à jour). */
  setData: (updater: T | ((previous: T) => T)) => void;
  setError: (message: string) => void;
}

export interface UseResourceOptions<T> {
  /** Message affiché si le chargement échoue sans message exploitable. */
  fallback: string;
  /** Donnée initiale (tableau vide dans la plupart des cas). */
  initial: T;
  /** `false` suspend le chargement (ex. hors ligne, droits non confirmés). */
  enabled?: boolean;
}

export function useResource<T>(
  load: () => Promise<T>,
  deps: readonly unknown[],
  { fallback, initial, enabled = true }: UseResourceOptions<T>,
): Resource<T> {
  const [data, setDataState] = useState<T>(initial);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');
  const [nonce, setNonce] = useState(0);
  // The loader is recreated on every render by callers; the ref keeps the
  // effect dependent on the caller's `deps`, not on the closure identity.
  const loaderRef = useRef(load);
  loaderRef.current = load;

  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    setError('');
    loaderRef.current()
      .then(value => { if (active) setDataState(value); })
      .catch((cause: unknown) => { if (active) setError(describeError(cause, fallback)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, nonce, fallback, ...deps]);

  const reload = useCallback(() => setNonce(value => value + 1), []);
  const setData = useCallback((updater: T | ((previous: T) => T)) => {
    setDataState(previous => (typeof updater === 'function' ? (updater as (p: T) => T)(previous) : updater));
  }, []);

  return { data, loading, error, reload, setData, setError };
}
