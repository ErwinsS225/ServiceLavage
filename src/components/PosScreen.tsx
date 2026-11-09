import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Car, 
  Sparkles, 
  Check, 
  DollarSign, 
  User, 
  Phone, 
  Receipt, 
  Printer, 
  Smartphone, 
  Plus, 
  CheckCircle2, 
  LayoutGrid,
  Users
} from 'lucide-react';
import { VehicleCategory, PaymentMethod } from '../types';
import confetti from 'canvas-confetti';

export const PosScreen: React.FC = () => {
  const { 
    services, 
    bays, 
    employees, 
    addOrder, 
    formatCurrency, 
    setSelectedOrderForTicket,
    customers,
    currentTenant,
    showBanner,
    setActiveTab
  } = useApp();

  const [vehicleCategory, setVehicleCategory] = useState<VehicleCategory>('suv_4x4');
  const [vehicleBrand, setVehicleBrand] = useState('Toyota');
  const [vehicleModel, setVehicleModel] = useState('RAV4');
  const [plateNumber, setPlateNumber] = useState('2841-HJ-01');

  const [customerName, setCustomerName] = useState('Kouassi Michel');
  const [customerPhone, setCustomerPhone] = useState('+225 07 48 99 10 22');

  const [selectedServiceId, setSelectedServiceId] = useState<string>(services[0]?.id || '');
  const [selectedBay, setSelectedBay] = useState<number>(1);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>(['emp-1', 'emp-2']);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('wave');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [isImmediatePayment, setIsImmediatePayment] = useState<boolean>(true);

  const vehicleCategories: { id: VehicleCategory; label: string; icon: string }[] = [
    { id: 'particulier', label: 'Particulier', icon: '🚗' },
    { id: 'berline', label: 'Berline', icon: '🚘' },
    { id: 'suv_4x4', label: '4x4 & SUV', icon: '🚙' },
    { id: 'pickup', label: 'Pick-up', icon: '🛻' },
    { id: 'taxi_communal', label: 'Wôrô-wôrô', icon: '🚕' },
    { id: 'taxi_classique', label: 'Taxi Compteur', icon: '🚖' },
    { id: 'minibus', label: 'Gbaka / Minibus', icon: '🚐' },
    { id: 'moto', label: 'Moto', icon: '🏍️' },
    { id: 'gros_camion', label: 'Poids Lourd', icon: '🚛' },
  ];

  const popularBrands = ['Toyota', 'Nissan', 'Hyundai', 'Mercedes', 'Peugeot', 'Mitsubishi', 'Suzuki', 'Mazda'];

  const currentService = services.find(s => s.id === selectedServiceId) || services[0];

  // Base price calculation
  let basePrice = currentService?.basePrice || 60;
  if (currentService?.categoryPrices && currentService.categoryPrices[vehicleCategory]) {
    basePrice = currentService.categoryPrices[vehicleCategory]!;
  }

  const discountAmount = (basePrice * discountPercent) / 100;
  const finalPrice = Math.max(0, basePrice - discountAmount);

  const handleStaffToggle = (staffId: string) => {
    setSelectedStaffIds(prev =>
      prev.includes(staffId) ? prev.filter(id => id !== staffId) : [...prev, staffId]
    );
  };

  const handleCustomerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const custId = e.target.value;
    if (!custId) return;
    const found = customers.find(c => c.id === custId);
    if (found) {
      setCustomerName(found.name);
      setCustomerPhone(found.phone);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const fullVehicleInfo = `${vehicleBrand} ${vehicleModel}`.trim() || 'Véhicule Client';

    const createdOrder = addOrder({
      tenantId: currentTenant.id,
      vehicleInfo: fullVehicleInfo,
      plateNumber: plateNumber.toUpperCase(),
      vehicleCategory,
      customerName: customerName || 'Client de passage',
      customerPhone,
      washCategory: currentService.category,
      serviceIds: [currentService.id],
      serviceNames: [currentService.name],
      bayArea: selectedBay,
      status: 'en_cours',
      paymentStatus: isImmediatePayment ? 'paye' : 'non_paye',
      paymentMethod: isImmediatePayment ? paymentMethod : undefined,
      amount: finalPrice,
      discount: discountAmount,
      paidAmount: isImmediatePayment ? finalPrice : 0,
      assignedStaffIds: selectedStaffIds,
    });

    try {
      confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
    } catch {}

    setSelectedOrderForTicket(createdOrder);
    showBanner(`Ticket ${createdOrder.ticketNumber} émis !`, 'success');
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto text-gray-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              TERMINAL POINT DE VENTE (POS)
            </span>
          </div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2 mt-1">
            <Car className="w-5 h-5 text-cyan-400" />
            <span>Nouvelle Prestation & Encaissement Rapide</span>
          </h2>
          <p className="text-xs text-gray-400">
            Interface tactile rapide adaptée aux agents d'accueil et caissiers de station
          </p>
        </div>

        {/* Existing Client Dropdown shortcut */}
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-gray-400" />
          <select
            onChange={handleCustomerSelect}
            className="px-3 py-2 bg-[#202532] border border-[#2c3343] rounded-xl text-xs text-gray-300 focus:outline-none cursor-pointer"
          >
            <option value="">Sélectionner un client fidèle...</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.phone})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main 2-Column POS Layout */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols): Step by step touch selection */}
        <div className="lg:col-span-8 space-y-6">
          {/* 1. Catégorie de véhicule (Grandes tuiles tactiles) */}
          <div className="bg-[#1c202a] border border-[#272d3b] rounded-2xl p-5 space-y-3">
            <label className="text-xs font-bold text-white uppercase tracking-wider block">
              1. Type de Véhicule (Tarification locale CI)
            </label>

            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
              {vehicleCategories.map(cat => {
                const isSelected = vehicleCategory === cat.id;
                return (
                  <button
                    type="button"
                    key={cat.id}
                    onClick={() => setVehicleCategory(cat.id)}
                    className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 ${
                      isSelected
                        ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-md shadow-cyan-500/20 ring-1 ring-cyan-500'
                        : 'bg-[#222734] border-[#2c3343] text-gray-400 hover:text-white hover:bg-[#282f3f]'
                    }`}
                  >
                    <span className="text-2xl">{cat.icon}</span>
                    <span className="text-xs font-bold truncate max-w-full">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Infos véhicule & Client */}
          <div className="bg-[#1c202a] border border-[#272d3b] rounded-2xl p-5 space-y-4">
            <label className="text-xs font-bold text-white uppercase tracking-wider block">
              2. Informations Véhicule & Client
            </label>

            {/* Popular Brand Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-[11px] text-gray-500 font-semibold mr-1">Marque :</span>
              {popularBrands.map(b => (
                <button
                  type="button"
                  key={b}
                  onClick={() => setVehicleBrand(b)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    vehicleBrand === b
                      ? 'bg-cyan-500 text-white font-bold'
                      : 'bg-[#222734] text-gray-400 hover:text-white'
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1">Modèle</label>
                <input
                  type="text"
                  required
                  value={vehicleModel}
                  onChange={e => setVehicleModel(e.target.value)}
                  placeholder="ex: RAV4, Patrol, Duster"
                  className="w-full px-3 py-2 bg-[#222734] border border-[#2c3343] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1">
                  Immatriculation (Plaque)
                </label>
                <input
                  type="text"
                  required
                  value={plateNumber}
                  onChange={e => setPlateNumber(e.target.value)}
                  placeholder="ex: 2841-HJ-01"
                  className="w-full px-3 py-2 bg-[#222734] border border-[#2c3343] rounded-xl text-xs text-white font-mono uppercase font-bold focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1">Nom du Client</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="Nom ou Client passage"
                  className="w-full px-3 py-2 bg-[#222734] border border-[#2c3343] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-400 mb-1">
                Téléphone (pour envoi automatique du Reçu WhatsApp)
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                placeholder="+225 07..."
                className="w-full px-3 py-2 bg-[#222734] border border-[#2c3343] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* 3. Choix de la Formule de Lavage */}
          <div className="bg-[#1c202a] border border-[#272d3b] rounded-2xl p-5 space-y-3">
            <label className="text-xs font-bold text-white uppercase tracking-wider block">
              3. Choix de la Formule de Lavage
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {services.map(srv => {
                const isSelected = selectedServiceId === srv.id;
                let srvPrice = srv.basePrice;
                if (srv.categoryPrices && srv.categoryPrices[vehicleCategory]) {
                  srvPrice = srv.categoryPrices[vehicleCategory]!;
                }

                return (
                  <div
                    key={srv.id}
                    onClick={() => setSelectedServiceId(srv.id)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between space-y-3 ${
                      isSelected
                        ? 'bg-[#232938] border-cyan-400 ring-2 ring-cyan-500/30 shadow-lg'
                        : 'bg-[#202532] border-[#2b3242] hover:border-gray-500'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-[#3b2d54] text-purple-200">
                          {srv.category}
                        </span>
                        <span className="text-sm font-black text-cyan-400">
                          {formatCurrency(srvPrice)}
                        </span>
                      </div>
                      <h4 className="font-bold text-white text-xs mt-2">{srv.name}</h4>
                      <p className="text-[11px] text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                        {srv.description}
                      </p>
                    </div>

                    <div className="text-[10px] text-gray-400 pt-2 border-t border-[#2a3040]">
                      Durée : ~{srv.durationMinutes} minutes
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. Attribution Piste & Laveurs */}
          <div className="bg-[#1c202a] border border-[#272d3b] rounded-2xl p-5 space-y-4">
            <label className="text-xs font-bold text-white uppercase tracking-wider block">
              4. Attribution Piste (Bay Station) & Laveurs
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {bays.map(b => {
                const isSelected = selectedBay === b.id;
                const isFree = !b.currentVehicleInfo || b.currentVehicleInfo === 'Libre';
                return (
                  <button
                    type="button"
                    key={b.id}
                    onClick={() => setSelectedBay(b.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-cyan-500/20 border-cyan-400 text-white font-bold ring-1 ring-cyan-500'
                        : 'bg-[#202532] border-[#2b3242] text-gray-400'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold">{b.name}</span>
                      <span className={`w-2 h-2 rounded-full ${isFree ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    </div>
                    <span className="text-[10px] text-gray-400 block mt-1">
                      {isFree ? 'Disponible' : `Occupé (${b.currentVehicleInfo?.split(' ')[0]})`}
                    </span>
                  </button>
                );
              })}
            </div>

            <div>
              <span className="text-[11px] font-semibold text-gray-400 block mb-1.5">
                Affecter les Laveurs de garde ({selectedStaffIds.length} sélectionnés) :
              </span>
              <div className="flex flex-wrap gap-2">
                {employees.filter(e => e.role === 'laveur').map(emp => {
                  const isAssigned = selectedStaffIds.includes(emp.id);
                  return (
                    <button
                      type="button"
                      key={emp.id}
                      onClick={() => handleStaffToggle(emp.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all ${
                        isAssigned
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                          : 'bg-[#202532] border-[#2b3242] text-gray-400'
                      }`}
                    >
                      {isAssigned && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                      <span>{emp.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Live Digital Ticket / Cart Summary */}
        <div className="lg:col-span-4 space-y-5">
          <div className="bg-[#1c202a] border border-[#272d3b] rounded-3xl p-6 shadow-xl space-y-5 sticky top-24">
            <div className="flex items-center justify-between pb-3 border-b border-[#262c3b]">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-white text-sm">Ticket de Caisse en Direct</h3>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#252b39] text-gray-300">
                APERÇU
              </span>
            </div>

            {/* Recalculation recap */}
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Véhicule :</span>
                <span className="font-bold text-white">{vehicleBrand} {vehicleModel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Plaque d'immatriculation :</span>
                <span className="font-mono text-cyan-400 font-bold">{plateNumber.toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Catégorie :</span>
                <span className="font-semibold text-gray-200 capitalize">{vehicleCategory.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Formule :</span>
                <span className="font-bold text-white">{currentService.category} ({currentService.name})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Piste de lavage :</span>
                <span className="font-bold text-white">Bay Area {selectedBay}</span>
              </div>
            </div>

            {/* Discount Selector */}
            <div className="pt-3 border-t border-[#262c3b] space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Remise commerciale :</span>
                <span className="font-bold text-rose-400">{discountPercent}% (-{formatCurrency(discountAmount)})</span>
              </div>
              <div className="flex items-center gap-1.5">
                {[0, 5, 10, 15, 20].map(pct => (
                  <button
                    type="button"
                    key={pct}
                    onClick={() => setDiscountPercent(pct)}
                    className={`flex-1 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                      discountPercent === pct
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : 'bg-[#222734] border-[#2c3343] text-gray-400'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            {/* Total Amount Box */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-[#1b2230] to-[#151922] border border-[#2b3345] space-y-1 text-center">
              <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">TOTAL À ENCAISSER</span>
              <div className="text-3xl font-black text-white tracking-tight">
                {formatCurrency(finalPrice)}
              </div>
            </div>

            {/* Immediate payment toggle & payment method */}
            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={isImmediatePayment}
                  onChange={e => setIsImmediatePayment(e.target.checked)}
                  className="w-4 h-4 rounded text-cyan-500 bg-[#222734] border-gray-600 focus:ring-0"
                />
                <span className="font-semibold text-white">Encaisser immédiatement à l'accueil</span>
              </label>

              {isImmediatePayment && (
                <div className="grid grid-cols-2 gap-2">
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
                        className={`p-2.5 rounded-xl text-xs font-bold border transition-all text-center ${
                          isSelected
                            ? `${labels[pm].color} ring-1 ring-white/20 shadow-sm`
                            : 'bg-[#202532] border-[#2b3242] text-gray-400 hover:text-white'
                        }`}
                      >
                        {labels[pm].name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Submit / Print Action Button */}
            <button
              type="submit"
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-extrabold text-sm shadow-xl shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              <Printer className="w-4 h-4" />
              <span>Valider & Émettre le Ticket</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
