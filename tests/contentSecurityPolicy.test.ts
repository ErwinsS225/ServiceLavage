import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

/**
 * The CSP is a plain <meta> tag, so a typo silently weakens it with no build
 * error. These assertions pin the directives that matter and prove the
 * Supabase origin is injected from the environment instead of hard-coded.
 */
const html = await readFile('index.html', 'utf8');
const config = await readFile('vite.config.ts', 'utf8');

const policy = (html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/s)?.[1] ?? '')
  .replace(/\s+/g, ' ').trim();

test('the policy is declared and injects the Supabase placeholder', () => {
  assert.ok(policy.length > 0, 'aucune CSP déclarée dans index.html');
  assert.match(policy, /connect-src[^;]*%VITE_CSP_SUPABASE_ORIGIN%/);
});

test('dangerous directives are explicitly disabled', () => {
  assert.match(policy, /object-src 'none'/);
  assert.match(policy, /base-uri 'self'/);
  assert.match(policy, /frame-ancestors 'none'/);
  assert.match(policy, /form-action 'self'/);
  assert.doesNotMatch(policy, /script-src[^;]*'unsafe-inline'/);
  assert.doesNotMatch(policy, /script-src[^;]*'unsafe-eval'/);
  assert.doesNotMatch(policy, /default-src \*/);
});

test('the build plugin derives the Supabase origin instead of hard-coding it', () => {
  assert.match(config, /name: 'csp-supabase-origin'/);
  assert.match(config, /process\.env\.VITE_SUPABASE_URL/);
  assert.match(config, /replace\(\/\^https:\/, 'wss:'\)/);
  // A project reference must never be committed in a tracked file.
  assert.doesNotMatch(html, /[a-z]{20}\.supabase\.co/);
});

test('fonts and styles stay limited to the known providers', () => {
  assert.match(policy, /font-src 'self' https:\/\/fonts\.gstatic\.com/);
  assert.match(policy, /style-src[^;]*https:\/\/fonts\.googleapis\.com/);
});
