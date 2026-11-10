import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listQueuedOrders,
  orderQueueKey,
  removeQueuedOrder,
  saveQueuedOrder,
  type QueuedOrder,
} from '../src/lib/offlineOrders';
class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}
const order: QueuedOrder = {
  version: 1,
  userId: 'user1',
  stationId: 'station1',
  requestId: 'req1',
  customerId: null,
  vehicle: 'Auto',
  plate: null,
  serviceIds: ['srv1'],
  createdAt: '2026-11-09T12:00:00Z',
};
test('queue is persistent, isolated by user and station and preserves independent requests', () => {
  const storage = new MemoryStorage();
  saveQueuedOrder(storage, order);
  saveQueuedOrder(storage, { ...order, requestId: 'req2' });
  saveQueuedOrder(storage, { ...order, userId: 'user2' });
  assert.equal(listQueuedOrders(storage, 'user1', 'station1').length, 2);
  assert.equal(listQueuedOrders(storage, 'user1', 'station2').length, 0);
  assert.throws(() => saveQueuedOrder(storage, order));
  removeQueuedOrder(storage, order);
  assert.equal(listQueuedOrders(storage, 'user1', 'station1').length, 1);
  assert.equal(listQueuedOrders(storage, 'user2', 'station1').length, 1);
});
test('malformed queue data is retained and reported', () => {
  const storage = new MemoryStorage();
  storage.setItem(orderQueueKey(order), '{');
  assert.throws(() => listQueuedOrders(storage, 'user1', 'station1'));
  assert.equal(storage.getItem(orderQueueKey(order)), '{');
});

test('a lost server response retains the request and a retry does not create a duplicate', async () => {
  const storage = new MemoryStorage();
  saveQueuedOrder(storage, order);
  const { synchronizeOrders } = await import('../src/lib/offlineOrders');
  const server = new Map<string, string>();
  let attempts = 0;
  const deliver = async (item: QueuedOrder) => {
    attempts++;
    if (!server.has(item.requestId)) server.set(item.requestId, 'created');
    if (attempts === 1) throw new Error('response lost after commit');
  };
  const first = await synchronizeOrders(storage, order.userId, order.stationId, deliver);
  assert.equal(first.completed, 0);
  assert.ok(first.error);
  assert.equal(listQueuedOrders(storage, order.userId, order.stationId).length, 1);
  const second = await synchronizeOrders(storage, order.userId, order.stationId, deliver);
  assert.equal(second.completed, 1);
  assert.equal(second.error, null);
  assert.equal(server.size, 1);
  assert.equal(listQueuedOrders(storage, order.userId, order.stationId).length, 0);
});

test('synchronization stops at failure and preserves failed and subsequent requests', async () => {
  const storage = new MemoryStorage();
  saveQueuedOrder(storage, order);
  saveQueuedOrder(storage, { ...order, requestId: 'req2' });
  saveQueuedOrder(storage, { ...order, requestId: 'req3' });
  const { synchronizeOrders } = await import('../src/lib/offlineOrders');
  const sent: string[] = [];
  const result = await synchronizeOrders(storage, order.userId, order.stationId, async item => {
    sent.push(item.requestId);
    if (item.requestId === 'req2') throw new Error('service disabled');
  });
  assert.deepEqual(sent, ['req1', 'req2']);
  assert.equal(result.completed, 1);
  assert.ok(result.error);
  assert.deepEqual(
    listQueuedOrders(storage, 'user1', 'station1').map(item => item.requestId),
    ['req2', 'req3'],
  );
});

test('invalid but valid JSON queue records are retained', () => {
  const storage = new MemoryStorage();
  for (const data of ['null', JSON.stringify({ ...order, serviceIds: ['srv1', 'srv1'] })]) {
    storage.setItem(orderQueueKey(order), data);
    assert.throws(() => listQueuedOrders(storage, 'user1', 'station1'), /invalide/);
    assert.equal(storage.getItem(orderQueueKey(order)), data);
  }
});
