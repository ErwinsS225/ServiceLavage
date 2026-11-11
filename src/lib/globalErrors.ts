/**
 * Capture des erreurs que React ne voit pas.
 *
 * Trois familles échappent à `ErrorBoundary` :
 *  - une exception dans un gestionnaire d'événement (le rendu n'a pas lieu,
 *    donc rien n'est capturé) ;
 *  - une promesse rejetée sans `catch` (un `void somePromise()` oublié) ;
 *  - un échec de chargement d'un module découpé (réseau coupé pendant un
 *    `import()`, ce qui arrive précisément en mobilité).
 *
 * Sans ce module, ces trois cas produisaient au mieux une ligne de console, au
 * pire un silence : l'utilisateur voyait un bouton qui ne réagit pas, et
 * personne n'en savait rien.
 *
 * Le module n'affiche **rien** : il journalise. Un bandeau pour chaque
 * exception d'événement serait plus nuisible qu'utile ; c'est aux écrans de
 * gérer leurs erreurs, et ceci est le filet.
 */

import { track } from './telemetry';

let installed = false;

/** Écouteurs branchés, conservés pour pouvoir les retirer (tests, HMR). */
let boundHandlers: {
  error: (event: ErrorEvent) => void;
  rejection: (event: PromiseRejectionEvent) => void;
} | null = null;

export function installGlobalErrorHandlers(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const onError = (event: ErrorEvent) => {
    // `event.error` est absent pour une ressource qui ne charge pas (image,
    // script) : l'information utile est alors la cible, pas une exception.
    if (!event.error) {
      track.warn(
        'ui.ressource_non_chargee',
        {
          cible: event.target instanceof HTMLElement ? event.target.tagName : 'inconnue',
        },
        { message: 'Ressource non chargée' },
      );
      return;
    }

    track.error(
      'ui.erreur_non_capturee',
      event.error,
      {
        fichier: typeof event.filename === 'string' ? event.filename.split('/').pop() : undefined,
        ligne: event.lineno,
      },
      { message: 'Exception non gérée dans un gestionnaire' },
    );
  };

  const onRejection = (event: PromiseRejectionEvent) => {
    // Un `AbortError` est banal : c'est une requête annulée volontairement
    // (changement d'écran, nouvelle frappe). Le compter comme une erreur
    // remplirait le diagnostic de bruit et masquerait les vrais incidents.
    const reason = event.reason as { name?: string } | undefined;
    if (reason?.name === 'AbortError') {
      track.debug('ui.requete_annulee');
      return;
    }

    track.error('ui.promesse_rejetee', event.reason, undefined, {
      message: 'Promesse rejetée sans traitement',
    });
  };

  // `capture: true` n'est pas un détail : un `error` de ressource (image, script,
  // module découpé) ne remonte pas — il ne bulle pas jusqu'à `window`. Un
  // écouteur en phase de bouillonnement ne voyait donc **jamais** l'échec de
  // chargement d'un module, qui est justement le cas fréquent en mobilité.
  window.addEventListener('error', onError, true);
  window.addEventListener('unhandledrejection', onRejection);
  boundHandlers = { error: onError, rejection: onRejection };
}

/**
 * Signale un échec de chargement de module découpé.
 *
 * Appelé par `components/portal/StationModulePanel.tsx` autour de chaque
 * chargement paresseux d'écran — typiquement hors ligne, l'application n'a pas
 * encore mis à jour son cache. Le message à l'écran est géré par l'appelant
 * (l'écran de secours de `Suspense`) ; ici on garde la trace.
 */
export function reportChunkFailure(chunkName: string, error: unknown): void {
  track.error(
    'ui.module_non_charge',
    error,
    { module: chunkName },
    {
      message: 'Module non chargé',
    },
  );
}

/**
 * Retire les écouteurs et remet l'état à zéro.
 *
 * Utile aux tests ; le drapeau seul ne suffisait pas, les écouteurs restant
 * accrochés à `window` s'accumulaient et comptaient chaque événement plusieurs
 * fois.
 */
export function resetGlobalHandlersForTests(): void {
  if (boundHandlers && typeof window !== 'undefined') {
    window.removeEventListener('error', boundHandlers.error, true);
    window.removeEventListener('unhandledrejection', boundHandlers.rejection);
  }
  boundHandlers = null;
  installed = false;
}
