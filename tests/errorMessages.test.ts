import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { describeError, errorText } from '../src/lib/errorMessages';

/**
 * Le traducteur d'erreurs ne doit jamais inventer un texte, ni laisser passer
 * un message PostgreSQL brut. Deux garanties testées ici :
 *   1. chaque `raise exception` des migrations a une entrée, avec une consigne ;
 *   2. une erreur inconnue est réduite à un message générique.
 */

const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
const sql = fs
  .readdirSync(migrationsDir)
  .filter(name => name.endsWith('.sql'))
  .map(name => fs.readFileSync(path.join(migrationsDir, name), 'utf8'))
  .join('\n');

/** Messages levés par nos RPC, relevé exhaustif du SQL. */
const raisedMessages = [...new Set([...sql.matchAll(/raise exception\s+'([^']+)'/g)].map(match => match[1]))];

test('le relevé des messages serveur n’est pas vide', () => {
  // Sans cette garde, un changement de syntaxe SQL rendrait le test suivant
  // vert en ne testant plus rien.
  assert.ok(raisedMessages.length >= 30, `seulement ${raisedMessages.length} messages relevés`);
});

test('chaque message levé par le serveur est traduit avec une consigne', () => {
  const missing: string[] = [];
  const withoutAction: string[] = [];
  for (const message of raisedMessages) {
    const described = describeError({ message, code: '22023' });
    if (described.message !== message) missing.push(message);
    if (!described.action) withoutAction.push(message);
    if (described.kind === 'unknown') missing.push(`${message} (catégorie inconnue)`);
  }
  assert.deepEqual(missing, [], 'messages serveur non traduits');
  assert.deepEqual(withoutAction, [], 'messages traduits sans consigne');
});

test('un message levé par le serveur n’est jamais remplacé par un texte inventé', () => {
  const described = describeError({ message: 'Stock insuffisant ou limite dépassée', code: '22023' });
  assert.equal(described.kind, 'validation');
  assert.equal(described.message, 'Stock insuffisant ou limite dépassée');
  assert.match(described.action ?? '', /Actualisez le stock/);
  assert.equal(described.retryable, false);
});

test('les codes PostgreSQL connus donnent une catégorie et une consigne', () => {
  const cases: Array<[string, string]> = [
    ['42501', 'permission'],
    ['22023', 'validation'],
    ['P0001', 'limit'],
    ['23505', 'conflict'],
    ['23503', 'foreign_key'],
    ['23514', 'validation'],
    ['PGRST116', 'permission'],
  ];
  for (const [code, kind] of cases) {
    const described = describeError({ code, message: 'new row violates check constraint' });
    assert.equal(described.kind, kind, `code ${code}`);
    assert.ok(described.action, `code ${code} sans consigne`);
  }
});

test('un code inconnu masque le texte technique', () => {
  const described = describeError({
    code: 'XX999',
    message: 'violates foreign key constraint "orders_customer_id_fkey" on table "orders"',
  });
  assert.equal(described.kind, 'unknown');
  assert.equal(described.message, 'L’opération n’a pas abouti.');
  assert.doesNotMatch(described.message, /constraint|table/);
  // Le brut n'apparaît pas à l'écran en production.
  assert.equal(described.detail, undefined);
});

test('un échec réseau est reconnaissable et relançable', () => {
  const described = describeError(new TypeError('Failed to fetch'));
  assert.equal(described.kind, 'network');
  assert.equal(described.retryable, true);
  assert.match(described.action ?? '', /connexion/i);
});

test('les erreurs d’authentification ont leur propre message', () => {
  assert.equal(describeError({ message: 'Invalid login credentials' }).title, 'Identifiants refusés');
  assert.equal(describeError({ message: 'Email not confirmed' }).kind, 'auth');
  assert.equal(describeError({ message: 'User already registered' }).kind, 'conflict');
  assert.equal(describeError({ message: 'JWT expired' }).title, 'Session expirée');
  assert.equal(describeError({ message: 'email rate limit exceeded' }).retryable, true);
});

test('une valeur qui n’est pas une erreur ne fait pas planter le rendu', () => {
  for (const value of [null, undefined, 'boom', 42, {}]) {
    const described = describeError(value);
    assert.ok(described.title.length > 0);
    assert.ok(described.message.length > 0);
  }
});

test('errorText assemble le message et la consigne', () => {
  const text = errorText({ message: 'Station non autorisée', code: '42501' });
  assert.match(text, /^Station non autorisée\. /);
  assert.match(text, /Demandez au propriétaire/);
});
