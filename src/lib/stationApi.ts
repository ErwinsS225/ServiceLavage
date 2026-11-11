import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultClient } from './supabase';
import { describeError, unwrap } from './queryResult';

/**
 * Les appels Supabase des modules « station » (catalogue, clients, prestations,
 * inventaire, personnel), regroupés par fonctionnalité.
 *
 * Pourquoi : ces requêtes vivaient dans le corps des composants, mêlées à
 * l'état React et au rendu. Impossible de les tester sans DOM, impossible de
 * vérifier qu'un écran n'oublie pas de borner sa requête. Ici elles sont
 * pures — `(client, …) => Promise<données>` — donc testables avec un faux
 * client, et un seul endroit à relire quand une politique RLS change.
 *
 * **Le serveur reste l'autorité.** Ces fonctions ne filtrent pas par rôle, ne
 * décident pas d'un droit et ne remplacent aucune politique : elles passent le
 * `station_id` demandé à PostgREST ou sonnent les RPC `SECURITY DEFINER`, qui
 * refusent d'eux-mêmes un appel non autorisé. Déplacer un filtre ici ne doit
 * jamais servir à retirer un contrôle RLS.
 */

/** Client partagé, injectable pour les tests. */
export type StationClient = SupabaseClient;

export function resolveClient(client?: StationClient | null): StationClient {
  const resolved = client ?? defaultClient;
  if (!resolved)
    throw new Error(
      'Supabase n’est pas configuré : VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY sont absents.',
    );
  return resolved;
}

/* ------------------------------------------------------------------ */
/* Catalogue (station_services)                                        */
/* ------------------------------------------------------------------ */

export interface ServiceRow {
  id: string;
  name: string;
  price_xof: number;
  duration_minutes: number;
  is_active: boolean;
}

export const SERVICE_FIELDS = 'id,name,price_xof,duration_minutes,is_active';

export interface ServiceInput {
  name: string;
  price_xof: number;
  duration_minutes: number;
  is_active: boolean;
}

export async function fetchServices(client: StationClient, stationId: string): Promise<ServiceRow[]> {
  const result = await client
    .from('station_services')
    .select(SERVICE_FIELDS)
    .eq('station_id', stationId)
    .order('created_at', { ascending: false });
  return unwrap(
    result as { data: ServiceRow[] | null; error: { message: string } | null },
    'Impossible de charger le catalogue',
  );
}

export async function createService(
  client: StationClient,
  stationId: string,
  input: ServiceInput,
): Promise<ServiceRow> {
  const result = await client
    .from('station_services')
    .insert({ ...input, station_id: stationId })
    .select(SERVICE_FIELDS)
    .single();
  return unwrap(
    result as { data: ServiceRow | null; error: { message: string } | null },
    'Enregistrement impossible',
  );
}

export async function updateService(
  client: StationClient,
  stationId: string,
  serviceId: string,
  input: ServiceInput,
): Promise<ServiceRow> {
  const result = await client
    .from('station_services')
    .update(input)
    .eq('id', serviceId)
    // The station filter is not a security control (RLS decides), it prevents
    // an id from another station being targeted by mistake.
    .eq('station_id', stationId)
    .select(SERVICE_FIELDS)
    .single();
  return unwrap(
    result as { data: ServiceRow | null; error: { message: string } | null },
    'Enregistrement impossible',
  );
}

/** Services actifs, pour la création d'une prestation. */
export async function fetchActiveServices(
  client: StationClient,
  stationId: string,
): Promise<Array<Pick<ServiceRow, 'id' | 'name' | 'price_xof'>>> {
  const result = await client
    .from('station_services')
    .select('id,name,price_xof')
    .eq('station_id', stationId)
    .eq('is_active', true)
    .order('name');
  return unwrap(
    result as {
      data: Array<Pick<ServiceRow, 'id' | 'name' | 'price_xof'>> | null;
      error: { message: string } | null;
    },
    'Impossible de charger les services actifs',
  );
}

/* ------------------------------------------------------------------ */
/* Clients (station_customers)                                         */
/* ------------------------------------------------------------------ */

export interface CustomerRow {
  id: string;
  name: string;
  phone: string;
}

export const CUSTOMER_FIELDS = 'id,name,phone';

export async function fetchCustomers(client: StationClient, stationId: string): Promise<CustomerRow[]> {
  const result = await client
    .from('station_customers')
    .select(CUSTOMER_FIELDS)
    .eq('station_id', stationId)
    .order('created_at', { ascending: false });
  return unwrap(
    result as { data: CustomerRow[] | null; error: { message: string } | null },
    'Impossible de charger les clients',
  );
}

