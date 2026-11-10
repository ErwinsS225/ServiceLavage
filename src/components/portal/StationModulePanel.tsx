import { lazy, Suspense } from 'react';
import { Alert } from '../ui/designSystem';
import { StationCustomers } from '../StationCustomers';
import { StationServices } from '../StationServices';
import { StationOrders } from '../StationOrders';
import { SubscriptionPlans } from '../SubscriptionPlans';
import { canManageRoles, canOpenTab, type StationRole, type StationTabId } from '../../lib/portalNavigation';

const StationInventory = lazy(() =>
  import('../StationInventory').then(module => ({ default: module.StationInventory })),
);
const StationStaff = lazy(() => import('../StationStaff').then(module => ({ default: module.StationStaff })));
const StationDashboard = lazy(() =>
  import('../StationDashboard').then(module => ({ default: module.StationDashboard })),
);
const StationReports = lazy(() =>
  import('../StationReports').then(module => ({ default: module.StationReports })),
);

/**
 * Panneau du module actif.
 *
 * Trois garde-fous, tous visibles ici plutôt que dispersés dans le portail :
 *  - `canOpenTab` : même matrice que la barre d'onglets, donc jamais d'onglet
 *    affiché sans panneau (ou l'inverse) ;
 *  - `roleFromServer` : Personnel et affectations exigent une réponse de
 *    `current_station_role`, pas un repli local ;
 *  - `key` incluant l'utilisateur et la station : changer de station remonte le
 *    module au lieu de lui laisser l'état de la précédente.
 */
export function StationModulePanel({
  tab,
  role,
  roleFromServer,
  stationId,
  stationName,
  userId,
}: {
  tab: StationTabId;
  role: StationRole;
  roleFromServer: boolean;
  stationId: string;
  stationName: string;
  userId: string;
}) {
  if (!canOpenTab(role, tab)) {
    return <Alert variant="warning">Ce module n’est pas ouvert à votre rôle sur cette station.</Alert>;
  }

  const scopeKey = `${userId}:${stationId}`;
  const fallback = (label: string) => <p className="text-sm text-[var(--text-secondary)]">{label}</p>;

  if (tab === 'subscription') return <SubscriptionPlans />;

  if (tab === 'dashboard') {
    return (
      <Suspense fallback={fallback('Chargement du tableau de bord…')}>
        <StationDashboard key={`dashboard:${scopeKey}`} stationId={stationId} userId={userId} />
      </Suspense>
    );
  }

  if (tab === 'orders') {
    return (
      <StationOrders
        key={`orders:${scopeKey}`}
        stationId={stationId}
        userId={userId}
        role={role}
        roleFeaturesReady={roleFromServer}
        stationName={stationName}
      />
    );
  }

  if (tab === 'services') {
    return <StationServices key={`services:${scopeKey}`} stationId={stationId} />;
  }

  if (tab === 'customers') {
    return <StationCustomers key={`customers:${scopeKey}`} stationId={stationId} />;
  }

  if (tab === 'inventory') {
    return (
      <Suspense fallback={fallback('Chargement de l’inventaire…')}>
        <StationInventory key={`inventory:${scopeKey}`} stationId={stationId} userId={userId} />
      </Suspense>
    );
  }

  if (tab === 'staff') {
    if (!roleFromServer) {
      return (
        <Alert variant="warning">
          Le module Personnel nécessite une réponse du serveur pour confirmer votre rôle. Reconnectez-vous ou
          réessayez.
        </Alert>
      );
    }
    return (
      <Suspense fallback={fallback('Chargement du personnel…')}>
        <StationStaff
          key={`staff:${scopeKey}`}
          stationId={stationId}
          canManageRoles={canManageRoles(role)}
          roleFeaturesReady={roleFromServer}
        />
      </Suspense>
    );
  }

  // tab === 'reports'
  return (
    <Suspense fallback={fallback('Chargement des rapports…')}>
      <StationReports key={`reports:${scopeKey}`} stationId={stationId} stationName={stationName} />
    </Suspense>
  );
}
