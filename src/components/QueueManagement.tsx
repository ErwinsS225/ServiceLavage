import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Car, 
  Clock, 
  CheckCircle2, 
  ArrowRight, 
  Receipt, 
  AlertCircle, 
  DollarSign, 
  Filter,
  Plus
} from 'lucide-react';
import { WashStatus } from '../types';

export const QueueManagement: React.FC = () => {
  const { 
    orders, 
    updateOrderStatus, 
    updatePaymentStatus, 
    formatCurrency, 
    setSelectedOrderForTicket,
    setSelectedOrderForDetail,
    setIsNewOrderModalOpen
  } = useApp();

  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const columns: { id: WashStatus; label: string; color: string; count: number }[] = [
    { 
      id: 'en_attente', 
      label: 'En attente', 
      color: 'border-amber-500/50 text-amber-400 bg-amber-500/10',
      count: orders.filter(o => o.status === 'en_attente').length
    },
    { 
      id: 'affecte', 
      label: 'Affecté à la piste', 
      color: 'border-blue-500/50 text-blue-400 bg-blue-500/10',
      count: orders.filter(o => o.status === 'affecte').length
    },
    { 
      id: 'en_cours', 
      label: 'En cours de lavage', 
      color: 'border-cyan-500/50 text-cyan-400 bg-cyan-500/10',
      count: orders.filter(o => o.status === 'en_cours').length
    },
    { 
      id: 'termine', 
      label: 'Terminé / Prêt', 
      color: 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10',
      count: orders.filter(o => o.status === 'termine').length
    },
  ];

  const filteredOrders = orders.filter(o => {
    if (categoryFilter === 'all') return true;
    return o.washCategory.toLowerCase() === categoryFilter.toLowerCase();
  });

  const getNextStatus = (current: WashStatus): WashStatus | null => {
    switch (current) {
      case 'en_attente': return 'affecte';
      case 'affecte': return 'en_cours';
      case 'en_cours': return 'termine';
      default: return null;
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto text-gray-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Car className="w-5 h-5 text-cyan-400" />
            <span>Gestion de la File d'Attente & Pistes</span>
          </h2>
          <p className="text-xs text-gray-400">
            Suivi des véhicules de l'accueil jusqu'à la sortie et encaissement
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Category Filter */}
          <div className="flex items-center gap-1.5 bg-[#202532] px-3 py-1.5 rounded-xl border border-[#2b3242] text-xs">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="bg-transparent text-gray-300 focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-[#202532]">Toutes les formules</option>
              <option value="Shine" className="bg-[#202532]">Shine</option>
              <option value="Gloss" className="bg-[#202532]">Gloss</option>
              <option value="Glint" className="bg-[#202532]">Glint</option>
            </select>
          </div>

          <button
            onClick={() => setIsNewOrderModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-xs flex items-center gap-2 shadow-md shadow-cyan-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nouveau Lavage</span>
          </button>
        </div>
      </div>

      {/* Kanban Board Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {columns.map(col => {
          const colOrders = filteredOrders.filter(o => o.status === col.id);
          return (
            <div
              key={col.id}
              className="bg-[#1a1e27] border border-[#272e3d] rounded-2xl p-4 flex flex-col h-[calc(100vh-230px)] shadow-sm"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#252b39]">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-md text-xs font-bold border ${col.color}`}>
                    {col.label}
                  </span>
                </div>
                <span className="text-xs font-bold text-gray-400">
                  {colOrders.length}
                </span>
              </div>

              {/* Cards List */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {colOrders.length === 0 ? (
                  <div className="text-center py-12 text-xs text-gray-500">
                    Aucun véhicule dans cet état
                  </div>
                ) : (
                  colOrders.map(order => {
                    const nextStatus = getNextStatus(order.status);
                    const isPaid = order.paymentStatus === 'paye';
                    return (
                      <div
                        key={order.id}
                        onClick={() => setSelectedOrderForDetail(order)}
                        className="bg-[#202532] border border-[#2c3343] hover:border-cyan-500/40 rounded-xl p-3.5 space-y-3 transition-all shadow-sm cursor-pointer group"
                      >
                        {/* Vehicle Title & Plate */}
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-bold text-sm text-white">{order.vehicleInfo}</h4>
                            <span className="text-xs font-mono text-cyan-400 font-semibold">
                              {order.plateNumber}
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#282f3f] text-gray-300">
                            {order.ticketNumber}
                          </span>
                        </div>

                        {/* Bay & Formula badges */}
                        <div className="flex items-center gap-2 text-xs">
                          <span className="px-2 py-0.5 rounded-md bg-[#293245] text-gray-300 font-medium">
                            Piste {order.bayArea}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-[#3b2d54] text-purple-200 font-medium">
                            {order.washCategory}
                          </span>
                        </div>

                        {/* Customer & Price */}
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-[#282e3c]">
                          <span className="text-gray-400 truncate max-w-[120px]">
                            {order.customerName || 'Client de passage'}
                          </span>
                          <span className="font-bold text-white">
                            {formatCurrency(order.amount)}
                          </span>
                        </div>

                        {/* Payment & Delay alert */}
                        <div className="flex items-center justify-between text-xs">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              isPaid 
                                ? 'bg-emerald-500/20 text-emerald-400' 
                                : 'bg-amber-500/20 text-amber-400'
                            }`}
                          >
                            {isPaid ? 'Payé' : 'À régler'}
                          </span>

                          {order.isDelayed && (
                            <span className="text-[10px] font-bold text-orange-400 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              <span>Retard</span>
                            </span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-2 border-t border-[#282e3c] gap-2">
                          <button
                            onClick={() => setSelectedOrderForTicket(order)}
                            className="p-1.5 rounded-lg bg-[#282f3e] text-gray-300 hover:text-white hover:bg-[#323b4e] transition-colors"
                            title="Ticket"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                          </button>

                          {!isPaid && (
                            <button
                              onClick={() => updatePaymentStatus(order.id, 'paye')}
                              className="px-2 py-1 rounded-lg bg-emerald-600/30 text-emerald-300 hover:bg-emerald-600/50 text-[10px] font-bold"
                            >
                              Encaisser
                            </button>
                          )}

                          {nextStatus && (
                            <button
                              onClick={() => updateOrderStatus(order.id, nextStatus)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-600/30 text-cyan-300 hover:bg-cyan-600/50 text-[10px] font-bold ml-auto"
                            >
                              <span>Avancer</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