/** Clients triés par nom, pour le sélecteur de la création de prestation. */
export async function fetchCustomersByName(client: StationClient, stationId: string): Promise<CustomerRow[]> {
  const result = await client
    .from('station_customers')
    .select(CUSTOMER_FIELDS)
    .eq('station_id', stationId)
    .order('name');
  return unwrap(
    result as { data: CustomerRow[] | null; error: { message: string } | null },
    'Impossible de charger les clients',
  );
}

export async function createCustomer(
  client: StationClient,
  stationId: string,
  input: { name: string; phone: string },
): Promise<CustomerRow> {
  const result = await client
    .from('station_customers')
    .insert({ station_id: stationId, name: input.name, phone: input.phone })
    .select(CUSTOMER_FIELDS)
    .single();
  return unwrap(
    result as { data: CustomerRow | null; error: { message: string } | null },
    'Enregistrement impossible',
  );
}

export async function updateCustomer(
  client: StationClient,
  stationId: string,
  customerId: string,
  input: { name: string; phone: string },
): Promise<CustomerRow> {
  const result = await client
    .from('station_customers')
    .update(input)
    .eq('id', customerId)
    .eq('station_id', stationId)
    .select(CUSTOMER_FIELDS)
    .single();
  return unwrap(
    result as { data: CustomerRow | null; error: { message: string } | null },
    'Enregistrement impossible',
  );
}

/* ------------------------------------------------------------------ */
/* Prestations (station_orders)                                        */
/* ------------------------------------------------------------------ */

export type OrderStatus = 'en_attente' | 'en_cours' | 'termine' | 'annule';

export interface OrderRow {
  id: string;
  vehicle_info: string;
  plate_number: string | null;
  total_xof: number;
  status: OrderStatus;
  created_at: string;
  station_order_items: Array<{ id: string; service_name: string; price_xof: number }>;
}

export const ORDER_FIELDS =
  'id,vehicle_info,plate_number,total_xof,status,created_at,station_order_items(id,service_name,price_xof)';

export async function fetchOrders(client: StationClient, stationId: string): Promise<OrderRow[]> {
  const result = await client
    .from('station_orders')
    .select(ORDER_FIELDS)
    .eq('station_id', stationId)
    // A station accumulates every wash ever recorded: the screen only shows
    // the recent ones, the reports read their own, bounded window.
    .order('created_at', { ascending: false })
    .limit(200);
  return unwrap(
    result as { data: OrderRow[] | null; error: { message: string } | null },
    'Chargement des prestations impossible',
  );
}

export interface QueuedOrderLike {
  requestId: string;
  stationId: string;
  customerId: string | null;
  vehicle: string;
  plate: string | null;
  serviceIds: string[];
}

/**
 * Envoi d'une prestation mise en file hors ligne, via la RPC idempotente :
 * rejouer la même requête ne crée pas de doublon. La fonction serveur vérifie
 * le rôle, les quotas et les prix — rien de tout cela n'est décidé ici.
 */
export async function createOrderIdempotent(client: StationClient, order: QueuedOrderLike): Promise<void> {
  const { error } = await client.rpc('create_station_order_idempotent', {
    p_request_id: order.requestId,
    p_station_id: order.stationId,
    p_customer_id: order.customerId,
    p_vehicle_info: order.vehicle,
    p_plate_number: order.plate,
    p_service_ids: order.serviceIds,
  });
  if (error) throw new Error(`Synchronisation en attente : ${error.message}`);
}

export async function transitionOrder(
  client: StationClient,
  orderId: string,
  status: 'en_cours' | 'termine' | 'annule',
): Promise<void> {
  const { error } = await client.rpc('transition_station_order', { p_order_id: orderId, p_status: status });
  if (error) throw new Error(`Mise à jour impossible : ${error.message}`);
}

/**
 * La session qui envoie la file doit être celle qui l'a créée : un changement
 * de compte sur le même appareil ne doit pas rejouer les prestations d'autrui.
 */
export async function assertSameUser(client: StationClient, userId: string): Promise<void> {
  const { data } = await client.auth.getSession();
  if (data.session?.user.id !== userId) {
    throw new Error('Reconnectez-vous au compte d’origine pour synchroniser.');
  }
}

/* ------------------------------------------------------------------ */
/* Affectations (station_order_assignments)                            */
/* ------------------------------------------------------------------ */

export interface AssignmentRow {
  order_id: string;
  user_id: string;
}

export async function fetchAssignments(client: StationClient, stationId: string): Promise<AssignmentRow[]> {
  const result = await client
    .from('station_order_assignments')
    .select('order_id,user_id')
    .eq('station_id', stationId);
  return unwrap(
    result as { data: AssignmentRow[] | null; error: { message: string } | null },
    'Chargement des affectations impossible',
  );
}

