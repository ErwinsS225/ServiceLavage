import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

/**
 * The portal used to build its module list inline, so the navigation, the
 * rendering conditions and the station-change reset could drift apart. They
 * now read one matrix; these assertions pin the matrix itself and prove the
 * panel conditions still agree with it.
 */
const source = await readFile('src/components/OwnerPortal.tsx', 'utf8');

const roles = ['owner', 'gerant', 'caissier', 'laveur'] as const;

test('the module matrix covers the eight station modules exactly once', () => {
  const ids = [...source.matchAll(/\{ id: '([a-z]+)', label: '[^']+', roles: \[([^\]]+)\] \}/g)]
    .map(match => ({ id: match[1], roles: match[2] }));
  assert.deepEqual(ids.map(entry => entry.id), [
    'dashboard', 'orders', 'services', 'customers', 'inventory', 'staff', 'reports', 'subscription',
  ]);
});

test('no role is left without any module', () => {
  const entries = [...source.matchAll(/\{ id: '[a-z]+', label: '[^']+', roles: \[([^\]]+)\] \}/g)]
    .map(match => match[1]);
  for (const role of roles) {
    assert.ok(entries.some(entry => entry.includes(`'${role}'`)), `${role} has no module at all`);
  }
});

test('a cashier cannot open the washes module, a washer cannot manage anything else', () => {
  const orders = /{ id: 'orders', label: '[^']+', roles: \[([^\]]+)\] }/.exec(source)?.[1] ?? '';
  // A cashier cannot create a wash on the server either
  // (create_station_order_idempotent requires owner or gerant), so the tab
  // must not be advertised. A washer only sees the washes assigned to them.
  assert.doesNotMatch(orders, /caissier/);
  assert.match(orders, /laveur/);
  for (const forbidden of ['services', 'inventory', 'staff', 'reports', 'subscription']) {
    const entry = new RegExp(`\\{ id: '${forbidden}', label: '[^']+', roles: \\[([^\\]]+)\\] \\}`).exec(source)?.[1] ?? '';
    assert.doesNotMatch(entry, /laveur/, `le laveur ne doit pas ouvrir ${forbidden}`);
  }
  // and the panel rendering must repeat the same restriction
  assert.match(source, /tab === 'orders' && \(stationRole === 'owner' \|\| stationRole === 'gerant' \|\| stationRole === 'laveur'\)/);
});

test('subscriptions stay owner-only, both in the matrix and in the panel', () => {
  const subscription = /{ id: 'subscription', label: '[^']+', roles: \[([^\]]+)\] }/.exec(source)?.[1] ?? '';
  assert.equal(subscription.trim(), "'owner'");
  assert.match(source, /tab === 'subscription' && stationRole === 'owner'/);
});

test('a station change can never keep a forbidden tab open', () => {
  // The reset effect must be driven by the shared helper, not a stale copy.
  assert.match(source, /allowedTabsFor\(stationRole\)/);
  assert.match(source, /if \(allowed\.length > 0 && !allowed\.includes\(tab\)\) setTab\(allowed\[0\]\)/);
});
