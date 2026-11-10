import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createStation as createStationRequest,
  fetchStations,
  readStationsCache,
  writeStationsCache,
  type StationRow,
} from '../lib/portalApi';

/**
 * Liste des stations de l'utilisateur, sélection courante et création.
 *
 * Extrait de `OwnerPortal` où le cache, la migration de cache v1→v2, le
 * rechargement après acceptation d'invitation et la création étaient trois
 * `useEffect` imbriqués dans le même composant que le rendu.
 *
 * Le cache sert au démarrage hors ligne et à l'affichage immédiat : il ne
 * remplace jamais la requête, il la précède.
 */
export interface StationsState {
  stations: StationRow[];
  stationId: string;
  selectStation: (id: string) => void;
  /** Rafraîchit depuis le serveur (après acceptation d'une invitation). */
  refresh: () => void;
  create: (name: string) => Promise<StationRow>;
  error: string;
  clearError: () => void;
}

export function useStations(client: SupabaseClient | null, userId: string | null): StationsState {
  const [stations, setStations] = useState<StationRow[]>([]);
  const [stationId, setStationId] = useState('');
  const [nonce, setNonce] = useState(0);
  const [error, setError] = useState('');

  const refresh = useCallback(() => setNonce(value => value + 1), []);

  useEffect(() => {
    if (!userId || !client) {
      setStations([]);
      setStationId('');
      return;
    }
    let active = true;
    setStations([]);
    setStationId('');

    // Offline / slow network: show what this device already knows.
    try {
      const cached = readStationsCache(userId);
      if (cached.stations.length > 0) setStations(cached.stations);
      if (cached.migrated) writeStationsCache(userId, cached.stations);
    } catch {
      setError('Impossible de lire les stations locales.');
    }

    fetchStations(client)
      .then(list => {
        if (!active) return;
        setStations(list);
        try { writeStationsCache(userId, list); }
        catch { setError('Impossible de sauvegarder les stations pour le mode hors ligne.'); }
      })
      .catch(() => {
        if (!active) return;
        // Keep the cached list visible, explain why it may be stale.
        setError('Stations hors ligne : les données enregistrées sur cet appareil sont utilisées si disponibles.');
      });

    return () => { active = false; };
  }, [client, userId, nonce]);

  const create = useCallback(async (name: string): Promise<StationRow> => {
    if (!client || !userId) throw new Error('Session absente.');
    const created = await createStationRequest(client, userId, name);
    setStations(previous => [...previous, created]);
    setStationId(created.id);
    return created;
  }, [client, userId]);

  return {
    stations,
    stationId,
    selectStation: setStationId,
    refresh,
    create,
    error,
    clearError: () => setError(''),
  };
}

/** Rôle du compte sur la station sélectionnée, avec repli hors ligne explicite. */
export interface StationRoleState {
  role: import('../lib/portalNavigation').StationRole | null;
  roleLoading: boolean;
  /** `true` quand la réponse vient de la RPC `current_station_role`. */
  roleFromServer: boolean;
}
