import { useCallback } from 'react';
import { fetchSubscription, resolveClient, type OwnerSubscription, type StationClient } from '../lib/stationApi';
import { useResource } from './useResource';

/**
 * Formule du propriétaire connecté, telle que le serveur la calcule.
 *
 * `my_subscription()` renvoie aussi la consommation réelle (stations
 * rattachées, prestations du mois) : l'écran n'a rien à additionner lui-même,
 * donc rien à inventer. Les plafonds viennent de `subscription_limits`, qui
 * décide aussi côté serveur — l'affichage suit, il ne décide pas.
 */
export function useSubscription({
  enabled = true,
  client,
}: {
  enabled?: boolean;
  client?: StationClient | null;
} = {}) {
  const api = useCallback(() => resolveClient(client), [client]);
  const resource = useResource<OwnerSubscription | null>(
    () => fetchSubscription(api()),
    [client],
    { fallback: 'Impossible de charger la formule. Vérifiez votre connexion.', initial: null, enabled },
  );

  return {
    subscription: resource.data,
    loading: resource.loading,
    error: resource.error,
    reload: resource.reload,
  };
}
