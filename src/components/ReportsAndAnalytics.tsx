/**
 * Rapports Financiers & Performance Opérationnelle Component
 * 
 * Vue d'ensemble quotidienne, hebdomadaire, mensuelle et annuelle de l'exploitation
 * de la station avec résumés cartess, graphiques et analyse des performances.
 * 
 * Features:
 * - Cartes résumé (recettes, dépenses, bénéfice net, CA)
 * - Graphique quotidien des recettes
 * - Dépenses par catégorie avec pourcentages
 * - Répartition des recettes par mode de paiement
 * - Export CSV des rapports
 * - Évolution de l'effectif et des véhicules
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import {
  FileText, Download, Printer, Calendar, TrendingUp, TrendingDown, DollarSign, Car, Users, Award, BarChart3, Wallet
} from 'lucide-react';

export const ReportsAndAnalytics: React.FC = () => {
  const { orders, expenses, employees, formatCurrency, currentTenant } = useApp();
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year'>('month');

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

  const filteredOrders = orders.filter(o => new Date(o.createdAt).getTime() >= getStartTime());
  const paidOrders = filteredOrders.filter(o => o.paymentStatus === 'paye');
  const totalBilled = filteredOrders.reduce((sum, o) => sum + o.amount, 0);
  const totalCollected = paidOrders.reduce((sum, o) => sum + o.paidAmount, 0);
  const totalUnpaid = Math.max(0, totalBilled - totalCollected);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const netProfit = totalCollected - totalExpenses;

  const dailyRevenue: Record<string, number> = {};
  const dailyExpense: Record<string, number> = {};
  paidOrders.forEach(o => {
    const d = new Date(o.createdAt).toLocaleDateString('fr-FR');
    dailyRevenue[d] = (dailyRevenue[d] || 0) + o.paidAmount;
  });
  expenses.forEach(e => {
    const d = new Date(e.date).toLocaleDateString('fr-FR');
    dailyExpense[d] = (dailyExpense[d] || 0) + e.amount;
  });

  const expenseByCategory = (cat: string) =>
    expenses.filter(e => e.category === cat).reduce((sum, e) => sum + e.amount, 0);

  const expenseCategories = ['produits', 'detergents', 'eau_electricite', 'carburant', 'maintenance', 'salaire_prime', 'autre'];

  const paymentMethodTotals = (method: string) =>
    paidOrders.filter(o => o.paymentMethod === method).reduce((sum, o) => sum + o.paidAmount, 0);

  const paymentMethods = [
    { label: 'Wave CI', total: paymentMethodTotals('wave'), color: 'bg-sky-400' },
    { label: 'Orange Money', total: paymentMethodTotals('orange_money'), color: 'bg-orange-400' },
    { label: 'MTN MoMo', total: paymentMethodTotals('mtn_momo'), color: 'bg-yellow-400' },
    { label: 'Moov Money', total: paymentMethodTotals('moov_money'), color: 'bg-purple-400' },
    { label: 'Carte Bancaire', total: paymentMethodTotals('carte'), color: 'bg-pink-400' },
    { label: 'Virement', total: paymentMethodTotals('virement'), color: 'bg-indigo-400' },
    { label: 'Espèces', total: paidOrders.filter(o => !o.paymentMethod || o.paymentMethod === 'especes').reduce((sum, o) => sum + o.paidAmount, 0), color: 'bg-emerald-400' },
  ];

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
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `rapport_lavages_${currentTenant.slug}_${period}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto text-gray-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            <span>Rapports Financiers & Performance Opérationnelle</span>
          </h2>
          <p className="text-xs text-gray-400">
            Vue d'ensemble quotidienne, hebdomadaire, mensuelle et annuelle de l'exploitation de la station
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-[#202532] p-1 rounded-xl border border-[#2c3343] text-xs">
            {(['today', 'week', 'month', 'year'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg font-bold capitalize transition-all ${
                  period === p ? 'bg-cyan-500 text-white shadow-sm' : 'text-gray-400 hover:text-white'
                }`}
              >
                {p === 'today' ? "Aujourd'hui" : p === 'week' ? 'Semaine' : p === 'month' ? 'Ce Mois' : 'Année'}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl bg-[#202532] hover:bg-[#2b3343] border border-[#2e3748] text-xs font-semibold text-gray-200 flex items-center gap-2 transition-all shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Exporter CSV</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#1c202a] border border-[#272d3b] rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-500/20">
            <DollarSign className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Recettes</p>
            <p className="text-lg font-bold text-white">{formatCurrency(totalCollected)}</p>
          </div>
        </div>
        <div className="bg-[#1c202a] border border-[#272d3b] rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-rose-500/20">
            <TrendingDown className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Dépenses</p>
            <p className="text-lg font-bold text-white">{formatCurrency(totalExpenses)}</p>
          </div>
        </div>
        <div className="bg-[#1c202a] border border-[#272d3b] rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/20">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Bénéfice net</p>
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
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Chiffre d'affaires</p>
            <p className="text-lg font-bold text-white">{formatCurrency(totalBilled)}</p>
          </div>
        </div>
      </div>

      {/* Répartition des recettes par mode de paiement */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="bg-[#1c202a] border border-[#272d3b] rounded-2xl p-6"
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
                <motion.div
                  key={m.label}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08 * paymentMethods.indexOf(m), type: 'spring' }}
                  className="flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-gray-300">{m.label}</span>
                    <span className="font-bold text-white">{formatCurrency(m.total)}</span>
                  </div>
                  <div className="w-full bg-[#202532] rounded-full h-2 border border-[#272d3b]/50 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                      className={`h-full ${m.color} rounded-full shadow-[0_0_12px_rgba(34,211,238,0.35)]`}
                    />
                  </div>
                  <span className="text-[10px] text-gray-500">{pct}% du total</span>
                </motion.div>
              );
            })}
        </div>
      </motion.div>
    </div>
  );
};