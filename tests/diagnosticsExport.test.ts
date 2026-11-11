// Le presse-papiers est un objet du navigateur : ce test lui donne un DOM.
import './domEnvironment';
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDiagnosticsReport, copyDiagnostics } from '../src/lib/diagnosticsExport';
import { clearEvents, track } from '../src/lib/telemetry';
import { clearMeasurements } from '../src/lib/performance';

/**
 * L'export est le seul moyen pour un caissier de transmettre un incident sans
 * accès à la console. Il doit donc réussir souvent, et **échouer bruyamment**
 * quand il ne peut pas : un bouton qui ne dit rien après un échec est pire que
 * pas de bouton du tout.
 */

function withClipboard<T>(value: unknown, run: () => Promise<T>): Promise<T> {
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true });
  return run().finally(() => {
    if (original) Object.defineProperty(navigator, 'clipboard', original);
    else Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  });
}

test('le rapport contient les événements et l’agrégat de performance', () => {
  clearEvents();
  clearMeasurements();
  track.warn('perf.appel_lent', { operation: 'prestations.chargement', durationMs: 1800 });

  const report = JSON.parse(buildDiagnosticsReport()) as {
    events: Array<{ event: string }>;
    performance: { operations: unknown[]; _note: string };
  };
  assert.equal(report.events[0].event, 'perf.appel_lent');
  assert.ok(Array.isArray(report.performance.operations));
  // La note dit ce que la mesure ne couvre pas : elle évite de faire passer des
  // durées navigateur pour des durées serveur.
  assert.match(report.performance._note, /pas sur le serveur/);
});

test('copyDiagnostics réussit et copie le rapport complet', async () => {
  clearEvents();
  track.info('app.demarrage', { version: 'test' });

  let copied = '';
  await withClipboard(
    {
      writeText: async (text: string) => {
        copied = text;
      },
    },
    async () => {
      const outcome = await copyDiagnostics();
      assert.deepEqual(outcome, { ok: true });
    },
  );
  assert.ok(copied.includes('app.demarrage'));
});

test('sans presse-papiers, copyDiagnostics explique quoi faire au lieu de se taire', async () => {
  // Cas réel : application servie en http sur le réseau local d'une station.
  await withClipboard(undefined, async () => {
    const outcome = await copyDiagnostics();
    assert.equal(outcome.ok, false);
    assert.match(outcome.ok === false ? outcome.reason : '', /https|téléchargement/);
  });
});

test('un refus du navigateur remonte un motif lisible', async () => {
  await withClipboard(
    {
      writeText: async () => {
        throw new Error('NotAllowedError');
      },
    },
    async () => {
      const outcome = await copyDiagnostics();
      assert.equal(outcome.ok, false);
      assert.match(outcome.ok === false ? outcome.reason : '', /refusée par le navigateur/);
    },
  );
});

test('copyDiagnostics ne lève jamais, même avec un presse-papiers cassé', async () => {
  await withClipboard(
    {
      get writeText(): never {
        throw new Error('propriété piégée');
      },
    },
    async () => {
      // Le contrat est explicite : une promesse qui se résout, jamais un rejet.
      const outcome = await copyDiagnostics().catch(error => {
        assert.fail(`copyDiagnostics a levé : ${String(error)}`);
      });
      assert.equal(outcome.ok, false);
    },
  );
});
