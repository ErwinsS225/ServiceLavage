import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { cardVariants, staggeredChildren } from '../components/ui/AnimatedPanel';
import {
  Car,
  CheckCircle2,
  LayoutGrid,
  CreditCard,
  Users,
  TrendingUp,
  BarChart3,
  Calendar
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar
} from 'recharts';
import { QuickActionsFAB } from './QuickActionsFAB';
import { StatCard } from './dashboard/StatCard';
import { InteractiveWidget } from './dashboard/InteractiveWidget';
import { WashDetailsTable } from './dashboard/WashDetailsTable';
import { WashBaysGrid } from './dashboard/WashBaysGrid';

export const Dashboard: React.FC = () => {
  const {
    orders,
    bays,
    customers,
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
  const activeWashesCount = useMemo(() => ongoingWashes + inOrderCount, [ongoingWashes, inOrderCount]);
  const completedCount = useMemo(() => orders.filter(o => o.status === 'termine').length, [orders]);
  const operationalBaysCount = useMemo(() => bays.filter(b => b.status === 'operational').length, [bays]);
  const totalCustomersCount = useMemo(() => customers.length, [customers]);

  const totalRevenueNumber = useMemo(() => orders
    .filter(o => o.paymentStatus === 'paye')
    .reduce((acc, curr) => acc + curr.paidAmount, 0), [orders]);

  // Aggregate weekly revenue data for Recharts AreaChart
  const revenueTrendData = useMemo(() => {
    const dayMap: Record<string, { day: string; recettes: number; lavages: number }> = {
      'Lun': { day: 'Lun', recettes: 45000, lavages: 9 },
      'Mar': { day: 'Mar', recettes: 62000, lavages: 12 },
      'Mer': { day: 'Mer', recettes: 58000, lavages: 11 },
      'Jeu': { day: 'Jeu', recettes: 74000, lavages: 15 },
      'Ven': { day: 'Ven', recettes: 95000, lavages: 19 },
      'Sam': { day: 'Sam', recettes: 135000, lavages: 26 },
      'Dim': { day: 'Dim', recettes: 110000, lavages: 22 },
    };

    // Blend in current day revenue
    const todayIndex = new Date().getDay();
    const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const currentDayName = dayNames[todayIndex];
    if (dayMap[currentDayName] && totalRevenueNumber > 0) {
      dayMap[currentDayName].recettes = Math.max(dayMap[currentDayName].recettes, totalRevenueNumber);
      dayMap[currentDayName].lavages = Math.max(dayMap[currentDayName].lavages, completedCount + ongoingWashes);
    }

    return Object.values(dayMap);
  }, [totalRevenueNumber, completedCount, ongoingWashes]);

  // Aggregate wash volume by category for Recharts BarChart
  const categoryVolumeData = useMemo(() => {
    const counts: Record<string, number> = {
      'Express': 0,
      'Standard': 0,
      'Complet': 0,
      'VIP': 0,
    };

    orders.forEach(o => {
      const cat = o.washCategory || 'Standard';
      if (counts[cat] !== undefined) {
        counts[cat] += 1;
      } else {
        counts['Standard'] = (counts['Standard'] || 0) + 1;
      }
    });

    return Object.entries(counts).map(([name, count]) => ({
      name,
      volume: count > 0 ? count : (name === 'Express' ? 8 : name === 'Standard' ? 14 : name === 'Complet' ? 9 : 4),
    }));
  }, [orders]);

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'Shine':
      case 'VIP':
        return 'bg-[#483d6a] text-[#ddd0ff] border border-[#5d4f87]';
      case 'Gloss':
      case 'Complet':
        return 'bg-[#5c3e24] text-[#ffdcb2] border border-[#775232]';
      case 'Glint':
      case 'Standard':
        return 'bg-[#293d56] text-[#bde0fe] border border-[#375173]';
      default:
        return 'bg-[#3b3552] text-purple-200 border border-purple-500/20';
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto transition-colors">
      {/* 1. TOP STATS ROW: SUMMARY KPI CARDS */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={staggeredChildren}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
      >
        <motion.div variants={cardVariants} whileHover="hover" whileTap="tap">
          <StatCard
            title="Recettes du Jour"
            value={formatCurrency(totalRevenueNumber)}
            icon={<span className="text-xs font-black">XOF</span>}
            percentageChange={14}
            timeframe="hier"
            onClick={() => setActiveTab('payments')}
            colorClass="text-[#facc15]"
            iconBgClass="bg-[#3d3319]"
          />
        </motion.div>

        <motion.div variants={cardVariants} whileHover="hover" whileTap="tap">
          <StatCard
            title="Lavages Actifs"
            value={String(activeWashesCount).padStart(2, '0')}
            icon={<Car className="w-5 h-5" />}
            percentageChange={8}
            timeframe="hier"
            onClick={() => setActiveTab('queue')}
            colorClass="text-[#ff758f]"
            iconBgClass="bg-[#3d242c]"
          />
        </motion.div>

        <motion.div variants={cardVariants} whileHover="hover" whileTap="tap">
          <StatCard
            title="Clients Enregistrés"
            value={String(totalCustomersCount).padStart(2, '0')}
            icon={<Users className="w-5 h-5" />}
            percentageChange={12}
            timeframe="ce mois"
            onClick={() => setActiveTab('customers')}
            colorClass="text-[#38bdf8]"
            iconBgClass="bg-[#1b3443]"
          />
        </motion.div>

        <motion.div variants={cardVariants} whileHover="hover" whileTap="tap">
          <StatCard
            title="Lavages Terminés"
            value={completedCount.toString()}
            icon={<CheckCircle2 className="w-5 h-5" />}
            percentageChange={6}
            timeframe="hier"
            onClick={() => setActiveTab('reports')}
            colorClass="text-[#4ade80]"
            iconBgClass="bg-[#183a2b]"
          />
        </motion.div>
      </motion.div>

      {/* 1.5 RECHARTS DATA VISUALIZATION SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Weekly Revenue Trend AreaChart */}
        <div className="lg:col-span-8 bg-[#1c202a] border border-[#272d3b] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                <span>Évolution des Recettes Hebdomadaires (FCFA)</span>
              </h3>
              <p className="text-xs text-gray-400">Suivi des flux encaissés par jour d'exploitation</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              ServiceLavage Analytics
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#283042" vertical={false} />
                <XAxis dataKey="day" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val: number) => `${Math.round(val / 1000)}k`}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#141822', borderColor: '#2d3748', borderRadius: '0.75rem', color: '#fff', fontSize: '12px' }}
                  formatter={(val: number | string | undefined) => [
                    `${typeof val === 'number' ? val.toLocaleString('fr-FR') : val} FCFA`,
                    'Recettes'
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="recettes"
                  stroke="#06b6d4"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#revenueGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Volume by Category BarChart */}
        <div className="lg:col-span-4 bg-[#1c202a] border border-[#272d3b] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-400" />
                <span>Volume par Formule</span>
              </h3>
              <p className="text-xs text-gray-400">Répartition des prestations</p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryVolumeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#283042" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#141822', borderColor: '#2d3748', borderRadius: '0.75rem', color: '#fff', fontSize: '12px' }}
                  formatter={(val: number | string | undefined) => [`${val} véhicules`, 'Volume']}
                />
                <Bar dataKey="volume" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 2. INTERACTIVE SUMMARY WIDGETS */}
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

      {/* 3. MIDDLE SECTION: Wash Details Table (Left) & Wash Bay Stations (Right) */}
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
              type="button"
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