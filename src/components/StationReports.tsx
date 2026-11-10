import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { formatXof } from '../lib/money';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent, 
  StatCard, 
  Alert,
  buttonStyles 
} from './ui/designSystem';
import { 
  FileText, 
  Printer, 
  Download, 
  Share2,
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Car, 
  Wallet,
  CheckCircle2,
  Building2
} from 'lucide-react';
import { generatePdfFromElement, downloadPdfBlob, sharePdfToMessaging } from '../lib/pdfExport';

interface StationReportsProps {
  stationId: string;
  stationName: string;
}

/** Shared wording for the four statuses allowed by the database check constraint. */
const ORDER_STATUS_LABELS: Record<string, string> = {
  en_attente: 'En attente',
  en_cours: 'En cours',
  termine: 'Terminé',
  annule: 'Annulé',
};

interface OrderReportItem {
  id: string;
  total_xof: number;
  status: string;
  created_at: string;
  vehicle_info: string;
  plate_number: string | null;
}

export function StationReports({ stationId, stationName }: StationReportsProps) {
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year'>('month');
  const [orders, setOrders] = useState<OrderReportItem[]>([]);
  const [feedback, setFeedback] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchReportData() {
      if (!supabase || !stationId) {
        return;
      }
      try {
        // The report only needs the current year, and an unbounded select would
        // grow with every wash. RLS still restricts the rows to this station.
        const { data, error } = await supabase
          .from('station_orders')
          .select('id, total_xof, status, created_at, vehicle_info, plate_number')
          .eq('station_id', stationId)
          .gte('created_at', new Date(new Date().getFullYear(), 0, 1).toISOString())
          .order('created_at', { ascending: false });

        if (error) setError(`Chargement du rapport impossible : ${error.message}`);
        else setOrders(data || []);
      } catch (err) {
        console.error('Erreur chargement données de rapport:', err);
        setError('Chargement du rapport impossible. Vérifiez votre connexion.');
      }
    }
    fetchReportData();
  }, [stationId]);

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  // ISO week: Monday first. getDay() returns 0 for Sunday, which would put a
  // Sunday at the end of the following week instead of the current one.
  const weekdayOffset = (now.getDay() + 6) % 7;
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - weekdayOffset).getTime();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

  const getStartTime = () => {
    switch (period) {
      case 'today': return startOfDay;
      case 'week': return startOfWeek;
      case 'month': return startOfMonth;
      case 'year': return startOfYear;
      default: return startOfMonth;
    }
  };

  const periodLabels = {
    today: "Aujourd'hui",
    week: 'Cette Semaine',
    month: 'Ce Mois-ci',
    year: 'Cette Année'
  };

  const filteredOrders = useMemo(() => {
    const startTime = getStartTime();
    return orders.filter(o => new Date(o.created_at).getTime() >= startTime);
  }, [orders, period]);

  // Revenue is only recognised on completed washes; a cancelled wash must not
  // appear as billed turnover either, hence the explicit status filter.
  const billableOrders = useMemo(() => filteredOrders.filter(o => o.status !== 'annule'), [filteredOrders]);

  const paidOrders = useMemo(() => {
    return filteredOrders.filter(o => o.status === 'termine');
  }, [filteredOrders]);

  const totalCollected = useMemo(() => {
    return paidOrders.reduce((sum, o) => sum + (o.total_xof || 0), 0);
  }, [paidOrders]);

  const totalBilled = useMemo(() => {
    return billableOrders.reduce((sum, o) => sum + (o.total_xof || 0), 0);
  }, [billableOrders]);

  const handlePrint = () => {
    window.print();
  };

  // Direct download of the formatted report as PDF (via html2canvas + jsPDF)
  const handleDownloadPdf = async () => {
    if (!reportRef.current) return;
    setIsProcessing(true);
    setFeedback('Génération du rapport PDF en cours...');
    const fileName = `rapport_financier_servicelavage_${period}.pdf`;

    try {
      const { blob } = await generatePdfFromElement(reportRef.current, {
        format: 'a4',
        orientation: 'portrait',
      });
      downloadPdfBlob(blob, fileName);
      setFeedback('Rapport PDF téléchargé avec succès !');
      setTimeout(() => setFeedback(''), 4000);
    } catch (err) {
      console.error('Erreur génération rapport PDF:', err);
      setFeedback('Erreur lors de la création du PDF.');
      setTimeout(() => setFeedback(''), 3000);
    } finally {
      setIsProcessing(false);
    }
  };

  // Direct sharing of the PDF report to WhatsApp / messaging apps
  const handleShareWhatsAppPdf = async () => {
    if (!reportRef.current) return;
    setIsProcessing(true);
    setFeedback('Préparation du document PDF pour WhatsApp...');
    const fileName = `rapport_financier_servicelavage_${period}.pdf`;

    try {
      const { blob } = await generatePdfFromElement(reportRef.current, {
        format: 'a4',
        orientation: 'portrait',
      });
      const outcome = await sharePdfToMessaging(
        blob,
        fileName,
        `Rapport Financier - ServiceLavage (${periodLabels[period]})`,
        `Bonjour, voici le rapport financier de la station ${stationName} pour la période : ${periodLabels[period]}. Recettes encaissées : ${formatXof(totalCollected)} sur ${paidOrders.length} prestation(s) terminée(s).`
      );

      if (outcome === 'shared') {
        setFeedback('Rapport PDF partagé avec succès !');
      } else {
        setFeedback('PDF téléchargé & WhatsApp ouvert pour l’envoi !');
      }
      setTimeout(() => setFeedback(''), 4500);
    } catch (err) {
      console.error('Erreur partage WhatsApp:', err);
      setFeedback('Erreur lors du partage.');
      setTimeout(() => setFeedback(''), 3000);
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Quotes a value for CSV and neutralises spreadsheet formulas: a vehicle
   * named `=HYPERLINK(...)` must stay text when the file is opened in Excel.
   */
  const csvCell = (value: string | number) => {
    const text = String(value);
    const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return `"${guarded.replace(/"/g, '""')}"`;
  };

  const handleExportCsv = () => {
    const headers = ['ID', 'Date', 'Véhicule', 'Immatriculation', 'Montant XOF', 'Statut'];
    const rows = filteredOrders.map(o => [
      csvCell(o.id),
      csvCell(new Date(o.created_at).toLocaleDateString('fr-FR')),
      csvCell(o.vehicle_info),
      csvCell(o.plate_number || 'N/A'),
      csvCell(o.total_xof),
      csvCell(ORDER_STATUS_LABELS[o.status] ?? o.status),
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `rapport_financier_servicelavage_${period}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Action Header - Hidden on Print */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            <span>Rapports Financiers & Performance Opérationnelle</span>
          </h2>
          <p className="text-xs text-slate-400">
            Exportez et partagez directement vos bilans comptables en format PDF ou sur WhatsApp
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Period selector */}
          <div className="flex items-center bg-[#181c26] p-1 rounded-xl border border-[#2b3343] text-xs">
            {(['today', 'week', 'month', 'year'] as const).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  period === p 
                    ? 'bg-indigo-600 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {p === 'today' ? "Aujourd'hui" : p === 'week' ? 'Semaine' : p === 'month' ? 'Ce Mois' : 'Année'}
              </button>
            ))}
          </div>

          {/* Download as PDF Button (using html2canvas + jsPDF) */}
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleDownloadPdf}
            className={`${buttonStyles({ variant: 'primary', size: 'sm' })} shadow-sm cursor-pointer`}
            title="Enregistrer directement le document au format PDF"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            <span>Télécharger en PDF</span>
          </button>

          {/* Share via WhatsApp as PDF */}
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleShareWhatsAppPdf}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            title="Partager le rapport PDF sur WhatsApp"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Partager WhatsApp (PDF)</span>
          </button>

          {/* Browser Print Button */}
          <button
            type="button"
            onClick={handlePrint}
            className={`${buttonStyles({ variant: 'outline', size: 'sm' })} shadow-sm cursor-pointer`}
            title="Ouvrir la boîte d'impression papier"
          >
            <Printer className="w-3.5 h-3.5 mr-1.5" />
            <span>Imprimer</span>
          </button>

          {/* Export CSV */}
          <button
            type="button"
            onClick={handleExportCsv}
            className={`${buttonStyles({ variant: 'outline', size: 'sm' })} cursor-pointer`}
            title="Exporter les données brutes en CSV"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {error && (
        <Alert variant="error" className="no-print">
          {error}
        </Alert>
      )}

      {/* Feedback banner */}
      {feedback && (
        <div className="no-print p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Screen Summary KPI Cards */}
      <div className="no-print grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Recettes Encaissées"
          value={formatXof(totalCollected)}
          subtext="Montants réglés sur la période"
          icon={<DollarSign className="w-5 h-5 text-emerald-400" />}
        />

        <StatCard
          title="Chiffre d'Affaires"
          value={formatXof(totalBilled)}
          subtext={`${paidOrders.length} lavages facturés`}
          icon={<Car className="w-5 h-5 text-amber-400" />}
        />

        <StatCard
          title="Prestations"
          value={filteredOrders.length}
          subtext="Véhicules sur la période"
          icon={<TrendingUp className="w-5 h-5 text-indigo-400" />}
        />

        <StatCard
          title="Dépenses & Bénéfice"
          value="Non suivis"
          subtext="Aucune dépense enregistrée"
          icon={<TrendingDown className="w-5 h-5 text-rose-400" />}
        />
      </div>

      {/* Screen View: Payment Breakdown Cards */}
      <Card className="no-print">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-sky-400" />
            Répartition des Recettes par Moyen de Paiement
          </CardTitle>
          <CardDescription>
            Ventilation des flux financiers collectés sur la période : {periodLabels[period]}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="info" title="Moyens de paiement non enregistrés">
            Les prestations ne conservent pas le moyen de règlement (Wave, Orange Money, espèces…).
            Aucune ventilation fiable ne peut donc être affichée : ce tableau sera disponible
            lorsque l'encaissement sera développé côté serveur.
          </Alert>
        </CardContent>
      </Card>

      {/* ==========================================================================
          OFFICIAL REPORT TEMPLATE CONTAINER
          Rendered cleanly and used by html2canvas + jsPDF for pixel-perfect PDF export
          ========================================================================== */}
      <div 
        ref={reportRef}
        className="bg-white text-gray-900 rounded-2xl p-6 sm:p-8 border border-gray-300 shadow-sm printable-report"
      >
        {/* Printable & PDF Header */}
        <div className="report-header border-b-2 border-black pb-4 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="w-6 h-6 text-indigo-700" />
                <h1 className="text-2xl font-black uppercase tracking-tight text-gray-900">
                  SERVICELAVAGE CI
                </h1>
              </div>
              <p className="text-sm font-bold text-gray-800 mt-1">
                Rapport Financier & Bilan d'Exploitation Périodique
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                Station : <strong>{stationName || 'Station Express'}</strong> • Abidjan, Côte d'Ivoire
              </p>
            </div>
            <div className="text-left sm:text-right text-xs text-gray-600 font-mono">
              <p>Période : <strong className="text-gray-900">{periodLabels[period]}</strong></p>
              <p>Édition : {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
              <p>Devise : Franc CFA (XOF)</p>
            </div>
          </div>
        </div>

        {/* Financial KPI Summary Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="kpi-card border border-gray-300 bg-gray-50/80 p-3.5 rounded-xl">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600 block">Recettes Encaissées</span>
            <span className="text-lg font-black text-gray-900 font-mono">{formatXof(totalCollected)}</span>
          </div>
          <div className="kpi-card border border-gray-300 bg-gray-50/80 p-3.5 rounded-xl">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600 block">Prestations</span>
            <span className="text-lg font-black text-gray-900 font-mono">{filteredOrders.length}</span>
          </div>
          <div className="kpi-card border border-gray-300 bg-gray-50/80 p-3.5 rounded-xl">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600 block">Prestations terminées</span>
            <span className="text-lg font-black text-emerald-800 font-mono">{paidOrders.length}</span>
          </div>
          <div className="kpi-card border border-gray-300 bg-gray-50/80 p-3.5 rounded-xl">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600 block">Véhicules Livrés</span>
            <span className="text-lg font-black text-gray-900 font-mono">{paidOrders.length} lavages</span>
          </div>
        </div>

        {/* Order breakdown: the only figures the schema can actually prove */}
        <div className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-800 mb-2.5 pb-1 border-b border-gray-300">
            Détail des Prestations de la Période
          </h2>
          {filteredOrders.length === 0 ? (
            <p className="text-xs text-gray-600 py-3">
              Aucune prestation enregistrée sur cette période. Les moyens de paiement ne sont pas
              suivis par l'application : aucune ventilation par règlement ne peut être produite.
            </p>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-400 bg-gray-100">
                  <th className="py-2 px-3 font-bold text-gray-800">Date</th>
                  <th className="py-2 px-3 font-bold text-gray-800">Véhicule</th>
                  <th className="py-2 px-3 font-bold text-gray-800">Immatriculation</th>
                  <th className="py-2 px-3 font-bold text-gray-800 text-center">Statut</th>
                  <th className="py-2 px-3 font-bold text-gray-800 text-right">Montant</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.slice(0, 40).map(order => (
                  <tr key={order.id} className="border-b border-gray-200">
                    <td className="py-2 px-3 text-gray-700">{new Date(order.created_at).toLocaleDateString('fr-FR')}</td>
                    <td className="py-2 px-3 font-medium text-gray-900">{order.vehicle_info}</td>
                    <td className="py-2 px-3 text-gray-700 font-mono">{order.plate_number || '—'}</td>
                    <td className="py-2 px-3 text-center text-gray-700">{ORDER_STATUS_LABELS[order.status] ?? order.status}</td>
                    <td className="py-2 px-3 text-right font-bold text-gray-900 font-mono">{formatXof(order.total_xof)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-black font-black bg-gray-50 text-gray-950">
                  <td className="py-3 px-3" colSpan={4}>TOTAL FACTURÉ ({billableOrders.length} prestations hors annulations)</td>
                  <td className="py-3 px-3 text-right font-mono">{formatXof(totalBilled)}</td>
                </tr>
                <tr className="font-black bg-gray-50 text-gray-950">
                  <td className="py-3 px-3" colSpan={4}>TOTAL ENCAISSÉ ({paidOrders.length} prestations terminées)</td>
                  <td className="py-3 px-3 text-right font-mono">{formatXof(totalCollected)}</td>
                </tr>
              </tbody>
            </table>
          )}
          {filteredOrders.length > 40 && (
            <p className="text-[11px] text-gray-600 mt-2">
              Seules les 40 prestations les plus récentes figurent dans le rapport ; l'export CSV contient la période complète.
            </p>
          )}
        </div>

        {/* Printable & PDF Signature Zone */}
        <div className="signature-zone mt-10 pt-6 border-t border-gray-400 flex flex-col sm:flex-row justify-between gap-6 text-xs text-gray-700">
          <div className="w-full sm:w-64 border-t border-dashed border-gray-500 pt-2 text-center">
            <p className="font-bold text-gray-900">Visa du Gérant de Station</p>
            <p className="text-[10px] text-gray-500 mt-6">(Date et signature précédées de la mention "Lu et certifié conforme")</p>
          </div>
          <div className="w-full sm:w-64 border-t border-dashed border-gray-500 pt-2 text-center">
            <p className="font-bold text-gray-900">Cachet de la Station</p>
            <p className="text-[10px] text-gray-500 mt-6">ServiceLavage CI • Direction d'Exploitation</p>
          </div>
        </div>
      </div>
    </div>
  );
}
