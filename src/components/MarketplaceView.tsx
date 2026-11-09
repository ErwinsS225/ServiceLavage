import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Store, Search, MapPin, Phone, MessageCircle, Star, ShieldCheck, Sparkles, Clock } from 'lucide-react';

export const MarketplaceView: React.FC = () => {
  const { tenants, formatCurrency, setActiveTab } = useApp();
  const [selectedCommune, setSelectedCommune] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const communes = ['all', 'Cocody', 'Marcory', 'Yopougon', 'Plateau', 'Koumassi', 'Deux Plateaux'];

  const filteredTenants = tenants.filter(t => {
    if (selectedCommune !== 'all' && t.commune.toLowerCase() !== selectedCommune.toLowerCase()) {
      return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        t.commune.toLowerCase().includes(q) ||
        t.quarter.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto text-gray-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
              PHASE 2 • EXPANSION COMMERCIALE
            </span>
          </div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2 mt-1">
            <Store className="w-5 h-5 text-purple-400" />
            <span>Marketplace Centralisée des Stations de Lavage CI</span>
          </h2>
          <p className="text-xs text-gray-400">
            Portail grand public permettant aux automobilistes de découvrir, comparer et contacter les meilleures stations d'Abidjan
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Rechercher quartier, station..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Commune filter pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {communes.map(c => (
          <button
            key={c}
            onClick={() => setSelectedCommune(c)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCommune === c
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'bg-[#202532] border border-[#2b3242] text-gray-400 hover:text-white'
            }`}
          >
            {c === 'all' ? 'Toutes les communes' : c}
          </button>
        ))}
      </div>

      {/* Directory of stations */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTenants.map(station => (
          <div
            key={station.id}
            className="bg-[#1c202a] border border-[#272d3b] hover:border-purple-500/40 rounded-2xl overflow-hidden shadow-sm transition-all flex flex-col justify-between"
          >
            {/* Card Cover image */}
            <div className="h-44 w-full relative">
              <img
                src={
                  station.id === 'tenant-1'
                    ? 'https://images.unsplash.com/photo-1601362840469-51e4d8d58785?w=700&auto=format&fit=crop&q=80'
                    : station.id === 'tenant-2'
                    ? 'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=700&auto=format&fit=crop&q=80'
                    : 'https://images.unsplash.com/photo-1552930294-6b595f4c2974?w=700&auto=format&fit=crop&q=80'
                }
                alt={station.name}
                className="w-full h-full object-cover brightness-75"
              />
              <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-bold text-white flex items-center gap-1">
                <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                <span>4.9 (124 avis)</span>
              </div>

              <div className="absolute bottom-3 left-3 px-2 py-0.5 rounded-md bg-purple-600/90 text-white text-[10px] font-extrabold uppercase tracking-wide">
                Station Partenaire Certifiée
              </div>
            </div>

            {/* Body */}
            <div className="p-5 space-y-3">
              <div>
                <h3 className="text-base font-bold text-white">{station.name}</h3>
                <p className="text-xs text-cyan-400 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{station.quarter}, {station.commune}</span>
                </p>
              </div>

              <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                {station.description}
              </p>

              <div className="pt-2 flex items-center justify-between text-xs text-gray-400 border-t border-[#262c3a]">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-cyan-400" />
                  {station.openingHours}
                </span>

                <span className="font-bold text-gray-300">
                  {station.baysCount} pistes actives
                </span>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-4 bg-[#181b24] border-t border-[#252b39] flex items-center justify-between gap-2">
              <button
                onClick={() => setActiveTab('showcase')}
                className="flex-1 py-2 px-3 rounded-xl bg-[#222734] hover:bg-[#2b3343] text-gray-200 text-xs font-semibold transition-colors"
              >
                Voir Vitrine
              </button>

              <a
                href={`https://wa.me/${station.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Bonjour ${station.name}, je vous contacte depuis la Marketplace Clean It CI.`)}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-emerald-600/20"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
