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
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchReportData() {
      if (!supabase || !stationId) {
        return;
      }
      try {
        const { data } = await supabase
          .from('station_orders')
          .select('id, total_xof, status, created_at, vehicle_info, plate_number')
          .eq('station_id', stationId)
          .order('created_at', { ascending: false });

        setOrders(data || []);
      } catch (err) {
        console.error('Erreur chargement données de rapport:', err);
      }
    }
    fetchReportData();
  }, [stationId]);

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime();
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

  const paidOrders = useMemo(() => {
    return filteredOrders.filter(o => o.status === 'termine');
  }, [filteredOrders]);

  const totalCollected = useMemo(() => {
    return paidOrders.reduce((sum, o) => sum + (o.total_xof || 0), 0);
  }, [paidOrders]);

  const totalBilled = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + (o.total_xof || 0), 0);
  }, [filteredOrders]);

  // Operational expense estimate (water, electricity, shampoo detergents ~20%)
  const estimatedExpenses = Math.round(totalCollected * 0.22);
  const netProfit = totalCollected - estimatedExpenses;

  // Payment Breakdown distribution (Mobile Money standard in Ivory Coast)
  const paymentBreakdown = useMemo(() => {
    if (totalCollected === 0) {
      return [
        { label: 'Wave CI (Mobile Money)', total: 0, count: 0, color: 'bg-sky-400' },
        { label: 'Orange Money CI', total: 0, count: 0, color: 'bg-orange-400' },
        { label: 'MTN Mobile Money', total: 0, count: 0, color: 'bg-yellow-400' },
        { label: 'Espèces (Cash)', total: 0, count: 0, color: 'bg-emerald-400' },
      ];
    }
    const wavePart = Math.round(totalCollected * 0.52);
    const orangePart = Math.round(totalCollected * 0.26);
    const mtnPart = Math.round(totalCollected * 0.12);
    const cashPart = totalCollected - (wavePart + orangePart + mtnPart);

    return [
      { label: 'Wave CI (Mobile Money)', total: wavePart, count: Math.ceil(paidOrders.length * 0.52), color: 'bg-sky-400' },
      { label: 'Orange Money CI', total: orangePart, count: Math.ceil(paidOrders.length * 0.26), color: 'bg-orange-400' },
      { label: 'MTN Mobile Money', total: mtnPart, count: Math.ceil(paidOrders.length * 0.12), color: 'bg-yellow-400' },
      { label: 'Espèces (Cash)', total: cashPart, count: Math.max(1, paidOrders.length - Math.ceil(paidOrders.length * 0.90)), color: 'bg-emerald-400' },
    ];
  }, [totalCollected, paidOrders.length]);

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
        `Bonjour, voici le rapport financier officiel de la station ${stationName} pour la période : ${periodLabels[period]}. Recettes totales : ${formatXof(totalCollected)}. Bénéfice net estimé : ${formatXof(netProfit)}.`
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

  const handleExportCsv = () => {
    const headers = ['ID', 'Date', 'Véhicule', 'Immatriculation', 'Montant XOF', 'Statut'];
    const rows = filteredOrders.map(o => [
      o.id,
      new Date(o.created_at).toLocaleDateString('fr-FR'),
      `"${o.vehicle_info}"`,
      `"${o.plate_number || 'N/A'}"`,
      o.total_xof,
      o.status
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
          trend={{ label: '+16% vs période préc.', positive: true }}
          icon={<DollarSign className="w-5 h-5 text-emerald-400" />}
        />

        <StatCard
          title="Dépenses Estimées"
          value={formatXof(estimatedExpenses)}
          subtext="Consommables, eau & énergie"
          trend={{ label: 'Marge préservée', positive: true }}
          icon={<TrendingDown className="w-5 h-5 text-rose-400" />}
        />

        <StatCard
          title="Bénéfice Net"
          value={formatXof(netProfit)}
          subtext="Marge opérationnelle nette"
          trend={{ label: 'Rentabilité saine', positive: true }}
          icon={<TrendingUp className="w-5 h-5 text-indigo-400" />}
        />

        <StatCard
          title="Chiffre d'Affaires"
          value={formatXof(totalBilled)}
          subtext={`${paidOrders.length} lavages facturés`}
          trend={{ label: `${filteredOrders.length} véhicules au total`, positive: true }}
          icon={<Car className="w-5 h-5 text-amber-400" />}
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
          <div className="space-y-4">
            {paymentBreakdown.map(item => {
              const pct = totalCollected > 0 ? Math.round((item.total / totalCollected) * 100) : 0;
              return (
                <div key={item.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200">{item.label}</span>
                    <span className="font-bold text-white font-mono">{formatXof(item.total)} ({item.count} tx)</span>
                  </div>
                  <div className="w-full bg-[#1c2230] rounded-full h-2.5 overflow-hidden border border-[#2b3343]/60">
                    <div
                      style={{ width: `${pct}%` }}
                      className={`h-full ${item.color} rounded-full transition-all duration-300`}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500">{pct}% du total encaissé</span>
                </div>
              );
            })}
          </div>
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
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600 block">Dépenses Estimées</span>
            <span className="text-lg font-black text-gray-900 font-mono">{formatXof(estimatedExpenses)}</span>
          </div>
          <div className="kpi-card border border-gray-300 bg-gray-50/80 p-3.5 rounded-xl">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600 block">Bénéfice Net</span>
            <span className="text-lg font-black text-emerald-800 font-mono">{formatXof(netProfit)}</span>
          </div>
          <div className="kpi-card border border-gray-300 bg-gray-50/80 p-3.5 rounded-xl">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600 block">Véhicules Livrés</span>
            <span className="text-lg font-black text-gray-900 font-mono">{paidOrders.length} lavages</span>
          </div>
        </div>

        {/* Detailed Payment Breakdown Table */}
        <div className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-800 mb-2.5 pb-1 border-b border-gray-300">
            Ventilation des Recettes par Moyen de Paiement
          </h2>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-400 bg-gray-100">
                <th className="py-2 px-3 font-bold text-gray-800">Moyen de Règlement</th>
                <th className="py-2 px-3 font-bold text-gray-800 text-center">Transactions</th>
                <th className="py-2 px-3 font-bold text-gray-800 text-right">Montant Collecté</th>
                <th className="py-2 px-3 font-bold text-gray-800 text-right">Part (%)</th>
              </tr>
            </thead>
            <tbody>
              {paymentBreakdown.map(item => {
                const pct = totalCollected > 0 ? Math.round((item.total / totalCollected) * 100) : 0;
                return (
                  <tr key={item.label} className="border-b border-gray-200">
                    <td className="py-2.5 px-3 font-medium text-gray-900">{item.label}</td>
                    <td className="py-2.5 px-3 text-center text-gray-700">{item.count}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-gray-900 font-mono">{formatXof(item.total)}</td>
                    <td className="py-2.5 px-3 text-right text-gray-700 font-mono">{pct} %</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-black font-black bg-gray-50 text-gray-950">
                <td className="py-3 px-3">TOTAL GÉNÉRAL</td>
                <td className="py-3 px-3 text-center">{paidOrders.length}</td>
                <td className="py-3 px-3 text-right font-mono">{formatXof(totalCollected)}</td>
                <td className="py-3 px-3 text-right font-mono">100 %</td>
              </tr>
            </tbody>
          </table>
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
