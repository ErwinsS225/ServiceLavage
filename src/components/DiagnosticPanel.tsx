import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from './ui/Alert';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { copyDiagnostics, downloadDiagnostics } from '../lib/diagnosticsExport';
import { diagnose, type DiagnosticLine } from '../lib/offlineDiagnostics';
import { listQueuedInventoryAdjustments } from '../lib/offlineInventory';
import { listQueuedOrders } from '../lib/offlineOrders';
import { summary } from '../lib/performance';
import { recentEvents, type LogEvent } from '../lib/telemetry';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

/**
 * Diagnostic lisible par un caissier, sur un téléphone, sans console.
 *
 * Le problème que ce panneau résout : quand une prestation ne partait pas, la
 * seule trace vivait dans la console du navigateur — inaccessible sur un
 * téléphone, et de toute façon illisible pour le personnel de station. Il
 * répond à trois questions, dans cet ordre :
 *
 *  1. qu'est-ce qui est en attente d'envoi **sur cet appareil** ;
 *  2. qu'est-ce qui a échoué récemment, et sur quel écran ;
 *  3. que faut-il transmettre au support (l'export JSON).
 *
 * Ce qu'il ne prétend pas faire : diagnostiquer le serveur. Tout ce qui est
 * affiché vient du navigateur. La latence serveur et les erreurs PostgreSQL
 * n'y figurent pas parce qu'on ne peut pas les connaître d'ici ; prétendre le
 * contraire serait pire que l'absence de panneau.
 */

/** Périmètre de lecture de la file : l'utilisateur et la station courants. */
export interface DiagnosticPerimeter {
  userId: string;
  stationId: string;
  stationName: string;
}

/**
 * Lit les deux files locales pour le périmètre donné. Ne lève pas.
 *
 * Un stockage indisponible — navigation privée verrouillée, cookies bloqués —
 * est signalé comme **illisible**, jamais comme vide : répondre « 0 en attente »
 * quand on ne peut pas lire la file est exactement le mensonge qui fait fermer
 * une caisse en laissant la journée sur l'appareil.
 */
function countQueues(perimeter: DiagnosticPerimeter | null): {
  orders: number;
  adjustments: number;
  unreadable: string;
} {
  if (!perimeter) return { orders: 0, adjustments: 0, unreadable: '' };
  let storage: Storage;
  try {
    if (typeof window === 'undefined' || !window.localStorage) throw new Error('absent');
    storage = window.localStorage;
  } catch {
    return {
      orders: 0,
      adjustments: 0,
      unreadable:
        'Le stockage local est inaccessible dans ce navigateur : impossible de vérifier si des opérations attendent.',
    };
  }

  let orders = 0;
  let adjustments = 0;
  const problems: string[] = [];
  try {
    orders = listQueuedOrders(storage, perimeter.userId, perimeter.stationId).length;
  } catch (cause) {
    problems.push(cause instanceof Error ? cause.message : 'File de prestations illisible.');
  }
  try {
    adjustments = listQueuedInventoryAdjustments(storage, perimeter.userId, perimeter.stationId).length;
  } catch (cause) {
    problems.push(cause instanceof Error ? cause.message : 'File d’inventaire illisible.');
  }
  return { orders, adjustments, unreadable: problems.join(' ') };
}

const SEVERITY_STYLE: Record<DiagnosticLine['severity'], { label: string; className: string }> = {
  ok: { label: 'OK', className: 'text-[var(--alert-success-icon)]' },
  attention: { label: 'À surveiller', className: 'text-[var(--alert-warning-icon)]' },
  bloquant: { label: 'Bloquant', className: 'text-[var(--alert-error-icon)]' },
};

