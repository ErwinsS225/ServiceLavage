import { useState, useMemo, useRef } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultClient } from '../lib/supabase';
import { formatXof } from '../lib/money';
import { describeError } from '../lib/queryResult';
import { buildOrdersCsv, downloadCsv } from '../lib/csvExport';
import { ReportDocument } from './reports/ReportDocument';
import { useReportOrders } from '../hooks/useStationQueries';
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
  Clock,
} from 'lucide-react';
import { generatePdfFromElement, downloadPdfBlob, sharePdfToMessaging } from '../lib/pdfExport';

interface StationReportsProps {
  stationId: string;
  stationName: string;
  /** Injected in tests; the application always uses the shared client. */
  client?: SupabaseClient | null;
}

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
  const [feedback, setFeedback] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // La requête vit dans `stationApi`, son cache dans `useStationQueries`. La
  // fenêtre reste déclarée ici : l'année en cours, parce qu'un `select` sans
  // borne grandirait à chaque lavage.
  const yearStart = useMemo(() => new Date(startOfYear(new Date())), []);
  const reportQuery = useReportOrders(stationId, yearStart, client);
  const orders: StationOrderRow[] = reportQuery.data ?? [];
  const loading = reportQuery.isPending;
  const error = reportQuery.error ? describeError(reportQuery.error, 'Chargement du rapport impossible. Vérifiez votre connexion.') : '';
  const load = () => { void reportQuery.refetch(); };

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

  const handleExportCsv = () => {
    const csv = buildOrdersCsv(periodOrders.map(order => ({
      id: order.id,
      created_at: order.created_at,
      vehicle_info: order.vehicle_info,
      plate_number: order.plate_number,
      total_xof: safeXof(order.total_xof),
      billedXof: orderBilledXof(order),
      statusLabel: STATUS_LABELS[order.status] ?? order.status,
    })));
    downloadCsv(csv, `prestations_${period}.csv`);
    setFeedback(`${periodOrders.length} ligne(s) exportée(s).`);
    setTimeout(() => setFeedback(''), 4000);
  };

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            <span>Rapport d’activité</span>
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Prestations, montants facturés et statuts réels de la période sélectionnée
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-[var(--surface-elevated)] p-1 rounded-xl border border-[var(--border-strong)] text-xs">
            {(['today', 'week', 'month', 'year'] as const).map(value => (
              <button
                key={value}
                type="button"
                onClick={() => setPeriod(value)}
                aria-pressed={period === value}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  period === value ? 'bg-indigo-600 text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-white'
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
        <p role="status" className="no-print text-sm text-[var(--text-secondary)]">Chargement du rapport…</p>
      ) : nothingToReport ? (
        <Card className="no-print">
          <CardContent>
            <EmptyState
              icon={<Clock className="w-6 h-6 text-[var(--text-secondary)]" />}
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
                  <span className="text-[var(--text-muted)]">Prestation terminée</span>
                  <span className="text-[var(--text-muted)]">→</span>
                  <span>le lavage est fait. <strong className="text-[var(--text-primary)]">Ce n’est pas un paiement.</strong></span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[var(--text-muted)]">Montant facturé</span>
                  <span className="text-[var(--text-muted)]">→</span>
                  <span>prix figé de la prestation, compté seulement une fois le lavage terminé.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[var(--text-muted)]">Recette encaissée</span>
                  <span className="text-[var(--text-muted)]">→</span>
                  <span className="text-amber-300">non enregistrée : aucun moyen de paiement n’est stocké.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[var(--text-muted)]">Dépense / bénéfice</span>
                  <span className="text-[var(--text-muted)]">→</span>
                  <span className="text-amber-300">non enregistrés : aucune marge ne peut être calculée.</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <ReportDocument
            ref={reportRef}
            stationName={stationName}
            period={period}
            metrics={metrics}
            orders={periodOrders}
          />
        </>
      )}
    </div>
  );
}
