import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultClient } from '../lib/supabase';
import { formatXof } from '../lib/money';
import {
  reportMetrics,
  periodLabel,
  STATUS_LABELS,
  RECEIPTS_NOT_TRACKED_COPY,
  safeXof,
  orderBilledXof,
  periodStart,
  startOfYear,
  type ReportPeriod,
  type StationOrderRow,
} from '../lib/stationMetrics';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  StatCard,
  Alert,
  EmptyState,
  buttonStyles
} from './ui/designSystem';
import {
  FileText,
  Printer,
  Download,
  Share2,
  TrendingUp,
  Car,
  Wallet,
  CheckCircle2,
  Building2,
  Clock,
} from 'lucide-react';
import { generatePdfFromElement, downloadPdfBlob, sharePdfToMessaging } from '../lib/pdfExport';

interface StationReportsProps {
  stationId: string;
  stationName: string;
  /** Injected in tests; the application always uses the shared client. */
  client?: SupabaseClient | null;
}

/** Rows kept for the printable table; the CSV export keeps the whole period. */
const PRINTED_ROWS = 40;

/**
 * Activity report, not a financial statement.
 *
 * The database records neither payments nor expenses (see
 * `stationMetrics`), so this screen reports what it can prove: how many
 * washes happened, what was billed and how they ended. It never prints a
 * "bénéfice", a "bilan" or an "encaissement".
 */