/** Une ligne du journal, rendue lisible : heure, niveau, action, contexte restreint. */
function EventRow({ event }: { event: LogEvent }) {
  const time = new Date(event.at);
  return (
    <li className="flex flex-col gap-0.5 border-b border-[var(--border-subtle)] pb-2 last:border-0">
      <div className="flex items-center gap-2">
        <span className="tabular-nums text-[11px] text-[var(--text-muted)]">
          {time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
        <span
          className={`text-[11px] font-semibold uppercase ${
            event.level === 'error'
              ? 'text-[var(--alert-error-icon)]'
              : event.level === 'warn'
                ? 'text-[var(--alert-warning-icon)]'
                : 'text-[var(--text-secondary)]'
          }`}
        >
          {event.level}
        </span>
        <span className="font-mono text-xs text-[var(--text-primary)]">{event.event}</span>
      </div>
      {event.message && <p className="text-xs text-[var(--text-secondary)]">{event.message}</p>}
      {event.context && Object.keys(event.context).length > 0 && (
        <p className="font-mono text-[11px] break-all text-[var(--text-muted)]">
          {Object.entries(event.context)
            .map(([key, value]) => `${key}=${String(value)}`)
            .join(' · ')}
        </p>
      )}
    </li>
  );
}

export function DiagnosticPanel({
  isOpen,
  onClose,
  perimeter,
  appVersion,
}: {
  isOpen: boolean;
  onClose: () => void;
  perimeter: DiagnosticPerimeter | null;
  appVersion: string;
}) {
  const online = useOnlineStatus();
  const [queues, setQueues] = useState(() => countQueues(perimeter));
  const [events, setEvents] = useState<LogEvent[]>(() => recentEvents());
  const [measures, setMeasures] = useState(() => summary());
  const [copyState, setCopyState] = useState<'' | 'ok' | string>('');

  const refresh = useCallback(() => {
    setQueues(countQueues(perimeter));
    setEvents(recentEvents());
    setMeasures(summary());
  }, [perimeter]);

  // Relecture à chaque ouverture : un panneau ouvert en permanence afficherait
  // un état périmé, et c'est exactement la donnée sur laquelle on veut être sûr.
  useEffect(() => {
    if (!isOpen) return;
    setCopyState('');
    refresh();
  }, [isOpen, refresh]);

  const lines = useMemo(
    () =>
      diagnose({
        online,
        queuedOrders: queues.orders,
        queuedAdjustments: queues.adjustments,
        syncError: queues.unreadable || null,
        appVersion,
        events,
      }),
    [online, queues, appVersion, events],
  );

  const errors = events.filter(event => event.level === 'error');

  async function handleCopy() {
    const outcome = await copyDiagnostics();
    setCopyState(outcome.ok ? 'ok' : outcome.reason);
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Diagnostic de cet appareil"
      description="Ce que cette application sait d’elle-même. Rien n’est envoyé automatiquement : l’export ne part que si vous le transmettez."
      size="lg"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={refresh}>
            Actualiser
          </Button>
          <Button variant="secondary" onClick={() => void handleCopy()}>
            Copier le diagnostic
          </Button>
          <Button variant="primary" onClick={downloadDiagnostics}>
            Télécharger le fichier
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {copyState === 'ok' && (
          <Alert variant="success">Diagnostic copié. Collez-le dans le message au support.</Alert>
        )}
        {copyState && copyState !== 'ok' && <Alert variant="warning">{copyState}</Alert>}

        <section aria-labelledby="diag-etat" className="space-y-2">
          <h3 id="diag-etat" className="text-sm font-semibold text-[var(--text-primary)]">
            État de la synchronisation
          </h3>
          <ul className="space-y-2">
            {lines.map(line => {
              const severity = SEVERITY_STYLE[line.severity];
              return (
                <li
                  key={line.check}
                  className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] p-3"
                >
                  <div className="flex items-start gap-2">
                    <span className={`shrink-0 text-[11px] font-semibold uppercase ${severity.className}`}>
                      {severity.label}
                    </span>
                    <div className="flex-1 space-y-1">
                      <p className="text-xs sm:text-sm text-[var(--text-primary)]">{line.detail}</p>
                      {line.action && <p className="text-xs text-[var(--text-secondary)]">{line.action}</p>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {perimeter ? (
            <p className="text-[11px] text-[var(--text-muted)]">
              File lue pour la station « {perimeter.stationName} » et votre compte. Les autres stations de
              votre compte ont leur propre file, sur cet appareil.
            </p>
          ) : (
            <p className="text-[11px] text-[var(--text-muted)]">
              Aucune station sélectionnée : les files locales ne sont pas lisibles depuis cet écran.
            </p>
          )}
        </section>

        <section aria-labelledby="diag-perf" className="space-y-2">
          <h3 id="diag-perf" className="text-sm font-semibold text-[var(--text-primary)]">
            Durées mesurées dans ce navigateur
          </h3>
          {measures.length === 0 ? (
            <p className="text-xs text-[var(--text-secondary)]">
              Aucune opération mesurée depuis l’ouverture de la page. Ce n’est pas une anomalie : les mesures
              n’existent que pour les appels effectués.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <caption className="sr-only">
                  Durées par opération : nombre d’appels, médiane, maximum, échecs
                </caption>
                <thead className="text-[11px] uppercase text-[var(--text-muted)]">
                  <tr>
                    <th scope="col" className="py-1 pr-3 font-semibold">
                      Opération
                    </th>
                    <th scope="col" className="py-1 pr-3 font-semibold">
                      Appels
                    </th>
                    <th scope="col" className="py-1 pr-3 font-semibold">
                      Médiane
                    </th>
                    <th scope="col" className="py-1 pr-3 font-semibold">
                      Max
                    </th>
                    <th scope="col" className="py-1 font-semibold">
                      Échecs
                    </th>
                  </tr>
                </thead>
                <tbody className="tabular-nums text-[var(--text-secondary)]">
                  {measures.map(row => (
                    <tr key={row.operation} className="border-t border-[var(--border-subtle)]">
                      <th scope="row" className="py-1 pr-3 font-mono font-normal text-[var(--text-primary)]">
                        {row.operation}
                      </th>
                      <td className="py-1 pr-3">{row.calls}</td>
                      <td className="py-1 pr-3">{row.medianMs} ms</td>
                      <td className="py-1 pr-3">{row.maxMs} ms</td>
                      <td className="py-1">{row.failures}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[11px] text-[var(--text-muted)]">
            Ces durées sont celles du navigateur, serveur inclus dans le temps d’attente. Elles ne mesurent
            pas la latence du réseau seule.
          </p>
        </section>

        <section aria-labelledby="diag-journal" className="space-y-2">
          <h3 id="diag-journal" className="text-sm font-semibold text-[var(--text-primary)]">
            Journal récent ({events.length} événement{events.length > 1 ? 's' : ''}, {errors.length} erreur
            {errors.length > 1 ? 's' : ''})
          </h3>
          {events.length === 0 ? (
            <p className="text-xs text-[var(--text-secondary)]">Aucun événement enregistré.</p>
          ) : (
            <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {[...events].reverse().map((event, index) => (
                // Pas d'identifiant propre dans un événement : l'horodatage à la
                // milliseconde plus le rang suffisent, et la liste est recréée à
                // chaque rafraîchissement.
                <EventRow key={`${event.at}:${index}`} event={event} />
              ))}
            </ul>
          )}
          <p className="text-[11px] text-[var(--text-muted)]">
            Les identifiants de connexion, les e-mails, les téléphones et les plaques sont masqués à
            l’écriture. Le journal reste sur cet appareil et disparaît au rechargement complet.
          </p>
        </section>
      </div>
    </Modal>
  );
}
