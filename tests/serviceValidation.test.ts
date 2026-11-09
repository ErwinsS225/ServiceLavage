import test from 'node:test';
import assert from 'node:assert/strict';
import { parseServiceInteger } from '../src/lib/serviceValidation';

test('prices are whole XOF with explicit limits', () => {
  assert.equal(parseServiceInteger('0', 0, 100000000), 0);
  assert.equal(parseServiceInteger('1500', 0, 100000000), 1500);
  assert.equal(parseServiceInteger('100000000', 0, 100000000), 100000000);
  for (const value of ['', ' ', '-1', '1.5', '1e3', '100000001', '999999999999999999999']) {
    assert.equal(parseServiceInteger(value, 0, 100000000), null, value);
  }
});

test('duration must be between one minute and one day', () => {
  assert.equal(parseServiceInteger('1', 1, 1440), 1);
  assert.equal(parseServiceInteger('1440', 1, 1440), 1440);
  assert.equal(parseServiceInteger('0', 1, 1440), null);
  assert.equal(parseServiceInteger('1441', 1, 1440), null);
});
