// L'environnement DOM doit être installé avant tout import qui lit `window`.
import './domEnvironment';
import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import {
  installGlobalErrorHandlers,
  reportChunkFailure,
  resetGlobalHandlersForTests,
} from '../src/lib/globalErrors';
import { clearEvents, recentEvents } from '../src/lib/telemetry';

/**
 * Ces tests portent sur les erreurs que React **ne voit pas** : c'est
 * précisément pourquoi elles étaient invisibles en production. Chacun vérifie
 * qu'une panne silencieuse laisse désormais une trace nommée, et que le bruit
 * connu (`AbortError`) n'est pas compté comme une panne.
 */

beforeEach(() => {
  clearEvents();
  resetGlobalHandlersForTests();
});

test('une exception dans un gestionnaire d’événement est journalisée avec son fichier', () => {
  installGlobalErrorHandlers();

  const failure = new Error('Cannot read properties of null');
  failure.name = 'TypeError';
  const event = new window.ErrorEvent('error', {
    error: failure,
    filename: 'https://exemple.test/assets/index-abc123.js',
    lineno: 42,
  });
  window.dispatchEvent(event);

  const [record] = recentEvents();
  assert.equal(record.level, 'error');
  assert.equal(record.event, 'ui.erreur_non_capturee');
  // Le chemin complet n'est pas conservé : seul le nom de fichier sert au
  // diagnostic, et une URL d'asset peut contenir un jeton de déploiement.
  assert.equal(record.context?.fichier, 'index-abc123.js');
  assert.equal(record.context?.ligne, 42);
  assert.equal(record.errorName, 'TypeError');
});

test('une ressource qui ne charge pas est signalée sans exception', () => {
  installGlobalErrorHandlers();

  const image = document.createElement('img');
  document.body.appendChild(image);
  image.dispatchEvent(new window.Event('error'));
  image.remove();

  const [record] = recentEvents();
  assert.equal(record.level, 'warn');
  assert.equal(record.event, 'ui.ressource_non_chargee');
  assert.equal(record.context?.cible, 'IMG');
});

test('une promesse rejetée non traitée est journalisée', () => {
  installGlobalErrorHandlers();

  // `PromiseRejectionEvent` n'existe pas dans jsdom : un événement générique
  // portant `reason` suffit, l'écouteur ne lit que ce champ.
  const event = new window.Event('unhandledrejection') as Event & { reason?: unknown };
  event.reason = new Error('Échec silencieux du chargement');
  window.dispatchEvent(event);

  const [record] = recentEvents();
  assert.equal(record.event, 'ui.promesse_rejetee');
  assert.equal(record.message, 'Promesse rejetée sans traitement');
});

test('un AbortError n’est pas compté comme une panne', () => {
  installGlobalErrorHandlers();

  const abort = new Error('The operation was aborted.');
  abort.name = 'AbortError';
  const event = new window.Event('unhandledrejection') as Event & { reason?: unknown };
  event.reason = abort;
  window.dispatchEvent(event);

  // En production, `debug` est filtré : la liste doit donc rester vide.
  const errors = recentEvents().filter(item => item.level === 'error');
  assert.equal(errors.length, 0);
});

test('les écouteurs ne sont branchés qu’une fois', () => {
  installGlobalErrorHandlers();
  installGlobalErrorHandlers();
  installGlobalErrorHandlers();

  const event = new window.Event('unhandledrejection') as Event & { reason?: unknown };
  event.reason = new Error('une seule fois');
  window.dispatchEvent(event);

  assert.equal(recentEvents().filter(item => item.event === 'ui.promesse_rejetee').length, 1);
});

test('un échec de module découpé porte le nom du module', () => {
  resetGlobalHandlersForTests();
  reportChunkFailure('StationReports', new Error('Failed to fetch dynamically imported module'));

  const [record] = recentEvents();
  assert.equal(record.event, 'ui.module_non_charge');
  assert.equal(record.context?.module, 'StationReports');
  assert.ok(record.fingerprint, 'deux échecs du même module doivent se regrouper');
});
