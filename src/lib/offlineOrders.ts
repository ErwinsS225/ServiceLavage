/** One immutable key per request avoids overwriting another tab's queue. */
export type QueuedOrder = {
  version: 1;
  userId: string;
  stationId: string;
  requestId: string;
  customerId: string | null;
  vehicle: string;
  plate: string | null;
  serviceIds: string[];
  createdAt: string;
};
const prefix = 'servicelavage:order:v1:';
export function orderQueueKey(order: Pick<QueuedOrder, 'userId' | 'stationId' | 'requestId'>): string {
  return `${prefix}${order.userId}:${order.stationId}:${order.requestId}`;
}
export function saveQueuedOrder(storage: Storage, order: QueuedOrder): void {
  const key = orderQueueKey(order);
  if (storage.getItem(key) !== null) throw new Error('Identifiant de requête déjà utilisé.');
  storage.setItem(key, JSON.stringify(order));
}
export function listQueuedOrders(storage: Storage, userId: string, stationId: string): QueuedOrder[] {
  const scope = `${prefix}${userId}:${stationId}:`;
  const result: QueuedOrder[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(scope)) continue;
    const value = storage.getItem(key);
    if (!value) continue;
    let item: QueuedOrder;
    try { item = JSON.parse(value); } catch { throw new Error('Une opération locale est illisible ; elle a été conservée.'); }
    if (item.version !== 1 || item.userId !== userId || item.stationId !== stationId || orderQueueKey(item) !== key ||
      typeof item.vehicle !== 'string' || !Array.isArray(item.serviceIds) || item.serviceIds.length === 0 ||
      typeof item.createdAt !== 'string') throw new Error('Une opération locale est invalide ; elle a été conservée.');
    result.push(item);
  }
  return result.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.requestId.localeCompare(b.requestId));
}
export function removeQueuedOrder(storage: Storage, order: QueuedOrder): void {
  storage.removeItem(orderQueueKey(order));
}
