import { formatXof } from '../../lib/money';
import { orderBilledXof, safeXof, type StationOrderRow } from '../../lib/stationMetrics';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, EmptyState, StatusBadge, buttonStyles } from '../ui/designSystem';
import type { StatusVariant } from '../ui/designSystem';
import { Car, ArrowRight } from 'lucide-react';

/**
 * Les cinq dernières prestations, telles qu'enregistrées côté serveur.
 *
 * Extrait de `StationDashboard`. Le pied de carte distingue deux choses que
 * l'écran confondait souvent : le prix figé (colonne de gauche, barré si la
 * prestation est annulée) et le montant facturé (compté uniquement si elle est
 * terminée). Le total affiché est la somme des secondes, jamais des premières.
 */
export function RecentOrdersCard({
  orders,
  loaded,
  onNavigateOrders,
}: {
  orders: readonly StationOrderRow[];
  loaded: boolean;
  onNavigateOrders?: () => void;
}) {
  return (
    <Card>
      <CardHeader
        action={
          onNavigateOrders && (
            <button
              type="button"
              onClick={onNavigateOrders}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <span>Voir toutes les prestations</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )
        }
      >
        <CardTitle className="flex items-center gap-2">
          <Car className="w-4 h-4 text-sky-400" />
          Dernières prestations enregistrées
        </CardTitle>
        <CardDescription>Les 5 plus récentes, telles qu’enregistrées sur le serveur</CardDescription>
      </CardHeader>
      <CardContent>
        {!loaded ? (
          <p role="status" className="text-xs text-slate-400 text-center py-4">Chargement…</p>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<Car className="w-6 h-6 text-slate-400" />}
            title="Aucune prestation enregistrée"
            description="Créez la première prestation depuis l’onglet Prestations : elle apparaîtra ici avec son montant serveur."
            action={onNavigateOrders && (
              <button type="button" className={buttonStyles({ variant: 'primary', size: 'sm' })} onClick={onNavigateOrders}>
                Créer une prestation
              </button>
            )}
          />
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {orders.map(order => (
              <div key={order.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5 min-w-0">
                  <div className="font-bold text-white flex items-center gap-2">
                    <span className="truncate">{order.vehicle_info}</span>
                    {order.plate_number && (
                      <span className="px-1.5 py-0.5 rounded bg-[#202532] text-slate-300 font-mono text-[10px] shrink-0">
                        {order.plate_number}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {new Date(order.created_at).toLocaleString('fr-FR', {
                      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className={`font-bold font-mono tabular-nums ${order.status === 'annule' ? 'text-slate-500 line-through' : 'text-white'}`}>
                    {formatXof(safeXof(order.total_xof))}
                  </span>
                  <StatusBadge status={order.status as StatusVariant} size="sm" />
                </div>
              </div>
            ))}
          </div>
        )}
        {orders.length > 0 && (
          <p className="pt-3 text-[11px] text-slate-500">
            Montant facturé = prix figé au moment de la création, compté seulement si la prestation est terminée.
            Total facturé sur ces {orders.length} lignes : {formatXof(orders.reduce((sum, order) => sum + orderBilledXof(order), 0))}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
