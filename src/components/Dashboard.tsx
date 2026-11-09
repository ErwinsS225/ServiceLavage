import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  TrendingUp, 
  RefreshCw, 
  Users, 
  Clock, 
  Car, 
  Receipt, 
  Wrench, 
  MessageSquare, 
  AlertTriangle, 
  AlertCircle, 
  ChevronDown, 
  CheckCircle2,
  DollarSign,
  ArrowRight,
  LayoutGrid,
  CreditCard
} from 'lucide-react';
import { WashOrder } from '../types';
import { QuickActionsFAB } from './QuickActionsFAB';

export const Dashboard: React.FC = () => {
  const { 
    orders, 
    bays, 
    refreshBay, 
    formatCurrency, 
    setSelectedOrderForTicket, 
    setSelectedOrderForDetail,
    setActiveTab, 
    updateOrderStatus,
    updatePaymentStatus,
    recentEvents
  } = useApp();

  const [bayFilter, setBayFilter] = useState<'operational' | 'out_of_service' | 'all'>('operational');
  const [analyticsPeriod, setAnalyticsPeriod] = useState<string>('previous week');

  // Filter bays based on tab
  const filteredBays = bays.filter(b => {
    if (bayFilter === 'all') return true;
    return b.status === bayFilter;
  });

  // Calculate live metric counts
  const ongoingWashes = orders.filter(o => o.status === 'en_cours').length;
  const inOrderCount = orders.filter(o => o.status === 'en_attente').length;
  const completedCount = orders.filter(o => o.status === 'termine').length;
  const operationalBaysCount = bays.filter(b => b.status === 'operational').length;
  
  const totalRevenueNumber = orders
    .filter(o => o.paymentStatus === 'paye')
    .reduce((acc, curr) => acc + curr.paidAmount, 0);

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'Shine':
        return 'bg-[#483d6a] text-[#ddd0ff] border border-[#5d4f87]';
      case 'Gloss':
        return 'bg-[#5c3e24] text-[#ffdcb2] border border-[#775232]';
      case 'Glint':
        return 'bg-[#293d56] text-[#bde0fe] border border-[#375173]';
      default:
        return 'bg-[#3b3552] text-purple-200 border border-purple-500/20';
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto transition-colors">
      {/* 1. TOP STATS ROW (4 Cards matching image_a81d1a79.png) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Lavages en cours */}
        <div 
          onClick={() => setActiveTab('queue')}
          className="bg-[#1c202a] border border-[#272d3b] rounded-2xl p-5 shadow-sm hover:border-cyan-500/50 transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#3d242c] flex items-center justify-center text-[#ff758f] group-hover:scale-105 transition-transform">
              {/* Droplets / Car Wash Icon */}
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
              </svg>
            </div>
            <span className="text-xs font-medium text-gray-300">Lavages en cours</span>
          </div>

          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-white tracking-tight">
              {String(ongoingWashes).padStart(2, '0')}
            </span>
            <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-400">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+6%</span>
              <span className="text-gray-400 font-normal">vs hier</span>
            </div>
          </div>
        </div>

        {/* Card 2: Tickets en attente */}
        <div 
          onClick={() => setActiveTab('queue')}
          className="bg-[#1c202a] border border-[#272d3b] rounded-2xl p-5 shadow-sm hover:border-cyan-500/50 transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1b3443] flex items-center justify-center text-[#38bdf8] group-hover:scale-105 transition-transform">
              <Car className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-gray-300">Tickets en attente</span>
          </div>

          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-white tracking-tight">
              {String(inOrderCount).padStart(2, '0')}
            </span>
            <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-400">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+6%</span>
              <span className="text-gray-400 font-normal">vs hier</span>
            </div>
          </div>
        </div>

        {/* Card 3: Lavages terminés */}
        <div 
          onClick={() => setActiveTab('reports')}
          className="bg-[#1c202a] border border-[#272d3b] rounded-2xl p-5 shadow-sm hover:border-cyan-500/50 transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#183a2b] flex items-center justify-center text-[#4ade80] group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-gray-300">Lavages terminés</span>
          </div>

          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-white tracking-tight">
              {completedCount}
            </span>
            <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-400">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+6%</span>
              <span className="text-gray-400 font-normal">vs hier</span>
            </div>
          </div>
        </div>

        {/* Card 4: Recettes du jour */}
        <div 
          onClick={() => setActiveTab('payments')}
          className="bg-[#1c202a] border border-[#272d3b] rounded-2xl p-5 shadow-sm hover:border-amber-500/50 transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#3d3319] flex items-center justify-center text-[#facc15] group-hover:scale-105 transition-transform">
              <span className="text-xs font-black">CFA</span>
            </div>
            <span className="text-xs font-medium text-gray-300">Recettes du Jour</span>
          </div>

          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              {formatCurrency(totalRevenueNumber)}
            </span>
            <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-400">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+6%</span>
              <span className="text-gray-400 font-normal">vs hier</span>
            </div>
          </div>
        </div>
      </div>

      {/* 1.5 INTERACTIVE SUMMARY WIDGETS (Requested: Today's Revenue, Active Washing Bays, Pending Tickets) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Widget 1: Recettes du Jour (Today's Revenue) */}
        <div
          onClick={() => setActiveTab('payments')}
          className="p-5 rounded-2xl bg-gradient-to-br from-[#1a2232] via-[#1c202a] to-[#171b24] border border-[#2b3548] hover:border-cyan-400/60 shadow-lg hover:shadow-cyan-500/10 transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-cyan-400">
              <CreditCard className="w-4 h-4" />
              <span className="text-xs font-extrabold uppercase tracking-wider">Recettes du Jour</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              +14% cette semaine
            </span>
          </div>

          <div className="mt-3">
            <div className="text-2xl font-black text-white group-hover:text-cyan-300 transition-colors">
              {formatCurrency(totalRevenueNumber)}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              Wave CI : 58% • Orange : 24% • MTN : 10% • Espèces : 8%
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-[#283244] flex items-center justify-between text-xs font-bold text-cyan-400 group-hover:text-cyan-300">
            <span>Accéder au Module Caisse & Règlements</span>
            <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Widget 2: Pistes de Lavage Actives (Active Washing Bays) */}
        <div
          onClick={() => setActiveTab('bays')}
          className="p-5 rounded-2xl bg-gradient-to-br from-[#192622] via-[#1c202a] to-[#171b24] border border-[#2b3d36] hover:border-emerald-400/60 shadow-lg hover:shadow-emerald-500/10 transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-400">
              <LayoutGrid className="w-4 h-4" />
              <span className="text-xs font-extrabold uppercase tracking-wider">Pistes de Lavage Actives</span>
            </div>
            <span className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              100% Opérationnel
            </span>
          </div>

          <div className="mt-3">
            <div className="text-2xl font-black text-white group-hover:text-emerald-300 transition-colors">
              {operationalBaysCount} / {bays.length} Pistes en Service
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              Pression d'eau optimale • 8 karchers opérationnels
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-[#273831] flex items-center justify-between text-xs font-bold text-emerald-400 group-hover:text-emerald-300">
            <span>Superviser les 8 Pistes (Wash Bays)</span>
            <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Widget 3: Tickets en Attente (Pending Tickets) */}
        <div
          onClick={() => setActiveTab('queue')}
          className="p-5 rounded-2xl bg-gradient-to-br from-[#27211a] via-[#1c202a] to-[#171b24] border border-[#423324] hover:border-amber-400/60 shadow-lg hover:shadow-amber-500/10 transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-400">
              <Car className="w-4 h-4" />
              <span className="text-xs font-extrabold uppercase tracking-wider">Tickets en Attente</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
              Temps moy. 11 min
            </span>
          </div>

          <div className="mt-3">
            <div className="text-2xl font-black text-white group-hover:text-amber-300 transition-colors">
              {inOrderCount} Véhicules en File
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              {ongoingWashes} lavages en cours • 6 laveurs affectés
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-[#3b2e21] flex items-center justify-between text-xs font-bold text-amber-400 group-hover:text-amber-300">
            <span>Gérer la File d'Attente (Kanban)</span>
            <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>

      {/* 2. MIDDLE SECTION: Wash Details Table (Left) & Wash Bay Stations (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Wash Details */}
        <div className="lg:col-span-7 bg-[#1c202a] border border-[#272d3b] rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white tracking-wide">Détails des Lavages en Cours</h3>
            <button 
              onClick={() => setActiveTab('queue')}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
            >
              Gérer la file d'attente →
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-[#29303f] pb-2">
                  <th className="pb-3 font-medium">Véhicule & Info</th>
                  <th className="pb-3 font-medium">Formule de Lavage</th>
                  <th className="pb-3 font-medium text-center">Piste</th>
                  <th className="pb-3 font-medium text-center">Statut</th>
                  <th className="pb-3 font-medium text-right">Montant Facturé</th>
                  <th className="pb-3 font-medium text-right pr-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#242a38]">
                {orders.slice(0, 8).map((order) => (
                  <tr key={order.id} className="hover:bg-[#222734] transition-colors group cursor-pointer" onClick={() => setSelectedOrderForDetail(order)}>
                    {/* Vehicle Info */}
                    <td className="py-3 pr-2">
                      <div className="font-semibold text-gray-200 group-hover:text-cyan-400 transition-colors flex items-center gap-1.5">
                        <span>{order.vehicleInfo}</span>
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono tracking-tight">{order.plateNumber}</div>
                    </td>

                    {/* Wash Category Pill */}
                    <td className="py-3 px-2">
                      <span className={`inline-block px-3 py-1 rounded-md text-[11px] font-medium ${getCategoryBadge(order.washCategory)}`}>
                        {order.washCategory}
                      </span>
                    </td>

                    {/* Bay Area */}
                    <td className="py-3 px-2 text-center text-gray-300 font-semibold">
                      {order.bayArea}
                    </td>

                    {/* Status Pill */}
                    <td className="py-3 px-2 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          order.isDelayed = !order.isDelayed;
                        }}
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-all ${
                          order.isDelayed
                            ? 'bg-[#3b2a1a] text-[#fb923c] border border-[#643f1f]'
                            : 'bg-[#183b28] text-[#4ade80] border border-[#23583c]'
                        }`}
                        title="Cliquer pour changer statut"
                      >
                        {order.isDelayed ? 'En retard' : 'Dans les temps'}
                      </button>
                    </td>

                    {/* Bill Amount */}
                    <td className="py-3 pl-2 text-right font-semibold text-gray-200">
                      {formatCurrency(order.amount)}
                    </td>

                    {/* Action: Ticket & Complete */}
                    <td className="py-3 pr-2 text-right">
                      <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedOrderForTicket(order)}
                          className="p-1 rounded bg-[#272e3d] text-cyan-400 hover:bg-cyan-500/20"
                          title="Imprimer / Voir le ticket"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                        </button>
                        {order.paymentStatus !== 'paye' && (
                          <button
                            onClick={() => updatePaymentStatus(order.id, 'paye')}
                            className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-[10px] font-bold"
                            title="Encaisser"
                          >
                            Payer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Wash Bay Stations */}
        <div className="lg:col-span-5 bg-[#1c202a] border border-[#272d3b] rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h3 className="text-sm font-bold text-white tracking-wide">Pistes de Lavage (Wash Bays)</h3>

              {/* Tabs: Operational / Out of service / All */}
              <div className="flex items-center gap-1 border-b border-[#282f3e] pb-1">
                <button
                  onClick={() => setBayFilter('operational')}
                  className={`text-xs font-semibold px-2 py-1 transition-all ${
                    bayFilter === 'operational'
                      ? 'text-cyan-400 border-b-2 border-cyan-400 -mb-1'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Opérationnelles
                </button>
                <button
                  onClick={() => setBayFilter('out_of_service')}
                  className={`text-xs font-semibold px-2 py-1 transition-all ${
                    bayFilter === 'out_of_service'
                      ? 'text-cyan-400 border-b-2 border-cyan-400 -mb-1'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Hors service
                </button>
                <button
                  onClick={() => setBayFilter('all')}
                  className={`text-xs font-semibold px-2 py-1 transition-all ${
                    bayFilter === 'all'
                      ? 'text-cyan-400 border-b-2 border-cyan-400 -mb-1'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Toutes
                </button>
              </div>
            </div>

            {/* Grid of Bay Stations (exact 2x2 layout from screenshot) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {filteredBays.slice(0, 4).map((bay) => (
                <div
                  key={bay.id}
                  className="bg-[#212633] border border-[#2c3343] rounded-xl p-3.5 hover:border-cyan-500/40 transition-all flex flex-col justify-between space-y-3"
                >
                  {/* Bay Header */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-200">{bay.name}</span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        bay.status === 'operational' ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-rose-500'
                      }`}
                    />
                  </div>

                  {/* Vehicle info & queue */}
                  <div className="grid grid-cols-2 gap-2 text-xs py-1 border-y border-[#29303f]">
                    <div>
                      <div className="font-bold text-gray-100 truncate">{bay.currentVehicleInfo || 'Disponible'}</div>
                      <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-0.5">
                        <Car className="w-3 h-3" />
                        <span>En cours</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-bold text-gray-100">{bay.inQueueCount}</div>
                      <div className="flex items-center justify-end gap-1 text-[10px] text-gray-400 mt-0.5">
                        <Users className="w-3 h-3" />
                        <span>En attente</span>
                      </div>
                    </div>
                  </div>

                  {/* Avg time & staff */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="font-bold text-gray-100">{bay.avgTimeMinutes} min</div>
                      <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>Durée moy.</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-bold text-gray-100">{bay.assignedStaffCount}</div>
                      <div className="flex items-center justify-end gap-1 text-[10px] text-gray-400 mt-0.5">
                        <Users className="w-3 h-3" />
                        <span>Laveurs</span>
                      </div>
                    </div>
                  </div>

                  {/* Refresh Button */}
                  <button
                    onClick={() => refreshBay(bay.id)}
                    className="w-full py-1.5 px-2 rounded-lg bg-[#282f3e] hover:bg-[#323b4e] text-gray-300 hover:text-white text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Actualiser</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#272d3b] flex items-center justify-between text-xs text-gray-400">
            <span>Pistes actives : {bays.filter(b => b.status === 'operational').length}/{bays.length}</span>
            <button 
              onClick={() => setActiveTab('bays')}
              className="text-cyan-400 hover:underline font-semibold"
            >
              Superviser les 8 pistes →
            </button>
          </div>
        </div>
      </div>

      {/* 3. BOTTOM SECTION: Transactions (Left), Package Analytics (Center), Recent Events (Right) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
        {/* Left: Transactions */}
        <div className="lg:col-span-4 bg-[#1c202a] border border-[#272d3b] rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white tracking-wide">Transactions Récentes</h3>
            <button
              onClick={() => setActiveTab('payments')}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
            >
              Voir tout
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-[#29303f] pb-2">
                  <th className="pb-3 font-medium">Véhicule & Réf</th>
                  <th className="pb-3 font-medium text-center">Montant</th>
                  <th className="pb-3 font-medium text-right">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#242a38]">
                {orders.slice(0, 4).map((t, idx) => {
                  const isPaid = t.paymentStatus === 'paye';
                  return (
                    <tr key={t.id || idx} className="hover:bg-[#222734] transition-colors">
                      <td className="py-3">
                        <div className="font-semibold text-gray-200">{t.vehicleInfo}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{t.plateNumber}</div>
                      </td>
                      <td className="py-3 text-center font-semibold text-gray-200">
                        {formatCurrency(t.amount)}
                      </td>
                      <td className="py-3 text-right">
                        <span
                          className={`inline-block px-3 py-1 rounded-md text-[10px] font-bold ${
                            isPaid
                              ? 'bg-[#183d29] text-[#4ade80] border border-[#265e3f]'
                              : 'bg-[#42331b] text-[#fbbf24] border border-[#6b5025]'
                          }`}
                        >
                          {isPaid ? 'Payé' : 'En attente'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Center: Package Analytics Bar Chart (Exact replica with FCFA values) */}
        <div className="lg:col-span-4 bg-[#1c202a] border border-[#272d3b] rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white tracking-wide">Analyse des Formules</h3>
              
              <div className="relative">
                <select
                  value={analyticsPeriod}
                  onChange={(e) => setAnalyticsPeriod(e.target.value)}
                  className="bg-[#242935] text-gray-300 text-xs rounded-lg px-2.5 py-1 pr-6 border border-[#2e3544] focus:outline-none cursor-pointer appearance-none"
                >
                  <option value="previous week">Semaine dernière</option>
                  <option value="this month">Ce mois</option>
                  <option value="today">Aujourd'hui</option>
                </select>
                <ChevronDown className="w-3 h-3 text-gray-400 absolute right-2 top-2.5 pointer-events-none" />
              </div>
            </div>

            {/* Custom SVG/CSS Bar Chart with dashed gridlines matching screenshot */}
            <div className="pt-2">
              <div className="relative h-44 flex items-end justify-between px-6 pb-4 border-b border-[#2e3546]">
                {/* Horizontal Dashed Gridlines & Y-Axis Labels in FCFA */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[10px] text-gray-500">
                  <div className="border-b border-dashed border-[#282f3e] w-full flex items-center justify-between pr-2">
                    <span>3,0 M FCFA</span>
                  </div>
                  <div className="border-b border-dashed border-[#282f3e] w-full flex items-center justify-between pr-2">
                    <span>2,5 M FCFA</span>
                  </div>
                  <div className="border-b border-dashed border-[#282f3e] w-full flex items-center justify-between pr-2">
                    <span>2,0 M FCFA</span>
                  </div>
                  <div className="border-b border-dashed border-[#282f3e] w-full flex items-center justify-between pr-2">
                    <span>1,5 M FCFA</span>
                  </div>
                  <div className="border-b border-dashed border-[#282f3e] w-full flex items-center justify-between pr-2">
                    <span>500 K FCFA</span>
                  </div>
                </div>

                {/* Vertical Bars */}
                {/* Bar 1: Glint */}
                <div className="relative z-10 flex flex-col items-center group">
                  <div className="w-12 bg-gradient-to-t from-[#263c52] to-[#3a5877] rounded-t-sm h-28 group-hover:from-sky-500 group-hover:to-cyan-400 transition-all flex items-end justify-center pb-2">
                    <span className="text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      2,1M F
                    </span>
                  </div>
                </div>

                {/* Bar 2: Shine */}
                <div className="relative z-10 flex flex-col items-center group">
                  <div className="w-12 bg-gradient-to-t from-[#293d56] to-[#415a77] rounded-t-sm h-36 group-hover:from-purple-500 group-hover:to-pink-400 transition-all flex items-end justify-center pb-2">
                    <span className="text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      2,7M F
                    </span>
                  </div>
                </div>

                {/* Bar 3: Gloss */}
                <div className="relative z-10 flex flex-col items-center group">
                  <div className="w-12 bg-gradient-to-t from-[#364963] to-[#4f6d8f] rounded-t-sm h-40 group-hover:from-amber-500 group-hover:to-orange-400 transition-all flex items-end justify-center pb-2">
                    <span className="text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      3,1M F
                    </span>
                  </div>
                </div>
              </div>

              {/* X-Axis Badges matching screenshot */}
              <div className="flex items-center justify-between px-4 mt-3">
                <span className="px-2.5 py-0.5 rounded text-[11px] font-medium bg-[#293d56] text-[#bde0fe]">
                  Glint
                </span>
                <span className="px-2.5 py-0.5 rounded text-[11px] font-medium bg-[#483d6a] text-[#ddd0ff]">
                  Shine
                </span>
                <span className="px-2.5 py-0.5 rounded text-[11px] font-medium bg-[#5c3e24] text-[#ffdcb2]">
                  Gloss
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 text-[11px] text-gray-400 text-center">
            Formule la plus demandée cette semaine : <span className="text-amber-300 font-semibold">Gloss</span> (+18%)
          </div>
        </div>

        {/* Right: Recent Events (French translation) */}
        <div className="lg:col-span-4 bg-[#1c202a] border border-[#272d3b] rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white tracking-wide">Événements Récents</h3>
            <button
              onClick={() => setActiveTab('notifications')}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
            >
              Voir tout
            </button>
          </div>

          <div className="space-y-3.5">
            {/* Event 1: Bay service reminder */}
            <div className="flex items-start gap-3 p-2 rounded-xl hover:bg-[#222734] transition-colors">
              <div className="w-9 h-9 rounded-full bg-[#3d242c] flex items-center justify-center text-[#ff758f] flex-shrink-0 mt-0.5">
                <Wrench className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-200">Rappel entretien de piste</span>
                  <span className="text-[10px] text-gray-400">05 min</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                  La révision de la Piste 2 est prévue le 14/07/2026
                </p>
              </div>
            </div>

            {/* Event 2: Customer review */}
            <div className="flex items-start gap-3 p-2 rounded-xl hover:bg-[#222734] transition-colors">
              <div className="w-9 h-9 rounded-full bg-[#322849] flex items-center justify-center text-[#c084fc] flex-shrink-0 mt-0.5">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-200">Avis client satisfait</span>
                  <span className="text-[10px] text-gray-400">15 min</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                  « Le lavage intérieur est propre et très soigné... »
                </p>
              </div>
            </div>

            {/* Event 3: Delivery delay */}
            <div className="flex items-start gap-3 p-2 rounded-xl hover:bg-[#222734] transition-colors">
              <div className="w-9 h-9 rounded-full bg-[#1b3443] flex items-center justify-center text-[#38bdf8] flex-shrink-0 mt-0.5">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-200">Alerte délai de lavage</span>
                  <span className="text-[10px] text-gray-400">45 min</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                  Piste 5 : durée supérieure à la moyenne estimée.
                </p>
              </div>
            </div>

            {/* Event 4: Customer complaint */}
            <div className="flex items-start gap-3 p-2 rounded-xl hover:bg-[#222734] transition-colors">
              <div className="w-9 h-9 rounded-full bg-[#3d3319] flex items-center justify-center text-[#facc15] flex-shrink-0 mt-0.5">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-200">Remarque client</span>
                  <span className="text-[10px] text-gray-400">45 min</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                  Sujet : Séchage des vitres et plastiques
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Quick Actions Menu */}
      <QuickActionsFAB />
    </div>
  );
};
