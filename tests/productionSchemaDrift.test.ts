import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dumpLocalSchema, type SchemaSnapshot } from '../scripts/dumpLocalSchema';

/**
 * Détection de dérive entre le dépôt et la base **déployée**.
 *
 * Pourquoi ce test existe : `supabase db push` compare des *versions* de
 * migration, pas des schémas. Les cinq dernières migrations ont été appliquées
 * via le connecteur Supabase, qui horodate à l'exécution : leurs versions
 * distantes (`20261109182442` … `20261109184205`) diffèrent des noms de
 * fichiers locaux (`20261109140000` … `20261109160000`). Le CLI les considère
 * donc comme non appliquées et `db push` tenterait de les rejouer.
 *
 * Avant de réparer l'historique ou de déployer quoi que ce soit, il faut
 * prouver que le **schéma** distant correspond bien au contenu des fichiers.
 * C'est ce que fait ce test : il rejoue les migrations dans PGlite, puis
 * compare le catalogue obtenu à `docs/sauvegardes/prod-schema-2026-11-10.json`,
 * capturé sur le projet réel `avvkzliysacpyavmetsx` (LavAuto) le 10/11/2026.
 *
 * Si ce test échoue, la bonne réaction n'est **pas** d'éditer une migration
 * déjà appliquée : il faut soit corriger l'extrait de référence après une
 * nouvelle capture, soit écrire une **nouvelle** migration additive.
 */

interface Reference extends SchemaSnapshot {
  _lisez_moi: string;
  _projet: Record<string, string>;
  _capture: Record<string, string>;
  _migrations_distantes: Array<{ version: string; name: string }>;
  _migrations_locales: Array<{ fichier: string; version_distante: string; identique: boolean }>;
  schema: SchemaSnapshot;
}

const reference = JSON.parse(
  await readFile('docs/sauvegardes/prod-schema-2026-11-10.json', 'utf8'),
) as Reference;

/** Compare deux listes d'objets sans tenir compte de l'ordre. */
function expectSameSet(actual: unknown[], expected: unknown[], label: string) {
  const serialize = (value: unknown) => JSON.stringify(value, Object.keys(value as object).sort());
  const a = new Set(actual.map(serialize));
  const b = new Set(expected.map(serialize));
  const onlyLocal = [...a].filter(item => !b.has(item));
  const onlyProd = [...b].filter(item => !a.has(item));
  assert.deepEqual(
    { onlyLocal, onlyProd },
    { onlyLocal: [], onlyProd: [] },
    `${label} : le schéma des migrations ne correspond plus à la production`,
  );
  assert.equal(actual.length, expected.length, `${label} : nombre d'objets différent`);
}

const local = await dumpLocalSchema();

test('the reference snapshot describes a deployed project, not a draft', () => {
  assert.equal(reference._projet.ref, 'avvkzliysacpyavmetsx');
  assert.equal(reference._migrations_distantes.length, 11, '11 migrations déployées');
  assert.equal(reference._migrations_locales.length, 11, '11 fichiers de migration');
  // Every local file is mapped to exactly one remote version.
  const files = reference._migrations_locales.map(item => item.fichier);
  assert.equal(new Set(files).size, files.length);
  const versions = reference._migrations_locales.map(item => item.version_distante);
  assert.equal(new Set(versions).size, versions.length);
});

test('the schema produced by the migrations equals the deployed schema', () => {
  const prod = reference.schema;
  expectSameSet(local.tables, prod.tables, 'tables');
  expectSameSet(local.columns, prod.columns, 'colonnes');
  expectSameSet(local.policies, prod.policies, 'politiques RLS');
  expectSameSet(local.functions, prod.functions, 'fonctions');
  expectSameSet(local.triggers, prod.triggers, 'déclencheurs');
  expectSameSet(local.indexes, prod.indexes, 'index');
  expectSameSet(local.constraints, prod.constraints, 'contraintes');
  expectSameSet(local.grants, prod.grants, 'privilèges');
});

test('the deployed database still satisfies the runbook checks', () => {
  const prod = reference.schema;
  // 1. RLS activée partout.
  assert.deepEqual(prod.tables.filter(table => !table.rls), []);
  // 2. Les trois déclencheurs de quota sont présents.
  assert.deepEqual(
    prod.triggers.map(trigger => trigger.name).sort(),
    ['enforce_monthly_order_limit', 'enforce_station_limit', 'owner_subscription_lock'],
  );
  // 3. Aucun droit d'écriture métier pour `authenticated` hors catalogue/clients :
  //    les prestations passent exclusivement par des fonctions SECURITY DEFINER.
  const writeGrants = prod.grants
    .filter(grant => grant.grantee === 'authenticated' && /INSERT|UPDATE|DELETE/.test(grant.privs))
    .map(grant => grant.table)
    .sort();
  assert.deepEqual(writeGrants, ['station_customers', 'station_services']);
});

test('the five late migrations are recorded under execution-time versions', () => {
  // C'est la cause du faux « pending » : le schéma est identique, seules les
  // versions diffèrent. Ce test fige la correspondance pour la commande
  // `supabase migration repair` du runbook.
  const divergent = reference._migrations_locales.filter(item => !item.identique);
  assert.equal(divergent.length, 5);
  for (const item of divergent) {
    assert.ok(
      item.version_distante > item.fichier.slice(0, 14),
      `${item.fichier} doit être enregistrée sous une version postérieure`,
    );
  }
});
