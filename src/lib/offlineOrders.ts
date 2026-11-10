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
    try {
      item = JSON.parse(value);
    } catch {
      throw new Error('Une opération locale est illisible ; elle a été conservée.');
    }
    if (
      !item ||
      typeof item !== 'object' ||
      item.version !== 1 ||
      item.userId !== userId ||
      item.stationId !== stationId ||
      typeof item.requestId !== 'string' ||
      !item.requestId ||
      orderQueueKey(item) !== key ||
      typeof item.vehicle !== 'string' ||
      !item.vehicle.trim() ||
      item.vehicle.length > 120 ||
      !(item.customerId === null || typeof item.customerId === 'string') ||
      !(item.plate === null || (typeof item.plate === 'string' && item.plate.length <= 40)) ||
      !Array.isArray(item.serviceIds) ||
      item.serviceIds.length < 1 ||
      item.serviceIds.length > 20 ||
      item.serviceIds.some(id => typeof id !== 'string' || !id) ||
      new Set(item.serviceIds).size !== item.serviceIds.length ||
      typeof item.createdAt !== 'string' ||
      !Number.isFinite(Date.parse(item.createdAt))
    )
      throw new Error('Une opération locale est invalide ; elle a été conservée.');
    result.push(item);
  }
  return result.sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.requestId.localeCompare(b.requestId),
  );
}
export function removeQueuedOrder(storage: Storage, order: QueuedOrder): void {
  storage.removeItem(orderQueueKey(order));
}

/** Deliver in creation order. Only a confirmed server acknowledgement removes an item. */
export async function synchronizeOrders(
  storage: Storage,
  userId: string,
  stationId: string,
  deliver: (order: QueuedOrder) => Promise<void>,
): Promise<{ completed: number; error: unknown | null }> {
  let completed = 0;
  try {
    const queue = listQueuedOrders(storage, userId, stationId);
    for (const order of queue) {
      await deliver(order);
      removeQueuedOrder(storage, order);
      completed++;
    }
    return { completed, error: null };
  } catch (error) {
    // Ambiguous network results are retained; server-side idempotency makes retry safe.
    return { completed, error };
  }
}
