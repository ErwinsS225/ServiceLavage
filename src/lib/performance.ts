/**
 * Mesure de performance côté navigateur.
 *
 * Ce que le navigateur sait mesurer, et ce que ce module mesure :
 *  - le temps d'affichage des éléments principaux (`PerformanceObserver`) ;
 *  - la durée des requêtes serveur, mesurée par nos soins autour de chaque
 *    appel (le navigateur ne sait pas ce qu'est « une prestation créée ») ;
 *  - le temps passé hors ligne, qui explique une partie des lenteurs perçues.
 *
 * Ce qu'il ne mesure pas, volontairement :
 *  - la latence réseau réelle (aller-retour TCP/TLS) : `fetch` ne la donne pas
 *    et l'inventer serait pire que l'ignorer ;
 *  - la performance du serveur PostgreSQL : invisible d'ici ;
 *  - rien qui sorte de l'appareil : les mesures alimentent le journal local.
 *
 * Un chiffre utile et honnête vaut mieux qu'un tableau de bord complet et faux.
 */

import { track } from './telemetry';

/**
 * Seuils d'alerte, en millisecondes.
 *
 * Ils ne sortent pas de nulle part : une requête PostgREST sur ce projet rend
 * en 80–300 ms en 4G ; au-delà d'une seconde, l'utilisateur commence à douter
 * et reclique. Les seuils servent à **signaler**, pas à bloquer.
 */
export const THRESHOLDS = {
  /** Une requête au-delà de ce seuil mérite d'être notée. */
  slowQuery: 1500,
  /** Au-delà, l'utilisateur a probablement cru que rien ne se passait. */
  verySlowQuery: 5000,
  /** L'affichage initial au-delà duquel la page paraît vide. */
  slowFirstPaint: 3000,
} as const;

/** Durée d'un appel mesuré, pour l'agrégat local. */
export interface Measurement {
  operation: string;
  durationMs: number;
  outcome: 'ok' | 'erreur';
}

const measurements: Measurement[] = [];
const MAX_MEASUREMENTS = 100;

/**
 * Mesure une opération asynchrone et la journalise si elle est lente.
 *
 * Volontairement sans surcoût mesurable : deux appels à `performance.now()` et
 * une comparaison. Un instrument qui ralentit ce qu'il mesure n'a pas sa place
 * dans une application utilisée au comptoir.
 */
export async function measure<T>(operation: string, run: () => Promise<T>): Promise<T> {
  const started = now();
  try {
    const result = await run();
    record(operation, now() - started, 'ok');
    return result;
  } catch (error) {
    record(operation, now() - started, 'erreur');
    throw error;
  }
}

function now(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now();
  return Date.now();
}

function record(operation: string, durationMs: number, outcome: 'ok' | 'erreur'): void {
  const measurement: Measurement = { operation, durationMs: Math.round(durationMs), outcome };
  measurements.push(measurement);
  if (measurements.length > MAX_MEASUREMENTS) measurements.shift();

  if (durationMs >= THRESHOLDS.verySlowQuery) {
    track.warn(
      'perf.appel_tres_lent',
      { operation, durationMs: measurement.durationMs, outcome },
      {
        message: `${operation} a pris ${measurement.durationMs} ms`,
      },
    );
  } else if (durationMs >= THRESHOLDS.slowQuery) {
    track.info('perf.appel_lent', { operation, durationMs: measurement.durationMs, outcome });
  }
}

/**
 * Agrégat par opération : nombre d'appels, médiane et maximum.
 *
 * La médiane plutôt que la moyenne : un seul appel à 30 s fausse une moyenne et
 * fait croire que tout est lent, alors qu'un utilisateur sur deux a une réponse
 * rapide.
 */
export function summary(): Array<{
  operation: string;
  calls: number;
  medianMs: number;
  maxMs: number;
  failures: number;
}> {
  const byOperation = new Map<string, Measurement[]>();
  for (const measurement of measurements) {
    const list = byOperation.get(measurement.operation) ?? [];
    list.push(measurement);
    byOperation.set(measurement.operation, list);
  }

  return [...byOperation.entries()]
    .map(([operation, list]) => {
      const durations = list.map(item => item.durationMs).sort((a, b) => a - b);
      const middle = Math.floor(durations.length / 2);
      const median =
        durations.length % 2 === 0
          ? Math.round((durations[middle - 1] + durations[middle]) / 2)
          : durations[middle];
      return {
        operation,
        calls: list.length,
        medianMs: median,
        maxMs: durations[durations.length - 1],
        failures: list.filter(item => item.outcome === 'erreur').length,
      };
    })
    .sort((a, b) => b.maxMs - a.maxMs);
}

/** Vide les mesures (après un export de diagnostic). */
export function clearMeasurements(): void {
  measurements.length = 0;
}

/**
 * Observe l'affichage initial.
 *
 * `first-contentful-paint` est disponible partout ; `largest-contentful-paint`
 * et `navigation` ne le sont pas partout, d'où les gardes. On n'invente jamais
 * une valeur manquante.
 */
export function observePageLoad(): void {
  if (typeof PerformanceObserver === 'undefined') return;

  try {
    const paint = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          const duration = Math.round(entry.startTime);
          track.info('perf.premier_affichage', { durationMs: duration });
          if (duration >= THRESHOLDS.slowFirstPaint) {
            track.warn(
              'perf.affichage_lent',
              { durationMs: duration },
              {
                message: `Premier affichage après ${duration} ms`,
              },
            );
          }
        }
      }
    });
    paint.observe({ type: 'paint', buffered: true });

    const lcp = new PerformanceObserver(list => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (last) track.info('perf.plus_grand_element', { durationMs: Math.round(last.startTime) });
    });
    // `largest-contentful-paint` n'existe pas dans tous les navigateurs : un
    // `try` évite de casser le démarrage de l'application pour une mesure.
    lcp.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {
    // Mesure indisponible : ce n'est pas une raison d'empêcher l'app de servir.
  }
}
