import test from 'node:test';
import assert from 'node:assert/strict';
import { formatXof } from '../src/lib/money';

test('XOF values are never inferred or converted', () => {
  for (const value of [0, 60, 999, 1000, 1500]) {
    assert.equal(formatXof(value), `${value.toLocaleString('fr-FR')} FCFA`);
  }
});

test('legacy fractional values are not silently multiplied or rounded to an integer', () => {
  assert.equal(formatXof(60.5), `${(60.5).toLocaleString('fr-FR')} FCFA`);
});