export async function fetchWashers(
  client: StationClient,
  stationId: string,
): Promise<Array<{ user_id: string }>> {
  const result = await client
    .from('station_memberships')
    .select('user_id')
    .eq('station_id', stationId)
    .eq('role', 'laveur')
    .is('revoked_at', null);
  return unwrap(
    result as { data: Array<{ user_id: string }> | null; error: { message: string } | null },
    'Chargement des laveurs impossible',
  );
}

export async function assignOrder(client: StationClient, orderId: string, washerId: string): Promise<void> {
  const { error } = await client.rpc('assign_station_order', { p_order_id: orderId, p_user_id: washerId });
  if (error) throw new Error(`Affectation impossible : ${error.message}`);
}

export async function unassignOrder(client: StationClient, orderId: string, washerId: string): Promise<void> {
  const { error } = await client.rpc('unassign_station_order', { p_order_id: orderId, p_user_id: washerId });
  if (error) throw new Error(`Retrait de l’affectation impossible : ${error.message}`);
}

/* ------------------------------------------------------------------ */
/* Inventaire (station_inventory + RPC d'opération)                    */
/* ------------------------------------------------------------------ */

export interface InventoryRow {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  min_threshold: number;
}

export const INVENTORY_FIELDS = 'id,name,unit,quantity,min_threshold';

export async function fetchInventory(client: StationClient, stationId: string): Promise<InventoryRow[]> {
  const result = await client
    .from('station_inventory')
    .select(INVENTORY_FIELDS)
    .eq('station_id', stationId)
    .order('name');
  return unwrap(
    result as { data: InventoryRow[] | null; error: { message: string } | null },
    'Impossible de charger l’inventaire',
  );
}

/** Création d'article : la RPC renvoie la ligne créée, ou refuse (rôle, quota). */
/** Champs d'un nouvel article, séparés de la station pour les mutations typées. */
export interface InventoryItemInput {
  stationId: string;
  name: string;
  unit: string;
  quantity: number;
  minThreshold: number;
}

export async function createInventoryItem(client: StationClient, input: InventoryItemInput): Promise<void> {
  const { data, error } = await client.rpc('apply_inventory_operation', {
    p_request_id: crypto.randomUUID(),
    p_station_id: input.stationId,
    p_item_id: null,
    p_name: input.name,
    p_unit: input.unit,
    p_quantity: input.quantity,
    p_min_threshold: input.minThreshold,
  });
  if (error) throw new Error(`Enregistrement impossible : ${error.message}`);
  if (!Array.isArray(data) || data.length === 0) throw new Error('Le serveur n’a pas confirmé la création.');
}

/** Ajustement relatif d'un article existant, idempotent par `requestId`. */
export async function applyInventoryAdjustment(
  client: StationClient,
  input: { requestId: string; stationId: string; itemId: string; delta: number },
): Promise<void> {
  const { data, error } = await client.rpc('apply_inventory_operation', {
    p_request_id: input.requestId,
    p_station_id: input.stationId,
    p_item_id: input.itemId,
    p_name: null,
    p_unit: null,
    p_quantity: input.delta,
    p_min_threshold: null,
  });
  if (error) throw new Error(error.message);
  if (!Array.isArray(data) || data.length === 0)
    throw new Error('Le serveur n’a pas confirmé l’ajustement de stock.');
}

/* ------------------------------------------------------------------ */
/* Personnel (invitations et membres)                                  */
/* ------------------------------------------------------------------ */

export type StaffRole = 'gerant' | 'caissier' | 'laveur';

export interface MemberRow {
  user_id: string;
  role: StaffRole;
  created_at: string;
  revoked_at: string | null;
}

export interface InvitationRow {
  id: string;
  email: string;
  role: StaffRole;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  cancelled_at: string | null;
}

/**
 * Effectif complet — y compris les accès révoqués, l'écran les affiche comme
 * tels. Les invitations ne sont lues que par un propriétaire : la politique RLS
 * le garantit aussi, mais interroger la table pour rien produirait une erreur
 * trompeuse pour un gérant.
 */
export async function fetchStaff(
  client: StationClient,
  stationId: string,
  canManageRoles: boolean,
): Promise<{ members: MemberRow[]; invitations: InvitationRow[] }> {
  const rosterQuery = client
    .from('station_memberships')
    .select('user_id,role,created_at,revoked_at')
    .eq('station_id', stationId)
    .order('created_at');
  const invitationsQuery = canManageRoles
    ? client
        .from('station_invitations')
        .select('id,email,role,created_at,expires_at,accepted_at,cancelled_at')
        .eq('station_id', stationId)
        .order('created_at', { ascending: false })
    : Promise.resolve({ data: [] as InvitationRow[], error: null });

  const [roster, invitations] = await Promise.all([rosterQuery, invitationsQuery]);
  const members = unwrap(
    roster as { data: MemberRow[] | null; error: { message: string } | null },
    'Chargement du personnel impossible',
  );
  const invites = unwrap(
    invitations as { data: InvitationRow[] | null; error: { message: string } | null },
    'Chargement des invitations impossible',
  );
  return { members, invitations: invites };
}

