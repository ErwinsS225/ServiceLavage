import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { sqlFingerprint } from '../scripts/checkMigrationContent.mjs';

/**
 * Étape 1 de la réconciliation : le dépôt affirme que les cinq migrations
 * appliquées sous d'autres horodatages ont le même contenu. C'était une note
 * dans un runbook ; c'est maintenant vérifié.
 *
 * La chaîne complète :
 *  1. `scripts/checkMigrationContent.mjs` recalcule l'empreinte de chaque
 *     fichier et la compare à celle du SQL stocké en base (relevé du
 *     10/11/2026 dans `docs/sauvegardes/prod-migration-historique-…json`) ;
 *  2. les assertions ci-dessous vérifient que ce relevé est exhaustif, cohérent
 *     et que l'empreinte ne dépend pas de la mise en forme.
 *
 * Limite assumée : ce test ne parle pas à la base. Il prouve que le dépôt est
 * cohérent avec un état distant daté et tracé ; il ne remplace pas la
 * commande `supabase migration list` avant une opération d'écriture.
 */

const HISTORY = 'docs/sauvegardes/prod-migration-historique-2026-11-10.json';

interface MigrationRecord {
  version: string;
  name: string;
  fichier: string;
  fingerprint: string;
  version_locale_du_fichier: string;
}

interface HistoryFile {
  migrations: MigrationRecord[];
}

const history = JSON.parse(await readFile(HISTORY, 'utf8')) as HistoryFile;
const run = promisify(execFile);

test('l’empreinte ne dépend ni des commentaires ni de la mise en forme', () => {
  const base = 'create table public.t (id uuid);';
  assert.equal(sqlFingerprint(base), sqlFingerprint(`  create table\npublic.t (id uuid);  `));
  assert.equal(sqlFingerprint(base), sqlFingerprint(`-- un commentaire\n${base}\n-- un autre`));
  // Un vrai changement ne peut pas être masqué.
  assert.notEqual(sqlFingerprint(base), sqlFingerprint('create table public.t (id bigint);'));
  assert.notEqual(sqlFingerprint(base), sqlFingerprint(`${base} grant select on public.t to authenticated;`));
});

test('les onze migrations du dépôt ont chacune une empreinte distante', async () => {
  const files = (await readdir('supabase/migrations')).filter(name => name.endsWith('.sql')).sort();
  assert.equal(files.length, 11);
  assert.equal(history.migrations.length, 11);

  const byFile = new Map(history.migrations.map(item => [item.fichier, item]));
  for (const file of files) {
    const record = byFile.get(file);
    assert.ok(record, `${file} n'a pas d'entrée dans l'historique distant`);
    assert.match(record.fingerprint, /^[0-9a-f]{32}$/, `${file} : empreinte invalide`);
    assert.equal(record.version.length, 14, `${file} : version distante mal formée`);
  }

  // Aucune version enregistrée en double : deux migrations ne peuvent pas
  // revendiquer le même horodatage.
  const versions = history.migrations.map(item => item.version);
  assert.equal(new Set(versions).size, versions.length, 'deux migrations sous la même version');
});

test('les cinq versions divergentes sont bien celles documentées', () => {
  const divergent = history.migrations.filter(item => item.version !== item.version_locale_du_fichier);
  assert.deepEqual(
    divergent.map(item => [item.fichier, item.version]),
    [
      ['20261109140000_station_memberships.sql', '20261109182442'],
      ['20261109141000_subscription_limits.sql', '20261109182456'],
      ['20261109142000_station_inventory.sql', '20261109182509'],
      ['20261109150000_station_role_permissions.sql', '20261109182534'],
      ['20261109160000_revoke_legacy_order_rpc.sql', '20261109184205'],
    ],
  );
  // Et l'ordre chronologique distant est respecté : memberships avant
  // role_permissions, sinon l'application aurait échoué en DDL.
  const versions = history.migrations.map(item => item.version);
  assert.deepEqual([...versions].sort(), versions, 'l’historique distant doit être chronologique');
});

test('le script de vérification confirme que les onze fichiers sont identiques', async () => {
  const { stdout } = await run('node', ['scripts/checkMigrationContent.mjs', '--json']);
  const report = JSON.parse(stdout) as { problems: string[]; results: Array<{ statut: string }> };
  assert.deepEqual(report.problems, [], 'aucune divergence de contenu');
  assert.equal(report.results.length, 11);
  assert.deepEqual([...new Set(report.results.map(row => row.statut))], ['identique']);
});

test('le relevé ne contient aucun secret', async () => {
  const raw = await readFile(HISTORY, 'utf8');
  assert.doesNotMatch(raw, /eyJ[A-Za-z0-9_-]{20,}/, 'jeton JWT');
  assert.doesNotMatch(raw, /sb_(publishable|secret)_[A-Za-z0-9]{10,}/, 'clé Supabase');
  assert.doesNotMatch(raw, /postgres(ql)?:\/\/[^"\s]+:[^"\s]+@/, 'chaîne de connexion avec mot de passe');
  // Le texte complet du SQL n'est pas recopié : seules les empreintes le sont,
  // ce qui suffit à prouver le contenu sans dupliquer les migrations.
  assert.doesNotMatch(raw, /create policy/i, 'le relevé ne doit pas recopier le SQL');
});
