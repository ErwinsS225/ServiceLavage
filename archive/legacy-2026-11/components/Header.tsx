import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Search, Bell, Plus, Shield, ChevronDown } from 'lucide-react';
import { UserRole } from '../types';

export const Header: React.FC = () => {
  const { 
    searchQuery, 
    setSearchQuery, 
    currency, 
    setCurrency, 
    currentUserRole, 
    setCurrentUserRole,
    setIsNewOrderModalOpen,
    recentEvents,
    setActiveTab,
    currentTenant
  } = useApp();

  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const roles: { id: UserRole; label: string; desc: string }[] = [
    { id: 'proprietaire', label: 'Propriétaire', desc: 'Accès complet & finances' },
    { id: 'gerant', label: 'Gérant Station', desc: 'Gestion opérationnelle & personnel' },
    { id: 'caissier', label: 'Caissier / Accueil', desc: 'Prestations & encaissement' },
    { id: 'laveur', label: 'Laveur', desc: 'Vue des tâches & commissions' },
    { id: 'super_admin', label: 'Super-Admin SaaS', desc: 'Gestion centrale multitenant' },
  ];

  const currentRoleObj = roles.find(r => r.id === currentUserRole) || roles[0];

  return (
    <header className="h-16 px-6 bg-[#16181d] border-b border-[#242832] flex items-center justify-between sticky top-0 z-20 transition-colors">
      {/* Search Input Bar (matching screenshot) */}
      <div className="relative w-96 max-w-md">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-500" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher un véhicule, client, matricule..."
          className="w-full pl-10 pr-4 py-2 bg-[#20242e] border border-transparent focus:border-cyan-500/50 rounded-xl text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all"
        />
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        {/* Local Currency Badge: Exclusively FCFA (XOF) */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#20242e] rounded-xl border border-[#2b313e] text-xs font-bold text-cyan-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Devise : FCFA</span>
        </div>

        {/* Quick New Wash button */}
        <button
          onClick={() => setIsNewOrderModalOpen(true)}
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-xs font-semibold border border-cyan-500/30 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Lavage</span>
        </button>

        {/* Role Switcher Popover */}
        <div className="relative">
          <button
            onClick={() => setShowRoleDropdown(!showRoleDropdown)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#20242e] hover:bg-[#282d3a] border border-[#2c3340] text-xs font-medium text-gray-300 transition-all"
          >
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden lg:inline">{currentRoleObj.label}</span>
            <ChevronDown className="w-3 h-3 text-gray-400" />
          </button>

          {showRoleDropdown && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl bg-[#1d212b] border border-[#2e3544] shadow-2xl p-2 z-50">
              <div className="px-2 py-1 text-[10px] font-semibold uppercase text-gray-400 tracking-wider">
                Simuler un rôle utilisateur
              </div>
              <div className="mt-1 space-y-1">
                {roles.map(r => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setCurrentUserRole(r.id);
                      setShowRoleDropdown(false);
                      if (r.id === 'super_admin') setActiveTab('superadmin');
                    }}
                    className={`w-full text-left p-2 rounded-lg text-xs transition-colors ${
                      currentUserRole === r.id
                        ? 'bg-cyan-500/20 text-cyan-300 font-medium'
                        : 'text-gray-300 hover:bg-[#262c38]'
                    }`}
                  >
                    <div className="font-semibold">{r.label}</div>
                    <div className="text-[10px] text-gray-400">{r.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Notification Bell */}
        <div className="relative">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="w-9 h-9 rounded-xl bg-[#20242e] hover:bg-[#282d3a] flex items-center justify-center text-gray-300 relative transition-all"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl bg-[#1d212b] border border-[#2e3544] shadow-2xl p-3 z-50">
              <div className="flex items-center justify-between pb-2 border-b border-[#282e3b]">
                <h4 className="text-xs font-bold text-white">Événements Récents</h4>
                <span className="text-[10px] text-cyan-400 font-medium">{currentTenant.name}</span>
              </div>
              <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                {recentEvents.map(e => (
                  <div key={e.id} className="p-2 rounded-lg bg-[#242935] text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-200">{e.title}</span>
                      <span className="text-[10px] text-gray-400">{e.timeAgo}</span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">{e.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Avatar (matching the portrait from screenshot) */}
        <div className="flex items-center gap-2 pl-1">
          <div className="relative">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
              alt="User profile"
              className="w-9 h-9 rounded-full object-cover ring-2 ring-[#2e3544]"
            />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[#16181d]" />
          </div>
        </div>
      </div>
    </header>
  );
};
