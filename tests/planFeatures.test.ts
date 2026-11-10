import assert from 'node:assert/strict';
import test from 'node:test';
import { planFeatures } from '../src/data/planFeatures';

test('plan matrix preserves confirmed station and monthly order quotas', () => {
  assert.deepEqual(
    planFeatures.map(plan => [plan.id, plan.stationLimit, plan.monthlyOrderLimit]),
    [
      ['starter', 1, 500],
      ['pro', 2, 2500],
      ['business', 10, 10000],
    ],
  );
});

test('higher plans inherit lower-tier features and expose their own additions', () => {
  const starterIds = planFeatures[0].features.map(feature => feature.id);
  const proIds = planFeatures[1].features.map(feature => feature.id);
  const businessIds = planFeatures[2].features.map(feature => feature.id);
  for (const id of starterIds) {
    assert.ok(proIds.includes(id), `Pro must inherit ${id}`);
    assert.ok(businessIds.includes(id), `Business must inherit ${id}`);
  }
  for (const id of proIds) assert.ok(businessIds.includes(id), `Business must inherit Pro feature ${id}`);
  assert.ok(proIds.includes('inventory-alerts'));
  assert.ok(proIds.includes('reports-export'));
  assert.ok(businessIds.includes('reports-consolidated'));
  assert.ok(businessIds.includes('roles-advanced'));
  assert.ok(businessIds.includes('offline-resilient'));
});

test('unfinished benefits are never labeled operational', () => {
  for (const plan of planFeatures) {
    for (const feature of plan.features) {
      if (['tickets', 'cash', 'reports-basic', 'staff-basic', 'showcase-basic'].includes(feature.id)) {
        assert.notEqual(
          feature.delivery,
          'operational',
          `${feature.id} must remain transparent until implemented`,
        );
      }
    }
  }
});
