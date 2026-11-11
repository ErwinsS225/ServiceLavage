import { lazy, Suspense, useEffect, type ComponentType } from 'react';
import { Alert } from '../ui/designSystem';
import { StationCustomers } from '../StationCustomers';
import { StationServices } from '../StationServices';
import { StationOrders } from '../StationOrders';
import { SubscriptionPlans } from '../SubscriptionPlans';
import { canManageRoles, canOpenTab, type StationRole, type StationTabId } from '../../lib/portalNavigation';
import { reportChunkFailure } from '../../lib/globalErrors';
import { track } from '../../lib/telemetry';

/**
 * Enveloppe un import paresseux pour nommer l'échec.
 *
 * Le piège à éviter : `import()` qui échoue (module non encore mis en cache,
 * réseau coupé — le cas normal d'un téléphone en mobilité) produit un rejet dont
 * seul le message générique du navigateur reste. En nommant le module, le
 * diagnostic peut dire « Rapports n'a pas pu se charger », ce qui indique quoi
 * faire (recharger une fois en ligne) au lieu de laisser un écran de secours
 * muet.
 */
function lazyModule(name: string, load: () => Promise<unknown>) {
  return lazy(async () => {
    try {
      // Le type est celui de `lazy` lui-même. Écrire ici les props de chaque
      // écran obligerait à les répéter une seconde fois, et c'est exactement
      // comme cela qu'une signature dérive de son composant.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- voir ci-dessus
      return (await load()) as { default: ComponentType<any> };
    } catch (cause) {
      reportChunkFailure(name, cause);
      throw cause;
    }
  });
}

const StationInventory = lazyModule('StationInventory', () =>
  import('../StationInventory').then(module => ({ default: module.StationInventory })),
);
const StationStaff = lazyModule('StationStaff', () =>
  import('../StationStaff').then(module => ({ default: module.StationStaff })),
);
const StationDashboard = lazyModule('StationDashboard', () =>
  import('../StationDashboard').then(module => ({ default: module.StationDashboard })),
);
const StationReports = lazyModule('StationReports', () =>
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
  // Tracking d'usage volontairement minimal : quel module est ouvert, par quel
  // rôle, sur quelle station. Pas de frappe clavier, pas de contenu de champ. Le
  // `useEffect` porte sur la station et le module ; changer de station ne compte
  // donc pas comme une seconde ouverture.
  useEffect(() => {
    track.info('ui.module_ouvert', { module: tab, role, stationId });
  }, [tab, role, stationId, userId]);

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
