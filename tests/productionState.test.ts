import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

/**
 * Le rapport d'audit du 9 novembre concluait que 4 migrations sur 10 n'étaient
 * pas déployées. C'est faux depuis le 9 novembre au soir, mais le document est
 * toujours dans le dépôt et un lecteur peut le prendre pour l'état courant.
 * Ces tests verrouillent son statut d'archive et la traçabilité de l'état réel.
 */

const HISTORICAL = 'docs/rapport-audit-complet-2026-11-09.md';

test('the 9 November report is visibly marked as historical', async () => {
  const report = await readFile(HISTORICAL, 'utf8');
  const header = report.slice(0, 2500);
  assert.match(header, /DOCUMENT HISTORIQUE, NE PAS UTILISER COMME ÉTAT ACTUEL/);
  assert.match(header, /périmé sur son constat central/);
  // It must point to the document that carries the current state.
  assert.match(header, /audit-general-2026-11-10\.md/);
  assert.match(header, /runbook-migrations\.md/);
  // And to the evidence, not to a claim.
  assert.match(header, /prod-schema-2026-11-10\.json/);
  // The stale figure must be contradicted in the header itself.
  assert.match(header, /11 versions sur 11/);
});

test('the runbook states the verified state instead of the historical one', async () => {
  const runbook = await readFile('docs/runbook-migrations.md', 'utf8');
  assert.match(runbook, /## État vérifié \(10 novembre 2026\)/, 'le runbook doit dater son état');
  assert.match(runbook, /11 migrations/);
  // The version drift is mapped explicitly, file by file.
  for (const pair of [
    ['20261109140000_station_memberships.sql', '20261109182442'],
    ['20261109141000_subscription_limits.sql', '20261109182456'],
    ['20261109142000_station_inventory.sql', '20261109182509'],
    ['20261109150000_station_role_permissions.sql', '20261109182534'],
    ['20261109160000_revoke_legacy_order_rpc.sql', '20261109184205'],
  ]) {
    assert.ok(
      runbook.includes(pair[0]) && runbook.includes(pair[1]),
      `correspondance manquante : ${pair[0]}`,
    );
  }
  // Depuis l'étape 3, le runbook ne prescrit plus `migration repair` : il
  // l'exclut explicitement. Le test qui figeait la commande de réparation est
  // devenu un test de l'inverse — sinon la documentation continuerait de
  // recommander une écriture d'historique devenue inutile et risquée.
  assert.doesNotMatch(
    runbook,
    /supabase migration repair --status/,
    'aucune commande `migration repair` ne doit rester',
  );
  assert.match(runbook, /n'est pas dans ce chemin/);
  // La correspondance ancien → nouveau reste documentée : c'est la trace de
  // ce qui a été fait, et elle explique pourquoi les versions ont changé.
  assert.match(runbook, /Étape 3 — noms de fichiers alignés/);
  // And the additive-migration rule is written down.
  assert.match(runbook, /Nouvelle migration : la seule voie autorisée/);
  assert.match(runbook, /Aucune migration\s+appliquée n'est éditée, jamais/);
});

test('the backup taken before any future migration exists and has no secret', async () => {
  const backup = await readFile('docs/sauvegardes/2026-11-10-avant-nouvelle-migration.json', 'utf8');
  const data = JSON.parse(backup);
  assert.equal(data.project_ref, 'avvkzliysacpyavmetsx');
  assert.equal(data.stations.length, 2);
  assert.equal(data.subscriptions.length, 1);
  assert.equal(data.compteurs.station_orders, 0);
  // No credential may ever land in a backup file committed to the repository.
  assert.doesNotMatch(backup, /eyJ[A-Za-z0-9_-]{20,}/, 'jeton JWT');
  assert.doesNotMatch(backup, /sb_(publishable|secret)_[A-Za-z0-9]{10,}/, 'clé Supabase');
  assert.doesNotMatch(backup, /service_role\s*[:=]\s*['"]/, 'clé service_role');
  assert.doesNotMatch(backup, /encrypted_password|password_hash/, 'hash de mot de passe');
});

test('the applied migrations were not modified to match the remote versions', async () => {
  // Renommé le 10 novembre 2026 (réconciliation, étape 3) : le fichier porte
  // désormais la version que la base a réellement enregistrée. Ce que ce test
  // protège reste le même — le **contenu** n'a pas été retouché. C'est
  // `npm run db:content` qui le prouve, en comparant l'empreinte de chaque
  // fichier au SQL stocké dans `schema_migrations`.
  const files = (await readdir('supabase/migrations')).filter(name => name.endsWith('.sql')).sort();
  assert.deepEqual(files, [
    '20261109121406_owner_stations.sql',
    '20261109122729_station_customers.sql',
    '20261109122929_station_services.sql',
    '20261109123327_station_orders.sql',
    '20261109130303_order_idempotency.sql',
    '20261109130602_restrict_station_privileges.sql',
    '20261109182442_station_memberships.sql',
    '20261109182456_subscription_limits.sql',
    '20261109182509_station_inventory.sql',
    '20261109182534_station_role_permissions.sql',
    '20261109184205_revoke_legacy_order_rpc.sql',
  ]);
  // Aucun fichier ne doit conserver un préfixe qui n'existe pas en base : ce
  // serait une migration fantôme, que `db push` rejouerait.
  const history = JSON.parse(
    await readFile('docs/sauvegardes/prod-migration-historique-2026-11-10.json', 'utf8'),
  ) as { migrations: Array<{ version: string }> };
  const applied = new Set(history.migrations.map(item => item.version));
  for (const file of files) assert.ok(applied.has(file.slice(0, 14)), `${file} : version non appliquée`);
});
