import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_PASSWORD_LENGTH, RECOVERY_SENT_MESSAGE, authRedirectUrl, validateNewPassword,
} from '../src/lib/passwordRecovery';

test('a new password must be long enough and match its confirmation', () => {
  assert.deepEqual(validateNewPassword('', ''), { ok: false, reason: 'empty' });
  assert.deepEqual(validateNewPassword('a'.repeat(MIN_PASSWORD_LENGTH - 1), 'a'.repeat(MIN_PASSWORD_LENGTH - 1)), { ok: false, reason: 'too_short' });
  assert.deepEqual(validateNewPassword('a'.repeat(MIN_PASSWORD_LENGTH), 'b'.repeat(MIN_PASSWORD_LENGTH)), { ok: false, reason: 'mismatch' });
  assert.deepEqual(validateNewPassword('a'.repeat(MIN_PASSWORD_LENGTH), 'a'.repeat(MIN_PASSWORD_LENGTH)), { ok: true });
});

test('password length limit matches the documented minimum of eight', () => {
  assert.equal(MIN_PASSWORD_LENGTH, 8);
  assert.equal(validateNewPassword('1234567', '1234567').ok, false);
  assert.equal(validateNewPassword('12345678', '12345678').ok, true);
});

test('recovery redirect targets the site root of the current origin', () => {
  assert.equal(authRedirectUrl('https://3000-abc.e2b.app'), 'https://3000-abc.e2b.app/');
  assert.equal(authRedirectUrl('http://localhost:3000'), 'http://localhost:3000/');
  // A path in the origin must not leak into the redirect target.
  assert.equal(authRedirectUrl('https://example.com/deep/path'), 'https://example.com/');
});

test('a malformed origin is returned unchanged instead of silently producing a dead link', () => {
  assert.equal(authRedirectUrl('not-a-url'), 'not-a-url');
  assert.equal(authRedirectUrl(''), '');
});

test('the recovery message never reveals whether an account exists', () => {
  assert.match(RECOVERY_SENT_MESSAGE, /^Si un compte existe/);
  assert.doesNotMatch(RECOVERY_SENT_MESSAGE, /inconnu|introuvable|existe pas|aucun compte/i);
});
