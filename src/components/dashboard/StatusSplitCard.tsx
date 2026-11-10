import { Card, CardHeader, CardTitle, CardDescription, CardContent, EmptyState } from '../ui/designSystem';
import { BarChart3, Clock } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

/**
 * Répartition des prestations par statut.
 *
 * Extrait de `StationDashboard`. Le camembert n'est dessiné qu'à partir des
 * tranches réellement non nulles, et la légende affiche les comptes bruts :
 * un pourcentage calculé sur trois lignes serait plus décoratif qu'informatif.
 */
export interface StatusSlice {
  status: string;
  name: string;
  value: number;
  color: string;
}

export function StatusSplitCard({
  distribution,
  empty,
  loaded,
}: {
  distribution: readonly StatusSlice[];
  empty: boolean;
  loaded: boolean;
}) {
  const visible = distribution.filter(slice => slice.value > 0);

  return (
    <Card className="lg:col-span-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-emerald-400" />
          Statuts des prestations
        </CardTitle>
        <CardDescription>Toutes les prestations de la station, par statut</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-between">
        {!loaded ? (
          <p
            role="status"
            className="h-44 flex items-center justify-center text-sm text-[var(--text-secondary)]"
          >
            Chargement…
          </p>
        ) : empty ? (
          <div className="h-44 flex items-center justify-center">
            <EmptyState
              icon={<Clock className="w-6 h-6 text-[var(--text-secondary)]" />}
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
                    data={[...visible]}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={4}
                    dataKey="value"
                    nameKey="name"
                  >
                    {visible.map(slice => (
                      <Cell key={slice.status} fill={slice.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#141822',
                      borderColor: '#2d3748',
                      borderRadius: '0.75rem',
                      color: '#fff',
                      fontSize: '12px',
                    }}
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
                  <span className="font-bold text-[var(--text-primary)] font-mono tabular-nums">
                    {slice.value}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
