import { invitationReferenceSchema } from './schemas';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { isRecoveryLink, supabase as defaultClient } from './supabase';
import { unwrap } from './queryResult';

/**
 * Requêtes du portail : session, liste des stations, rôle sur la station.
 *
 * Extraites de `OwnerPortal.tsx`, où elles étaient mêlées à la navigation et au
 * rendu. Elles restent volontairement minces : aucune décision de droit, deux
 * appels seulement — `stations` (filtrée par RLS) et la RPC
 * `current_station_role` (SECURITY DEFINER).
 *
 * Le repli hors ligne (cache `localStorage`, rôle déduit de `owner_id`) est une
 * commodité d'ergonomie, **pas** une autorisation : la valeur affichée ne sert
 * qu'à choisir un onglet, et chaque appel de données est de toute façon
 * refusé ou accepté par le serveur.
 */

export interface StationRow {
  id: string;
  name: string;
  owner_id?: string;
}

export const STATIONS_CACHE_KEY = (userId: string) => `servicelavage:stations:v2:${userId}`;
export const LEGACY_STATIONS_CACHE_KEY = (userId: string) => `servicelavage:stations:v1:${userId}`;

/** Normalise une valeur lue dans le cache : seule une liste de stations passe. */
export function sanitizeStations(value: unknown): StationRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is StationRow =>
    !!item && typeof item === 'object' &&
    typeof (item as StationRow).id === 'string' &&
    typeof (item as StationRow).name === 'string');
}

/**
 * Cache local des stations. La v1 ne contenait que les stations dont on est
 * propriétaire (ancienne politique RLS) : la migrer sans `owner_id` ferait
 * apparaître des stations « membre » comme étrangères, d'où l'ajout explicite.
 */
export function readStationsCache(userId: string): { stations: StationRow[]; migrated: boolean } {
  const current = localStorage.getItem(STATIONS_CACHE_KEY(userId));
  if (current !== null) return { stations: sanitizeStations(JSON.parse(current)), migrated: false };
  const legacy = localStorage.getItem(LEGACY_STATIONS_CACHE_KEY(userId));
  if (legacy === null) return { stations: [], migrated: false };
  const migratedStations = sanitizeStations(JSON.parse(legacy)).map(station => ({ ...station, owner_id: userId }));
  return { stations: migratedStations, migrated: true };
}

export function writeStationsCache(userId: string, stations: StationRow[]): void {
  localStorage.setItem(STATIONS_CACHE_KEY(userId), JSON.stringify(stations));
}

export async function fetchStations(client: SupabaseClient): Promise<StationRow[]> {
  const result = await client.from('stations').select('id,name,owner_id').order('created_at');
  return unwrap(result as { data: StationRow[] | null; error: { message: string } | null }, 'Chargement des stations impossible');
}

/** Un propriétaire peut toujours créer une station ; la limite est côté serveur. */
export async function createStation(client: SupabaseClient, ownerId: string, name: string): Promise<StationRow> {
  const result = await client
    .from('stations')
    .insert({ name: name.trim(), owner_id: ownerId })
    .select('id,name,owner_id')
    .single();
  return unwrap(result as { data: StationRow | null; error: { message: string } | null }, 'Création de la station impossible');
}

/**
 * Rôle réel sur une station. `error` signifie que la RPC n'est pas joignable
 * (hors ligne ou migration absente) : l'appelant décide du repli, jamais ce
 * module.
 */
export async function fetchStationRole(client: SupabaseClient, stationId: string): Promise<{ role: string | null; failed: boolean }> {
  const { data, error } = await client.rpc('current_station_role', { p_station_id: stationId });
  if (error) return { role: null, failed: true };
  return { role: typeof data === 'string' ? data : null, failed: false };
}

/** Repli local : propriétaire si `owner_id` correspond, sinon aucun rôle. */
export async function fetchOwnerFallback(client: SupabaseClient, stationId: string, userId: string): Promise<'owner' | null> {
  const result = await client.from('stations').select('owner_id').eq('id', stationId).maybeSingle();
  const row = result.data as { owner_id?: string } | null;
  return row?.owner_id === userId ? 'owner' : null;
}

export async function acceptInvitation(client: SupabaseClient, invitationId: string): Promise<void> {
  const { error } = await client.rpc('accept_station_invitation', { p_invitation_id: invitationId });
  if (error) throw new Error(`Invitation non acceptée : ${error.message}`);
}

/** UUID v1–v8, la seule forme que `accept_station_invitation` accepte. */
/**
 * Délègue au schéma partagé : la même référence est validée ici et dans
 * `StationStaff`. Deux expressions séparées de la même règle finissent par
 * diverger, et c'est alors l'écran qui refuse ce que la RPC accepte.
 */
export function isInvitationReference(value: string): boolean {
  return invitationReferenceSchema.safeParse(value).success;
}

export interface SessionSnapshot {
  session: Session | null;
  error: string;
}

export function resolvePortalClient(client?: SupabaseClient | null): SupabaseClient | null {
  return client ?? defaultClient;
}

export { isRecoveryLink };
