import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Crown, 
  Check, 
  Layers, 
  Smartphone, 
  ShieldCheck, 
  TrendingUp, 
  Building2, 
  Users, 
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { SUBSCRIPTION_PLANS } from '../data/mockData';

export const SaaSAdminAndSubscriptions: React.FC = () => {
  const { 
    currentTenant, 
    upgradePlan, 
    tenants, 
    currentUserRole, 
    setCurrentUserRole,
    formatCurrency,
    showBanner
  } = useApp();

  const [activeTab, setActiveTab] = useState<'my_plan' | 'super_admin'>('my_plan');
  const [selectedMobilePayment, setSelectedMobilePayment] = useState<'wave' | 'orange' | 'mtn'>('wave');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Super admin metrics
  const totalMRR = tenants.reduce((acc, t) => {
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === t.subscriptionPlanId);
    return acc + (plan?.priceMonthXOF || 5000);
  }, 0);

  const activeTenantsCount = tenants.filter(t => t.subscriptionStatus === 'active').length;
  const trialTenantsCount = tenants.filter(t => t.subscriptionStatus === 'trial').length;

  const handleSimulatePayment = (planId: 'starter' | 'pro' | 'business') => {
    setIsProcessingPayment(true);
    setTimeout(() => {
      upgradePlan(planId);
      setIsProcessingPayment(false);
      showBanner(`Abonnement ${planId.toUpperCase()} réglé avec succès via ${selectedMobilePayment.toUpperCase()} !`, 'success');
    }, 900);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto text-gray-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-400" />
            <span>Abonnements SaaS & Super-Administration CI</span>
          </h2>
          <p className="text-xs text-gray-400">
            Modèle économique récurrent, gestion des quotas et supervision des stations clientes
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex items-center bg-[#202532] p-1 rounded-xl border border-[#2c3343]">
          <button
            onClick={() => setActiveTab('my_plan')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'my_plan' ? 'bg-cyan-500 text-white shadow-sm' : 'text-gray-400 hover:text-white'
            }`}
          >
            Formule de ma Station ({currentTenant.name})
          </button>
          <button
            onClick={() => {
              setActiveTab('super_admin');
              setCurrentUserRole('super_admin');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'super_admin' ? 'bg-cyan-500 text-white shadow-sm' : 'text-gray-400 hover:text-white'
            }`}
          >
            Vue Super-Admin SaaS CI
          </button>
        </div>
      </div>

      {activeTab === 'my_plan' ? (
        <div className="space-y-6">
          {/* Current Plan & Quota Status Card */}
          <div className="p-5 rounded-2xl bg-[#1c202a] border border-[#272d3b] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#262c3a]">
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-semibold">Formule actuelle</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xl font-black text-amber-400 uppercase">
                    Plan {currentTenant.subscriptionPlanId}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Actif
                  </span>
                </div>
              </div>

              <div className="text-xs text-gray-400">
                Période d'essai ou renouvellement : <span className="text-white font-semibold">30 Novembre 2026</span>
              </div>
            </div>

            {/* Quotas Meter */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              <div className="p-3 rounded-xl bg-[#222734] border border-[#2b3343] space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Utilisateurs enregistrés</span>
                  <span className="font-bold text-white">4 / 8</span>
                </div>
                <div className="w-full bg-[#161922] h-2 rounded-full overflow-hidden">
                  <div className="bg-cyan-400 h-full rounded-full" style={{ width: '50%' }} />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#222734] border border-[#2b3343] space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Prestations ce mois</span>
                  <span className="font-bold text-white">342 / 2 500</span>
                </div>
                <div className="w-full bg-[#161922] h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-400 h-full rounded-full" style={{ width: '14%' }} />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#222734] border border-[#2b3343] space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Photos vitrine publique</span>
                  <span className="font-bold text-white">4 / 20</span>
                </div>
                <div className="w-full bg-[#161922] h-2 rounded-full overflow-hidden">
                  <div className="bg-amber-400 h-full rounded-full" style={{ width: '20%' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Pricing Plans Grid (3 Tiers from Prompt) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SUBSCRIPTION_PLANS.map(plan => {
              const isCurrent = currentTenant.subscriptionPlanId === plan.id;
              const isRecommended = plan.id === 'pro';

              return (
                <div
                  key={plan.id}
                  className={`rounded-2xl p-6 flex flex-col justify-between space-y-6 transition-all shadow-lg relative ${
                    isCurrent
                      ? 'bg-[#1e2432] border-2 border-cyan-400 ring-2 ring-cyan-500/20'
                      : 'bg-[#1c202a] border border-[#272d3b] hover:border-gray-500'
                  }`}
                >
                  {isRecommended && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-extrabold uppercase tracking-wider shadow-md">
                      Recommandé
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-black text-white">{plan.name}</h3>
                      {isCurrent && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500 text-white">
                          Actuel
                        </span>
                      )}
                    </div>

                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-3xl font-black text-white">
                        {plan.priceMonthXOF.toLocaleString('fr-FR')}
                      </span>
                      <span className="text-xs font-bold text-gray-400">FCFA / mois</span>
                    </div>

                    <p className="text-xs text-gray-400 mt-1">Par station et par mois</p>

                    <div className="mt-6 space-y-2.5">
                      {plan.features.map((feat, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-gray-300">
                          <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-[#262c3a]">
                    {!isCurrent && (
                      <div className="flex items-center justify-center gap-2 pb-1">
                        <span className="text-[10px] text-gray-400">Régler avec :</span>
                        <div className="flex gap-1.5">
                          {(['wave', 'orange', 'mtn'] as const).map(op => (
                            <button
                              key={op}
                              type="button"
                              onClick={() => setSelectedMobilePayment(op)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all ${
                                selectedMobilePayment === op
                                  ? 'bg-cyan-500 text-white'
                                  : 'bg-[#262c3a] text-gray-400'
                              }`}
                            >
                              {op}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      disabled={isCurrent || isProcessingPayment}
                      onClick={() => handleSimulatePayment(plan.id)}
                      className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-md ${
                        isCurrent
                          ? 'bg-[#272e3d] text-gray-400 cursor-default'
                          : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-cyan-600/20 active:scale-[0.98]'
                      }`}
                    >
                      {isCurrent ? 'Plan Actif' : isProcessingPayment ? 'Paiement en cours...' : `Souscrire avec ${selectedMobilePayment.toUpperCase()}`}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* SUPER-ADMIN VIEW */
        <div className="space-y-6">
          {/* Super-Admin KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="bg-[#1c202a] border border-[#272d3b] rounded-2xl p-5 space-y-2">
              <span className="text-xs text-gray-400 font-semibold uppercase">Revenu Mensuel Récurrent (MRR)</span>
              <div className="text-3xl font-black text-cyan-400">
                {totalMRR.toLocaleString('fr-FR')} FCFA
              </div>
              <p className="text-[11px] text-emerald-400 flex items-center gap-1 font-semibold">
                <TrendingUp className="w-3.5 h-3.5" />
                +24% de croissance ce mois
              </p>
            </div>

            <div className="bg-[#1c202a] border border-[#272d3b] rounded-2xl p-5 space-y-2">
              <span className="text-xs text-gray-400 font-semibold uppercase">Stations Partenaires Actives</span>
              <div className="text-3xl font-black text-white">
                {activeTenantsCount} stations
              </div>
              <p className="text-[11px] text-gray-400">
                Abidjan (Cocody, Marcory, Plateau, Yopougon)
              </p>
            </div>

            <div className="bg-[#1c202a] border border-[#272d3b] rounded-2xl p-5 space-y-2">
              <span className="text-xs text-gray-400 font-semibold uppercase">Stations en Essai Gratuit</span>
              <div className="text-3xl font-black text-amber-400">
                {trialTenantsCount} en test 7 jours
              </div>
              <p className="text-[11px] text-gray-400">
                Taux de conversion vers payant : ~78%
              </p>
            </div>
          </div>

          {/* Tenants Directory Table */}
          <div className="bg-[#1c202a] border border-[#272d3b] rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-white">Toutes les Stations Inscrites en Côte d'Ivoire</h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-gray-400 border-b border-[#29303f] pb-2">
                    <th className="pb-3 font-medium">Nom de la Station</th>
                    <th className="pb-3 font-medium">Commune & Ville</th>
                    <th className="pb-3 font-medium">Contact</th>
                    <th className="pb-3 font-medium text-center">Formule</th>
                    <th className="pb-3 font-medium text-center">Statut</th>
                    <th className="pb-3 font-medium text-right">Cotisation</th>
                    <th className="pb-3 font-medium text-right">Action Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#242a38]">
                  {tenants.map(t => {
                    const plan = SUBSCRIPTION_PLANS.find(p => p.id === t.subscriptionPlanId);
                    return (
                      <tr key={t.id} className="hover:bg-[#222734] transition-colors">
                        <td className="py-3">
                          <span className="font-bold text-white text-xs block">{t.name}</span>
                          <span className="text-[10px] text-gray-400 font-mono">ID: {t.id}</span>
                        </td>

                        <td className="py-3">
                          <span className="font-semibold text-gray-200">{t.commune}</span>
                          <span className="text-[10px] text-gray-400 block">{t.city}</span>
                        </td>

                        <td className="py-3">
                          <span className="text-gray-300 font-mono text-[11px]">{t.phone}</span>
                        </td>

                        <td className="py-3 text-center">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#3b2d54] text-purple-200 uppercase">
                            {t.subscriptionPlanId}
                          </span>
                        </td>

                        <td className="py-3 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            t.subscriptionStatus === 'active' 
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}>
                            {t.subscriptionStatus === 'active' ? 'Abonné' : 'Essai 7j'}
                          </span>
                        </td>

                        <td className="py-3 text-right font-bold text-white">
                          {(plan?.priceMonthXOF || 5000).toLocaleString('fr-FR')} FCFA/m
                        </td>

                        <td className="py-3 text-right">
                          <button
                            onClick={() => showBanner(`Station ${t.name} renouvelée de 30 jours !`)}
                            className="px-2.5 py-1 rounded-lg bg-[#272e3d] hover:bg-[#343d52] text-cyan-300 text-[10px] font-semibold transition-colors"
                          >
                            Prolonger
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
