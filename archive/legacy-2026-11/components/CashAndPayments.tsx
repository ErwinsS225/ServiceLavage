/**
 * Caisse Journalière & Encaissements Component
 * 
 * Gestion de la caisse quotidienne, clôture, encaissements par méthode de paiement,
 * suivi des dépenses et rapport des transactions pour les stations de lavage.
 * 
 * Features:
 * - Résumé cartes (recettes, dépenses, bénéfice net)
 * - Répartition par méthode de paiement (espèces par défaut, Mobile Money activable via .env)
 * - Clôture de caisse avec contrôle d'écarts
 * - Enregistrement des dépenses par catégorie
 * - Historique des transactions avec filtres période/méthode
 * - Modal de clôture avec vérification physique
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { cardVariants, staggeredChildren } from '../components/ui/AnimatedPanel';
import { 
  CreditCard, 
  DollarSign, 
  Lock, 
  Unlock, 
  ArrowUpRight, 
  ArrowDownRight, 
  CheckCircle, 
  Search, 
  Filter,
  Receipt,
  Smartphone,
  Banknote,
  PiggyBank,
  TrendingUp,
  TrendingDown,
  AlertTriangle
} from 'lucide-react';
import { PaymentMethod, ExpenseItem } from '../types';

const ALL_PAYMENT_METHODS: PaymentMethod[] = ['wave', 'orange_money', 'mtn_momo', 'moov_money', 'carte', 'virement'];

const isPaymentMethodEnabled = (method: PaymentMethod) => {
  if (method === 'especes') return true;
  const envKey = `VITE_PAYMENT_${method.toUpperCase()}` as `VITE_PAYMENT_${string}`;
  return import.meta.env[envKey] === 'true';
};

export const CashAndPayments: React.FC = () => {
  const { 
    orders, 
    expenses,
    cashSession, 
    closeCashSession, 
    openCashSession, 
    addExpense,
    formatCurrency, 
    setSelectedOrderForTicket,
    updatePaymentStatus
  } = useApp();

  const [filterMethod, setFilterMethod] = useState<string>('all');
  const [actualCashClosing, setActualCashClosing] = useState<string>('');
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [newExpense, setNewExpense] = useState<Partial<ExpenseItem>>({
    date: new Date().toISOString().slice(0, 10),
    category: 'detergents',
    description: '',
    paymentMethod: 'especes',
    amount: 0,
  });
  const [searchTx, setSearchTx] = useState('');
  const [openingAmountInput, setOpeningAmountInput] = useState<number>(0);

  const enabledMethods: PaymentMethod[] = ['especes', ...ALL_PAYMENT_METHODS.filter(m => isPaymentMethodEnabled(m))];

  // Calculate totals by method
  const paidOrders = orders.filter(o => o.paymentStatus === 'paye');
   
  const totalWave = paidOrders
    .filter(o => o.paymentMethod === 'wave')
    .reduce((sum: number, o) => sum + o.paidAmount, 0);
    
  const totalOrange = paidOrders
    .filter(o => o.paymentMethod === 'orange_money')
    .reduce((sum: number, o) => sum + o.paidAmount, 0);

  const totalMtn = paidOrders
    .filter(o => o.paymentMethod === 'mtn_momo')
    .reduce((sum: number, o) => sum + o.paidAmount, 0);

  const totalMoov = paidOrders
    .filter(o => o.paymentMethod === 'moov_money')
    .reduce((sum: number, o) => sum + o.paidAmount, 0);

  const totalCard = paidOrders
    .filter(o => o.paymentMethod === 'carte')
    .reduce((sum: number, o) => sum + o.paidAmount, 0);

  const totalVirement = paidOrders
    .filter(o => o.paymentMethod === 'virement')
    .reduce((sum: number, o) => sum + o.paidAmount, 0);

  const totalCash = paidOrders
    .filter(o => o.paymentMethod === 'especes' || !o.paymentMethod)
    .reduce((sum: number, o) => sum + o.paidAmount, 0);

  const grandTotal = paidOrders.reduce((sum: number, o) => sum + o.paidAmount, 0);

  // Expense breakdown
  const expenseByCategory = (cat: ExpenseItem['category']) =>
    expenses.filter(e => e.category === cat).reduce((sum: number, e) => sum + e.amount, 0);

  const totalExpenses = expenses.reduce((sum: number, e) => sum + e.amount, 0);
  const netCash = grandTotal - totalExpenses;

  // Expense categories
  const expenseCategories: ExpenseItem['category'][] = [
    'produits', 'detergents', 'eau_electricite', 'carburant', 'maintenance',
    'salaire_prime', 'autre'
  ];
  // Period-based summary (today/week/month/year)
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

  const periodLabel = (period: 'today' | 'week' | 'month' | 'year') => {
    const d = now;
    switch (period) {
      case 'today':
        return `Décembre ${d.getDate()} ${d.getFullYear()}`;
      case 'week': {
        const startDate = new Date(d);
        startDate.setDate(d.getDate() - 7);
        return `7 derniers jours : ${startDate.toLocaleDateString('fr-FR')} → ${d.toLocaleDateString('fr-FR')}`;
      }
      case 'month':
        return `Mois de ${d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`;
      case 'year':
        return `Année ${d.getFullYear()}`;
      default:
        return '';
    }
  };

  // Filter orders by period and method
  const paidInPeriod = paidOrders.filter(o => {
    const t = new Date(o.createdAt).getTime();
    if (filterMethod === 'today') return t >= startOfDay;
    if (filterMethod === 'week') return t >= startOfWeek;
    if (filterMethod === 'month') return t >= startOfMonth;
    if (filterMethod === 'year') return t >= startOfYear;
    return true;
  });

  const periodTotal = paidInPeriod.reduce((sum: number, o) => sum + o.paidAmount, 0);

  const filteredOrders = paidInPeriod.filter(o => {
    const q = searchTx.toLowerCase();
    return o.ticketNumber.toLowerCase().includes(q) ||
      (o.vehicleInfo || '').toLowerCase().includes(q) ||
      (o.plateNumber || '').toLowerCase().includes(q);
  });

  const handleCloseSession = (e: React.FormEvent) => {
    e.preventDefault();
    const cash = Number(actualCashClosing);
    if (!actualCashClosing.trim() || !Number.isSafeInteger(cash) || cash < 0) return;
    closeCashSession(cash, 'Clôture de caisse quotidienne normale');
    setShowCloseModal(false);
  };

  const handleOpenSession = () => {
    if (cashSession.status === 'closed') {
      openCashSession(50000);
    }
  };

  const handleExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(newExpense.amount);
    if (!newExpense.description || !amount || amount <= 0) return;
    addExpense({
      tenantId: 'tenant-1',
      category: newExpense.category || 'autre',
      description: newExpense.description,
      amount,
      paymentMethod: newExpense.paymentMethod || 'especes',
      recordedBy: 'Personne',
    });
    setNewExpense({ date: new Date().toISOString().slice(0, 10), category: 'detergents', description: '', paymentMethod: 'especes', amount: 0 });
    setShowExpenseModal(false);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto text-gray-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-cyan-400" />
            <span>Caisse Journalière & Encaissements</span>
          </h2>
          <p className="text-xs text-gray-400">
            Gestion des recettes, des paiements et de la clôture de caisse quotidienne
          </p>
        </div>

        <div className="flex items-center gap-3">
          {cashSession.status === 'open' ? (
            <button
              onClick={() => {
                setActualCashClosing(String(cashSession.expectedClosingBalance));
                setShowCloseModal(true);
              }}
              className="px-4 py-2 rounded-xl bg-rose-600/20 text-rose-300 hover:bg-rose-600/30 border border-rose-500/30 text-xs font-bold flex items-center gap-2 transition-all"
            >
              <Lock className="w-4 h-4" />
              <span>Clôturer la Caisse</span>
            </button>
          ) : (
            <button
              onClick={() => openCashSession(Number(openingAmountInput))}
              className="px-4 py-2 rounded-xl bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/30 text-xs font-bold flex items-center gap-2 transition-all"
            >
              <Unlock className="w-4 h-4" />
              <span>Ouvrir une Nouvelle Caisse</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Cards: Mobile Money & Cash Breakdown */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={staggeredChildren}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {enabledMethods.includes('wave') && (
        <motion.div variants={cardVariants} whileHover="hover" whileTap="tap">
        <div className="bg-[#1c202a] border border-[#272d3b] rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4" />
              Wave Côte d'Ivoire
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400">
              0% frais
            </span>
          </div>
          <div className="text-2xl font-extrabold text-white">
            {formatCurrency(totalWave)}
          </div>
          <p className="text-[11px] text-gray-400">
            Scans QR & transferts directs Wave
          </p>
        </div>
        </motion.div>
        )}

        {enabledMethods.includes('orange_money') && (
        <motion.div variants={cardVariants} whileHover="hover" whileTap="tap">
        <div className="bg-[#1c202a] border border-[#272d3b] rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-orange-400 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4" />
              Orange Money CI
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400">
              #144#
            </span>
          </div>
          <div className="text-2xl font-extrabold text-white">
            {formatCurrency(totalOrange)}
          </div>
          <p className="text-[11px] text-gray-400">
            Paiements marchands Orange
          </p>
        </div>
        </motion.div>
        )}

        {enabledMethods.includes('mtn_momo') && (
        <motion.div variants={cardVariants} whileHover="hover" whileTap="tap">
        <div className="bg-[#1c202a] border border-[#272d3b] rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-yellow-400 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4" />
              MTN Mobile Money
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400">
              *133#
            </span>
          </div>
          <div className="text-2xl font-extrabold text-white">
            {formatCurrency(totalMtn)}
          </div>
          <p className="text-[11px] text-gray-400">
            Encaissements clients MTN
          </p>
        </div>
        </motion.div>
        )}

        {enabledMethods.includes('moov_money') && (
        <motion.div variants={cardVariants} whileHover="hover" whileTap="tap">
        <div className="bg-[#1c202a] border border-[#272d3b] rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4" />
              Moov Money CI
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400">
              *855#
            </span>
          </div>
          <div className="text-2xl font-extrabold text-white">
            {formatCurrency(totalMoov)}
          </div>
          <p className="text-[11px] text-gray-400">
            Encaissements clients Moov
          </p>
        </div>
        </motion.div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            {label: 'Wave', total: totalWave, color: 'bg-sky-400', code: 'wave'},
            {label: 'Orange', total: totalOrange, color: 'bg-orange-400', code: 'orange_money'},
            {label: 'MTN', total: totalMtn, color: 'bg-yellow-400', code: 'mtn_momo'},
            {label: 'Moov', total: totalMoov, color: 'bg-purple-400', code: 'moov_money'},
            {label: 'Carte', total: totalCard, color: 'bg-pink-400', code: 'carte'},
            {label: 'Virement', total: totalVirement, color: 'bg-indigo-400', code: 'virement'},
          ].filter(m => enabledMethods.includes(m.code as PaymentMethod)).map((m) => (
            <div key={m.code} className="bg-[#1c202a] border border-[#272d3b] rounded-xl p-3">
              <p className="text-[10px] uppercase font-bold text-gray-400">{m.label}</p>
              <p className="text-lg font-bold text-white">{formatCurrency(m.total)}</p>
            </div>
          ))}
        </div>

      </motion.div>

      {/* Session details status banner */}
      <motion.div
        variants={cardVariants}
        whileHover="hover"
        whileTap="tap"
        className="p-4 rounded-2xl bg-[#1c202a] border border-[#272d3b] flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs"
      >
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${cashSession.status === 'open' ? 'bg-emerald-400 animate-ping' : 'bg-gray-500'}`} />
          <div>
            <span className="font-bold text-white text-sm">
              Session Caisse : {cashSession.status === 'open' ? 'En cours' : 'Clôturée'}
            </span>
            <p className="text-gray-400 text-[11px]">
              Ouverte par {cashSession.openedBy} le {new Date(cashSession.openedAt).toLocaleTimeString('fr-FR')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div>
            <span className="text-gray-400 block text-[10px]">TOTAL TOUS MODES</span>
            <span className="font-extrabold text-cyan-400 text-base">{formatCurrency(grandTotal)}</span>
          </div>

          <div>
            <span className="text-gray-400 block text-[10px]">SOLDE ESPÈCES ATTENDU</span>
            <span className="font-bold text-white text-base">{cashSession.expectedClosingBalance.toLocaleString('fr-FR')} FCFA</span>
          </div>
        </div>
      </motion.div>

      {/* Transactions Table with Filters */}
      <motion.div
        variants={cardVariants}
        whileHover="hover"
        whileTap="tap"
        className="bg-[#1c202a] border border-[#272d3b] rounded-2xl p-5 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-white">Historique des Transactions de Lavage</h3>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Rechercher immat, client..."
                value={searchTx}
                onChange={e => setSearchTx(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-[#222734] border border-[#2c3343] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none"
              />
            </div>

            {/* Filter by Method */}
            <select
              value={filterMethod}
              onChange={e => setFilterMethod(e.target.value)}
              className="px-3 py-1.5 bg-[#222734] border border-[#2c3343] rounded-xl text-xs text-gray-300 focus:outline-none cursor-pointer"
            >
              <option value="all">Tous les modes</option>
              <option value="especes">Espèces</option>
              {enabledMethods.includes('wave') && <option value="wave">Wave</option>}
              {enabledMethods.includes('orange_money') && <option value="orange_money">Orange Money</option>}
              {enabledMethods.includes('mtn_momo') && <option value="mtn_momo">MTN MoMo</option>}
              {enabledMethods.includes('moov_money') && <option value="moov_money">Moov Money</option>}
              {enabledMethods.includes('carte') && <option value="carte">Carte Bancaire</option>}
              {enabledMethods.includes('virement') && <option value="virement">Virement</option>}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-gray-400 border-b border-[#29303f] pb-2">
                <th className="pb-3 font-medium">Ticket & Date</th>
                <th className="pb-3 font-medium">Véhicule & Client</th>
                <th className="pb-3 font-medium">Prestation</th>
                <th className="pb-3 font-medium text-center">Mode Paiement</th>
                <th className="pb-3 font-medium text-right">Montant</th>
                <th className="pb-3 font-medium text-center">Statut</th>
                <th className="pb-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#242a38]">
              {filteredOrders.map(order => {
                const isPaid = order.paymentStatus === 'paye';
                return (
                  <tr key={order.id} className="hover:bg-[#222734] transition-colors">
                    <td className="py-3">
                      <span className="font-bold text-gray-200 block">{order.ticketNumber}</span>
                      <span className="text-[10px] text-gray-400">{new Date(order.createdAt).toLocaleTimeString('fr-FR')}</span>
                    </td>

                    <td className="py-3">
                      <div className="font-semibold text-gray-200">{order.vehicleInfo}</div>
                      <div className="text-[10px] text-cyan-400 font-mono">{order.plateNumber}</div>
                      <div className="text-[10px] text-gray-400">{order.customerName || 'Passage'}</div>
                    </td>

                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#2e2646] text-purple-200">
                        {order.washCategory}
                      </span>
                    </td>

                    <td className="py-3 text-center">
                      <span className="font-bold uppercase text-[11px] text-gray-300">
                        {order.paymentMethod || 'Espèces'}
                      </span>
                    </td>

                    <td className="py-3 text-right font-extrabold text-white">
                      {formatCurrency(order.amount)}
                    </td>

                    <td className="py-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isPaid
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}
                      >
                        {isPaid ? 'Payé' : 'À régler'}
                      </span>
                    </td>

                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedOrderForTicket(order)}
                          className="p-1 rounded bg-[#282f3e] text-cyan-400 hover:bg-[#323b4e]"
                          title="Imprimer Reçu"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                        </button>
                        {!isPaid && (
                          <button
                            onClick={() => updatePaymentStatus(order.id, 'paye', 'wave')}
                            className="px-2 py-0.5 rounded bg-emerald-600/30 text-emerald-300 hover:bg-emerald-600/50 text-[10px] font-bold"
                          >
                            Encaisser
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Modal Clôture de Caisse */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#1a1e27] border border-[#2b3242] rounded-2xl w-full max-w-md p-5 space-y-4 text-gray-200 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-rose-400" />
              <span>Clôture et Contrôle de Caisse</span>
            </h3>

            <p className="text-xs text-gray-400">
              Veuillez compter physiquement les billets et pièces dans le tiroir-caisse pour calculer les écarts éventuels.
            </p>

            <div className="p-3 bg-[#202532] rounded-xl border border-[#2a3140] space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Solde théorique attendu :</span>
                <span className="font-bold text-white">{cashSession.expectedClosingBalance.toLocaleString('fr-FR')} FCFA</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Total recettes Wave & MoMo :</span>
                <span className="font-bold text-cyan-400">{formatCurrency(totalWave + totalOrange + totalMtn)}</span>
              </div>
            </div>

            <form onSubmit={handleCloseSession} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Montant Espèces Compté Réellement (FCFA)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={actualCashClosing}
                  onChange={e => setActualCashClosing(e.target.value)}
                  className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-sm font-bold text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#222734] text-xs font-semibold text-gray-300"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-md transition-colors"
                >
                  Confirmer la Clôture
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
