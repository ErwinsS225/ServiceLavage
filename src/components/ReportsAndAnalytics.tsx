import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  FileText, 
  Download, 
  Printer, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Car, 
  Users,
  Award
} from 'lucide-react';

export const ReportsAndAnalytics: React.FC = () => {
  const { orders, expenses, employees, formatCurrency, currentTenant } = useApp();
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year'>('month');

  // Calculations
  const totalBilled = orders.reduce((sum, o) => sum + o.amount, 0) + 1950;
  const totalCollected = orders
    .filter(o => o.paymentStatus === 'paye')
    .reduce((sum, o) => sum + o.amount, 0) + 1820;
  const totalUnpaid = Math.max(0, totalBilled - totalCollected);
  const totalExpensesUSD = expenses.reduce((sum, e) => sum + e.amount, 0) / 650;
  const netEstimatedProfit = totalCollected - totalExpensesUSD;

  const handleExportCSV = () => {
    const headers = ['Ticket', 'Date', 'Vehicule', 'Plaque', 'Formule', 'Piste', 'Montant', 'Statut', 'Mode'];
    const rows = orders.map(o => [
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
            Distinction stricte entre Chiffre d'Affaires, Encaissements réels, Dépenses et Marge nette
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
            <span>Export CSV / Excel</span>
          </button>

          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white flex items-center gap-2 transition-all shadow-md"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimer</span>
          </button>
        </div>
      </div>

      {/* 4 Financial Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Chiffre d'affaires facturé */}
        <div className="bg-[#1c202a] border border-[#272d3b] rounded-2xl p-5 space-y-2">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
            Chiffre d'Affaires Brut (Facturé)
          </span>
          <div className="text-2xl font-black text-white">
            {formatCurrency(totalBilled)}
          </div>
          <p className="text-[11px] text-gray-400">
            Total des prestations enregistrées
          </p>
        </div>

        {/* Encaissements réels */}
        <div className="bg-[#1c202a] border border-[#272d3b] rounded-2xl p-5 space-y-2">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
            Encaissements Réels (Perçus)
          </span>
          <div className="text-2xl font-black text-emerald-400">
            {formatCurrency(totalCollected)}
          </div>
          <p className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
            <TrendingUp className="w-3.5 h-3.5" />
            Entrées en caisse & Mobile Money
          </p>
        </div>

        {/* Dépenses */}
        <div className="bg-[#1c202a] border border-[#272d3b] rounded-2xl p-5 space-y-2">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
            Dépenses & Consommables
          </span>
          <div className="text-2xl font-black text-rose-400">
            -{formatCurrency(totalExpensesUSD)}
          </div>
          <p className="text-[11px] text-rose-400 flex items-center gap-1 font-medium">
            <TrendingDown className="w-3.5 h-3.5" />
            Shampoings, carburant, eau SODECI
          </p>
        </div>

        {/* Marge / Résultat net estimé */}
        <div className="bg-[#1c202a] border border-[#272d3b] rounded-2xl p-5 space-y-2">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
            Bénéfice Net Opérationnel
          </span>
          <div className="text-2xl font-black text-cyan-400">
            {formatCurrency(netEstimatedProfit)}
          </div>
          <p className="text-[11px] text-gray-400">
            Marge bénéficiaire nette : ~{Math.round((netEstimatedProfit / totalCollected) * 100)}%
          </p>
        </div>
      </div>

      {/* Washer Leaderboard & Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Washer Leaderboard */}
        <div className="lg:col-span-6 bg-[#1c202a] border border-[#272d3b] rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              <span>Classement & Productivité des Laveurs</span>
            </h3>
            <span className="text-xs text-gray-400">Sur la période</span>
          </div>

          <div className="space-y-3">
            {employees.filter(e => e.role === 'laveur').map((emp, idx) => (
              <div
                key={emp.id}
                className="flex items-center justify-between p-3 rounded-xl bg-[#222734] border border-[#2b3243]"
              >
                <div className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                    idx === 0 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-gray-700 text-gray-300'
                  }`}>
                    {idx + 1}
                  </span>
                  <div>
                    <h4 className="font-bold text-white text-xs">{emp.name}</h4>
                    <span className="text-[10px] text-gray-400">Commission : {emp.commissionRate}%</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-extrabold text-white text-xs block">
                    {emp.totalWashesCompleted} véhicules
                  </span>
                  <span className="text-[10px] text-emerald-400 font-bold">
                    {emp.totalCommissionsEarned.toLocaleString('fr-FR')} FCFA gagnés
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Payment Methods Breakdown */}
        <div className="lg:col-span-6 bg-[#1c202a] border border-[#272d3b] rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white">Répartition des Recettes par Mode de Règlement</h3>

          <div className="space-y-3 pt-2">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-bold text-sky-400">Wave Côte d'Ivoire</span>
                <span className="font-bold text-white">42% (980 000 FCFA)</span>
              </div>
              <div className="w-full bg-[#161922] h-2.5 rounded-full overflow-hidden">
                <div className="bg-sky-400 h-full rounded-full" style={{ width: '42%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-bold text-orange-400">Orange Money CI</span>
                <span className="font-bold text-white">28% (650 000 FCFA)</span>
              </div>
              <div className="w-full bg-[#161922] h-2.5 rounded-full overflow-hidden">
                <div className="bg-orange-400 h-full rounded-full" style={{ width: '28%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-bold text-yellow-400">MTN Mobile Money</span>
                <span className="font-bold text-white">18% (420 000 FCFA)</span>
              </div>
              <div className="w-full bg-[#161922] h-2.5 rounded-full overflow-hidden">
                <div className="bg-yellow-400 h-full rounded-full" style={{ width: '18%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-bold text-emerald-400">Espèces en Caisse</span>
                <span className="font-bold text-white">12% (280 000 FCFA)</span>
              </div>
              <div className="w-full bg-[#161922] h-2.5 rounded-full overflow-hidden">
                <div className="bg-emerald-400 h-full rounded-full" style={{ width: '12%' }} />
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 rounded-xl bg-[#222734] border border-[#2b3243] text-xs text-gray-300">
            💡 <strong>Observation stratégique :</strong> 88% des encaissements se font désormais via Mobile Money (Wave, Orange, MTN). Les risques de vol d'espèces en caisse sont réduits au minimum.
          </div>
        </div>
      </div>
    </div>
  );
};
