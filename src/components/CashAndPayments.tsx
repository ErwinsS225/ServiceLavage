import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
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
  Smartphone
} from 'lucide-react';
import { PaymentMethod } from '../types';

export const CashAndPayments: React.FC = () => {
  const { 
    orders, 
    cashSession, 
    closeCashSession, 
    openCashSession, 
    formatCurrency, 
    setSelectedOrderForTicket,
    updatePaymentStatus
  } = useApp();

  const [filterMethod, setFilterMethod] = useState<string>('all');
  const [actualCashClosing, setActualCashClosing] = useState<string>('');
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [openingAmountInput, setOpeningAmountInput] = useState<string>('50000');
  const [searchTx, setSearchTx] = useState('');

  // Calculate totals by method
  const paidOrders = orders.filter(o => o.paymentStatus === 'paye');
  
  const totalWave = paidOrders
    .filter(o => o.paymentMethod === 'wave')
    .reduce((sum, o) => sum + o.paidAmount, 0);
    
  const totalOrange = paidOrders
    .filter(o => o.paymentMethod === 'orange_money')
    .reduce((sum, o) => sum + o.paidAmount, 0);

  const totalMtn = paidOrders
    .filter(o => o.paymentMethod === 'mtn_momo')
    .reduce((sum, o) => sum + o.paidAmount, 0);

  const totalCash = paidOrders
    .filter(o => o.paymentMethod === 'especes' || !o.paymentMethod)
    .reduce((sum, o) => sum + o.paidAmount, 0);

  const grandTotal = paidOrders.reduce((sum, o) => sum + o.paidAmount, 0);

  const filteredOrders = orders.filter(o => {
    if (filterMethod !== 'all' && o.paymentMethod !== filterMethod) return false;
    if (searchTx) {
      const q = searchTx.toLowerCase();
      return (
        o.plateNumber.toLowerCase().includes(q) ||
        o.vehicleInfo.toLowerCase().includes(q) ||
        (o.customerName && o.customerName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleCloseSession = (e: React.FormEvent) => {
    e.preventDefault();
    const cash = Number(actualCashClosing);
    if (!actualCashClosing.trim() || !Number.isSafeInteger(cash) || cash < 0) return;
    closeCashSession(cash, 'Clôture de caisse quotidienne normale');
    setShowCloseModal(false);
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
            Démonstration locale : ces montants ne constituent pas un journal de caisse fiable.
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Wave CI */}
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

        {/* Orange Money */}
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

        {/* MTN MoMo */}
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

        {/* Espèces physiques en caisse */}
        <div className="bg-[#1c202a] border border-[#272d3b] rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4" />
              Espèces en Caisse
            </span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              cashSession.status === 'open' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-700 text-gray-300'
            }`}>
              {cashSession.status === 'open' ? 'Ouverte' : 'Clôturée'}
            </span>
          </div>
          <div className="text-2xl font-extrabold text-white">
            {formatCurrency(totalCash)}
          </div>
          <p className="text-[11px] text-gray-400">
            Fond de caisse : {cashSession.openingBalance.toLocaleString('fr-FR')} FCFA
          </p>
        </div>
      </div>

      {/* Session details status banner */}
      <div className="p-4 rounded-2xl bg-[#1c202a] border border-[#272d3b] flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
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
      </div>

      {/* Transactions Table with Filters */}
      <div className="bg-[#1c202a] border border-[#272d3b] rounded-2xl p-5 space-y-4">
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
              <option value="wave">Wave</option>
              <option value="orange_money">Orange Money</option>
              <option value="mtn_momo">MTN MoMo</option>
              <option value="especes">Espèces</option>
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
      </div>

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
