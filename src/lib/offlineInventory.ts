/** Local queue for relative stock changes; server remains authoritative for the final quantity. */
export type QueuedInventoryAdjustment = {
  version: 1;
  userId: string;
  stationId: string;
  requestId: string;
  itemId: string;
  delta: number;
  createdAt: string;
};

const prefix = 'servicelavage:inventory-adjustment:v1:';

export function inventoryQueueKey(adjustment: Pick<QueuedInventoryAdjustment, 'userId' | 'stationId' | 'requestId'>): string {
  return `${prefix}${adjustment.userId}:${adjustment.stationId}:${adjustment.requestId}`;
}

export function saveQueuedInventoryAdjustment(storage: Storage, adjustment: QueuedInventoryAdjustment): void {
  validateAdjustment(adjustment);
  const key = inventoryQueueKey(adjustment);
  if (storage.getItem(key) !== null) throw new Error('Identifiant de requête déjà utilisé.');
  storage.setItem(key, JSON.stringify(adjustment));
}

function validateAdjustment(value: unknown): asserts value is QueuedInventoryAdjustment {
  if (!value || typeof value !== 'object') throw new Error('Une opération locale d’inventaire est invalide ; elle a été conservée.');
  const item = value as Partial<QueuedInventoryAdjustment>;
  if (item.version !== 1 || typeof item.userId !== 'string' || !item.userId ||
    typeof item.stationId !== 'string' || !item.stationId || typeof item.requestId !== 'string' || !item.requestId ||
    typeof item.itemId !== 'string' || !item.itemId || typeof item.delta !== 'number' || !Number.isSafeInteger(item.delta) || item.delta === 0 ||
    Math.abs(item.delta) > 1_000_000_000 || typeof item.createdAt !== 'string' || !Number.isFinite(Date.parse(item.createdAt))) {
    throw new Error('Une opération locale d’inventaire est invalide ; elle a été conservée.');
  }
}

export function listQueuedInventoryAdjustments(storage: Storage, userId: string, stationId: string): QueuedInventoryAdjustment[] {
  const scope = `${prefix}${userId}:${stationId}:`;
  const result: QueuedInventoryAdjustment[] = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (!key?.startsWith(scope)) continue;
    const raw = storage.getItem(key);
    if (raw === null) continue;
    let item: unknown;
    try { item = JSON.parse(raw); }
    catch { throw new Error('Une opération locale d’inventaire est illisible ; elle a été conservée.'); }
    validateAdjustment(item);
    if (item.userId !== userId || item.stationId !== stationId || inventoryQueueKey(item) !== key) {
      throw new Error('Une opération locale d’inventaire ne correspond pas à sa clé ; elle a été conservée.');
    }
    result.push(item);
  }
  return result.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.requestId.localeCompare(b.requestId));
}

export function removeQueuedInventoryAdjustment(storage: Storage, adjustment: QueuedInventoryAdjustment): void {
  storage.removeItem(inventoryQueueKey(adjustment));
}

/** Stop on the first failure and retain it plus later operations for a safe retry. */
export async function synchronizeInventoryAdjustments(
  storage: Storage,
  userId: string,
  stationId: string,
  deliver: (adjustment: QueuedInventoryAdjustment) => Promise<void>,
): Promise<{ completed: number; error: unknown | null }> {
  let completed = 0;
  try {
    for (const adjustment of listQueuedInventoryAdjustments(storage, userId, stationId)) {
      await deliver(adjustment);
      removeQueuedInventoryAdjustment(storage, adjustment);
      completed++;
    }
    return { completed, error: null };
  } catch (error) {
    return { completed, error };
  }
}
