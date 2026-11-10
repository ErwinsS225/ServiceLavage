import { formatXof } from '../../lib/money';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, EmptyState, buttonStyles } from '../ui/designSystem';
import { TrendingUp } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

/**
 * Montants facturés sur 7 jours.
 *
 * Extrait de `StationDashboard`. Quand la série est vide, le composant affiche
 * un état vide explicite : il ne dessine pas de courbe de démonstration. Une
 * aire qui monte se lit comme une mesure, même si elle est inventée.
 */
export interface BilledPoint {
  label: string;
  billedXof: number;
  count: number;
}

export function BilledTrendChart({
  series,
  empty,
  loaded,
  onNavigateOrders,
}: {
  series: readonly BilledPoint[];
  empty: boolean;
  loaded: boolean;
  onNavigateOrders?: () => void;
}) {
  return (
    <Card className="lg:col-span-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-indigo-400" />
          Montants facturés sur 7 jours (FCFA)
        </CardTitle>
        <CardDescription>Somme des prestations terminées, jour par jour</CardDescription>
      </CardHeader>
      <CardContent>
        {!loaded ? (
          <p role="status" className="h-64 flex items-center justify-center text-sm text-slate-400">Chargement…</p>
        ) : empty ? (
          <div className="h-64 flex items-center justify-center">
            <EmptyState
              icon={<TrendingUp className="w-6 h-6 text-slate-400" />}
              title="Aucune prestation terminée sur 7 jours"
              description="Le graphique apparaîtra dès qu’une prestation aura été enregistrée puis marquée comme terminée. Aucune valeur de démonstration n’est affichée."
              action={onNavigateOrders && (
                <button type="button" className={buttonStyles({ variant: 'primary', size: 'sm' })} onClick={onNavigateOrders}>
                  Voir les prestations
                </button>
              )}
            />
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={[...series]} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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
                    `${formatXof(Number(value ?? 0))} · ${(item?.payload as BilledPoint | undefined)?.count ?? 0} prestation(s)`,
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
  );
}
