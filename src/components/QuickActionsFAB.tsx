import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Zap, 
  X, 
  Car, 
  Package, 
  CreditCard, 
  RefreshCw, 
  Users, 
  Building2, 
  Sparkles,
  Plus,
  ArrowRight,
  TrendingUp,
  Share2
} from 'lucide-react';

export const QuickActionsFAB: React.FC = () => {
  const { 
    setIsNewOrderModalOpen, 
    setActiveTab, 
    setIsOnboardingOpen, 
    bays, 
    refreshBay, 
    showBanner,
    inventory,
    updateInventoryStock,
    currentTenant
  } = useApp();

  const [isOpen, setIsOpen] = useState(false);
  const [showQuickStockModal, setShowQuickStockModal] = useState(false);
  const [selectedStockId, setSelectedStockId] = useState<string>(inventory[0]?.id || '');
  const [addQuantity, setAddQuantity] = useState<string>('10');

  // Keyboard shortcut listener (Escape to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleRefreshAllBays = () => {
    bays.forEach(b => refreshBay(b.id));
    showBanner('Toutes les 8 pistes de lavage ont été actualisées !', 'success');
    setIsOpen(false);
  };

  const handleQuickRestockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const item = inventory.find(i => i.id === selectedStockId);
    if (item) {
      const qty = Number(addQuantity) || 10;
      updateInventoryStock(item.id, item.quantity + qty);
      showBanner(`Stock de "${item.name}" augmenté de +${qty} ${item.unit} !`, 'success');
      setShowQuickStockModal(false);
      setIsOpen(false);
    }
  };

  const quickActions = [
    {
      id: 'new_wash',
      title: 'Register New Wash',
      desc: 'Enregistrer un véhicule & ticket POS',
      icon: Car,
      color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40 hover:bg-cyan-500/30',
      badge: 'Action #1',
      action: () => {
        setIsNewOrderModalOpen(true);
        setIsOpen(false);
      }
    },
    {
      id: 'update_stock',
      title: 'Update Stock & Products',
      desc: 'Réapprovisionner shampoings & cires en 1 clic',
      icon: Package,
      color: 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30',
      badge: 'Stocks',
      action: () => {
        setShowQuickStockModal(true);
      }
    },
    {
      id: 'close_cash',
      title: 'Cash Register & Payments',
      desc: 'Point de caisse Wave, MoMo & espèces',
      icon: CreditCard,
      color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30',
      badge: 'Caisse',
      action: () => {
        setActiveTab('payments');
        setIsOpen(false);
      }
    },
    {
      id: 'refresh_bays',
      title: 'Refresh All 8 Wash Bays',
      desc: 'Synchroniser l\'état en direct de toutes les pistes',
      icon: RefreshCw,
      color: 'bg-blue-500/20 text-blue-400 border-blue-500/40 hover:bg-blue-500/30',
      badge: 'Pistes',
      action: handleRefreshAllBays
    },
    {
      id: 'customer_lookup',
      title: 'Customer & Fleet Directory',
      desc: 'Consulter un client ou envoyer message WhatsApp',
      icon: Users,
      color: 'bg-purple-500/20 text-purple-400 border-purple-500/40 hover:bg-purple-500/30',
      badge: 'Clients',
      action: () => {
        setActiveTab('customers');
        setIsOpen(false);
      }
    },
    {
      id: 'onboarding_wizard',
      title: 'Station Setup Wizard (9 steps)',
      desc: 'Assistant de configuration complète de la station',
      icon: Building2,
      color: 'bg-sky-500/20 text-sky-400 border-sky-500/40 hover:bg-sky-500/30',
      badge: 'Setup',
      action: () => {
        setIsOnboardingOpen(true);
        setIsOpen(false);
      }
    }
  ];

  return (
    <>
      {/* Floating Action Button (FAB) anchored bottom-right */}
      <div className="fixed bottom-7 right-7 z-40 select-none">
        {/* Backdrop overlay when open */}
        {isOpen && (
          <div 
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs -z-10 animate-in fade-in duration-200"
          />
        )}

        {/* Speed-Dial Menu Items (Stacked vertically above FAB) */}
        {isOpen && (
          <div className="mb-3.5 space-y-2.5 flex flex-col items-end animate-in slide-in-from-bottom-5 fade-in duration-200">
            {/* Header label */}
            <div className="px-3 py-1.5 rounded-xl bg-[#191c24] border border-[#2e3544] text-[11px] font-bold text-gray-300 shadow-xl flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Quick Actions • Tâches Fréquentes</span>
            </div>

            {quickActions.map(act => {
              const Icon = act.icon;
              return (
                <button
                  key={act.id}
                  onClick={act.action}
                  className="group flex items-center gap-3 p-2.5 pr-4 rounded-2xl bg-[#1d212b]/95 hover:bg-[#252b38] border border-[#2e3646] hover:border-cyan-400/50 shadow-2xl backdrop-blur-md text-left transition-all active:scale-[0.98] w-72"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border flex-shrink-0 transition-transform group-hover:scale-105 ${act.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors truncate">
                        {act.title}
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#282f3d] text-gray-400 ml-1">
                        {act.badge}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 truncate mt-0.5">
                      {act.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Primary Toggle Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`relative group flex items-center gap-2.5 px-4 py-3 rounded-full font-bold text-xs text-white shadow-2xl transition-all duration-300 active:scale-95 ${
            isOpen
              ? 'bg-[#252b38] border border-[#3b4457] text-gray-200'
              : 'bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-cyan-500/35 ring-4 ring-cyan-500/20'
          }`}
          title="Quick Actions (Actions Rapides)"
          aria-label="Quick Actions"
        >
          {isOpen ? (
            <>
              <X className="w-5 h-5 text-gray-300 group-hover:rotate-90 transition-transform" />
              <span className="tracking-wide">Fermer</span>
            </>
          ) : (
            <>
              <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-white fill-white" />
              </div>
              <span className="tracking-wide font-extrabold pr-0.5">Quick Actions</span>
            </>
          )}

          {/* Pulsing indicator when closed */}
          {!isOpen && (
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-cyan-400 border-2 border-[#16181d]" />
            </span>
          )}
        </button>
      </div>

      {/* Fast In-Place Modal: "Update Stock" */}
      {showQuickStockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#1a1e27] border border-[#2b3242] rounded-2xl w-full max-w-md p-5 space-y-4 text-gray-200 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-[#282f3e]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Mise à jour Rapide du Stock</h3>
                  <span className="text-[10px] text-gray-400">Réapprovisionnement instantané</span>
                </div>
              </div>
              <button 
                onClick={() => setShowQuickStockModal(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg bg-[#242a38]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickRestockSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Sélectionner le Produit / Consommable
                </label>
                <select
                  value={selectedStockId}
                  onChange={e => setSelectedStockId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  {inventory.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} (Actuel : {item.quantity} {item.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Quantité à Ajouter au Stock
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    required
                    min="1"
                    value={addQuantity}
                    onChange={e => setAddQuantity(e.target.value)}
                    className="flex-1 px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-sm font-bold text-white focus:outline-none focus:border-cyan-500"
                  />
                  <div className="flex items-center gap-1">
                    {[5, 10, 25, 50].map(q => (
                      <button
                        type="button"
                        key={q}
                        onClick={() => setAddQuantity(String(q))}
                        className={`px-2.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                          addQuantity === String(q)
                            ? 'bg-amber-500 text-black border-amber-400 font-extrabold'
                            : 'bg-[#222734] border-[#2c3343] text-gray-300 hover:text-white'
                        }`}
                      >
                        +{q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuickStockModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#222734] text-xs font-semibold text-gray-300 hover:text-white"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-xs font-bold text-black shadow-md transition-all active:scale-[0.98]"
                >
                  Mettre à Jour le Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
