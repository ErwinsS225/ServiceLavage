import { useEffect, useState, useMemo, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultClient } from '../lib/supabase';
import { formatXof } from '../lib/money';
import { countCustomers, fetchOrders } from '../lib/stationApi';
import { listQueuedOrders } from '../lib/offlineOrders';
import {
  dailyBilledSeries,
  dashboardMetrics,
  isSeriesEmpty,
  orderBilledXof,
  safeXof,
  statusDistribution,
  RECEIPTS_NOT_TRACKED_COPY,
  type StationOrderRow,
} from '../lib/stationMetrics';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  StatCard,
  StatusBadge,
  Alert,
  EmptyState,
  buttonStyles
} from './ui/designSystem';
import type { StatusVariant } from './ui/designSystem';
import {
  Car,
  TrendingUp,
  Users,
  CheckCircle2,
  BarChart3,
  ArrowRight,
  RefreshCw,
  Clock
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface StationDashboardProps {
  stationId: string;
  userId: string;
  onNavigateTab?: (tab: 'orders' | 'customers' | 'services' | 'inventory' | 'reports') => void;
  /** Injected in tests; the application always uses the shared client. */
  client?: SupabaseClient | null;
}

type QueuedSummary = {
  requestId: string;
  vehicle: string;
  plate: string | null;
  createdAt: string;
};

/**
 * Everything displayed here comes from `stationMetrics` over the rows returned
 * by the database, plus the local offline queue (which has no server price and
 * is therefore shown as a count, never as money). When a dataset is empty the
 * screen says so instead of drawing a curve or a KPI that would look measured.
 */
export function StationDashboard({ stationId, userId, onNavigateTab, client = defaultClient }: StationDashboardProps) {
  const [orders, setOrders] = useState<StationOrderRow[]>([]);
  const [queued, setQueued] = useState<QueuedSummary[]>([]);
  const [customerCount, setCustomerCount] = useState<number>(0);
  const [loaded, setLoaded] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const loadData = useCallback(async () => {
    if (!client || !stationId) return;
    setError('');
    try {
      // (1) Prestations de la station. RLS les restreint déjà au tenant ; le
      // filtre `.eq('station_id')` est un garde-fou contre une erreur d'appel.
      await fetchOrders(client, stationId)
        .then(rows => setOrders(rows as StationOrderRow[]))
        .catch((cause: unknown) => {
          setError(cause instanceof Error ? cause.message : 'Chargement des prestations impossible.');
        });

      // (2) Comptage côté serveur, sans rapatrier la table des clients.
      await countCustomers(client, stationId)
        .then(setCustomerCount)
        .catch((cause: unknown) => {
          const message = cause instanceof Error ? cause.message : 'Comptage des clients impossible.';
          setError(previous => previous || message);
        });

      // (3) Local queue: counted, never priced (see stationMetrics).
      try {
        setQueued(listQueuedOrders(localStorage, userId, stationId).map(item => ({
          requestId: item.requestId,
          vehicle: item.vehicle,
          plate: item.plate,
          createdAt: item.createdAt,
        })));
      } catch {
        setError('La file locale est illisible ; elle a été conservée sur cet appareil.');
      }
    } catch {
      setError('Chargement des indicateurs impossible. Vérifiez votre connexion.');
    } finally {
      setLoaded(true);
      setRefreshing(false);
    }
  }, [client, stationId, userId]);

  useEffect(() => {
    setLoaded(false);
    void loadData();
  }, [loadData]);

  // One reference instant for the whole render, so every panel describes the
  // same day even if the render straddles midnight.
  const reference = useMemo(() => new Date(), [orders, customerCount, queued]);

  const metrics = useMemo(
    () => dashboardMetrics(orders, reference, { customersCount: customerCount, queuedCount: queued.length }),
    [orders, reference, customerCount, queued.length],
  );

  const series = useMemo(() => dailyBilledSeries(orders, reference), [orders, reference]);
  const seriesEmpty = isSeriesEmpty(series);

  const distribution = useMemo(() => statusDistribution(orders), [orders]);
  const distributionEmpty = distribution.every(slice => slice.value === 0);

  const recentOrders = orders.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Title & refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-400" />
            <span>Tableau de bord opérationnel · ServiceLavage</span>
          </h2>
          <p className="text-xs text-slate-400">
            Flux de lavage et montants facturés, calculés uniquement à partir des prestations enregistrées
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setRefreshing(true); void loadData(); }}
            disabled={refreshing}
            className={buttonStyles({ variant: 'outline', size: 'sm' })}
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
            <span>{refreshing ? 'Actualisation…' : 'Actualiser'}</span>
          </button>
        </div>
      </div>

      {error && <Alert variant="error" action={
        <button type="button" className="underline text-xs font-semibold text-rose-300" onClick={() => void loadData()}>
          Réessayer
        </button>
      }>{error}</Alert>}

      {/* Payments are not recorded: say it before showing amounts. */}
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

      {/* KPI cards: every value is a count or a sum of real rows */}
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

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              Montants facturés sur 7 jours (FCFA)
            </CardTitle>
            <CardDescription>
              Somme des prestations terminées, jour par jour
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!loaded ? (
              <p role="status" className="h-64 flex items-center justify-center text-sm text-slate-400">Chargement…</p>
            ) : seriesEmpty ? (
              <div className="h-64 flex items-center justify-center">
                <EmptyState
                  icon={<TrendingUp className="w-6 h-6 text-slate-400" />}
                  title="Aucune prestation terminée sur 7 jours"
                  description="Le graphique apparaîtra dès qu’une prestation aura été enregistrée puis marquée comme terminée. Aucune valeur de démonstration n’est affichée."
                  action={onNavigateTab && (
                    <button type="button" className={buttonStyles({ variant: 'primary', size: 'sm' })} onClick={() => onNavigateTab('orders')}>
                      Voir les prestations
                    </button>
                  )}
                />
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="dashboardAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#252b3b" vertical={false} />
                    <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} />
                    <YAxis
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      width={52}
                      tickFormatter={(value: number) => value.toLocaleString('fr-FR')}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#141822', borderColor: '#2d3748', borderRadius: '0.75rem', color: '#fff', fontSize: '12px' }}
                      formatter={(value, _name, item) => [
                        `${formatXof(Number(value ?? 0))} · ${item?.payload?.count ?? 0} prestation(s)`,
                        'Facturé',
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="billedXof"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#dashboardAreaGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              Statuts des prestations
            </CardTitle>
            <CardDescription>
              Toutes les prestations de la station, par statut
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-between">
            {!loaded ? (
              <p role="status" className="h-44 flex items-center justify-center text-sm text-slate-400">Chargement…</p>
            ) : distributionEmpty ? (
              <div className="h-44 flex items-center justify-center">
                <EmptyState
                  icon={<Clock className="w-6 h-6 text-slate-400" />}
                  title="Aucune prestation"
                  description="La répartition s’affichera au premier lavage enregistré."
                />
              </div>
            ) : (
              <>
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={distribution.filter(slice => slice.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={65}
                        paddingAngle={4}
                        dataKey="value"
                        nameKey="name"
                      >
                        {distribution.filter(slice => slice.value > 0).map(slice => (
                          <Cell key={slice.status} fill={slice.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#141822', borderColor: '#2d3748', borderRadius: '0.75rem', color: '#fff', fontSize: '12px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full space-y-2 pt-2 border-t border-[var(--border-subtle)]">
                  {distribution.map(slice => (
                    <div key={slice.status} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
                        <span className="text-slate-300">{slice.name}</span>
                      </div>
                      <span className="font-bold text-white font-mono tabular-nums">{slice.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent orders */}
      <Card>
        <CardHeader
          action={
            onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('orders')}
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
          <CardDescription>
            Les 5 plus récentes, telles qu’enregistrées sur le serveur
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!loaded ? (
            <p role="status" className="text-xs text-slate-400 text-center py-4">Chargement…</p>
          ) : recentOrders.length === 0 ? (
            <EmptyState
              icon={<Car className="w-6 h-6 text-slate-400" />}
              title="Aucune prestation enregistrée"
              description="Créez la première prestation depuis l’onglet Prestations : elle apparaîtra ici avec son montant serveur."
              action={onNavigateTab && (
                <button type="button" className={buttonStyles({ variant: 'primary', size: 'sm' })} onClick={() => onNavigateTab('orders')}>
                  Créer une prestation
                </button>
              )}
            />
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {recentOrders.map(order => (
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
          {recentOrders.length > 0 && (
            <p className="pt-3 text-[11px] text-slate-500">
              Montant facturé = prix figé au moment de la création, compté seulement si la prestation est terminée.
              Total facturé sur ces 5 lignes : {formatXof(recentOrders.reduce((sum, order) => sum + orderBilledXof(order), 0))}.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
