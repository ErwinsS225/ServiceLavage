import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Users, 
  Search, 
  Plus, 
  Phone, 
  Mail, 
  Award, 
  Car, 
  MessageCircle, 
  X, 
  Truck, 
  Filter, 
  CheckCircle2, 
  ShieldCheck,
  TrendingUp,
  Tag
} from 'lucide-react';
import { Customer, CustomerVehicleCategory } from '../types';

export const CustomerManagement: React.FC = () => {
  const { customers, addCustomer, formatCurrency, orders, currentTenant } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'sedan' | 'suv' | 'utility'>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states for new customer
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+225 ');
  const [email, setEmail] = useState('');
  const [vehicleCategory, setVehicleCategory] = useState<CustomerVehicleCategory>('sedan');
  const [vehicleModel, setVehicleModel] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [notes, setNotes] = useState('');

  // Helper to resolve customer's vehicle category reliably
  const getCustomerCategory = (cust: Customer): CustomerVehicleCategory => {
    if (cust.vehicleCategory) return cust.vehicleCategory;
    
    // Check in past orders
    const matchedOrder = orders.find(o => o.customerPhone === cust.phone || o.customerName === cust.name);
    if (matchedOrder) {
      if (['suv_4x4'].includes(matchedOrder.vehicleCategory)) return 'suv';
      if (['pickup', 'minibus', 'gros_camion'].includes(matchedOrder.vehicleCategory)) return 'utility';
      if (['berline', 'particulier', 'taxi_communal', 'taxi_classique'].includes(matchedOrder.vehicleCategory)) return 'sedan';
    }

    // Check in notes
    const lowerNotes = (cust.notes || '').toLowerCase();
    if (lowerNotes.includes('suv') || lowerNotes.includes('4x4') || lowerNotes.includes('prado') || lowerNotes.includes('rav4')) return 'suv';
    if (lowerNotes.includes('utilitaire') || lowerNotes.includes('pick-up') || lowerNotes.includes('fourgon') || lowerNotes.includes('btp') || lowerNotes.includes('navara') || lowerNotes.includes('hilux')) return 'utility';
    if (lowerNotes.includes('berline') || lowerNotes.includes('sédan') || lowerNotes.includes('peugeot') || lowerNotes.includes('mercedes')) return 'sedan';

    return 'sedan'; // default fallback for passenger cars
  };

  // Live counts for category pills
  const totalCount = customers.length;
  const sedanCount = customers.filter(c => getCustomerCategory(c) === 'sedan').length;
  const suvCount = customers.filter(c => getCustomerCategory(c) === 'suv').length;
  const utilityCount = customers.filter(c => getCustomerCategory(c) === 'utility').length;

  // Filtered customer list based on search term AND vehicle category filter
  const filteredCustomers = customers.filter(cust => {
    const custCat = getCustomerCategory(cust);
    
    // Category filter check
    if (selectedCategory !== 'all' && custCat !== selectedCategory) {
      return false;
    }

    // Search query check
    if (!searchTerm.trim()) return true;

    const query = searchTerm.toLowerCase().trim();
    const matchesName = cust.name.toLowerCase().includes(query);
    const matchesPhone = cust.phone.includes(query);
    const matchesEmail = Boolean(cust.email && cust.email.toLowerCase().includes(query));
    const matchesVehicleModel = Boolean(cust.vehicleModel && cust.vehicleModel.toLowerCase().includes(query));
    const matchesPlateNumber = Boolean(cust.plateNumber && cust.plateNumber.toLowerCase().includes(query));
    const matchesNotes = Boolean(cust.notes && cust.notes.toLowerCase().includes(query));

    return matchesName || matchesPhone || matchesEmail || matchesVehicleModel || matchesPlateNumber || matchesNotes;
  });

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    addCustomer({
      tenantId: currentTenant.id,
      name,
      phone,
      email: email.trim() || undefined,
      vehicleCategory,
      vehicleModel: vehicleModel.trim() || undefined,
      plateNumber: plateNumber.trim().toUpperCase() || undefined,
      notes: notes.trim() || undefined,
    });
    setName('');
    setPhone('+225 ');
    setEmail('');
    setVehicleCategory('sedan');
    setVehicleModel('');
    setPlateNumber('');
    setNotes('');
    setShowAddModal(false);
  };

  const getCategoryBadgeStyle = (cat: CustomerVehicleCategory) => {
    switch (cat) {
      case 'sedan':
        return {
          bg: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
          label: 'Sédan / Berline',
          icon: Car
        };
      case 'suv':
        return {
          bg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
          label: 'SUV & 4x4',
          icon: Car
        };
      case 'utility':
        return {
          bg: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
          label: 'Utilitaire & Pro',
          icon: Truck
        };
      default:
        return {
          bg: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
          label: 'Véhicule Client',
          icon: Car
        };
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto text-gray-200">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            <span>Gestion de la Clientèle & Flottes</span>
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Fiches clients, filtres par catégorie de véhicule, fidélité et contact direct WhatsApp
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-md shadow-cyan-600/20 transition-all active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>+ Nouveau Client</span>
        </button>
      </div>

      {/* 4 Interactive KPI summary metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div 
          onClick={() => setSelectedCategory('all')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            selectedCategory === 'all'
              ? 'bg-[#222734] border-cyan-400 shadow-md shadow-cyan-500/10'
              : 'bg-[#1c202a] border-[#272d3b] hover:border-gray-500/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Base Clients</span>
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white">{totalCount}</div>
          <span className="text-[10px] text-gray-400">Total répertorié</span>
        </div>

        <div 
          onClick={() => setSelectedCategory('sedan')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            selectedCategory === 'sedan'
              ? 'bg-[#1a2530] border-cyan-400 shadow-md shadow-cyan-500/10'
              : 'bg-[#1c202a] border-[#272d3b] hover:border-cyan-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-cyan-300 uppercase tracking-wide">Sédans & Berlines</span>
            <Car className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white">{sedanCount}</div>
          <span className="text-[10px] text-cyan-400/80 font-medium">Particuliers & VTC</span>
        </div>

        <div 
          onClick={() => setSelectedCategory('suv')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            selectedCategory === 'suv'
              ? 'bg-[#182a24] border-emerald-400 shadow-md shadow-emerald-500/10'
              : 'bg-[#1c202a] border-[#272d3b] hover:border-emerald-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wide">SUV & 4x4</span>
            <Car className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white">{suvCount}</div>
          <span className="text-[10px] text-emerald-400/80 font-medium">Grand gabarit</span>
        </div>

        <div 
          onClick={() => setSelectedCategory('utility')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            selectedCategory === 'utility'
              ? 'bg-[#292218] border-amber-400 shadow-md shadow-amber-500/10'
              : 'bg-[#1c202a] border-[#272d3b] hover:border-amber-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wide">Utilitaires & Pro</span>
            <Truck className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white">{utilityCount}</div>
          <span className="text-[10px] text-amber-400/80 font-medium">Pick-up, chantiers, flottes</span>
        </div>
      </div>

      {/* Controls Bar: Search Input + Category Filter Pills */}
      <div className="bg-[#1c202a] border border-[#272d3b] rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-sm">
        {/* Search Input with Clear Button */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Rechercher par nom, tél (+225), modèle, immatriculation..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-9 py-2 bg-[#202532] border border-[#2c3343] focus:border-cyan-500 rounded-xl text-xs text-white placeholder-gray-400 focus:outline-none transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-2.5 text-gray-400 hover:text-white p-0.5"
              title="Effacer la recherche"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills: Sédan, SUV, Utilitaire */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <span className="text-xs font-semibold text-gray-400 flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Filtres :</span>
          </span>

          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              selectedCategory === 'all'
                ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/20'
                : 'bg-[#202532] border border-[#2b3242] text-gray-400 hover:text-white'
            }`}
          >
            <span>Tous</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/25">
              {totalCount}
            </span>
          </button>

          <button
            onClick={() => setSelectedCategory('sedan')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              selectedCategory === 'sedan'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
                : 'bg-[#202532] border border-[#2b3242] text-gray-300 hover:text-white'
            }`}
          >
            <Car className="w-3.5 h-3.5 text-cyan-400" />
            <span>Sédans & Berlines</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/25">
              {sedanCount}
            </span>
          </button>

          <button
            onClick={() => setSelectedCategory('suv')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              selectedCategory === 'suv'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'bg-[#202532] border border-[#2b3242] text-gray-300 hover:text-white'
            }`}
          >
            <Car className="w-3.5 h-3.5 text-emerald-400" />
            <span>SUV & 4x4</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/25">
              {suvCount}
            </span>
          </button>

          <button
            onClick={() => setSelectedCategory('utility')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              selectedCategory === 'utility'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                : 'bg-[#202532] border border-[#2b3242] text-gray-300 hover:text-white'
            }`}
          >
            <Truck className="w-3.5 h-3.5 text-amber-400" />
            <span>Utilitaires</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/25">
              {utilityCount}
            </span>
          </button>
        </div>
      </div>

      {/* Active filter / Search results count */}
      <div className="flex items-center justify-between text-xs text-gray-400 px-1">
        <span>
          Affichage de <strong className="text-white">{filteredCustomers.length}</strong> client(s)
          {selectedCategory !== 'all' && (
            <> dans la catégorie <strong className="text-cyan-400 capitalize">{selectedCategory === 'sedan' ? 'Sédan / Berline' : selectedCategory === 'suv' ? 'SUV & 4x4' : 'Utilitaire'}</strong></>
          )}
          {searchTerm && (
            <> correspondant à « <strong className="text-white">{searchTerm}</strong> »</>
          )}
        </span>

        {(selectedCategory !== 'all' || searchTerm) && (
          <button
            onClick={() => {
              setSelectedCategory('all');
              setSearchTerm('');
            }}
            className="text-cyan-400 hover:text-cyan-300 hover:underline font-semibold"
          >
            Réinitialiser les filtres
          </button>
        )}
      </div>

      {/* Grid of Customer Cards */}
      {filteredCustomers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCustomers.map(cust => {
            const clientOrders = orders.filter(o => o.customerPhone === cust.phone || o.customerName === cust.name);
            const category = getCustomerCategory(cust);
            const badgeStyle = getCategoryBadgeStyle(category);
            const BadgeIcon = badgeStyle.icon;

            const vehicleDisplay = cust.vehicleModel || (clientOrders[0]?.vehicleInfo) || 'Véhicule non renseigné';
            const plateDisplay = cust.plateNumber || (clientOrders[0]?.plateNumber) || 'Plaque non renseignée';

            const cleanPhoneDigits = cust.phone.replace(/[^0-9]/g, '');
            const whatsappMessage = encodeURIComponent(
              `Bonjour M./Mme ${cust.name}, toute l'équipe de la station ${currentTenant.name} vous remercie de votre fidélité ! Votre véhicule ${vehicleDisplay} (${plateDisplay}) bénéficie d'un accueil prioritaire.`
            );

            return (
              <div
                key={cust.id}
                className="bg-[#1c202a] border border-[#272d3b] hover:border-cyan-500/40 rounded-2xl p-5 space-y-4 transition-all shadow-sm flex flex-col justify-between group"
              >
                <div>
                  {/* Card Header: Initial, Name, WhatsApp */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 text-cyan-300 flex items-center justify-center font-black text-sm border border-cyan-500/30 shadow-inner flex-shrink-0">
                        {cust.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-sm group-hover:text-cyan-300 transition-colors">
                          {cust.name}
                        </h4>
                        <a 
                          href={`tel:${cust.phone.replace(/\s+/g, '')}`}
                          className="text-[11px] text-gray-400 hover:text-white flex items-center gap-1 mt-0.5 transition-colors"
                        >
                          <Phone className="w-3 h-3 text-emerald-400" />
                          <span>{cust.phone}</span>
                        </a>
                      </div>
                    </div>

                    <a
                      href={`https://wa.me/${cleanPhoneDigits}?text=${whatsappMessage}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:scale-105 transition-all flex items-center gap-1 border border-emerald-500/20"
                      title="Envoyer un message WhatsApp au client"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span className="text-[10px] font-bold hidden sm:inline">WhatsApp</span>
                    </a>
                  </div>

                  {/* Vehicle Category & Model Banner */}
                  <div className="mt-3.5 p-3 rounded-xl bg-[#212634] border border-[#2b3243] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badgeStyle.bg}`}>
                        <BadgeIcon className="w-3 h-3" />
                        <span>{badgeStyle.label}</span>
                      </span>

                      <span className="text-[10px] text-gray-400 font-mono tracking-tight bg-[#191d26] px-2 py-0.5 rounded border border-[#2a303f]">
                        {plateDisplay}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400 text-[11px]">Véhicule :</span>
                      <span className="font-semibold text-white truncate max-w-[200px]" title={vehicleDisplay}>
                        {vehicleDisplay}
                      </span>
                    </div>
                  </div>

                  {cust.email && (
                    <div className="text-[11px] text-gray-400 flex items-center gap-1.5 mt-2.5">
                      <Mail className="w-3 h-3 text-gray-500" />
                      <span className="truncate">{cust.email}</span>
                    </div>
                  )}

                  {cust.notes && (
                    <p className="text-[11px] text-gray-400 bg-[#202532] p-2.5 rounded-xl border border-[#293040] mt-2.5 leading-relaxed">
                      {cust.notes}
                    </p>
                  )}
                </div>

                {/* Stats: visits & total spent (Strictly in FCFA) */}
                <div className="pt-3 border-t border-[#272d3b] grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-[#222734] p-2.5 rounded-xl">
                    <span className="text-gray-400 text-[10px] block font-medium">VISITES EFFECTUÉES</span>
                    <span className="font-extrabold text-white text-sm flex items-center gap-1 mt-0.5">
                      <Award className="w-3.5 h-3.5 text-amber-400" />
                      {cust.totalVisits + clientOrders.length} lavages
                    </span>
                  </div>

                  <div className="bg-[#222734] p-2.5 rounded-xl">
                    <span className="text-gray-400 text-[10px] block font-medium">TOTAL DÉPENSÉ</span>
                    <span className="font-extrabold text-cyan-400 text-sm mt-0.5 block">
                      {formatCurrency(cust.totalSpent)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="p-12 text-center rounded-2xl bg-[#1c202a] border border-[#272d3b] space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#262c3a] text-gray-400 flex items-center justify-center mx-auto">
            <Search className="w-7 h-7 text-gray-500" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Aucun client trouvé</h3>
            <p className="text-xs text-gray-400 max-w-sm mx-auto mt-1">
              Aucun résultat ne correspond à votre filtre actuel ou à votre terme de recherche.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => {
                setSelectedCategory('all');
                setSearchTerm('');
              }}
              className="px-4 py-2 rounded-xl bg-[#252b38] hover:bg-[#2e3646] text-xs font-semibold text-gray-300"
            >
              Effacer la recherche
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Créer ce client</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal Add Customer */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#1a1e27] border border-[#2b3242] rounded-2xl w-full max-w-md p-6 space-y-4 text-gray-200 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#282f3e]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Nouveau Client</h3>
                  <span className="text-[10px] text-gray-400">Enregistrer un client et son véhicule</span>
                </div>
              </div>
              <button 
                onClick={() => setShowAddModal(false)} 
                className="text-gray-400 hover:text-white p-1 rounded-lg bg-[#242a38]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Nom Complet du Client *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="ex: Kouassi Michel, M. Diabaté..."
                  className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Numéro de Téléphone (+225) *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+225 07 48 99 10 22"
                  className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Vehicle Category Selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Catégorie du Véhicule
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setVehicleCategory('sedan')}
                    className={`p-2 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                      vehicleCategory === 'sedan'
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                        : 'bg-[#202532] border-[#2b3242] text-gray-400 hover:text-white'
                    }`}
                  >
                    <Car className="w-4 h-4 text-cyan-400" />
                    <span>Sédan / Berline</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVehicleCategory('suv')}
                    className={`p-2 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                      vehicleCategory === 'suv'
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                        : 'bg-[#202532] border-[#2b3242] text-gray-400 hover:text-white'
                    }`}
                  >
                    <Car className="w-4 h-4 text-emerald-400" />
                    <span>SUV & 4x4</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVehicleCategory('utility')}
                    className={`p-2 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                      vehicleCategory === 'utility'
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                        : 'bg-[#202532] border-[#2b3242] text-gray-400 hover:text-white'
                    }`}
                  >
                    <Truck className="w-4 h-4 text-amber-400" />
                    <span>Utilitaire / Pro</span>
                  </button>
                </div>
              </div>

              {/* Vehicle Model & Plate Number */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Modèle du Véhicule
                  </label>
                  <input
                    type="text"
                    value={vehicleModel}
                    onChange={e => setVehicleModel(e.target.value)}
                    placeholder="ex: Peugeot 508, RAV4..."
                    className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Immatriculation
                  </label>
                  <input
                    type="text"
                    value={plateNumber}
                    onChange={e => setPlateNumber(e.target.value)}
                    placeholder="ex: 2841-HJ-01"
                    className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500 uppercase font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Email (Facultatif)</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="client@entreprise.ci"
                  className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Préférences / Remarques</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Formule préférée, fréquence de lavage, contrat flotte..."
                  className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#272e3d]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#222734] hover:bg-[#2b3142] text-xs font-semibold text-gray-300 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-xs font-bold text-white shadow-md shadow-cyan-600/25 transition-all active:scale-[0.98]"
                >
                  Enregistrer le Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
