import assert from 'node:assert/strict';
import test from 'node:test';
import {
  listQueuedInventoryAdjustments,
  saveQueuedInventoryAdjustment,
  synchronizeInventoryAdjustments,
  type QueuedInventoryAdjustment,
} from '../src/lib/offlineInventory';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, String(value));
  }
}

function adjustment(overrides: Partial<QueuedInventoryAdjustment> = {}): QueuedInventoryAdjustment {
  return {
    version: 1,
    userId: 'user-a',
    stationId: 'station-a',
    requestId: crypto.randomUUID(),
    itemId: 'soap',
    delta: -2,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

test('inventory adjustments persist and remain isolated by user and station', () => {
  const storage = new MemoryStorage();
  saveQueuedInventoryAdjustment(
    storage,
    adjustment({ requestId: 'r1', createdAt: '2026-01-01T00:00:00.000Z' }),
  );
  saveQueuedInventoryAdjustment(
    storage,
    adjustment({ requestId: 'r2', delta: 3, createdAt: '2026-01-02T00:00:00.000Z' }),
  );
  assert.equal(listQueuedInventoryAdjustments(storage, 'user-a', 'station-a').length, 2);
  assert.equal(listQueuedInventoryAdjustments(storage, 'user-b', 'station-a').length, 0);
  assert.equal(listQueuedInventoryAdjustments(storage, 'user-a', 'station-b').length, 0);
  assert.throws(
    () => saveQueuedInventoryAdjustment(storage, adjustment({ requestId: 'r1' })),
    /déjà utilisé/,
  );
});

test('inventory queue retains malformed entries without silently deleting them', () => {
  const storage = new MemoryStorage();
  const item = adjustment({ requestId: 'bad' });
  storage.setItem(
    `servicelavage:inventory-adjustment:v1:${item.userId}:${item.stationId}:${item.requestId}`,
    '{',
  );
  assert.throws(() => listQueuedInventoryAdjustments(storage, item.userId, item.stationId), /illisible/);
  assert.equal(storage.length, 1);
});

test('a lost acknowledgement retries the same stock request idempotently', async () => {
  const storage = new MemoryStorage();
  const item = adjustment({ requestId: 'retry' });
  saveQueuedInventoryAdjustment(storage, item);
  const applied = new Set<string>();
  let stock = 10;
  let loseResponse = true;
  const deliver = async (queued: QueuedInventoryAdjustment) => {
    if (!applied.has(queued.requestId)) {
      stock += queued.delta;
      applied.add(queued.requestId);
    }
    if (loseResponse) {
      loseResponse = false;
      throw new Error('response perdue');
    }
  };
  const first = await synchronizeInventoryAdjustments(storage, item.userId, item.stationId, deliver);
  assert.equal(first.completed, 0);
  assert.equal(stock, 8);
  assert.equal(listQueuedInventoryAdjustments(storage, item.userId, item.stationId).length, 1);
  const retry = await synchronizeInventoryAdjustments(storage, item.userId, item.stationId, deliver);
  assert.equal(retry.completed, 1);
  assert.equal(stock, 8);
  assert.equal(listQueuedInventoryAdjustments(storage, item.userId, item.stationId).length, 0);
});

test('synchronization stops at the first rejected adjustment and keeps it plus later entries', async () => {
  const storage = new MemoryStorage();
  const first = adjustment({ requestId: 'a', createdAt: '2026-01-01T00:00:00.000Z' });
  const second = adjustment({ requestId: 'b', createdAt: '2026-01-02T00:00:00.000Z' });
  const third = adjustment({ requestId: 'c', createdAt: '2026-01-03T00:00:00.000Z' });
  [first, second, third].forEach(item => saveQueuedInventoryAdjustment(storage, item));
  const attempted: string[] = [];
  const result = await synchronizeInventoryAdjustments(storage, first.userId, first.stationId, async item => {
    attempted.push(item.requestId);
    if (item.requestId === 'b') throw new Error('stock serveur insuffisant');
  });
  assert.equal(result.completed, 1);
  assert.deepEqual(attempted, ['a', 'b']);
  assert.deepEqual(
    listQueuedInventoryAdjustments(storage, first.userId, first.stationId).map(item => item.requestId),
    ['b', 'c'],
  );
});

test('invalid and zero inventory deltas are not queued', () => {
  const storage = new MemoryStorage();
  assert.throws(() => saveQueuedInventoryAdjustment(storage, adjustment({ delta: 0 })), /invalide/);
  assert.throws(() => saveQueuedInventoryAdjustment(storage, adjustment({ delta: 1.5 })), /invalide/);
  assert.throws(
    () => saveQueuedInventoryAdjustment(storage, adjustment({ delta: 1_000_000_001 })),
    /invalide/,
  );
  assert.equal(storage.length, 0);
});
