/**
 * Diagnostics hors ligne.
 *
 * Le sujet n'est pas « suis-je en ligne ? » — `useOnlineStatus` y répond déjà —
 * mais « **qu'est-ce qui n'est pas encore arrivé au serveur, et pourquoi ?** ».
 * C'est la question qu'un caissier pose au téléphone, et à laquelle
 * l'application ne savait pas répondre : la file d'attente existait, personne
 * ne pouvait la voir.
 *
 * Ce module ne lit ni n'écrit rien : il reçoit une description de l'état et la
 * rend lisible. Les lectures de `localStorage` restent dans `offlineOrders` et
 * `offlineInventory`, qui sont testés séparément.
 */

import type { LogEvent } from './telemetry';

export type Severity = 'ok' | 'attention' | 'bloquant';

export interface DiagnosticLine {
  /** Nom stable du contrôle, pour un test ou un filtre. */
  check: string;
  severity: Severity;
  /** Ce qui a été constaté, en une phrase. */
  detail: string;
  /** Ce que l'utilisateur peut faire, s'il y a quelque chose à faire. */
  action?: string;
}

export interface OfflineState {
  online: boolean;
  /** Éléments en attente d'envoi, toutes files confondues. */
  queuedOrders: number;
  queuedAdjustments: number;
  /** Message d'erreur de la dernière synchronisation, s'il y en a un. */
  syncError: string | null;
  /** Version de l'application servie par le service worker, si connue. */
  appVersion: string;
  /** Événements récents, pour la partie « ce qui a échoué ». */
  events: LogEvent[];
}

/**
 * Construit la liste des constats, du plus grave au moins grave.
 *
 * Principe : ne jamais rassurer à tort. « Hors ligne » n'est pas une panne si
 * la file est vide, mais c'est un problème si trois prestations attendent et que
 * le caissier s'apprête à fermer la caisse.
 */
export function diagnose(state: OfflineState): DiagnosticLine[] {
  const lines: DiagnosticLine[] = [];
  const pending = state.queuedOrders + state.queuedAdjustments;

  if (!state.online && pending === 0) {
    lines.push({
      check: 'reseau',
      severity: 'attention',
      detail: 'Hors ligne. Aucune opération en attente.',
      action:
        'Les consultations déjà chargées restent disponibles. Les écritures sont mises en file sur cet appareil et partiront au retour du réseau.',
    });
  } else if (!state.online) {
    lines.push({
      check: 'reseau',
      severity: 'bloquant',
      detail: `Hors ligne avec ${pending} opération${pending > 1 ? 's' : ''} en attente d’envoi.`,
      action:
        'Ne videz pas les données du navigateur et ne désinstallez pas l’application : la file est stockée sur cet appareil. Reconnectez-vous au réseau pour qu’elle parte.',
    });
  } else if (pending > 0) {
    lines.push({
      check: 'reseau',
      severity: 'attention',
      detail: `En ligne, ${pending} opération${pending > 1 ? 's' : ''} encore en attente.`,
      action:
        'La synchronisation est en cours ou n’a pas encore été relancée. Utilisez « Synchroniser » sur le module concerné.',
    });
  } else {
    lines.push({ check: 'reseau', severity: 'ok', detail: 'En ligne, aucune opération en attente.' });
  }

  if (state.syncError) {
    lines.push({
      check: 'synchronisation',
      severity: 'bloquant',
      detail: state.syncError,
      action:
        'La file est conservée. Vérifiez le réseau, puis relancez la synchronisation ; rien n’est envoyé deux fois grâce à l’identifiant d’idempotence.',
    });
  }

  const errors = state.events.filter(event => event.level === 'error');
  if (errors.length > 0) {
    // On compte par empreinte : « la même panne 8 fois » n'est pas la même
    // information que « 8 pannes différentes ».
    const grouped = new Map<string, number>();
    for (const event of errors) {
      const key = event.fingerprint ?? event.event;
      grouped.set(key, (grouped.get(key) ?? 0) + 1);
    }
    lines.push({
      check: 'erreurs',
      severity: 'attention',
      detail: `${errors.length} erreur${errors.length > 1 ? 's' : ''} enregistrée${errors.length > 1 ? 's' : ''} sur cet appareil (${grouped.size} distincte${grouped.size > 1 ? 's' : ''}).`,
      action: 'Ouvrez le détail pour voir quel écran était concerné, puis transmettez l’export au support.',
    });
  }

  if (state.queuedOrders > 0) {
    lines.push({
      check: 'file_prestations',
      severity: 'attention',
      detail: `${state.queuedOrders} prestation${state.queuedOrders > 1 ? 's' : ''} enregistrée${state.queuedOrders > 1 ? 's' : ''} sur cet appareil, pas encore confirmée${state.queuedOrders > 1 ? 's' : ''} par le serveur.`,
      action:
        'Ne pas imprimer de reçu définitif avant la synchronisation : le numéro de prestation vient du serveur.',
    });
  }

  if (state.queuedAdjustments > 0) {
    lines.push({
      check: 'file_inventaire',
      severity: 'attention',
      detail: `${state.queuedAdjustments} ajustement${state.queuedAdjustments > 1 ? 's' : ''} de stock en attente.`,
      action:
        'Le stock affiché peut différer du serveur jusqu’à la synchronisation. Un ajustement qui rendrait le stock négatif sera refusé au retour du réseau.',
    });
  }

  lines.push({ check: 'version', severity: 'ok', detail: `Version servie : ${state.appVersion}.` });

  return lines;
}

/** Une ligne de résumé, pour un bandeau : la plus grave d'abord. */
export function headline(lines: DiagnosticLine[]): string {
  const worst =
    lines.find(line => line.severity === 'bloquant') ?? lines.find(line => line.severity === 'attention');
  return worst?.detail ?? 'Aucun problème détecté sur cet appareil.';
}
