import test from 'node:test';
import assert from 'node:assert/strict';
import { THRESHOLDS, clearMeasurements, measure, summary } from '../src/lib/performance';
import { recentEvents } from '../src/lib/telemetry';

/**
 * La mesure ne doit rien promettre qu'elle ne peut tenir : elle mesure ce que le
 * navigateur voit, agrège par médiane, et n'empêche jamais une opération de
 * aboutir — même quand elle échoue.
 */

async function delayUntil(ms: number): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < ms) {
    // Attente active : `performance.now()` doit avancer, ce qu'un `setTimeout`
    // ne garantit pas assez finement pour un seuil de 1 500 ms.
    await new Promise(resolve => setTimeout(resolve, 1));
  }
}

test('measure renvoie le résultat et l’enregistre', async () => {
  clearMeasurements();
  const value = await measure('test.lecture', async () => 42);
  assert.equal(value, 42);

  const [row] = summary();
  assert.equal(row.operation, 'test.lecture');
  assert.equal(row.calls, 1);
  assert.equal(row.failures, 0);
  assert.ok(row.medianMs >= 0);
});

test('measure propage l’erreur et la compte comme échec', async () => {
  clearMeasurements();
  await assert.rejects(
    measure('test.echec', async () => {
      throw new Error('refus serveur');
    }),
    /refus serveur/,
  );

  const [row] = summary();
  assert.equal(row.failures, 1);
  assert.equal(row.calls, 1);
});

test('la médiane ignore un pic isolé, le maximum ne le cache pas', async () => {
  clearMeasurements();
  await measure('test.charge', async () => {});
  await measure('test.charge', async () => {});
  await measure('test.charge', async () => {});
  // Un seul appel lent : la moyenne serait trompeuse, la médiane non.
  await delayUntil(1600);
  await measure('test.charge', async () => {
    await delayUntil(1600);
  });

  const row = summary().find(item => item.operation === 'test.charge');
  assert.ok(row);
  assert.equal(row.calls, 4);
  assert.ok(row.medianMs < 100, `médiane attendue petite, reçue ${row.medianMs}`);
  assert.ok(row.maxMs >= 1500, `maximum attendu ≥ 1500, reçu ${row.maxMs}`);
});

test('un appel au-delà du premier seuil produit un événement nommé', async () => {
  clearMeasurements();
  // La mesure porte sur l'opération elle-même : c'est bien `measure` qui doit
  // constater la lenteur, pas le test autour d'elle.
  await measure('test.lent', async () => {
    await delayUntil(THRESHOLDS.slowQuery + 100);
  });

  const slow = recentEvents().filter(event => event.context?.operation === 'test.lent');
  assert.equal(slow.length, 1, 'un seul événement par appel, jamais deux');
  // Au-delà du seuil « très lent » c'est un `warn`, entre les deux un `info` :
  // le test accepte les deux selon la machine, mais exige un nommage exact.
  assert.ok(['perf.appel_lent', 'perf.appel_tres_lent'].includes(slow[0].event));
  assert.ok(Number(slow[0].context?.durationMs) >= THRESHOLDS.slowQuery);
});

test('sous le seuil, aucun événement de lenteur n’est inventé', async () => {
  clearMeasurements();
  await measure('test.rapide_sans_bruit', async () => {});
  const noise = recentEvents().filter(event => event.context?.operation === 'test.rapide_sans_bruit');
  assert.deepEqual(noise, []);
});

test('clearMeasurements remet l’agrégat à zéro', async () => {
  await measure('test.nettoyage', async () => {});
  assert.ok(summary().length > 0);
  clearMeasurements();
  assert.deepEqual(summary(), []);
});

test('summary trie par maximum décroissant, l’opération la plus lente d’abord', async () => {
  clearMeasurements();
  await measure('test.rapide', async () => {});
  await delayUntil(30);
  await measure('test.moyen', async () => {
    await delayUntil(30);
  });

  const rows = summary();
  assert.equal(rows[0].operation, 'test.moyen');
  assert.equal(rows[1].operation, 'test.rapide');
});
