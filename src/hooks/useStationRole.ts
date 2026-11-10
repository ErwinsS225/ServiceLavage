import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchOwnerFallback, fetchStationRole, type StationRow } from '../lib/portalApi';
import { parseStationRole, type StationRole } from '../lib/portalNavigation';

/**
 * Rôle du compte sur la station sélectionnée.
 *
 * Trois sources, dans cet ordre :
 *  1. la RPC `current_station_role` (SECURITY DEFINER) — la seule qui fasse
 *     autorité pour un membre invité ;
 *  2. hors ligne, le cache local des stations (`owner_id`) — propriétaire
 *     uniquement, parce que c'est la seule relation que l'appareil connaît ;
 *  3. si la RPC échoue, une lecture de `stations.owner_id` pour ne pas
 *     enfermer un propriétaire hors de son propre espace.
 *
 * `roleFromServer` distingue les cas 2 et 3 du cas 1 : les modules qui ont
 * besoin d'une réponse serveur (Personnel, affectations) l'utilisent pour
 * refuser de s'afficher plutôt que d'inventer des droits.
 */
export function useStationRole(
  client: SupabaseClient | null,
  userId: string | null,
  stationId: string,
  stations: StationRow[],
  online: boolean,
): { role: StationRole | null; roleLoading: boolean; roleFromServer: boolean } {
  const [role, setRole] = useState<StationRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const [roleFromServer, setRoleFromServer] = useState(false);

  useEffect(() => {
    if (!userId || !client) {
      setRole(null);
      setRoleLoading(false);
      setRoleFromServer(false);
      return;
    }
    if (!stationId) {
      // No station yet: the very first user is treated as an owner so the
      // "create your first station" card can be shown. Nothing is written.
      setRole(stations.length === 0 ? 'owner' : null);
      setRoleLoading(false);
      setRoleFromServer(false);
      return;
    }

    setRole(null);
    setRoleLoading(true);
    setRoleFromServer(false);
    let active = true;

    const fallbackFromOwnerId = async () => {
      try {
        const derived = await fetchOwnerFallback(client, stationId, userId);
        if (active) setRole(derived);
      } catch {
        if (active) setRole(null);
      } finally {
        if (active) {
          setRoleLoading(false);
          setRoleFromServer(false);
        }
      }
    };

    if (!online) {
      const cached = stations.find(station => station.id === stationId);
      setRole(cached?.owner_id === userId ? 'owner' : null);
      setRoleLoading(false);
      return () => { active = false; };
    }

    fetchStationRole(client, stationId)
      .then(result => {
        if (!active) return;
        if (result.failed) { void fallbackFromOwnerId(); return; }
        setRole(parseStationRole(result.role));
        setRoleFromServer(true);
        setRoleLoading(false);
      })
      .catch(() => { if (active) void fallbackFromOwnerId(); });

    return () => { active = false; };
  }, [client, userId, stationId, stations, online]);

  return { role, roleLoading, roleFromServer };
}
