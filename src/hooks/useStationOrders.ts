import { useCallback, useEffect, useState } from 'react';
import {
  assertSameUser,
  assignOrder,
  createOrderIdempotent,
  fetchActiveServices,
  fetchAssignments,
  fetchCustomersByName,
  fetchOrders,
  fetchWashers,
  resolveClient,
  transitionOrder,
  unassignOrder,
  type AssignmentRow,
  type CustomerRow,
  type OrderRow,
  type OrderStatus,
  type ServiceRow,
  type StationClient,
} from '../lib/stationApi';
import { listQueuedOrders, saveQueuedOrder, synchronizeOrders, type QueuedOrder } from '../lib/offlineOrders';
import { useOfflineQueue } from './useOfflineQueue';
import { useLocalCache } from './useLocalCache';
import { describeError } from '../lib/queryResult';

/**
 * Tout l'état *données* du module Prestations : catalogue actif, clients,
 * historique, cache hors ligne, file d'envoi, affectations.
 *
 * Ce que le composant garde : les formulaires, les modales, les messages. Ce
 * que ce hook porte : les requêtes, la reprise hors ligne et les mutations.
 *
 * Rien ici ne décide d'un droit. Les mutations passent par les RPC
 * `SECURITY DEFINER` (`create_station_order_idempotent`,
 * `transition_station_order`, `assign_station_order`, …) qui vérifient le rôle,
 * les quotas et la propriété de la prestation. `canManageOrders` n'est qu'un
 * confort d'interface : un laveur qui appellerait `transition_station_order`
 * directement serait accepté s'il est affecté, refusé sinon — par le serveur.
 */

export type StationRole = 'owner' | 'gerant' | 'caissier' | 'laveur';

const ORDER_CACHE_VERSION = 'servicelavage:order-data:v1';

interface CachedCatalogue {
  services: Array<Pick<ServiceRow, 'id' | 'name' | 'price_xof'>>;
  customers: CustomerRow[];
}

function isCachedCatalogue(value: unknown): value is CachedCatalogue {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CachedCatalogue>;
  return Array.isArray(candidate.services) && Array.isArray(candidate.customers);
}

export interface UseStationOrdersOptions {
  stationId: string;
  userId: string;
  role: StationRole;
  /** `false` tant que les droits serveur ne sont pas confirmés. */
  roleFeaturesReady: boolean;
  client?: StationClient | null;
}

export interface NewOrderInput {
  vehicle: string;
  plate: string;
  customerId: string;
  serviceIds: string[];
}

