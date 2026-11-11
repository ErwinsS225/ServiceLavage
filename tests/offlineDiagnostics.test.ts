import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnose, headline, type OfflineState } from '../src/lib/offlineDiagnostics';
import type { LogEvent } from '../src/lib/telemetry';

/**
 * Le diagnostic répond à la question qu'un caissier pose au téléphone :
 * « est-ce que ce que j'ai saisi est parti ? ». Deux règles sont testées ici :
 * il ne rassure **jamais** à tort, et il distingue une file vide d'une file
 * qu'il ne sait plus lire.
 */

const base: OfflineState = {
  online: true,
  queuedOrders: 0,
  queuedAdjustments: 0,
  syncError: null,
  appVersion: '1.4.0',
  events: [],
};

function errorEvent(event: string, fingerprint: string): LogEvent {
  return {
    event,
    level: 'error',
    at: '2026-11-10T09:00:00.000Z',
    fingerprint,
  };
}

test('hors ligne avec une file vide : à surveiller, pas bloquant', () => {
  const lines = diagnose({ ...base, online: false });
  const reseau = lines.find(line => line.check === 'reseau');
  assert.equal(reseau?.severity, 'attention');
  assert.equal(reseau?.detail, 'Hors ligne. Aucune opération en attente.');
  assert.ok(reseau?.action, 'l’utilisateur doit savoir ce qui reste possible');
});

test('hors ligne avec des prestations en attente : bloquant, et la file est conservée', () => {
  const lines = diagnose({ ...base, online: false, queuedOrders: 3 });
  const reseau = lines.find(line => line.check === 'reseau');
  assert.equal(reseau?.severity, 'bloquant');
  assert.equal(reseau?.detail, 'Hors ligne avec 3 opérations en attente d’envoi.');
  assert.match(reseau?.action ?? '', /Ne videz pas les données du navigateur/);
});

test('singulier et pluriel ne produisent pas de faute visible', () => {
  const one = diagnose({ ...base, online: false, queuedOrders: 1, queuedAdjustments: 0 });
  assert.match(one[0].detail, /1 opération en attente/);
  const many = diagnose({ ...base, queuedOrders: 2 });
  assert.match(many[0].detail, /2 opérations encore en attente/);
});

test('en ligne sans file : tout est ok, le headline reste neutre', () => {
  const lines = diagnose(base);
  assert.equal(lines[0].severity, 'ok');
  assert.equal(lines[0].detail, 'En ligne, aucune opération en attente.');
  // `headline` ne sert qu'à signaler un problème : quand il n'y en a aucun, il
  // ne reprend pas la ligne « ok » mais l'affirme explicitement.
  assert.equal(headline(lines), 'Aucun problème détecté sur cet appareil.');
});

test('une erreur de synchronisation est bloquante et rappelle l’idempotence', () => {
  const lines = diagnose({ ...base, syncError: 'Synchronisation impossible.' });
  const sync = lines.find(line => line.check === 'synchronisation');
  assert.equal(sync?.severity, 'bloquant');
  assert.match(sync?.action ?? '', /rien n’est envoyé deux fois/);
});

test('les erreurs sont comptées par empreinte, pas en vrac', () => {
  const lines = diagnose({
    ...base,
    events: [
      errorEvent('data.lecture_echouee', 'Error:aaaa'),
      errorEvent('data.lecture_echouee', 'Error:aaaa'),
      errorEvent('ui.erreur_rendu', 'Error:bbbb'),
    ],
  });
  const errors = lines.find(line => line.check === 'erreurs');
  assert.equal(errors?.severity, 'attention');
  assert.equal(errors?.detail, '3 erreurs enregistrées sur cet appareil (2 distinctes).');
});

test('une file illisible est signalée comme bloquante, jamais comme vide', () => {
  // Le cas dangereux : `localStorage` contient des prestations mais la lecture
  // échoue. Afficher « aucune opération en attente » ferait fermer la caisse et
  // perdre la journée.
  const lines = diagnose({
    ...base,
    syncError: 'Une opération locale est illisible ; elle a été conservée.',
  });
  const sync = lines.find(line => line.check === 'synchronisation');
  assert.equal(sync?.severity, 'bloquant');
  assert.equal(headline(lines), 'Une opération locale est illisible ; elle a été conservée.');
});

test('les ajustements de stock ont leur propre ligne, avec leur conséquence', () => {
  const lines = diagnose({ ...base, queuedAdjustments: 2 });
  const stock = lines.find(line => line.check === 'file_inventaire');
  assert.equal(stock?.detail, '2 ajustements de stock en attente.');
  assert.match(stock?.action ?? '', /stock négatif/);
  // Aucune ligne « prestations » : les deux files ne se mélangent pas.
  assert.equal(
    lines.some(line => line.check === 'file_prestations'),
    false,
  );
});

test('la version servie apparaît toujours, en dernier', () => {
  const lines = diagnose({ ...base, online: false, queuedOrders: 2, queuedAdjustments: 1 });
  const last = lines[lines.length - 1];
  assert.equal(last.check, 'version');
  assert.equal(last.detail, 'Version servie : 1.4.0.');
});

test('headline retient le plus grave, bloquant avant attention', () => {
  const lines = diagnose({
    ...base,
    online: false,
    queuedOrders: 1,
    events: [errorEvent('ui.rendu', 'Error:cccc')],
  });
  const worst = lines.find(line => line.severity === 'bloquant');
  assert.equal(headline(lines), worst?.detail);
});

test('headline ne prétend pas qu’il n’y a aucun problème quand il y en a un', () => {
  assert.notEqual(
    headline(diagnose({ ...base, syncError: 'Échec' })),
    'Aucun problème détecté sur cet appareil.',
  );
  assert.equal(headline([]), 'Aucun problème détecté sur cet appareil.');
});
