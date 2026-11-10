import type { StationClient } from '../lib/stationApi';
import { describeError } from '../lib/queryResult';
import { useSubscriptionQuery } from './useStationQueries';

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
  const query = useSubscriptionQuery(enabled, client);

  return {
    subscription: query.data ?? null,
    loading: query.isPending,
    error: query.error ? describeError(query.error, 'Impossible de charger la formule. Vérifiez votre connexion.') : '',
    reload: () => { void query.refetch(); },
  };
}