export function StationReports({ stationId, stationName, client = defaultClient }: StationReportsProps) {
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [orders, setOrders] = useState<StationOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!client || !stationId) return;
    setLoading(true);
    setError('');
    const yearStart = new Date(startOfYear(new Date())).toISOString();
    try {
      // Bounded to the current year: an unbounded select would grow with every wash.
      const { data, error: queryError } = await client
        .from('station_orders')
        .select('id, total_xof, status, created_at, vehicle_info, plate_number')
        .eq('station_id', stationId)
        .gte('created_at', yearStart)
        .order('created_at', { ascending: false });

      if (queryError) setError(`Chargement du rapport impossible : ${queryError.message}`);
      else setOrders((data ?? []) as StationOrderRow[]);
    } catch {
      setError('Chargement du rapport impossible. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  }, [client, stationId]);

  useEffect(() => { void load(); }, [load]);

  const reference = useMemo(() => new Date(), [orders, period]);
  const metrics = useMemo(() => reportMetrics(orders, period, reference), [orders, period, reference]);

  // Rows of the period, newest first, for the printable detail and the CSV.
  const periodOrders = useMemo(() => {
    const start = periodStart(period, reference);
    const end = reference.getTime();
    return orders.filter(order => {
      const t = Date.parse(order.created_at);
      return Number.isFinite(t) && t >= start && t <= end;
    });
  }, [orders, period, reference]);

  const hasActivity = periodOrders.length > 0;
  const nothingToReport = !hasActivity;

  const handlePrint = () => window.print();

  const handleDownloadPdf = async () => {
    if (!reportRef.current) return;
    setIsProcessing(true);
    setFeedback('Génération du PDF en cours…');
    try {
      const { blob } = await generatePdfFromElement(reportRef.current, { format: 'a4', orientation: 'portrait' });
      downloadPdfBlob(blob, `rapport_activite_${stationName.replace(/\s+/g, '_')}_${period}.pdf`);
      setFeedback('PDF téléchargé.');
    } catch {
      setFeedback('Création du PDF impossible. Utilisez « Imprimer » puis « Enregistrer en PDF ».');
    } finally {
      setIsProcessing(false);
      setTimeout(() => setFeedback(''), 4000);
    }
  };

  const handleShareWhatsAppPdf = async () => {
    if (!reportRef.current) return;
    setIsProcessing(true);
    setFeedback('Préparation du PDF…');
    try {
      const { blob } = await generatePdfFromElement(reportRef.current, { format: 'a4', orientation: 'portrait' });
      const outcome = await sharePdfToMessaging(
        blob,
        `rapport_activite_${period}.pdf`,
        `Rapport d’activité - ${stationName}`,
        `Bonjour, voici le rapport d’activité de la station ${stationName} pour la période : ${periodLabel(period)}. ` +
        `${metrics.completedCount} prestation(s) terminée(s) pour ${formatXof(metrics.billedXof)} facturés. ` +
        `Les paiements ne sont pas suivis par l’application : ces montants sont facturés, pas encaissés.`,
      );
      setFeedback(outcome === 'shared' ? 'PDF partagé.' : 'PDF téléchargé et WhatsApp ouvert.');
    } catch {
      setFeedback('Partage impossible. Téléchargez le PDF puis envoyez-le manuellement.');
    } finally {
      setIsProcessing(false);
      setTimeout(() => setFeedback(''), 5000);
    }
  };

  /**
   * Quotes a CSV value and neutralises spreadsheet formulas: a vehicle named
   * `=HYPERLINK(...)` must stay text when the file is opened in Excel.
   */
  const csvCell = (value: string | number) => {
    const text = String(value);
    const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return `"${guarded.replace(/"/g, '""')}"`;
  };

  const handleExportCsv = () => {
    // Explicit wording: a cancelled or unfinished wash keeps its quoted price
    // in the first column, and shows 0 in the billed column.
    const headers = [
      'ID',
      'Date',
      'Véhicule',
      'Immatriculation',
      'Prix figé (non facturé) XOF',
      'Montant facturé XOF',
      'Statut',
    ];
    const rows = periodOrders.map(order => [
      csvCell(order.id),
      csvCell(new Date(order.created_at).toLocaleString('fr-FR')),
      csvCell(order.vehicle_info),
      csvCell(order.plate_number || ''),
      csvCell(safeXof(order.total_xof)),
      // 0 for a wash that is not terminated: the price exists but nothing is owed.
      csvCell(orderBilledXof(order)),
      csvCell(STATUS_LABELS[order.status] ?? order.status),
    ]);
    // A BOM keeps the accents readable when Excel opens the file.
    const csv = '\ufeff' + [headers.join(','), ...rows.map(row => row.join(','))].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `prestations_${period}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setFeedback(`${rows.length} ligne(s) exportée(s).`);
    setTimeout(() => setFeedback(''), 4000);
  };

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            <span>Rapport d’activité</span>
          </h2>
          <p className="text-xs text-slate-400">
            Prestations, montants facturés et statuts réels de la période sélectionnée
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-[#181c26] p-1 rounded-xl border border-[#2b3343] text-xs">
            {(['today', 'week', 'month', 'year'] as const).map(value => (
              <button
                key={value}
                type="button"
                onClick={() => setPeriod(value)}
                aria-pressed={period === value}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  period === value ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                {value === 'today' ? "Aujourd'hui" : value === 'week' ? 'Semaine' : value === 'month' ? 'Ce mois' : 'Année'}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={isProcessing || nothingToReport}
            onClick={handleDownloadPdf}
            className={`${buttonStyles({ variant: 'primary', size: 'sm' })} cursor-pointer`}
            title={nothingToReport ? 'Aucune donnée à exporter sur cette période' : 'Enregistrer le rapport en PDF'}
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            <span>Télécharger en PDF</span>
          </button>

          <button
            type="button"
            disabled={isProcessing || nothingToReport}
            onClick={handleShareWhatsAppPdf}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title={nothingToReport ? 'Aucune donnée à partager' : 'Partager le rapport par WhatsApp'}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>WhatsApp (PDF)</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            disabled={nothingToReport}
            className={`${buttonStyles({ variant: 'outline', size: 'sm' })} cursor-pointer`}
            title="Ouvrir la boîte d’impression"
          >
            <Printer className="w-3.5 h-3.5 mr-1.5" />
            <span>Imprimer</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={nothingToReport}
            className={`${buttonStyles({ variant: 'outline', size: 'sm' })} cursor-pointer`}
            title="Exporter les prestations de la période en CSV"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {error && (
        <Alert variant="error" className="no-print" action={
          <button type="button" className="underline text-xs font-semibold text-rose-300" onClick={() => void load()}>
            Réessayer
          </button>
        }>{error}</Alert>
      )}

      {feedback && (
        <div role="status" className="no-print p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* What this report is, and what it is not. */}
      <Alert variant="info" className="no-print" title="Rapport d’activité, pas de bilan financier">
        {RECEIPTS_NOT_TRACKED_COPY} Aucune dépense n’étant enregistrée, aucun bénéfice ni marge ne peut être
        calculé : ce rapport ne les affiche pas. Un vrai rapport financier suppose un modèle de paiement et de
        dépenses traçables côté serveur.
      </Alert>

      {loading ? (
        <p role="status" className="no-print text-sm text-slate-400">Chargement du rapport…</p>
      ) : nothingToReport ? (
        <Card className="no-print">
          <CardContent>
            <EmptyState
              icon={<Clock className="w-6 h-6 text-slate-400" />}
              title={`Aucune prestation sur la période : ${periodLabel(period)}`}
              description="Aucune valeur n’est affichée : les totaux resteront à zéro tant qu’aucune prestation n’aura été enregistrée sur cette période. Changez de période ou créez une prestation."
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPIs: counts and billed amounts only */}
          <div className="no-print grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Prestations créées"
              value={metrics.createdCount}
              subtext={metrics.cancelledCount > 0 ? `${metrics.cancelledCount} annulée(s) exclue(s)` : 'Hors annulations'}
              icon={<Car className="w-5 h-5 text-amber-400" />}
            />
            <StatCard
              title="Prestations terminées"
              value={metrics.completedCount}
              subtext="Statut « Terminé » (non payé)"
              icon={<CheckCircle2 className="w-5 h-5 text-emerald-400" />}
            />
            <StatCard
              title="Montant facturé"
              value={formatXof(metrics.billedXof)}
              subtext="Prestations terminées uniquement"
              icon={<TrendingUp className="w-5 h-5 text-indigo-400" />}
            />
            <StatCard
              title="Panier moyen"
              value={formatXof(metrics.averageBilledXof)}
              subtext="Par prestation terminée"
              icon={<Wallet className="w-5 h-5 text-sky-400" />}
            />
          </div>

          <Card className="no-print">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-sky-400" />
                Encaissements et dépenses
              </CardTitle>
              <CardDescription>Ce que l’application peut et ne peut pas mesurer aujourd’hui</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex gap-2">
                  <span className="text-slate-500">Prestation terminée</span>
                  <span className="text-slate-500">→</span>
                  <span>le lavage est fait. <strong className="text-white">Ce n’est pas un paiement.</strong></span>
                </li>
                <li className="flex gap-2">
                  <span className="text-slate-500">Montant facturé</span>
                  <span className="text-slate-500">→</span>
                  <span>prix figé de la prestation, compté seulement une fois le lavage terminé.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-slate-500">Recette encaissée</span>
                  <span className="text-slate-500">→</span>
                  <span className="text-amber-300">non enregistrée : aucun moyen de paiement n’est stocké.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-slate-500">Dépense / bénéfice</span>
                  <span className="text-slate-500">→</span>
                  <span className="text-amber-300">non enregistrés : aucune marge ne peut être calculée.</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Printable activity report */}
          <div
            ref={reportRef}
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
                  <p>Période : <strong className="text-gray-900">{periodLabel(period)}</strong></p>
                  <p>Édition : {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
                  <p>Devise : Franc CFA (XOF)</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
              <div className="kpi-card border border-gray-300 bg-gray-50/80 p-3.5 rounded-xl">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600 block">Prestations créées</span>
                <span className="text-lg font-black text-gray-900 font-mono">{metrics.createdCount}</span>
              </div>
              <div className="kpi-card border border-gray-300 bg-gray-50/80 p-3.5 rounded-xl">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600 block">Terminées</span>
                <span className="text-lg font-black text-gray-900 font-mono">{metrics.completedCount}</span>
              </div>
              <div className="kpi-card border border-gray-300 bg-gray-50/80 p-3.5 rounded-xl">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600 block">Annulées</span>
                <span className="text-lg font-black text-gray-900 font-mono">{metrics.cancelledCount}</span>
              </div>
              <div className="kpi-card border border-gray-300 bg-gray-50/80 p-3.5 rounded-xl">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600 block">Montant facturé</span>
                <span className="text-lg font-black text-gray-900 font-mono">{formatXof(metrics.billedXof)}</span>
              </div>
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
                  {periodOrders.slice(0, PRINTED_ROWS).map(order => (
                    <tr key={order.id} className="border-b border-gray-200">
                      <td className="py-2 px-3 text-gray-700">{new Date(order.created_at).toLocaleDateString('fr-FR')}</td>
                      <td className="py-2 px-3 font-medium text-gray-900">{order.vehicle_info}</td>
                      <td className="py-2 px-3 text-gray-700 font-mono">{order.plate_number || '—'}</td>
                      <td className="py-2 px-3 text-center text-gray-700">{STATUS_LABELS[order.status] ?? order.status}</td>
                      <td className={`py-2 px-3 text-right font-bold font-mono ${order.status === 'annule' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                        {formatXof(safeXof(order.total_xof))}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-black font-black bg-gray-50 text-gray-950">
                    <td className="py-3 px-3" colSpan={4}>TOTAL FACTURÉ ({metrics.completedCount} prestations terminées)</td>
                    <td className="py-3 px-3 text-right font-mono">{formatXof(metrics.billedXof)}</td>
                  </tr>
                </tbody>
              </table>
              {periodOrders.length > PRINTED_ROWS && (
                <p className="text-[11px] text-gray-600 mt-2">
                  Seules les {PRINTED_ROWS} prestations les plus récentes figurent sur ce document ; l’export CSV contient la période complète.
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
        </>
      )}
    </div>
  );
}
