import { useCallback, useEffect, useRef, useState } from 'react';
import { describeError } from '../lib/queryResult';
import { measure } from '../lib/performance';
import { track } from '../lib/telemetry';

/**
 * File hors ligne + synchronisation, extraites de StationOrders.
 *
 * Le module mélangeait quatre choses : lire une file dans `localStorage`,
 * tenter de l'envoyer au serveur, décider quoi faire en cas d'échec, et
 * afficher le tout. Les trois premières n'ont rien à voir avec React ; les
 * laisser dans le composant rendait le chemin de reprise intestable — alors
 * que c'est précisément le chemin qui peut créer un doublon.
 *
 * Propriétés conservées telles quelles, parce qu'elles sont la correction d'un
 * vrai défaut :
 *  - **un seul envoi à la fois** (`syncing`) : un retour du réseau pendant un
 *    envoi ne lance pas une seconde passe concurrente ;
 *  - **une reprise programmée** (`syncAgain`) : si quelque chose s'est mis en
 *    file pendant l'envoi, une passe de plus est faite à la fin, pas avant ;
 *  - **rien n'est retiré de la file sans accusé serveur** : la suppression est
 *    faite par `synchronize*` uniquement après succès, et l'idempotence côté
 *    serveur couvre le cas d'une réponse perdue.
 */

export interface OfflineQueueOptions<T> {
  /** Lit la file courante. Peut lever si la file est illisible. */
  list: () => T[];
  /** Envoie un élément ; doit lever si le serveur ne confirme pas. */
  deliver: (item: T) => Promise<void>;
  /** Envoie la file entière et renvoie le nombre d'éléments confirmés. */
  synchronize: (deliver: (item: T) => Promise<void>) => Promise<{ completed: number; error: unknown | null }>;
  /** `false` désactive l'envoi (hors ligne, rôle non autorisé). */
  canSync: () => boolean;
  /** Appelé après une synchronisation partielle ou complète. */
  onDelivered?: (completed: number) => void;
  /** Message si l'envoi échoue sans message exploitable. */
  fallback: string;
}

export interface OfflineQueue<T> {
  pending: T[];
  error: string;
  message: string;
  /** Relit la file ; lève si elle est illisible. */
  refresh: () => T[];
  /** Tente l'envoi. Sans effet si `canSync()` est faux. */
  sync: () => Promise<void>;
  clearMessage: () => void;
  setError: (message: string) => void;
}

export function useOfflineQueue<T>({
  list,
  deliver,
  synchronize,
  canSync,
  onDelivered,
  fallback,
}: OfflineQueueOptions<T>): OfflineQueue<T> {
  const [pending, setPending] = useState<T[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const syncing = useRef(false);
  const syncAgain = useRef(false);

  // Every callback is read through a ref: `sync` must stay stable (it is used
  // in effects and event listeners) while always calling the latest closure.
  const options = useRef({ list, deliver, synchronize, canSync, onDelivered, fallback });
  options.current = { list, deliver, synchronize, canSync, onDelivered, fallback };

  const refresh = useCallback((): T[] => {
    const queue = options.current.list();
    setPending(queue);
    return queue;
  }, []);

  const sync = useCallback(async (): Promise<void> => {
    const current = options.current;
    if (!current.canSync()) return;
    if (syncing.current) {
      syncAgain.current = true;
      return;
    }
    syncing.current = true;
    setError('');
    try {
      // La synchronisation est mesurée : c'est l'opération dont la lenteur est
      // la plus visible au comptoir, et celle dont on n'avait aucune donnée.
      const result = await measure('offline.synchronisation', () => current.synchronize(current.deliver));
      try {
        refresh();
      } catch {
        /* the original error is more useful */
      }
      if (result.completed > 0) {
        setMessage(`${result.completed} élément(s) confirmé(s) par le serveur.`);
        current.onDelivered?.(result.completed);
        track.info('offline.synchronise', { confirmes: result.completed });
      }
      if (result.error) throw result.error;
    } catch (cause) {
      let remaining = -1;
      try {
        remaining = refresh().length;
      } catch {
        /* keep the original error */
      }
      // Le nombre restant en file est l'information qui manquait : « l'envoi a
      // échoué » ne dit pas si quelque chose a été confirmé au passage.
      track.error(
        'offline.synchronisation_echouee',
        cause,
        { restants: remaining },
        { message: 'Synchronisation de la file locale impossible' },
      );
      setError(describeError(cause, current.fallback));
    } finally {
      syncing.current = false;
      if (syncAgain.current) {
        syncAgain.current = false;
        void sync();
      }
    }
  }, [refresh]);

  // A queue read at mount keeps the banner correct before the first attempt,
  // and the two window events cover the cases React cannot see.
  useEffect(() => {
    const onOnline = () => {
      void sync();
    };
    const onStorage = () => {
      try {
        refresh();
      } catch (cause) {
        // Une file illisible est grave : les opérations existent toujours dans
        // `localStorage` mais l'application ne sait plus les lire. Sans trace,
        // ce cas était indiscernable d'une file vide.
        track.error('offline.file_illisible', cause, undefined, {
          message: 'File locale illisible depuis un autre onglet',
        });
        setError('File locale illisible ; elle a été conservée.');
      }
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('storage', onStorage);
    };
  }, [refresh, sync]);

  return {
    pending,
    error,
    message,
    refresh,
    sync,
    clearMessage: useCallback(() => setMessage(''), []),
    setError,
  };
}
