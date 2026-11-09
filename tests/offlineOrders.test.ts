import test from 'node:test';
import assert from 'node:assert/strict';
import { listQueuedOrders, orderQueueKey, removeQueuedOrder, saveQueuedOrder, type QueuedOrder } from '../src/lib/offlineOrders';
class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, value); }
}
const order: QueuedOrder = { version: 1, userId: 'user1', stationId: 'station1', requestId: 'req1', customerId: null, vehicle: 'Auto', plate: null, serviceIds: ['srv1'], createdAt: '2026-11-09T12:00:00Z' };
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
