/**
 * Compare le code des migrations du dépôt à celui que la base a réellement
 * exécuté, sans se connecter.
 *
 * Pourquoi ce script existe : `supabase db push` compare des *versions*, pas du
 * SQL. Le 9 novembre, cinq migrations ont été appliquées via le connecteur
 * Supabase, qui les a horodatées au moment de l'exécution : le dépôt contenait
 * `20261109140000_station_memberships.sql`, la base a enregistré
 * `20261109182442` avec le même contenu.
 *
 * Ce script a servi à le prouver (étape 1). Les cinq fichiers ont ensuite été
 * renommés vers les versions réellement enregistrées (étape 3), donc en
 * fonctionnement normal chaque fichier porte sa propre version et la
 * correspondance croisée n'est plus utilisée. Elle reste dans le relevé, et le
 * script l'accepte encore : c'est la trace de ce qui a été vérifié.
 *
 * Méthode : la table `supabase_migrations.schema_migrations` conserve, depuis
 * la CLI 2.x, le texte exécuté dans `statements[1]`. On en dérive une empreinte
 * insensible à la mise en forme (commentaires `--` retirés, tous les blancs
 * supprimés), on calcule la même empreinte sur chaque fichier local, et on
 * compare avec la correspondance de versions figée ci-dessous.
 *
 * Cette correspondance est la seule donnée qui ne peut pas être recalculée
 * hors ligne : elle vient de `select version, name from
 * supabase_migrations.schema_migrations` (relevé le 10/11/2026, voir
 * `docs/sauvegardes/prod-migration-historique-2026-11-10.json`).
 *
 * Mode d'emploi :
 *   node scripts/checkMigrationContent.mjs          # vérifie
 *   node scripts/checkMigrationContent.mjs --json   # sortie machine
 *
 * Sortie : code 0 si tout correspond, 1 sinon (utilisable en CI).
 */
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const MIGRATIONS_DIR = 'supabase/migrations';
const HISTORY_FILE = 'docs/sauvegardes/prod-migration-historique-2026-11-10.json';

/**
 * Empreinte du code SQL, indépendante de la mise en forme : commentaires en
 * ligne retirés, puis toute espace, tabulation ou saut de ligne supprimé.
 *
 * Les commentaires sont retirés en premier parce que `create_migration` ne les
 * enregistre pas toujours de la même façon ; les blancs ensuite, parce que le
 * CLI peut normaliser l'indentation. Ce qui reste est exactement la suite
 * d'instructions exécutées.
 */
export function sqlFingerprint(sql) {
  const withoutComments = sql.replace(/--[^\n]*/g, '');
  const compact = withoutComments.replace(/\s/g, '');
  return createHash('md5').update(compact, 'utf8').digest('hex');
}

/** Fichiers de migration, triés, avec leur version (14 premiers caractères). */
async function localMigrations() {
  const entries = await readdir(MIGRATIONS_DIR);
  return entries
    .filter(name => name.endsWith('.sql'))
    .sort()
    .map(name => ({ file: name, version: name.slice(0, 14) }));
}

async function main() {
  const history = JSON.parse(await readFile(HISTORY_FILE, 'utf8'));
  const remote = new Map(history.migrations.map(item => [item.version, item]));
  const localFiles = await localMigrations();

  const results = [];
  const problems = [];

  for (const { file, version } of localFiles) {
    const localSql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    // Une version locale peut avoir été exercée sous un autre horodatage
    // (application via connecteur) : la correspondance vient de l'historique.
    const record =
      remote.get(version) ??
      history.migrations.find(item => item.fichier === file || item.version_fichier === file);
    if (!record) {
      problems.push(`${file} : aucune entrée dans l'historique distant`);
      results.push({ file, version, statut: 'inconnu' });
      continue;
    }
    if (record.fingerprint !== sqlFingerprint(localSql)) {
      problems.push(`${file} : le SQL du dépôt ne correspond pas à celui exécuté sous ${record.version}`);
      results.push({ file, version: record.version, statut: 'different' });
      continue;
    }
    results.push({ file, version: record.version, statut: 'identique' });
  }

  // Une migration enregistrée en base doit avoir un fichier portant sa version :
  // sinon un `db push` futur la considérerait absente et la rejouerait.
  //
  // Après l'étape 3, le fichier a été renommé : `version_fichier` contient la
  // version réelle, et `fichier` garde le nom historique (preuve de l'étape 1).
  // Accepter l'un ou l'autre évite que cette trace devienne une fausse alerte.
  const knownFiles = new Set(localFiles.map(item => item.file));
  for (const item of history.migrations) {
    const renamed = item.version_fichier && knownFiles.has(item.version_fichier);
    const original = item.fichier && knownFiles.has(item.fichier);
    if (!renamed && !original) {
      problems.push(`${item.version} (${item.name}) est appliquée mais aucun fichier ne la représente`);
    }
  }

  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify({ results, problems }, null, 2)}\n`);
  } else {
    for (const row of results) {
      const statut = row.statut === 'identique' ? 'OK' : row.statut.toUpperCase();
      console.log(`${statut.padEnd(10)} ${row.file}  -> ${row.version}`);
    }
    console.log();
    if (problems.length === 0) {
      console.log(`${results.length} migration(s) locale(s) identiques au SQL exécuté, aucune divergence.`);
    } else {
      console.log(`${problems.length} problème(s) :`);
      for (const problem of problems) console.log(`  - ${problem}`);
    }
  }

  process.exitCode = problems.length === 0 ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
