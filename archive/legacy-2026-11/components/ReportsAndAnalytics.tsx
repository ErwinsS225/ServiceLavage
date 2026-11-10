/**
 * Rapports Financiers & Performance Opérationnelle Component
 * 
 * Vue d'ensemble quotidienne, hebdomadaire, mensuelle et annuelle de l'exploitation
 * de la station avec résumés cartes, graphiques et analyse des performances.
 * 
 * Features:
 * - Cartes résumé (recettes, dépenses, bénéfice net, CA)
 * - Graphique quotidien des recettes
 * - Dépenses par catégorie avec pourcentages
 * - Répartition des recettes par mode de paiement
 * - Téléchargement direct au format PDF via jspdf/html2canvas
 * - Partage PDF direct sur WhatsApp et messageries
 * - Export CSV des rapports
 * - Impression directe via dialogue du navigateur avec style sheet d'impression print-friendly
 */

import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import {
  FileText, Download, Printer, Share2, TrendingUp, TrendingDown, DollarSign, Car, Wallet, CheckCircle2, Building2
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export const ReportsAndAnalytics: React.FC = () => {
  const { orders, expenses, formatCurrency, currentTenant } = useApp();
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year'>('month');
  const [feedback, setFeedback] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const reportRef = useRef<HTMLDivElement>(null);

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

  const filteredOrders = orders.filter(o => new Date(o.createdAt).getTime() >= getStartTime());
  const paidOrders = filteredOrders.filter(o => o.paymentStatus === 'paye');
  const totalBilled = filteredOrders.reduce((sum, o) => sum + o.amount, 0);
  const totalCollected = paidOrders.reduce((sum, o) => sum + o.paidAmount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const netProfit = totalCollected - totalExpenses;

  const paymentMethodTotals = (method: string) =>
    paidOrders.filter(o => o.paymentMethod === method).reduce((sum, o) => sum + o.paidAmount, 0);

  const paymentMethods = [
    { label: 'Wave CI', total: paymentMethodTotals('wave'), count: paidOrders.filter(o => o.paymentMethod === 'wave').length, color: 'bg-sky-400' },
    { label: 'Orange Money', total: paymentMethodTotals('orange_money'), count: paidOrders.filter(o => o.paymentMethod === 'orange_money').length, color: 'bg-orange-400' },
    { label: 'MTN MoMo', total: paymentMethodTotals('mtn_momo'), count: paidOrders.filter(o => o.paymentMethod === 'mtn_momo').length, color: 'bg-yellow-400' },
    { label: 'Moov Money', total: paymentMethodTotals('moov_money'), count: paidOrders.filter(o => o.paymentMethod === 'moov_money').length, color: 'bg-purple-400' },
    { label: 'Carte Bancaire', total: paymentMethodTotals('carte'), count: paidOrders.filter(o => o.paymentMethod === 'carte').length, color: 'bg-pink-400' },
    { label: 'Virement', total: paymentMethodTotals('virement'), count: paidOrders.filter(o => o.paymentMethod === 'virement').length, color: 'bg-indigo-400' },
    { label: 'Espèces', total: paidOrders.filter(o => !o.paymentMethod || o.paymentMethod === 'especes').reduce((sum, o) => sum + o.paidAmount, 0), count: paidOrders.filter(o => !o.paymentMethod || o.paymentMethod === 'especes').length, color: 'bg-emerald-400' },
  ];

  const handlePrint = () => {
    window.print();
  };

  // Direct download of the formatted report as PDF (via html2canvas + jsPDF)
  const handleDownloadPdf = async () => {
    if (!reportRef.current) return;
    setIsProcessing(true);
    setFeedback('Génération du rapport PDF...');
    const fileName = `rapport_financier_servicelavage_${period}.pdf`;

    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png', 0.95);
      const doc = new jsPDF('portrait', 'mm', 'a4');
      const pageWidth = 210;
      const pageHeight = 297;
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      doc.addImage(imgData, 'PNG', 10, 10, imgWidth, Math.min(imgHeight, pageHeight - 20));
      doc.save(fileName);
      setFeedback('Rapport PDF téléchargé avec succès !');
      setTimeout(() => setFeedback(''), 4000);
    } catch (err) {
      console.error('Erreur génération PDF:', err);
      setFeedback('Erreur lors de la génération du PDF.');
      setTimeout(() => setFeedback(''), 3000);
    } finally {
      setIsProcessing(false);
    }
  };

  // Share via WhatsApp as a formatted PDF file
  const handleShareWhatsAppPdf = async () => {
    if (!reportRef.current) return;
    setIsProcessing(true);
    setFeedback('Préparation du rapport PDF pour WhatsApp...');
    const fileName = `rapport_financier_servicelavage_${period}.pdf`;

    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png', 0.95);
      const doc = new jsPDF('portrait', 'mm', 'a4');
      const pageWidth = 210;
      const pageHeight = 297;
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      doc.addImage(imgData, 'PNG', 10, 10, imgWidth, Math.min(imgHeight, pageHeight - 20));
      const pdfBlob = doc.output('blob');
      const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          files: [pdfFile],
          title: `Rapport Financier - ServiceLavage (${periodLabels[period]})`,
          text: `Bonjour, voici le rapport financier officiel de la station ${currentTenant.name} pour la période : ${periodLabels[period]}. Recettes totales : ${formatCurrency(totalCollected)}. Bénéfice net : ${formatCurrency(netProfit)}.`,
        });
        setFeedback('Rapport PDF partagé avec succès !');
        setTimeout(() => setFeedback(''), 4000);
        return;
      }

      // Fallback
      doc.save(fileName);
      const encodedMsg = encodeURIComponent(
        `Bonjour, le rapport financier officiel ServiceLavage pour la période : ${periodLabels[period]} a été généré au format PDF. Le document est téléchargé sur votre appareil.`
      );
      window.open(`https://api.whatsapp.com/send?text=${encodedMsg}`, '_blank');
      setFeedback('PDF téléchargé & WhatsApp ouvert !');
      setTimeout(() => setFeedback(''), 4500);
    } catch (err) {
      console.error('Erreur partage WhatsApp:', err);
      setFeedback('Erreur lors du partage.');
      setTimeout(() => setFeedback(''), 3000);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Ticket', 'Date', 'Vehicule', 'Plaque', 'Formule', 'Piste', 'Montant', 'Statut', 'Mode'];
    const rows = filteredOrders.map(o => [
      o.ticketNumber,
      new Date(o.createdAt).toLocaleDateString('fr-FR'),
      `"${o.vehicleInfo}"`,
      `"${o.plateNumber}"`,
      o.washCategory,
      o.bayArea,
      o.amount,
      o.paymentStatus,
      o.paymentMethod || 'especes'
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `rapport_financier_servicelavage_${currentTenant.slug || 'station'}_${period}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto text-gray-200">
      {/* Top Header - Hidden on print */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            <span>Rapports Financiers & Performance Opérationnelle</span>
          </h2>
          <p className="text-xs text-gray-400">
            ServiceLavage CI • Synthèse comptable exportable directement au format PDF ou papier
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center bg-[#202532] p-1 rounded-xl border border-[#2c3343] text-xs">
            {(['today', 'week', 'month', 'year'] as const).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg font-bold capitalize transition-all cursor-pointer ${
                  period === p ? 'bg-cyan-500 text-white shadow-sm' : 'text-gray-400 hover:text-white'
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
            className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-xs font-semibold text-white flex items-center gap-2 transition-all shadow-sm cursor-pointer"
            title="Enregistrer directement le document au format PDF"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Télécharger en PDF</span>
          </button>

          {/* Share via WhatsApp as PDF */}
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleShareWhatsAppPdf}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-semibold text-white flex items-center gap-2 transition-all shadow-sm cursor-pointer"
            title="Partager le rapport PDF sur WhatsApp"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Partager WhatsApp (PDF)</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-3.5 py-2 rounded-xl bg-[#202532] hover:bg-[#2b3343] border border-[#2e3748] text-xs font-semibold text-gray-200 flex items-center gap-2 transition-all shadow-sm cursor-pointer"
            title="Imprimer via le dialogue du navigateur"
          >
            <Printer className="w-3.5 h-3.5 text-cyan-400" />
            <span>Imprimer</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl bg-[#202532] hover:bg-[#2b3343] border border-[#2e3748] text-xs font-semibold text-gray-200 flex items-center gap-2 transition-all shadow-sm cursor-pointer"
            title="Exporter les données brutes en CSV"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
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

      {/* Screen Interactive Summary Cards */}
      <div className="no-print grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#1c202a] border border-[#272d3b] rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-500/20">
            <DollarSign className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Recettes Encaissées</p>
            <p className="text-lg font-bold text-white">{formatCurrency(totalCollected)}</p>
          </div>
        </div>
        <div className="bg-[#1c202a] border border-[#272d3b] rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-rose-500/20">
            <TrendingDown className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Dépenses Exploitation</p>
            <p className="text-lg font-bold text-white">{formatCurrency(totalExpenses)}</p>
          </div>
        </div>
        <div className="bg-[#1c202a] border border-[#272d3b] rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/20">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Bénéfice Net</p>
            <p className={`text-lg font-bold ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatCurrency(netProfit)}
            </p>
          </div>
        </div>
        <div className="bg-[#1c202a] border border-[#272d3b] rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/20">
            <Car className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Chiffre d'Affaires</p>
            <p className="text-lg font-bold text-white">{formatCurrency(totalBilled)}</p>
          </div>
        </div>
      </div>

      {/* Screen View: Payment Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="no-print bg-[#1c202a] border border-[#272d3b] rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Wallet className="w-4 h-4 text-cyan-400" />
            <span>Répartition des Recettes par Mode de Paiement</span>
          </h3>
          <span className="text-xs text-gray-400">{formatCurrency(totalCollected)} encaissés</span>
        </div>

        <div className="space-y-3">
          {paymentMethods
            .filter(m => m.total > 0)
            .sort((a, b) => b.total - a.total)
            .map(m => {
              const pct = totalCollected > 0 ? Math.round((m.total / totalCollected) * 100) : 0;
              return (
                <div key={m.label} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-gray-300">{m.label}</span>
                    <span className="font-bold text-white">{formatCurrency(m.total)} ({m.count} tx)</span>
                  </div>
                  <div className="w-full bg-[#202532] rounded-full h-2 border border-[#272d3b]/50 overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className={`h-full ${m.color} rounded-full`}
                    />
                  </div>
                  <span className="text-[10px] text-gray-500">{pct}% du total</span>
                </div>
              );
            })}
        </div>
      </motion.div>

      {/* ==========================================================================
          OFFICIAL PRINTABLE & HTML-TO-PDF REPORT
          Rendered cleanly and captured by html2canvas + jsPDF for direct PDF download
          ========================================================================== */}
      <div 
        ref={reportRef} 
        className="printable-report bg-white text-gray-900 rounded-2xl p-6 sm:p-8 border border-gray-300 shadow-sm"
      >
        {/* Report Header */}
        <div className="report-header border-b-2 border-black pb-4 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="w-6 h-6 text-cyan-700" />
                <h1 className="text-2xl font-black uppercase tracking-tight text-gray-900">
                  ServiceLavage CI
                </h1>
              </div>
              <p className="text-sm font-bold text-gray-800 mt-1">
                Rapport Financier & Bilan d'Exploitation Périodique
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                Station : <strong>{currentTenant.name}</strong> • {currentTenant.commune} ({currentTenant.address})
              </p>
            </div>
            <div className="text-left sm:text-right text-xs text-gray-600 font-mono">
              <p>Période : <strong className="text-gray-900">{periodLabels[period]}</strong></p>
              <p>Date d'édition : {new Date().toLocaleDateString('fr-FR')} {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
              <p>Devise : Franc CFA (XOF)</p>
            </div>
          </div>
        </div>

        {/* Financial KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="kpi-card border border-gray-300 bg-gray-50/80 p-3.5 rounded-xl">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600 block">Recettes Encaissées</span>
            <span className="text-base font-black text-gray-900 font-mono">{formatCurrency(totalCollected)}</span>
          </div>
          <div className="kpi-card border border-gray-300 bg-gray-50/80 p-3.5 rounded-xl">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600 block">Dépenses Opérationnelles</span>
            <span className="text-base font-black text-gray-900 font-mono">{formatCurrency(totalExpenses)}</span>
          </div>
          <div className="kpi-card border border-gray-300 bg-gray-50/80 p-3.5 rounded-xl">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600 block">Bénéfice Net d'Exploitation</span>
            <span className="text-base font-black text-emerald-800 font-mono">{formatCurrency(netProfit)}</span>
          </div>
          <div className="kpi-card border border-gray-300 bg-gray-50/80 p-3.5 rounded-xl">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600 block">Véhicules Traités</span>
            <span className="text-base font-black text-gray-900 font-mono">{paidOrders.length} lavages</span>
          </div>
        </div>

        {/* Detailed Payment Breakdown Table */}
        <div className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-800 mb-2.5 pb-1 border-b border-gray-300">
            Ventilation des Encaissements par Moyen de Paiement
          </h2>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-400 bg-gray-100">
                <th className="py-2 px-3 font-bold text-gray-800">Mode de Règlement</th>
                <th className="py-2 px-3 font-bold text-gray-800 text-center">Transactions</th>
                <th className="py-2 px-3 font-bold text-gray-800 text-right">Montant Encaissé</th>
                <th className="py-2 px-3 font-bold text-gray-800 text-right">Part (%)</th>
              </tr>
            </thead>
            <tbody>
              {paymentMethods.filter(m => m.total > 0).map(m => {
                const pct = totalCollected > 0 ? Math.round((m.total / totalCollected) * 100) : 0;
                return (
                  <tr key={m.label} className="border-b border-gray-200">
                    <td className="py-2.5 px-3 font-medium text-gray-900">{m.label}</td>
                    <td className="py-2.5 px-3 text-center text-gray-700">{m.count}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-gray-900 font-mono">{formatCurrency(m.total)}</td>
                    <td className="py-2.5 px-3 text-right text-gray-700 font-mono">{pct} %</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-black font-black bg-gray-50 text-gray-950">
                <td className="py-3 px-3">TOTAL GÉNÉRAL</td>
                <td className="py-3 px-3 text-center">{paidOrders.length}</td>
                <td className="py-3 px-3 text-right font-mono">{formatCurrency(totalCollected)}</td>
                <td className="py-3 px-3 text-right font-mono">100 %</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Signature Zone */}
        <div className="signature-zone mt-10 pt-6 border-t border-gray-400 flex flex-col sm:flex-row justify-between gap-6 text-xs text-gray-700">
          <div className="w-full sm:w-64 border-t border-dashed border-gray-500 pt-2 text-center">
            <p className="font-bold text-gray-900">Visa du Gérant de Station</p>
            <p className="text-[10px] text-gray-500 mt-6">(Date et signature précédées de la mention "Lu et approuvé")</p>
          </div>
          <div className="w-full sm:w-64 border-t border-dashed border-gray-500 pt-2 text-center">
            <p className="font-bold text-gray-900">Cachet de l'Établissement</p>
            <p className="text-[10px] text-gray-500 mt-6">ServiceLavage CI • Direction d'Exploitation</p>
          </div>
        </div>
      </div>
    </div>
  );
};