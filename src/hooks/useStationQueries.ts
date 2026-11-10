import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import {
  createCustomer,
  createInventoryItem,
  createService,
  fetchCustomers,
  fetchInventory,
  fetchReportOrders,
  fetchServices,
  fetchStaff,
  fetchSubscription,
  resolveClient,
  updateCustomer,
  updateService,
  type CustomerRow,
  type InvitationRow,
  type MemberRow,
  type OwnerSubscription,
  type ReportOrderRow,
  type InventoryItemInput,
  type ServiceInput,
  type ServiceRow,
  type StaffRole,
  type StationClient,
} from '../lib/stationApi';
import { createInvitation, cancelInvitation, revokeMembership } from '../lib/stationApi';
import { describeError } from '../lib/queryResult';
import { queryKeys } from '../lib/queryClient';

/**
 * Données serveur lues par TanStack Query.
 *
 * Pourquoi seulement *une partie* des modules, et pas tous : la P1 avait un
 * impératif explicite — séparer les responsabilités sans changer le socle de
 * données. Les modules où `useState` mélangeait vraiment « état serveur » et
 * « état d'écran » sont migrés ici ; ceux qui portent une file hors ligne
 * (`StationInventory`, `StationOrders`) gardent leur orchestration, parce que
 * leur état local n'est pas du cache : c'est une file d'écritures non
 * confirmées. La mettre dans un cache de lecture serait un contresens.
 *
 * Les mutations invalident les clés concernées : aucune liste n'est mise à
 * jour « à la main » en espérant qu'elle ressemble à la réponse du serveur.
 * Les droits ne sont pas ici : les RPC `SECURITY DEFINER` et RLS décident.
 */

function api(client?: StationClient | null) {
  return resolveClient(client);
}

/* ------------------------------ catalogue ------------------------------ */

export function useServices(stationId: string, client?: StationClient | null) {
  return useQuery({
    queryKey: queryKeys.services(stationId),
    queryFn: () => fetchServices(api(client), stationId),
    enabled: Boolean(stationId),
  });
}

export function useCreateService(stationId: string, client?: StationClient | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ServiceInput) => createService(api(client), stationId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.services(stationId) });
    },
  });
}

export function useUpdateService(stationId: string, client?: StationClient | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { serviceId: string; changes: ServiceInput }) =>
      updateService(api(client), stationId, input.serviceId, input.changes),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.services(stationId) });
    },
  });
}

/* ------------------------------ inventaire ----------------------------- */

/**
 * Inventaire — lecture seule via le cache.
 *
 * L'écriture reste hors de TanStack Query, et ce n'est pas un oubli : les
 * ajustements sont mis en file dans `localStorage` et envoyés par
 * `apply_inventory_operation`, retirés seulement après accusé serveur. Mettre
 * cette file dans un cache de lecture la rejouerait ou la viderait au premier
 * `refetch`. Seule la lecture profite donc du cache.
 */
export function useInventory(
  stationId: string,
  options: { enabled?: boolean; client?: StationClient | null } = {},
) {
  const { enabled = true, client } = options;
  return useQuery({
    queryKey: queryKeys.inventory(stationId),
    queryFn: () => fetchInventory(api(client), stationId),
    enabled: Boolean(stationId) && enabled,
  });
}

/** Création d'un article : en ligne uniquement, donc une mutation simple. */
export function useCreateInventoryItem(stationId: string, client?: StationClient | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<InventoryItemInput, 'stationId'>) =>
      createInventoryItem(api(client), { ...input, stationId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.inventory(stationId) });
    },
  });
}

/* ------------------------------- clients ------------------------------- */

export function useCustomers(stationId: string, client?: StationClient | null) {
  return useQuery({
    queryKey: queryKeys.customers(stationId),
    queryFn: () => fetchCustomers(api(client), stationId),
    enabled: Boolean(stationId),
  });
}

export function useCreateCustomer(stationId: string, client?: StationClient | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; phone: string }) => createCustomer(api(client), stationId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.customers(stationId) });
    },
  });
}

export function useUpdateCustomer(stationId: string, client?: StationClient | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { customerId: string; changes: { name: string; phone: string } }) =>
      updateCustomer(api(client), stationId, input.customerId, input.changes),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.customers(stationId) });
    },
  });
}

/* ------------------------------ personnel ------------------------------ */

/**
 * Effectif et invitations. `enabled` reste piloté par l'appelant : tant que
 * `current_station_role` n'a pas répondu, interroger `station_invitations`
 * produirait « permission denied » pour un gérant, ce qui ressemble à une
 * panne alors que c'est une règle.
 */
export function useStaff(
  stationId: string,
  canManageRoles: boolean,
  enabled: boolean,
  client?: StationClient | null,
) {
  return useQuery({
    queryKey: queryKeys.staff(stationId, canManageRoles),
    queryFn: () => fetchStaff(api(client), stationId, canManageRoles),
    enabled: Boolean(stationId) && enabled,
  });
}

export function useInvitationMutations(stationId: string, client?: StationClient | null) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['station', stationId, 'staff'] });
  };
  const invalidateAll = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['station', stationId, 'staff'] });
  }, [queryClient, stationId]);

  const invite = useMutation({
    mutationFn: (input: { email: string; role: StaffRole }) =>
      createInvitation(api(client), stationId, input.email, input.role),
    onSuccess: invalidate,
  });
  const cancel = useMutation({
    mutationFn: (invitationId: string) => cancelInvitation(api(client), invitationId),
    onSuccess: invalidateAll,
  });
  const revoke = useMutation({
    mutationFn: (userId: string) => revokeMembership(api(client), stationId, userId),
    onSuccess: invalidateAll,
  });

  return { invite, cancel, revoke };
}

/* ------------------------------- rapports ------------------------------ */

/**
 * Prestations de l'année en cours pour le rapport.
 *
 * La fenêtre est déclarée par l'appelant (`since`) : un `select` sans borne
 * grandirait à chaque lavage. `staleTime` plus court que la valeur par défaut,
 * parce qu'un rapport relu après un lavage doit refléter ce lavage.
 */
export function useReportOrders(stationId: string, since: Date, client?: StationClient | null) {
  return useQuery({
    queryKey: queryKeys.reports(stationId),
    queryFn: () => fetchReportOrders(api(client), stationId, since),
    enabled: Boolean(stationId),
    staleTime: 0,
  });
}

/* ----------------------------- abonnement ------------------------------ */

export function useSubscriptionQuery(enabled: boolean, client?: StationClient | null) {
  return useQuery({
    queryKey: queryKeys.subscription(),
    queryFn: () => fetchSubscription(api(client)),
    enabled,
  });
}

export type { CustomerRow, InvitationRow, MemberRow, OwnerSubscription, ReportOrderRow, ServiceRow };

/** Message prêt à afficher pour n'importe quelle erreur de mutation. */
export function mutationMessage(cause: unknown, fallback: string): string {
  return describeError(cause, fallback);
}
