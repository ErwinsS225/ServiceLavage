/**
 * Export du diagnostic vers le presse-papiers.
 *
 * Pourquoi passer par un fichier séparé : trois écrans en ont besoin (l'écran
 * d'erreur, la page de diagnostic, le bandeau hors ligne), et la logique doit
 * être testable sans DOM. Le presse-papiers échoue dans trois cas réels — page
 * non sécurisée (`http://`), permission refusée, navigateur ancien — et il faut
 * le dire clairement plutôt que de laisser croire à un succès.
 */

import { diagnosticsSnapshot } from './telemetry';
import { summary } from './performance';

/**
 * Diagnostic complet : événements + agrégat de performance.
 *
 * Les deux sont séparés dans le JSON pour qu'un lecteur pressé voie d'abord ce
 * qui a échoué, et un lecteur technique les durées.
 */
export function buildDiagnosticsReport(): string {
  const base = JSON.parse(diagnosticsSnapshot()) as Record<string, unknown>;
  return JSON.stringify(
    {
      ...base,
      performance: {
        _note:
          'Durées mesurées dans ce navigateur, pas sur le serveur. La médiane évite qu’un seul appel lent fausse la lecture.',
        operations: summary(),
      },
    },
    null,
    2,
  );
}

export type CopyOutcome = { ok: true } | { ok: false; reason: string };

/**
 * Copie le diagnostic. Ne lève jamais : renvoie un résultat que l'appelant
 * transforme en message.
 */
export async function copyDiagnostics(): Promise<CopyOutcome> {
  const report = buildDiagnosticsReport();

  // `navigator.clipboard` n'existe pas hors contexte sécurisé (http://). Une
  // application servie en http sur le réseau local d'une station est un cas
  // réel, pas une hypothèse.
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    return {
      ok: false,
      reason:
        'Copie impossible sur cette adresse : ouvrez l’application en https, ou utilisez le téléchargement.',
    };
  }

  try {
    await navigator.clipboard.writeText(report);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'Copie refusée par le navigateur. Utilisez le téléchargement du fichier.' };
  }
}

/**
 * Télécharge le diagnostic en fichier `.json`.
 *
 * Repli quand le presse-papiers est indisponible : c'est la voie qui fonctionne
 * toujours, y compris en http sur un réseau local.
 */
export function downloadDiagnostics(): void {
  const blob = new Blob([buildDiagnosticsReport()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  link.href = url;
  link.download = `servicelavage-diagnostic-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Sans révocation, le blob reste en mémoire jusqu'au rechargement.
  URL.revokeObjectURL(url);
}
