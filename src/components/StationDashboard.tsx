import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultClient } from '../lib/supabase';
import { formatXof } from '../lib/money';
import { RECEIPTS_NOT_TRACKED_COPY } from '../lib/stationMetrics';
import { StatCard, Alert, buttonStyles } from './ui/designSystem';
import { Car, TrendingUp, Users, CheckCircle2, RefreshCw } from 'lucide-react';
import { useDashboardMetrics } from '../hooks/useDashboardMetrics';
import { BilledTrendChart } from './dashboard/BilledTrendChart';
import { StatusSplitCard } from './dashboard/StatusSplitCard';
import { RecentOrdersCard } from './dashboard/RecentOrdersCard';

interface StationDashboardProps {
  stationId: string;
  userId: string;
  onNavigateTab?: (tab: 'orders' | 'customers' | 'services' | 'inventory' | 'reports') => void;
  /** Injected in tests; the application always uses the shared client. */
  client?: SupabaseClient | null;
}

/**
 * Tableau de bord opérationnel.
 *
 * Ce composant ne fait plus que composer : les données viennent de
 * `hooks/useDashboardMetrics` (qui s'appuie sur `lib/stationApi`), les chiffres
 * de `lib/stationMetrics`, et les trois blocs visuels de `components/dashboard`.
 *
 * Règle de fond, tenue par les tests : rien ici n'invente de valeur. Quand une
 * série est vide, l'écran l'écrit au lieu de dessiner une courbe plausible, et
 * les montants affichés sont des montants *facturés* — l'application
 * n'enregistre aucun paiement.
 */
export function StationDashboard({ stationId, userId, onNavigateTab, client = defaultClient }: StationDashboardProps) {
  const {
    queued, loaded, refreshing, error, metrics, series, seriesEmpty,
    distribution, distributionEmpty, recentOrders, refresh,
  } = useDashboardMetrics(client, stationId, userId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-400" />
            <span>Tableau de bord opérationnel · ServiceLavage</span>
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Flux de lavage et montants facturés, calculés uniquement à partir des prestations enregistrées
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className={buttonStyles({ variant: 'outline', size: 'sm' })}
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin motion-safe-keep text-indigo-400' : ''}`} />
            <span>{refreshing ? 'Actualisation…' : 'Actualiser'}</span>
          </button>
        </div>
      </div>

      {error && (
        <Alert
          variant="error"
          action={
            <button type="button" className="underline text-xs font-semibold text-rose-300" onClick={refresh}>
              Réessayer
            </button>
          }
        >
          {error}
        </Alert>
      )}

      {/* Aucun paiement n'est enregistré : le dire avant d'afficher des montants. */}
      <Alert variant="info" title="Montants facturés, pas recettes encaissées">{RECEIPTS_NOT_TRACKED_COPY}</Alert>

      {queued.length > 0 && (
        <Alert variant="warning" title={`${queued.length} prestation(s) en attente de synchronisation`}>
          <p className="text-xs">
            Enregistrées sur cet appareil uniquement : elles n’ont pas encore de montant serveur et ne sont
            comptées que dans le nombre total, jamais dans les montants.
          </p>
          <ul className="mt-1 space-y-0.5 font-mono text-xs">
            {queued.map(item => (
              <li key={item.requestId}>{item.vehicle} · {item.plate || 'Sans immatriculation'}</li>
            ))}
          </ul>
        </Alert>
      )}

      {/* Chaque valeur est un compte ou une somme de lignes réelles. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Facturé aujourd’hui"
          value={formatXof(metrics.billedTodayXof)}
          subtext={`${metrics.completedTodayCount} prestation(s) terminée(s) ce jour`}
          icon={<span className="text-xs font-black text-amber-300">XOF</span>}
        />
        <StatCard
          title="Lavages en cours"
          value={metrics.activeCount}
          subtext="En attente ou en cours"
          icon={<Car className="w-5 h-5 text-sky-400" />}
        />
        <StatCard
          title="Clients enregistrés"
          value={metrics.customersCount}
          subtext="Fiches clients de la station"
          icon={<Users className="w-5 h-5 text-indigo-400" />}
        />
        <StatCard
          title="Prestations créées aujourd’hui"
          value={metrics.createdTodayCount}
          subtext={metrics.queuedCount > 0 ? `Dont ${metrics.queuedCount} hors ligne` : 'Hors annulations'}
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-400" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <BilledTrendChart
          series={series}
          empty={seriesEmpty}
          loaded={loaded}
          onNavigateOrders={onNavigateTab ? () => onNavigateTab('orders') : undefined}
        />
        <StatusSplitCard distribution={distribution} empty={distributionEmpty} loaded={loaded} />
      </div>

      <RecentOrdersCard
        orders={recentOrders}
        loaded={loaded}
        onNavigateOrders={onNavigateTab ? () => onNavigateTab('orders') : undefined}
      />
    </div>
  );
}
