import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { cardVariants, staggeredChildren } from '../components/ui/AnimatedPanel';
import {
  Car,
  CheckCircle2,
  LayoutGrid,
  CreditCard
} from 'lucide-react';
import { QuickActionsFAB } from './QuickActionsFAB';
import { StatCard } from './dashboard/StatCard';
import { InteractiveWidget } from './dashboard/InteractiveWidget';
import { WashDetailsTable } from './dashboard/WashDetailsTable';
import { WashBaysGrid } from './dashboard/WashBaysGrid';

export const Dashboard: React.FC = () => {
  const {
    orders,
    bays,
    formatCurrency,
    setSelectedOrderForTicket,
    setSelectedOrderForDetail,
    setActiveTab,
    updatePaymentStatus,
  } = useApp();

  const [bayFilter, setBayFilter] = useState<'operational' | 'out_of_service' | 'all'>('operational');

  // Filter bays based on tab
  const filteredBays = useMemo(() => bays.filter(b => {
    if (bayFilter === 'all') return true;
    return b.status === bayFilter;
  }), [bays, bayFilter]);

  // Calculate live metric counts
  const ongoingWashes = useMemo(() => orders.filter(o => o.status === 'en_cours').length, [orders]);
  const inOrderCount = useMemo(() => orders.filter(o => o.status === 'en_attente').length, [orders]);
  const completedCount = useMemo(() => orders.filter(o => o.status === 'termine').length, [orders]);
  const operationalBaysCount = useMemo(() => bays.filter(b => b.status === 'operational').length, [bays]);

  const totalRevenueNumber = useMemo(() => orders
    .filter(o => o.paymentStatus === 'paye')
    .reduce((acc, curr) => acc + curr.paidAmount, 0), [orders]);

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
      {/* 1. TOP STATS ROW */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={staggeredChildren}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
      >
        <motion.div variants={cardVariants} whileHover="hover" whileTap="tap">
          <StatCard
            title="Lavages en cours"
            value={String(ongoingWashes).padStart(2, '0')}
            icon={<Car className="w-5 h-5" />}
            percentageChange={6}
            timeframe="hier"
            onClick={() => setActiveTab('queue')}
            colorClass="text-[#ff758f]"
            iconBgClass="bg-[#3d242c]"
          />
        </motion.div>
        <motion.div variants={cardVariants} whileHover="hover" whileTap="tap">
          <StatCard
            title="Tickets en attente"
            value={String(inOrderCount).padStart(2, '0')}
            icon={<Car className="w-5 h-5" />}
            percentageChange={6}
            timeframe="hier"
            onClick={() => setActiveTab('queue')}
            colorClass="text-[#38bdf8]"
            iconBgClass="bg-[#1b3443]"
          />
        </motion.div>
        <motion.div variants={cardVariants} whileHover="hover" whileTap="tap">
          <StatCard
            title="Lavages terminés"
            value={completedCount.toString()}
            icon={<CheckCircle2 className="w-5 h-5" />}
            percentageChange={6}
            timeframe="hier"
            onClick={() => setActiveTab('reports')}
            colorClass="text-[#4ade80]"
            iconBgClass="bg-[#183a2b]"
          />
        </motion.div>
        <motion.div variants={cardVariants} whileHover="hover" whileTap="tap">
          <StatCard
            title="Recettes du Jour"
            value={formatCurrency(totalRevenueNumber)}
            icon={<span className="text-xs font-black">CFA</span>}
            percentageChange={6}
            timeframe="hier"
            onClick={() => setActiveTab('payments')}
            colorClass="text-[#facc15]"
            iconBgClass="bg-[#3d3319]"
          />
        </motion.div>
      </motion.div>

      {/* 1.5 INTERACTIVE SUMMARY WIDGETS */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={staggeredChildren}
        className="grid grid-cols-1 md:grid-cols-3 gap-5"
      >
        <motion.div variants={cardVariants} whileHover="hover" whileTap="tap">
          <InteractiveWidget
            title="Recettes du Jour"
            value={formatCurrency(totalRevenueNumber)}
            subtitle="Wave CI : 58% • Orange : 24% • MTN : 10% • Espèces : 8%"
            icon={<CreditCard className="w-4 h-4" />}
            badgeText="+14% cette semaine"
            badgeType="positive"
            onClick={() => setActiveTab('payments')}
            colorClass="text-cyan-400"
            hoverColorClass="hover:border-cyan-400/60"
            borderColorClass="border-[#2b3548]"
            buttonText="Accéder au Module Caisse & Règlements"
          />
        </motion.div>
        <motion.div variants={cardVariants} whileHover="hover" whileTap="tap">
          <InteractiveWidget
            title="Pistes de Lavage Actives"
            value={`${operationalBaysCount} / ${bays.length} Pistes en Service`}
            subtitle="Pression d'eau optimale • 8 karchers opérationnels"
            icon={<LayoutGrid className="w-4 h-4" />}
            badgeText="100% Opérationnel"
            badgeType="positive"
            onClick={() => setActiveTab('bays')}
            colorClass="text-emerald-400"
            hoverColorClass="hover:border-emerald-400/60"
            borderColorClass="border-[#2b3d36]"
            buttonText="Superviser les 8 Pistes (Wash Bays)"
          />
        </motion.div>
        <motion.div variants={cardVariants} whileHover="hover" whileTap="tap">
          <InteractiveWidget
            title="Tickets en Attente"
            value={`${inOrderCount} Véhicules en File`}
            subtitle={`${ongoingWashes} lavages en cours • 6 laveurs affectés`}
            icon={<Car className="w-4 h-4" />}
            badgeText="Temps moy. 11 min"
            badgeType="neutral"
            onClick={() => setActiveTab('queue')}
            colorClass="text-amber-400"
            hoverColorClass="hover:border-amber-400/60"
            borderColorClass="border-[#423324]"
            buttonText="Gérer la File d'Attente (Kanban)"
          />
        </motion.div>
      </motion.div>

      {/* 2. MIDDLE SECTION: Wash Details Table (Left) & Wash Bay Stations (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <motion.div
          variants={cardVariants}
          whileHover="hover"
          whileTap="tap"
          className="lg:col-span-7 bg-[#1c202a] border border-[#272d3b] rounded-2xl p-5 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white tracking-wide">Détails des Lavages en Cours</h3>
            <button
              onClick={() => setActiveTab('queue')}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
            >
              Gérer la file d'attente →
            </button>
          </div>
          <WashDetailsTable
            orders={orders}
            formatCurrency={formatCurrency}
            setSelectedOrderForTicket={setSelectedOrderForTicket}
            setSelectedOrderForDetail={setSelectedOrderForDetail}
            updatePaymentStatus={updatePaymentStatus}
            getCategoryBadge={getCategoryBadge}
          />
        </motion.div>

        <motion.div
          variants={cardVariants}
          whileHover="hover"
          whileTap="tap"
          className="lg:col-span-5 bg-[#1c202a] border border-[#272d3b] rounded-2xl p-5 shadow-sm flex flex-col justify-between"
        >
          <WashBaysGrid
            bays={filteredBays}
            bayFilter={bayFilter}
            setBayFilter={setBayFilter}
          />
        </motion.div>
      </div>

      {/* Floating Quick Actions Menu */}
      <QuickActionsFAB />
    </div>
  );
};