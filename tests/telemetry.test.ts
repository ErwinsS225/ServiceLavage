import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearEvents,
  diagnosticsSnapshot,
  fingerprintOf,
  log,
  recentEvents,
  redact,
  subscribe,
  track,
} from '../src/lib/telemetry';

/**
 * Le journal est le seul endroit où l'application raconte ce qui lui arrive sur
 * un appareil où personne ne lit de console. Deux propriétés comptent donc plus
 * que les autres, et sont testées en premier : **rien de personnel ne sort** et
 * **une panne répétée se regroupe**.
 */

test('redact masque les clés sensibles au lieu de les supprimer', () => {
  const output = redact({
    stationId: 'station-1',
    customerEmail: 'awa@example.com',
    access_token: 'secret-value',
    plate: '1234 AB 01',
    nested: { password: 'hunter2', count: 3 },
  }) as Record<string, unknown>;

  assert.equal(output.stationId, 'station-1');
  // Une clé sensible est remplacée, jamais retirée : savoir que le champ était
  // renseigné fait partie du diagnostic.
  assert.equal(output.customerEmail, '[masqué]');
  assert.equal(output.access_token, '[masqué]');
  assert.equal(output.plate, '[masqué]');
  assert.deepEqual(output.nested, { password: '[masqué]', count: 3 });
});

test('redact nettoie les emails et téléphones dans une chaîne libre', () => {
  assert.equal(redact('contacter awa@example.com svp'), 'contacter [email] svp');
  assert.equal(redact('joindre le +225 07 12 34 56 78'), 'joindre le [numéro]');
});

test('redact ne descend pas indéfiniment', () => {
  let value: Record<string, unknown> = { texte: 'fin' };
  for (let depth = 0; depth < 10; depth += 1) value = { enfant: value };
  const flattened = JSON.stringify(redact(value));
  assert.ok(flattened.includes('[profond]'), 'la profondeur doit être bornée');
});

test('fingerprintOf regroupe deux occurrences de la même erreur', () => {
  const first = new Error('Prestation 8f2c1d3a-aaaa-bbbb-cccc-1234567890ab introuvable');
  const second = new Error('Prestation 1130 introuvable');
  assert.equal(fingerprintOf(first), fingerprintOf(second));

  const other = new Error('Réseau indisponible');
  assert.notEqual(fingerprintOf(first), fingerprintOf(other));
});

test('log conserve nom, niveau, contexte assaini et empreinte', () => {
  clearEvents();
  const record = log(
    'error',
    'data.lecture_echouee',
    { ressource: 'orders', email: 'a@b.ci' },
    {
      message: 'Lecture impossible',
      code: '42501',
      error: new Error('permission denied for table orders'),
    },
  );

  assert.equal(record.event, 'data.lecture_echouee');
  assert.equal(record.level, 'error');
  assert.equal(record.code, '42501');
  assert.equal(record.errorName, 'Error');
  assert.equal(record.context?.ressource, 'orders');
  assert.equal(record.context?.email, '[masqué]');

  const [stored] = recentEvents();
  assert.equal(stored.event, 'data.lecture_echouee');
  assert.equal(stored.fingerprint, record.fingerprint);
});

test('track.error accepte une erreur en premier argument et en dérive le message', () => {
  clearEvents();
  const record = track.error('offline.synchronisation_echouee', new Error('réseau absent'), {
    restants: 2,
  });
  assert.equal(record.message, 'réseau absent');
  assert.equal(record.context?.restants, 2);
  assert.ok(record.fingerprint);
});

test('track.warn accepte un message lisible pour l’écran', () => {
  clearEvents();
  const record = track.warn(
    'perf.appel_tres_lent',
    { operation: 'prestations.chargement' },
    {
      message: 'prestations.chargement a pris 6400 ms',
    },
  );
  assert.equal(record.message, 'prestations.chargement a pris 6400 ms');
  assert.equal(record.level, 'warn');
});

test('le tampon est borné à 200 événements et garde les plus récents', () => {
  clearEvents();
  for (let index = 0; index < 250; index += 1) track.info('test.boucle', { index });
  const events = recentEvents();
  assert.equal(events.length, 200);
  // Le plus ancien conservé est le 51e (index 50) : les 50 premiers ont été
  // oubliés, pas les derniers.
  assert.equal(events[0].context?.index, 50);
  assert.equal(events[199].context?.index, 249);
});

test('clearEvents vide le tampon', () => {
  track.info('test.a');
  assert.ok(recentEvents().length > 0);
  clearEvents();
  assert.deepEqual(recentEvents(), []);
});

test('les abonnés reçoivent les événements et un abonné fautif ne bloque rien', () => {
  clearEvents();
  const received: string[] = [];
  const unsubscribe = subscribe(event => received.push(event.event));
  const failing = subscribe(() => {
    throw new Error('abonné cassé');
  });

  track.info('test.premier');
  track.info('test.second');
  unsubscribe();
  failing();
  track.info('test.troisieme');

  assert.deepEqual(received, ['test.premier', 'test.second']);
});

test('diagnosticsSnapshot est un JSON valide, daté, et sans email en clair', () => {
  clearEvents();
  track.info('app.demarrage', { version: 'test', contact: 'awa@example.com' });
  const snapshot = diagnosticsSnapshot();
  const parsed = JSON.parse(snapshot) as {
    generatedAt: string;
    events: Array<{ event: string }>;
    environment: { dev: boolean; serviceWorker: string };
    _lisez_moi: string;
  };
  assert.ok(Number.isFinite(Date.parse(parsed.generatedAt)));
  assert.equal(parsed.events[0].event, 'app.demarrage');
  assert.equal(parsed.environment.serviceWorker, 'absent');
  assert.equal(snapshot.includes('awa@example.com'), false);
  assert.ok(parsed._lisez_moi, 'le snapshot doit dire ce qu’il contient');
});
