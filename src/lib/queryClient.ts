import { QueryClient } from '@tanstack/react-query';

/**
 * Client de cache pour les données serveur.
 *
 * Réglages choisis pour ce contexte, pas par défaut :
 *  - `retry: 1` et non 3 : un gérant attend devant un comptoir. Une erreur
 *    réseau se voit tout de suite, avec un bouton « Réessayer ».
 *  - `staleTime: 30 s` : une liste (services, clients) bouge peu ; inutile de
 *    refaire une requête à chaque montage d'onglet.
 *  - `refetchOnWindowFocus: false` : sur un téléphone en station, chaque
 *    retour d'écran déclencherait une rafale de requêtes.
 *  - `gcTime: 5 min` : au-delà, on relit depuis le réseau, pas depuis une
 *    mémoire qui ne correspond plus à la base.
 *
 * Aucune donnée n'est montrée avant d'être chargée : le cache évite des
 * allers-retours, il ne fabrique jamais un écran plausible.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        networkMode: 'always',
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

/** Clés de requête : un seul format, donc aucune collision entre modules. */
export const queryKeys = {
  services: (stationId: string) => ['station', stationId, 'services'] as const,
  activeServices: (stationId: string) => ['station', stationId, 'services', 'active'] as const,
  customers: (stationId: string) => ['station', stationId, 'customers'] as const,
  orders: (stationId: string) => ['station', stationId, 'orders'] as const,
  inventory: (stationId: string) => ['station', stationId, 'inventory'] as const,
  staff: (stationId: string, canManageRoles: boolean) => ['station', stationId, 'staff', canManageRoles] as const,
  subscription: () => ['subscription'] as const,
  reports: (stationId: string) => ['station', stationId, 'reports'] as const,
} as const;
