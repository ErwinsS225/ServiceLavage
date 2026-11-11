import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

/**
 * La CLI Supabase est la seule voie de déploiement de ce dépôt. Sans config
 * versionnée, `supabase link` ne sait pas quel projet viser et chaque
 * développeur recrée la sienne à la main — c'est ainsi que le décalage de
 * versions du 9 novembre est passé inaperçu.
 *
 * Ces tests figent les réglages qui doivent rester alignés sur la réalité du
 * projet, sans contenir aucun secret.
 */

const config = await readFile('supabase/config.toml', 'utf8');
const reference = JSON.parse(await readFile('docs/sauvegardes/prod-schema-2026-11-10.json', 'utf8'));

test('the CLI config targets the real project', () => {
  assert.match(config, /^project_id = "avvkzliysacpyavmetsx"$/m, 'projet LavAuto');
  assert.equal(
    reference._projet.ref,
    'avvkzliysacpyavmetsx',
    'la référence doit rester celle de l’instantané',
  );
});

test('the local development stack is usable without Docker-specific values', () => {
  // `supabase start` sert pour les essais locaux ; les ports par défaut évitent
  // d’entrer en conflit avec le serveur Vite du projet (3000).
  assert.match(config, /\[api\]\n(enabled = true\n)?port = 54321/);
  assert.match(config, /\[db\]\nport = 54322/);
  assert.match(config, /\[studio\]\n(enabled = true\n)?port = 54323/);
});

test('the config carries no credential', () => {
  assert.doesNotMatch(config, /sb_(publishable|secret)_[A-Za-z0-9]{10,}/, 'clé Supabase');
  assert.doesNotMatch(config, /eyJ[A-Za-z0-9_-]{20,}/, 'jeton JWT');
  // Le nom de la variable est documenté dans l'en-tête, sa valeur ne doit
  // jamais apparaître : un jeton personnel commence par `sbp_`.
  assert.doesNotMatch(config, /SUPABASE_ACCESS_TOKEN\s*=\s*\S+/, 'valeur de jeton');
  assert.doesNotMatch(config, /\bsbp_[A-Za-z0-9]{20,}/, 'jeton personnel');
});

test('the npm scripts drive the CLI instead of ad-hoc commands', async () => {
  const pkg = JSON.parse(await readFile('package.json', 'utf8')) as { scripts: Record<string, string> };
  const expected: Record<string, RegExp> = {
    'db:version': /supabase.*--version/,
    'db:login': /supabase(@latest)? login --no-browser/,
    'db:link': /supabase(@latest)? link --project-ref avvkzliysacpyavmetsx/,
    'db:status': /supabase(@latest)? migration list/,
    'db:drift': /productionSchemaDrift|dumpLocalSchema/,
  };
  for (const [script, pattern] of Object.entries(expected)) {
    assert.ok(pkg.scripts[script], `script manquant : ${script}`);
    assert.match(pkg.scripts[script], pattern, `${script} ne fait pas ce qu’il annonce`);
  }
  // Aucun script ne doit pouvoir pousser des migrations par accident.
  for (const [name, command] of Object.entries(pkg.scripts)) {
    assert.doesNotMatch(command, /db push|--include-all/, `${name} contourne la procédure du runbook`);
  }
});
