/**
 * Navigation du portail : une seule matrice pour les onglets, la barre de
 * navigation et les conditions de rendu des panneaux.
 *
 * Avant, la liste vivait dans `OwnerPortal.tsx` et les conditions de rendu
 * étaient recopiées dans le JSX (`tab === 'orders' && (stationRole === 'owner'
 * || …)`). Deux copies d'une même règle finissent toujours par diverger :
 * c'était le cas (un caissier pouvait atterrir sur un panneau vide).
 *
 * **Ce module ne protège rien.** C'est un filtre d'affichage. L'autorité, ce
 * sont les politiques RLS de PostgreSQL et les fonctions `SECURITY DEFINER`
 * (`current_station_role`, `create_station_order_idempotent`,
 * `transition_station_order`, …). Masquer un onglet n'a jamais empêché un appel
 * direct : c'est pour cela que chaque condition ici doit rester alignée sur ce
 * que le serveur accepte, jamais servir d'unique garde.
 */

export type StationRole = 'owner' | 'gerant' | 'caissier' | 'laveur';

export type StationTabId =
  | 'dashboard'
  | 'orders'
  | 'services'
  | 'customers'
  | 'inventory'
  | 'staff'
  | 'reports'
  | 'subscription';

export interface StationTab {
  id: StationTabId;
  label: string;
  roles: readonly StationRole[];
}

/**
 * La matrice d'autorité d'affichage, alignée sur le serveur :
 *  - `orders` : le caissier est exclu parce que
 *    `create_station_order_idempotent` n'accepte que propriétaire et gérant ;
 *  - `staff`, `inventory`, `services`, `reports` : écriture réservée au
 *    propriétaire et au gérant par les politiques RLS ;
 *  - `subscription` : propriétaire uniquement (`owner_subscriptions`).
 */
export const STATION_TABS: readonly StationTab[] = [
  { id: 'dashboard', label: 'Tableau de bord', roles: ['owner', 'gerant', 'caissier'] },
  { id: 'orders', label: 'Prestations', roles: ['owner', 'gerant', 'laveur'] },
  { id: 'services', label: 'Catalogue', roles: ['owner', 'gerant'] },
  { id: 'customers', label: 'Clients', roles: ['owner', 'gerant', 'caissier'] },
  { id: 'inventory', label: 'Inventaire', roles: ['owner', 'gerant'] },
  { id: 'staff', label: 'Personnel', roles: ['owner', 'gerant'] },
  { id: 'reports', label: 'Rapports', roles: ['owner', 'gerant'] },
  { id: 'subscription', label: 'Abonnements', roles: ['owner'] },
];

/** Onglets qu'un rôle peut ouvrir, dans l'ordre de la matrice. */
export function allowedTabsFor(role: StationRole | null): StationTabId[] {
  if (!role) return [];
  return STATION_TABS.filter(tab => tab.roles.includes(role)).map(tab => tab.id);
}

export function canOpenTab(role: StationRole | null, tab: StationTabId): boolean {
  if (!role) return false;
  const entry = STATION_TABS.find(item => item.id === tab);
  return entry ? entry.roles.includes(role) : false;
}

/**
 * Onglet de repli quand le rôle change de station : on garde l'onglet courant
 * s'il reste autorisé, sinon on ouvre le premier disponible. Renvoie `null`
 * lorsqu'aucun onglet n'est permis (rôle inconnu), pour ne pas forcer un panneau.
 */
export function resolveTab(role: StationRole | null, current: StationTabId): StationTabId | null {
  const allowed = allowedTabsFor(role);
  if (allowed.length === 0) return null;
  return allowed.includes(current) ? current : allowed[0];
}

/** Un rôle de station valide, ou `null` si le serveur a renvoyé autre chose. */
export function parseStationRole(value: unknown): StationRole | null {
  return value === 'owner' || value === 'gerant' || value === 'caissier' || value === 'laveur' ? value : null;
}

/**
 * Capacités d'affichage, dérivées des mêmes règles que la matrice.
 *
 * Un seul endroit décide « ce rôle gère-t-il la station ? », au lieu de quatre
 * comparaisons `role === 'owner' || role === 'gerant'` dispersées dans les
 * composants et les hooks — c'est exactement le genre de duplication qui avait
 * laissé le caissier accéder à un onglet vide.
 *
 * Ceci ne protège rien : `revoke_station_membership`, `create_station_invitation`,
 * `cancel_station_invitation` n'acceptent que le propriétaire, et les politiques
 * RLS des tables de catalogue / inventaire n'autorisent l'écriture qu'au
 * propriétaire et au gérant. Ces fonctions alignent l'interface sur ces règles.
 */

/** Gère la station : catalogue, clients, inventaire, personnel, rapports. */
export function canManageStation(role: StationRole | null): boolean {
  return role === 'owner' || role === 'gerant';
}

/** Enregistre et fait avancer les prestations (`create_station_order_idempotent`). */
export function canManageOrders(role: StationRole | null): boolean {
  return role === 'owner' || role === 'gerant';
}

/**
 * Invite, annule une invitation, révoque un accès.
 * Réservé au propriétaire par `create_station_invitation`, de façon identique.
 */
export function canManageRoles(role: StationRole | null): boolean {
  return role === 'owner';
}

export const ROLE_LABELS: Record<StationRole, string> = {
  owner: 'Propriétaire',
  gerant: 'Gérant',
  caissier: 'Caissier',
  laveur: 'Laveur',
};