/** Renvoie la référence d'invitation à transmettre au collaborateur. */
export async function createInvitation(
  client: StationClient,
  stationId: string,
  email: string,
  role: StaffRole,
): Promise<string> {
  const { data, error } = await client.rpc('create_station_invitation', {
    p_station_id: stationId,
    p_email: email,
    p_role: role,
  });
  if (error) throw new Error(`Création de l’invitation impossible : ${error.message}`);
  return String(data ?? '');
}

export async function cancelInvitation(client: StationClient, invitationId: string): Promise<void> {
  const { error } = await client.rpc('cancel_station_invitation', { p_invitation_id: invitationId });
  if (error) throw new Error(`Annulation impossible : ${error.message}`);
}

export async function revokeMembership(
  client: StationClient,
  stationId: string,
  userId: string,
): Promise<void> {
  const { error } = await client.rpc('revoke_station_membership', {
    p_station_id: stationId,
    p_user_id: userId,
  });
  if (error) throw new Error(`Révocation impossible : ${error.message}`);
}

/* ------------------------------------------------------------------ */
/* Rapport d'activité                                                  */
/* ------------------------------------------------------------------ */

export interface ReportOrderRow {
  id: string;
  total_xof: number;
  status: OrderStatus;
  created_at: string;
  vehicle_info: string;
  plate_number: string | null;
}

/**
 * Prestations de l'année en cours pour une station.
 *
 * Bornée à `since` : un `select` sans borne grandirait à chaque lavage. Le
 * rapport ne prétend donc pas couvrir l'historique complet, et l'écran le dit.
 */
export async function fetchReportOrders(
  client: StationClient,
  stationId: string,
  since: Date,
): Promise<ReportOrderRow[]> {
  const result = await client
    .from('station_orders')
    .select('id, total_xof, status, created_at, vehicle_info, plate_number')
    .eq('station_id', stationId)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false });
  return unwrap(
    result as { data: ReportOrderRow[] | null; error: { message: string } | null },
    'Chargement du rapport impossible',
  );
}

/**
 * Comptage des clients d'une station sans rapatrier la table.
 * `head: true` + `count: 'exact'` : le serveur renvoie un entier, pas des lignes.
 */
export async function countCustomers(client: StationClient, stationId: string): Promise<number> {
  const { count, error } = await client
    .from('station_customers')
    .select('id', { count: 'exact', head: true })
    .eq('station_id', stationId);
  if (error) throw new Error(`Comptage des clients impossible : ${error.message}`);
  return count ?? 0;
}

export { describeError };

/* ------------------------------------------------------------------ */
/* Abonnement du propriétaire                                          */
/* ------------------------------------------------------------------ */

export interface OwnerSubscription {
  plan: 'starter' | 'pro' | 'business';
  max_stations: number;
  max_monthly_orders: number;
  /** Nombre de stations réellement rattachées au propriétaire. */
  station_count: number;
  /** Prestations du mois courant, toutes stations confondues. */
  monthly_orders: number;
}

/**
 * Formule, plafonds et consommation réels via `my_subscription()`.
 *
 * La RPC est `SECURITY DEFINER` et filtre sur `auth.uid()` : elle ne renvoie
 * qu'une ligne, celle du propriétaire connecté, et calcule elle-même les deux
 * compteurs (stations rattachées, prestations du mois). Ces valeurs sont donc
 * mesurées côté serveur, pas déduites du cache local — un compteur de quota
 * affiché depuis le navigateur serait faux dès la deuxième session.
 */
export async function fetchSubscription(client: StationClient): Promise<OwnerSubscription> {
  const { data, error } = await client.rpc('my_subscription');
  if (error) throw new Error(`Lecture de la formule impossible : ${error.message}`);
  const rows = (data ?? []) as OwnerSubscription[];
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('Aucune formule retournée par le serveur.');
  }
  const row = rows[0];
  return {
    plan: row.plan,
    max_stations: Number(row.max_stations),
    max_monthly_orders: Number(row.max_monthly_orders),
    station_count: Number(row.station_count),
    monthly_orders: Number(row.monthly_orders),
  };
}

/** Pourcentage de consommation d'un quota, borné à [0, 100]. `null` si le quota est nul. */
export function quotaUsage(used: number, limit: number): number | null {
  if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) return null;
  return Math.min(100, Math.max(0, Math.round((used / limit) * 100)));
}
