import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

/**
 * The Vite dev server serves the project root, which would expose internal
 * documentation, SQL migrations, tests and environment files. A guard plugin
 * blocks them; this test proves the guard exists and covers the required paths,
 * and that nothing confidential lives in `public/` (copied verbatim to the site
 * root at build time).
 */
const config = await readFile('vite.config.ts', 'utf8');

test('the dev server blocks internal directories', () => {
  const match = config.match(/const blocked = (\/.*\/);/);
  assert.ok(match, 'the allow-list guard must define a blocked pattern');
  const blocked = new RegExp(match[1].slice(1, -1));
  for (const path of [
    '/docs/audit.md',
    '/docs',
    '/tests/money.test.ts',
    '/supabase/migrations/x.sql',
    '/.aistudio/artifacts/brain/x.jpg',
  ]) {
    assert.ok(blocked.test(path), `${path} must be blocked`);
  }
  for (const path of [
    '/',
    '/src/main.tsx',
    '/icons/icon-192.png',
    '/manifest.webmanifest',
    '/assets/index-abc.js',
  ]) {
    assert.ok(!blocked.test(path), `${path} must stay reachable`);
  }
});

test('the dev server rejects parent-directory traversal', () => {
  assert.match(config, /pathname\.includes\('\.\.'\)/);
});

test('the guard is only applied to the dev server, never to the build', () => {
  assert.match(config, /name: 'dev-root-allow-list',\s*apply: 'serve'/);
});

test('public/ contains only files meant to be public', async () => {
  const { readdir } = await import('node:fs/promises');
  const files = (await readdir('public', { recursive: true })).filter(entry => /\.\w+$/.test(entry)).sort();
  assert.deepEqual(files, [
    'assets/auth-forgot-1.jpg',
    'assets/auth-forgot-2.jpg',
    'assets/auth-reset-1.jpg',
    'assets/auth-reset-2.jpg',
    'assets/auth-signin-1.jpg',
    'assets/auth-signin-2.jpg',
    'assets/auth-signup-1.jpg',
    'assets/auth-signup-2.jpg',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'manifest.webmanifest',
  ]);
});

test('no product documentation is served from public/', async () => {
  const { readdir } = await import('node:fs/promises');
  const all = (await readdir('public', { recursive: true })).join(' ');
  assert.doesNotMatch(all, /\.(md|sql|json)$/i, 'public/ must not ship documentation, SQL or configuration');
});
