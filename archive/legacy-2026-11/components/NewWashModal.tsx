import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, Car, User, Sparkles, Check, DollarSign } from 'lucide-react';
import { VehicleCategory, PaymentMethod } from '../types';
import confetti from 'canvas-confetti';

export const NewWashModal: React.FC = () => {
  const { 
    isNewOrderModalOpen, 
    setIsNewOrderModalOpen, 
    services, 
    bays, 
    employees, 
    addOrder, 
    formatCurrency,
    setSelectedOrderForTicket,
    customers
  } = useApp();

  const [vehicleInfo, setVehicleInfo] = useState('Toyota RAV4');
  const [plateNumber, setPlateNumber] = useState('8412-HJ-01');
  const [vehicleCategory, setVehicleCategory] = useState<VehicleCategory>('suv_4x4');
  
  const [customerName, setCustomerName] = useState('Kouadio Jean');
  const [customerPhone, setCustomerPhone] = useState('+225 07 12 34 56 78');
  
  const [selectedServiceId, setSelectedServiceId] = useState<string>(services[0]?.id || '');
  const [selectedBay, setSelectedBay] = useState<number>(1);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>(['emp-1', 'emp-2']);
  
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('wave');
  const [isPaidImmediately, setIsPaidImmediately] = useState(true);
  const [discountPercent, setDiscountPercent] = useState(0);

  if (!isNewOrderModalOpen) return null;

  const currentService = services.find(s => s.id === selectedServiceId) || services[0];
  
  // Calculate price with vehicle category override if available
  let basePrice = currentService?.basePrice || 60;
  if (currentService?.categoryPrices && currentService.categoryPrices[vehicleCategory]) {
    basePrice = currentService.categoryPrices[vehicleCategory]!;
  }
  
  const discountAmount = (basePrice * discountPercent) / 100;
  const finalPrice = Math.max(0, basePrice - discountAmount);

  const vehicleCategories: { id: VehicleCategory; label: string; icon: string }[] = [
    { id: 'particulier', label: 'Particulier', icon: '🚗' },
    { id: 'berline', label: 'Berline', icon: '🚘' },
    { id: 'suv_4x4', label: '4x4 & SUV', icon: '🚙' },
    { id: 'pickup', label: 'Pick-up', icon: '🛻' },
    { id: 'taxi_communal', label: 'Wôrô-wôrô', icon: '🚕' },
    { id: 'taxi_classique', label: 'Taxi Compteur', icon: '🚖' },
    { id: 'minibus', label: 'Gbaka / Minibus', icon: '🚐' },
    { id: 'moto', label: 'Moto', icon: '🏍️' },
    { id: 'gros_camion', label: 'Camion', icon: '🚛' },
  ];

  const handleStaffToggle = (staffId: string) => {
    setSelectedStaffIds(prev => 
      prev.includes(staffId) 
        ? prev.filter(id => id !== staffId)
        : [...prev, staffId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const createdOrder = addOrder({
      tenantId: 'tenant-1',
      vehicleInfo,
      plateNumber,
      vehicleCategory,
      customerName,
      customerPhone,
      washCategory: currentService.category,
      serviceIds: [currentService.id],
      serviceNames: [currentService.name],
      bayArea: selectedBay,
      status: 'en_cours',
      paymentStatus: isPaidImmediately ? 'paye' : 'non_paye',
      paymentMethod: isPaidImmediately ? paymentMethod : undefined,
      amount: finalPrice,
      discount: discountAmount,
      paidAmount: isPaidImmediately ? finalPrice : 0,
      assignedStaffIds: selectedStaffIds,
    });

    // Trigger celebration confetti
    try {
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {
      // ignore in test environments
    }

    setIsNewOrderModalOpen(false);
    setSelectedOrderForTicket(createdOrder);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#1a1e27] border border-[#2b3242] rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl text-gray-200">
        {/* Modal Header */}
        <div className="p-5 border-b border-[#272e3d] flex items-center justify-between sticky top-0 bg-[#1a1e27] z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Nouvelle Prestation Lavage (POS)</h3>
              <p className="text-xs text-gray-400">Enregistrement rapide et attribution de piste</p>
            </div>
          </div>
          <button
            onClick={() => setIsNewOrderModalOpen(false)}
            className="p-1.5 rounded-lg bg-[#242a38] text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* 1. Catégorie de véhicule */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-2">
              Type de Véhicule (Catégories CI)
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {vehicleCategories.map(cat => (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => setVehicleCategory(cat.id)}
                  className={`p-2 rounded-xl text-left border text-xs transition-all flex items-center gap-2 ${
                    vehicleCategory === cat.id
                      ? 'bg-cyan-500/20 border-cyan-400 text-white font-semibold'
                      : 'bg-[#202532] border-[#2c3343] text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <span className="text-base">{cat.icon}</span>
                  <span className="truncate">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Infos Véhicule & Immatriculation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Marque & Modèle
              </label>
              <input
                type="text"
                required
                value={vehicleInfo}
                onChange={e => setVehicleInfo(e.target.value)}
                placeholder="ex: Toyota RAV4, Mazda CX-5"
                className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Immatriculation (Plaque)
              </label>
              <input
                type="text"
                required
                value={plateNumber}
                onChange={e => setPlateNumber(e.target.value)}
                placeholder="ex: 8412-HJ-01 ou Reg. CLA-132"
                className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white uppercase font-mono placeholder-gray-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* 3. Client */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-[#252b39]">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-cyan-400" />
                <span>Nom du Client (ou passage)</span>
              </label>
              <input
                type="text"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="Nom du client..."
                className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Téléphone (pour reçu WhatsApp)
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                placeholder="+225 07..."
                className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* 4. Formule de lavage */}
          <div className="pt-1 border-t border-[#252b39]">
            <label className="block text-xs font-semibold text-gray-300 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Choix de la Formule</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {services.slice(0, 3).map(srv => {
                const isSelected = selectedServiceId === srv.id;
                let srvPrice = srv.basePrice;
                if (srv.categoryPrices && srv.categoryPrices[vehicleCategory]) {
                  srvPrice = srv.categoryPrices[vehicleCategory]!;
                }
                return (
                  <div
                    key={srv.id}
                    onClick={() => setSelectedServiceId(srv.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[#232938] border-cyan-400 shadow-md ring-1 ring-cyan-500/30'
                        : 'bg-[#202532] border-[#2b3242] hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{srv.category}</span>
                      <span className="text-xs font-extrabold text-cyan-400">{formatCurrency(srvPrice)}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 line-clamp-2">{srv.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 5. Attribution Piste (Bay) & Laveurs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-[#252b39]">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Piste de Lavage (Bay Station)
              </label>
              <select
                value={selectedBay}
                onChange={e => setSelectedBay(Number(e.target.value))}
                className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white focus:outline-none cursor-pointer"
              >
                {bays.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.status === 'operational' ? 'Opérationnelle' : 'Hors-service'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Affecter les Laveurs ({selectedStaffIds.length} sélectionnés)
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {employees.filter(e => e.role === 'laveur').map(emp => {
                  const isAssigned = selectedStaffIds.includes(emp.id);
                  return (
                    <button
                      type="button"
                      key={emp.id}
                      onClick={() => handleStaffToggle(emp.id)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-medium border flex items-center gap-1 transition-all ${
                        isAssigned
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                          : 'bg-[#202532] border-[#2b3242] text-gray-400'
                      }`}
                    >
                      {isAssigned && <Check className="w-3 h-3" />}
                      <span>{emp.name.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 6. Mode de paiement & Encaissement immédiat */}
          <div className="p-3.5 rounded-xl bg-[#202532] border border-[#2b3242] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="immediatePay"
                  checked={isPaidImmediately}
                  onChange={e => setIsPaidImmediately(e.target.checked)}
                  className="w-4 h-4 rounded text-cyan-500 focus:ring-0 bg-[#16181d] border-gray-600"
                />
                <label htmlFor="immediatePay" className="text-xs font-semibold text-white cursor-pointer">
                  Encaisser immédiatement à l'accueil
                </label>
              </div>

              <div className="text-right">
                <span className="text-xs text-gray-400">Total à payer : </span>
                <span className="text-sm font-extrabold text-white">{formatCurrency(finalPrice)}</span>
              </div>
            </div>

            {isPaidImmediately && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#2a303f]">
                {(['wave', 'orange_money', 'mtn_momo', 'especes'] as PaymentMethod[]).map(pm => {
                  const labels: Record<string, { name: string; color: string }> = {
                    wave: { name: 'Wave CI', color: 'bg-sky-500/20 text-sky-300 border-sky-400/40' },
                    orange_money: { name: 'Orange Money', color: 'bg-orange-500/20 text-orange-300 border-orange-400/40' },
                    mtn_momo: { name: 'MTN MoMo', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-400/40' },
                    especes: { name: 'Espèces', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40' },
                  };
                  const isSelected = paymentMethod === pm;
                  return (
                    <button
                      type="button"
                      key={pm}
                      onClick={() => setPaymentMethod(pm)}
                      className={`p-2 rounded-xl text-xs font-bold border transition-all text-center ${
                        isSelected
                          ? `${labels[pm].color} ring-1 ring-white/20`
                          : 'bg-[#181c24] border-[#29303f] text-gray-400 hover:text-white'
                      }`}
                    >
                      {labels[pm].name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsNewOrderModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-[#222734] hover:bg-[#2b3243] text-xs font-semibold text-gray-300 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-xs font-bold text-white shadow-lg shadow-cyan-500/25 transition-all flex items-center gap-2 active:scale-[0.98]"
            >
              <Check className="w-4 h-4" />
              <span>Valider & Générer le Ticket</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
