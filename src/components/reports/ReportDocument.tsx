import { forwardRef } from 'react';
import { formatXof } from '../../lib/money';
import {
  periodLabel,
  safeXof,
  STATUS_LABELS,
  type ReportPeriod,
  type StationOrderRow,
} from '../../lib/stationMetrics';
import { Building2 } from 'lucide-react';

/** Lignes conservées sur le document imprimé ; l'export CSV garde la période entière. */
export const PRINTED_ROWS = 40;

export interface ReportMetrics {
  createdCount: number;
  completedCount: number;
  cancelledCount: number;
  billedXof: number;
}

/**
 * Document imprimable / exportable en PDF du rapport d'activité.
 *
 * Extrait de `StationReports` : c'est le seul bloc destiné à être capturé par
 * html2canvas, donc le seul dont la mise en page doit rester stable quand on
 * fait évoluer l'écran. Il ne calcule rien : les compteurs et les montants
 * arrivent déjà calculés par `stationMetrics`.
 *
 * Rappel de cadrage : le document s'intitule « rapport d'activité » parce que
 * l'application n'enregistre ni paiement ni dépense. Il ne doit jamais
 * afficher de recette encaissée, de bénéfice ou de marge.
 */
export const ReportDocument = forwardRef<
  HTMLDivElement,
  {
    stationName: string;
    period: ReportPeriod;
    metrics: ReportMetrics;
    orders: readonly StationOrderRow[];
  }
>(function ReportDocument({ stationName, period, metrics, orders }, ref) {
  return (
    <div
      ref={ref}
      className="bg-white text-gray-900 rounded-2xl p-6 sm:p-8 border border-gray-300 shadow-sm printable-report"
    >
      <div className="report-header border-b-2 border-black pb-4 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="w-6 h-6 text-indigo-700" />
              <h1 className="text-2xl font-black uppercase tracking-tight text-gray-900">ServiceLavage CI</h1>
            </div>
            <p className="text-sm font-bold text-gray-800 mt-1">Rapport d’activité des prestations</p>
            <p className="text-xs text-gray-600 mt-0.5">
              Station : <strong>{stationName || 'Station non nommée'}</strong>
            </p>
          </div>
          <div className="text-left sm:text-right text-xs text-gray-600 font-mono">
            <p>
              Période : <strong className="text-gray-900">{periodLabel(period)}</strong>
            </p>
            <p>
              Édition : {new Date().toLocaleDateString('fr-FR')} à{' '}
              {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p>Devise : Franc CFA (XOF)</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Kpi label="Prestations créées" value={String(metrics.createdCount)} />
        <Kpi label="Terminées" value={String(metrics.completedCount)} />
        <Kpi label="Annulées" value={String(metrics.cancelledCount)} />
        <Kpi label="Montant facturé" value={formatXof(metrics.billedXof)} />
      </div>

      <div className="mb-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-800 mb-2.5 pb-1 border-b border-gray-300">
          Détail des prestations
        </h2>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-400 bg-gray-100">
              <th className="py-2 px-3 font-bold text-gray-800">Date</th>
              <th className="py-2 px-3 font-bold text-gray-800">Véhicule</th>
              <th className="py-2 px-3 font-bold text-gray-800">Immatriculation</th>
              <th className="py-2 px-3 font-bold text-gray-800 text-center">Statut</th>
              <th className="py-2 px-3 font-bold text-gray-800 text-right">Montant facturé</th>
            </tr>
          </thead>
          <tbody>
            {orders.slice(0, PRINTED_ROWS).map(order => (
              <tr key={order.id} className="border-b border-gray-200">
                <td className="py-2 px-3 text-gray-700">
                  {new Date(order.created_at).toLocaleDateString('fr-FR')}
                </td>
                <td className="py-2 px-3 font-medium text-gray-900">{order.vehicle_info}</td>
                <td className="py-2 px-3 text-gray-700 font-mono">{order.plate_number || '—'}</td>
                <td className="py-2 px-3 text-center text-gray-700">
                  {STATUS_LABELS[order.status] ?? order.status}
                </td>
                <td
                  className={`py-2 px-3 text-right font-bold font-mono ${order.status === 'annule' ? 'text-gray-400 line-through' : 'text-gray-900'}`}
                >
                  {formatXof(safeXof(order.total_xof))}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-black font-black bg-gray-50 text-gray-950">
              <td className="py-3 px-3" colSpan={4}>
                TOTAL FACTURÉ ({metrics.completedCount} prestations terminées)
              </td>
              <td className="py-3 px-3 text-right font-mono">{formatXof(metrics.billedXof)}</td>
            </tr>
          </tbody>
        </table>
        {orders.length > PRINTED_ROWS && (
          <p className="text-[11px] text-gray-600 mt-2">
            Seules les {PRINTED_ROWS} prestations les plus récentes figurent sur ce document ; l’export CSV
            contient la période complète.
          </p>
        )}
      </div>

      <p className="text-[10px] text-gray-600 border-t border-gray-300 pt-3">
        Les montants de ce rapport sont des montants facturés issus du prix figé de chaque prestation.
        L’application n’enregistre ni paiement ni dépense : elle ne peut donc attester d’aucune recette
        encaissée, d’aucun bénéfice et d’aucune marge. Document interne, sans valeur fiscale.
      </p>

      <div className="signature-zone mt-8 pt-6 border-t border-gray-400 flex flex-col sm:flex-row justify-between gap-6 text-xs text-gray-700">
        <div className="w-full sm:w-64 border-t border-dashed border-gray-500 pt-2 text-center">
          <p className="font-bold text-gray-900">Visa du gérant</p>
          <p className="text-[10px] text-gray-500 mt-6">(Date et signature)</p>
        </div>
        <div className="w-full sm:w-64 border-t border-dashed border-gray-500 pt-2 text-center">
          <p className="font-bold text-gray-900">Cachet de la station</p>
          <p className="text-[10px] text-gray-500 mt-6">{stationName || 'Station'}</p>
        </div>
      </div>
    </div>
  );
});

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="kpi-card border border-gray-300 bg-gray-50/80 p-3.5 rounded-xl">
      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600 block">{label}</span>
      <span className="text-lg font-black text-gray-900 font-mono">{value}</span>
    </div>
  );
}