export function useStationOrders({ stationId, userId, role, roleFeaturesReady, client }: UseStationOrdersOptions) {
  const api = useCallback(() => resolveClient(client), [client]);
  const canManageOrders = role === 'owner' || role === 'gerant';
  const cache = useLocalCache<CachedCatalogue>(`${ORDER_CACHE_VERSION}:${userId}:${stationId}`, isCachedCatalogue);

  const [services, setServices] = useState<Array<Pick<ServiceRow, 'id' | 'name' | 'price_xof'>>>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [cached, setCached] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [washers, setWashers] = useState<Array<{ user_id: string }>>([]);
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  const reload = useCallback(() => setReloadToken(value => value + 1), []);

  /* ---------------- file hors ligne ---------------- */

  const queue = useOfflineQueue<QueuedOrder>({
    list: () => listQueuedOrders(localStorage, userId, stationId),
    deliver: async order => {
      const stationApi = api();
      // The queue belongs to one account: replaying it under another session
      // would attribute someone else's washes to the new user.
      await assertSameUser(stationApi, userId);
      await createOrderIdempotent(stationApi, order);
    },
    synchronize: deliver => synchronizeOrders(localStorage, userId, stationId, deliver),
    canSync: () => canManageOrders && navigator.onLine,
    onDelivered: reload,
    fallback: 'Synchronisation impossible. Les opérations restent sur cet appareil.',
  });

  useEffect(() => {
    try { queue.refresh(); } catch (cause) { setLoadError(describeError(cause, 'File locale inaccessible.')); }
    void queue.sync();
    // `queue.refresh` / `queue.sync` are stable; the scope is the station.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationId, userId, role]);

  /* ---------------- catalogue, clients, historique ---------------- */

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');

    // Offline, the cached catalogue is what allows a station to keep working.
    try {
      const snapshot = cache.read();
      if (snapshot) {
        setServices(snapshot.services);
        setCustomers(snapshot.customers);
        setCached(true);
      }
    } catch (cause) {
      setLoadError(describeError(cause, 'Impossible de lire les données locales.'));
    }

    if (!navigator.onLine) {
      setOrders([]);
      setLoading(false);
      return () => { active = false; };
    }

    const stationApi = api();
    Promise.all([
      fetchActiveServices(stationApi, stationId),
      fetchCustomersByName(stationApi, stationId),
      fetchOrders(stationApi, stationId),
    ])
      .then(([serviceList, customerList, orderList]) => {
        if (!active) return;
        setServices(serviceList);
        setCustomers(customerList);
        setOrders(orderList);
        setCached(false);
        try {
          cache.write({ services: serviceList, customers: customerList });
        } catch {
          setLoadError('Données chargées, mais leur stockage hors ligne a échoué.');
        }
      })
      .catch((cause: unknown) => {
        if (active) setLoadError(describeError(cause, 'Chargement impossible. Vérifiez votre connexion.'));
      })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationId, userId, role, reloadToken]);

  /* ---------------- affectations ---------------- */

  useEffect(() => {
    if (!roleFeaturesReady || !canManageOrders) {
      setAssignments([]);
      setWashers([]);
      return;
    }
    let active = true;
    const stationApi = api();
    Promise.all([fetchAssignments(stationApi, stationId), fetchWashers(stationApi, stationId)])
      .then(([assignmentList, washerList]) => {
        if (!active) return;
        setAssignments(assignmentList);
        setWashers(washerList);
      })
      .catch((cause: unknown) => {
        if (active) setActionError(describeError(cause, 'Chargement des affectations impossible.'));
      });
    return () => { active = false; };
  }, [stationId, role, roleFeaturesReady, reloadToken, canManageOrders, api]);

  /* ---------------- mutations ---------------- */

  /** Enregistre la prestation sur l'appareil puis tente l'envoi. */
  const createOrder = useCallback(async (input: NewOrderInput): Promise<void> => {
    const order: QueuedOrder = {
      version: 1,
      userId,
      stationId,
      requestId: crypto.randomUUID(),
      customerId: input.customerId || null,
      vehicle: input.vehicle.trim(),
      plate: input.plate.trim() || null,
      serviceIds: input.serviceIds,
      createdAt: new Date().toISOString(),
    };
    saveQueuedOrder(localStorage, order);
    try {
      queue.refresh();
    } catch {
      throw new Error('Prestation enregistrée localement, mais la file contient une entrée illisible : ne créez pas de doublon.');
    }
    void queue.sync();
  }, [queue, stationId, userId]);

  const transition = useCallback(async (orderId: string, status: Extract<OrderStatus, 'en_cours' | 'termine' | 'annule'>): Promise<void> => {
    await transitionOrder(api(), orderId, status);
    reload();
  }, [api, reload]);

  const assign = useCallback(async (orderId: string, washerId: string): Promise<void> => {
    if (!washerId) throw new Error('Sélectionnez un laveur.');
    await assignOrder(api(), orderId, washerId);
    reload();
  }, [api, reload]);

  const unassign = useCallback(async (orderId: string, washerId: string): Promise<void> => {
    await unassignOrder(api(), orderId, washerId);
    reload();
  }, [api, reload]);

  return {
    services,
    customers,
    orders,
    loading,
    cached,
    loadError,
    queue,
    assignments,
    washers,
    reload,
    createOrder,
    transition,
    assign,
    unassign,
    canManageOrders,
    actionError,
    actionMessage,
    setActionError,
    setActionMessage,
    clearActionMessages: useCallback(() => { setActionError(''); setActionMessage(''); }, []),
  };
}
