import { QueryCache, QueryClient } from '@tanstack/react-query';

/**
 * Ce qu'un échec doit produire à l'écran. Injecté plutôt qu'importé : le cache
 * est créé hors de React, et un `useToast()` ne peut pas y être appelé.
 * `main.tsx` branche ces deux fonctions sur le contexte de toasts.
 */
export interface QueryErrorHandlers {
  onQueryError?: (message: string, detail?: string) => void;
}

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
export function createQueryClient(handlers: QueryErrorHandlers = {}): QueryClient {
  return new QueryClient({
    // Seules les lectures sont signalées globalement. Une écriture ratée est
    // déjà expliquée par l'écran qui l'a déclenchée (message précis sous le
    // champ ou dans l'alerte d'action) : la doubler d'un toast donnerait deux
    // textes différents pour un seul échec.
    queryCache: new QueryCache({
      onError: error => {
        handlers.onQueryError?.('Chargement impossible.', error instanceof Error ? error.message : undefined);
      },
    }),
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
  staff: (stationId: string, canManageRoles: boolean) =>
    ['station', stationId, 'staff', canManageRoles] as const,
  subscription: () => ['subscription'] as const,
  reports: (stationId: string) => ['station', stationId, 'reports'] as const,
} as const;
