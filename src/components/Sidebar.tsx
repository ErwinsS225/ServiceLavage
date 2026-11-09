import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Home,
  Car,
  Users,
  CreditCard,
  Package,
  Bell,
  Settings,
  HelpCircle,
  Moon,
  Sun,
  LayoutGrid,
  FileText,
  Sparkles,
  Globe,
  Crown,
  Store,
  PlusCircle,
  Wifi,
  WifiOff,
  RefreshCw,
  Layers,
  ChevronDown,
  Building2,
  Download
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    isDarkMode,
    toggleDarkMode,
    isOfflineMode,
    toggleOfflineMode,
    offlineQueueCount,
    syncOfflineQueue,
    tenants,
    currentTenant,
    setCurrentTenantId,
    setIsNewOrderModalOpen,
    setIsOnboardingOpen,
    orders,
    hasAccess
  } = useApp();

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const activeOrdersCount = orders.filter(o => o.status === 'en_cours' || o.status === 'en_attente').length;

  return (
    <aside className="w-64 flex-shrink-0 flex flex-col justify-between h-screen sticky top-0 bg-[#16181d] text-gray-300 border-r border-[#242832] select-none z-30 transition-colors duration-200">
      {/* Top Header / Logo */}
      <div>
        <div className="p-5 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Droplet Logo matching screenshot */}
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 via-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
                </svg>
              </div>
              <div>
                <span className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                  Clean It
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400 block -mt-1">
                  CI • ERP SaaS
                </span>
              </div>
            </div>
          </div>

          {/* Tenant Switcher dropdown */}
          <div className="mt-4 p-2 rounded-lg bg-[#1e222a] border border-[#2b313d] flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
              <div className="truncate text-left">
                <p className="text-xs font-semibold text-white truncate">{currentTenant.name}</p>
                <p className="text-[10px] text-gray-400 truncate">{currentTenant.commune}, Abidjan</p>
              </div>
            </div>
            <select
              value={currentTenant.id}
              onChange={(e) => setCurrentTenantId(e.target.value)}
              className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
              title="Changer de station"
            >
              {tenants.map(t => (
                <option key={t.id} value={t.id} className="bg-[#1e222a] text-white">
                  {t.name} ({t.commune})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 pointer-events-none flex-shrink-0" />
          </div>

          {/* Quick Action Button: POS / Nouvelle Prestation */}
          <div className="space-y-1.5 mt-3">
            <button
              onClick={() => setIsNewOrderModalOpen(true)}
              className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-md shadow-cyan-600/25 transition-all active:scale-[0.98]"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Nouveau Lavage (POS)</span>
            </button>

            <button
              onClick={() => setIsOnboardingOpen(true)}
              className="w-full py-1.5 px-2.5 rounded-lg bg-[#202532] hover:bg-[#282f3e] text-cyan-400 hover:text-cyan-300 text-[11px] font-semibold border border-cyan-500/20 flex items-center justify-center gap-1.5 transition-all"
              title="Configurer une nouvelle station pas-à-pas"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>+ Onboarding Station (9 ét.)</span>
            </button>
          </div>
        </div>

        {/* Navigation Section */}
        <div className="px-3 py-1 space-y-5 overflow-y-auto max-h-[calc(100vh-320px)] scrollbar-none">
          {/* Main Menu */}
          <div>
            <span className="px-3 text-[11px] font-semibold text-gray-500 tracking-wider uppercase">
              Menu
            </span>
            <div className="mt-2 space-y-1">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${activeTab === 'dashboard'
                  ? 'bg-[#222733] text-white border-l-4 border-cyan-400 font-semibold pl-2'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1e27]'
                  }`}
              >
                <Home className="w-4 h-4 text-cyan-400" />
                <span>Tableau de bord</span>
              </button>

              <button
                onClick={() => setActiveTab('pos')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${activeTab === 'pos'
                  ? 'bg-[#222733] text-white border-l-4 border-cyan-400 font-semibold pl-2'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1e27]'
                  }`}
              >
                <PlusCircle className="w-4 h-4 text-cyan-400" />
                <div className="flex items-center justify-between w-full">
                  <span>Nouvelle Prestation</span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-500/20 text-cyan-400">POS</span>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('queue')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${activeTab === 'queue'
                  ? 'bg-[#222733] text-white border-l-4 border-cyan-400 font-semibold pl-2'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1e27]'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <Car className="w-4 h-4" />
                  <span>File d'attente (Queue)</span>
                </div>
                {activeOrdersCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-cyan-500/20 text-cyan-400">
                    {activeOrdersCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('customers')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${activeTab === 'customers'
                  ? 'bg-[#222733] text-white border-l-4 border-cyan-400 font-semibold pl-2'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1e27]'
                  }`}
              >
                <Users className="w-4 h-4" />
                <span>Clients & Flottes</span>
              </button>

              <button
                onClick={() => setActiveTab('bays')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${activeTab === 'bays'
                  ? 'bg-[#222733] text-white border-l-4 border-cyan-400 font-semibold pl-2'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1e27]'
                  }`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span>Pistes de Lavage</span>
              </button>

              {hasAccess('payments') && (
                <button
                  onClick={() => setActiveTab('payments')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${activeTab === 'payments'
                    ? 'bg-[#222733] text-white border-l-4 border-cyan-400 font-semibold pl-2'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1e27]'
                    }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Caisse & Règlements</span>
                </button>
              )}

              <button
                onClick={() => setActiveTab('inventory')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${activeTab === 'inventory'
                  ? 'bg-[#222733] text-white border-l-4 border-cyan-400 font-semibold pl-2'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1e27]'
                  }`}
              >
                <Package className="w-4 h-4" />
                <span>Stocks & Dépenses</span>
              </button>

              <button
                onClick={() => setActiveTab('catalogue')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${activeTab === 'catalogue'
                  ? 'bg-[#222733] text-white border-l-4 border-cyan-400 font-semibold pl-2'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1e27]'
                  }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>Catalogue & Tarifs</span>
              </button>

              <button
                onClick={() => setActiveTab('staff')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${activeTab === 'staff'
                  ? 'bg-[#222733] text-white border-l-4 border-cyan-400 font-semibold pl-2'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1e27]'
                  }`}
              >
                <Users className="w-4 h-4" />
                <span>Personnel & Commissions</span>
              </button>

              {hasAccess('reports') && (
                <button
                  onClick={() => setActiveTab('reports')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${activeTab === 'reports'
                    ? 'bg-[#222733] text-white border-l-4 border-cyan-400 font-semibold pl-2'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1e27]'}`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Rapports & Audit</span>
                </button>
              )}

              <button
                onClick={() => setActiveTab('notifications')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${activeTab === 'notifications'
                  ? 'bg-[#222733] text-white border-l-4 border-cyan-400 font-semibold pl-2'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1e27]'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <Bell className="w-4 h-4" />
                  <span>Notifications</span>
                </div>
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
              </button>
            </div>
          </div>

          {/* Commercial & SaaS Spaces */}
          <div>
            <span className="px-3 text-[11px] font-semibold text-gray-500 tracking-wider uppercase">
              Espaces Connectés
            </span>
            <div className="mt-2 space-y-1">
              <button
                onClick={() => setActiveTab('showcase')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${activeTab === 'showcase'
                  ? 'bg-[#222733] text-cyan-300 border-l-4 border-cyan-400 font-semibold pl-2'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1e27]'
                  }`}
              >
                <Globe className="w-4 h-4 text-emerald-400" />
                <div className="text-left">
                  <span>Vitrine Publique Web</span>
                  <span className="block text-[9px] text-emerald-400 font-normal">Page Commerciale</span>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('subscriptions')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${activeTab === 'subscriptions'
                  ? 'bg-[#222733] text-amber-300 border-l-4 border-amber-400 font-semibold pl-2'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1e27]'
                  }`}
              >
                <Crown className="w-4 h-4 text-amber-400" />
                <div className="text-left">
                  <span>Abonnement SaaS</span>
                  <span className="block text-[9px] text-amber-400 font-normal">{currentTenant.subscriptionPlanId.toUpperCase()}</span>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('marketplace')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${activeTab === 'marketplace'
                  ? 'bg-[#222733] text-purple-300 border-l-4 border-purple-400 font-semibold pl-2'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1e27]'
                  }`}
              >
                <Store className="w-4 h-4 text-purple-400" />
                <div className="text-left">
                  <span>Marketplace CI</span>
                  <span className="block text-[9px] text-purple-400 font-normal">Phase 2</span>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('superadmin')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${activeTab === 'superadmin'
                  ? 'bg-[#222733] text-sky-300 border-l-4 border-sky-400 font-semibold pl-2'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1e27]'
                  }`}
              >
                <Layers className="w-4 h-4 text-sky-400" />
                <span>Super-Admin SaaS</span>
              </button>
            </div>
          </div>

          {/* Support */}
          <div>
            <span className="px-3 text-[11px] font-semibold text-gray-500 tracking-wider uppercase">
              Support
            </span>
            <div className="mt-2 space-y-1">
              <button
                onClick={() => setActiveTab('settings')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${activeTab === 'settings'
                  ? 'bg-[#222733] text-white border-l-4 border-cyan-400 font-semibold pl-2'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1e27]'
                  }`}
              >
                <Settings className="w-4 h-4" />
                <span>Paramètres Station</span>
              </button>

              <button
                onClick={() => setActiveTab('help')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${activeTab === 'help'
                  ? 'bg-[#222733] text-white border-l-4 border-cyan-400 font-semibold pl-2'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1e27]'
                  }`}
              >
                <HelpCircle className="w-4 h-4" />
                <span>Guide & Aide CI</span>
              </button>

              {hasAccess('export_data') && (
                <button
                  onClick={() => setIsExportModalOpen(true)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-gray-200 hover:bg-[#1a1e27] transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Exporter les données</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Controls: Offline test toggle & Dark Mode switch (matching reference image!) */}
      <div className="p-4 border-t border-[#242832] bg-[#14161b] space-y-3">
        {/* Offline local sync badge */}
        <div className="p-2.5 rounded-xl bg-[#1b1f28] border border-[#272d3b] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            {isOfflineMode ? (
              <WifiOff className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <div className="text-left">
              <span className="font-medium text-gray-300 text-[11px] block">
                {isOfflineMode ? 'Hors-ligne (Local)' : 'Connecté Cloud'}
              </span>
              {offlineQueueCount > 0 && (
                <span className="text-[10px] text-amber-400">
                  {offlineQueueCount} en attente
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {offlineQueueCount > 0 && (
              <button
                onClick={syncOfflineQueue}
                className="p-1 rounded bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 text-[10px]"
                title="Synchroniser"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={toggleOfflineMode}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${isOfflineMode
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'bg-[#262c38] text-gray-400 hover:text-white'
                }`}
            >
              {isOfflineMode ? 'Actif' : 'Simuler'}
            </button>
          </div>
        </div>

        {/* Dark Mode Toggle Switch (Exact match from screenshot) */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5 text-xs font-medium text-gray-400">
            {isDarkMode ? <Moon className="w-4 h-4 text-cyan-400" /> : <Sun className="w-4 h-4 text-amber-400" />}
            <span>Mode Sombre</span>
          </div>

          {/* Toggle Switch */}
          <button
            onClick={toggleDarkMode}
            type="button"
            className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out ${isDarkMode ? 'bg-emerald-500' : 'bg-gray-600'
              }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${isDarkMode ? 'translate-x-5' : 'translate-x-0'
                }`}
            />
          </button>
        </div>
      </div>
    </aside>
  );
};