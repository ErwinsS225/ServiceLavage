import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Sparkles, Plus, Clock, Tag, Check, X, Edit2 } from 'lucide-react';
import { WashService } from '../types';

export const CatalogueManagement: React.FC = () => {
  const { services, addService, updateService, formatCurrency } = useApp();
  const [showAddModal, setShowAddModal] = useState(false);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'Shine' | 'Gloss' | 'Glint' | 'VIP'>('Shine');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('25');
  const [basePrice, setBasePrice] = useState('50');

  const handleAddService = (e: React.FormEvent) => {
    e.preventDefault();
    addService({
      tenantId: 'tenant-1',
      code: code || name.toLowerCase().replace(/\s+/g, '-'),
      name,
      category,
      description,
      durationMinutes: Number(durationMinutes) || 25,
      basePrice: Number(basePrice) || 50,
      isPublic: true,
      isActive: true,
    });
    setName('');
    setDescription('');
    setShowAddModal(false);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto text-gray-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <span>Catalogue des Prestations & Grille Tarifaire</span>
          </h2>
          <p className="text-xs text-gray-400">
            Personnalisez vos formules de lavage (Shine, Gloss, Glint) et vos tarifs par type de véhicule
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-xs flex items-center gap-2 shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>+ Ajouter une Prestation</span>
        </button>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {services.map(srv => (
          <div
            key={srv.id}
            className="bg-[#1c202a] border border-[#272d3b] hover:border-cyan-500/40 rounded-2xl p-5 space-y-4 transition-all shadow-sm flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-md text-xs font-bold bg-[#3b2d54] text-purple-200">
                  {srv.category}
                </span>

                <span className="text-lg font-extrabold text-cyan-400">
                  {formatCurrency(srv.basePrice)}
                </span>
              </div>

              <h4 className="text-base font-bold text-white mt-3">{srv.name}</h4>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">{srv.description}</p>

              {/* Vehicle specific breakdown if present */}
              {srv.categoryPrices && Object.keys(srv.categoryPrices).length > 0 && (
                <div className="mt-4 pt-3 border-t border-[#272e3d] space-y-1 text-xs">
                  <span className="text-[10px] text-gray-400 uppercase font-semibold block">Tarifs par véhicule</span>
                  <div className="grid grid-cols-2 gap-1 text-[11px]">
                    {Object.entries(srv.categoryPrices).map(([cat, pr]) => (
                      <div key={cat} className="flex justify-between text-gray-300">
                        <span className="capitalize">{cat.replace('_', ' ')} :</span>
                        <span className="font-bold text-white">{formatCurrency(pr!)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-[#272d3b] flex items-center justify-between text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                {srv.durationMinutes} min
              </span>

              <span className="text-emerald-400 text-[11px] font-semibold">
                {srv.isPublic ? 'Affiché sur vitrine web' : 'Usage interne'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Add Service */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#1a1e27] border border-[#2b3242] rounded-2xl w-full max-w-md p-5 space-y-4 text-gray-200 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-[#282f3e]">
              <h3 className="text-sm font-bold text-white">Ajouter une Formule de Lavage</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddService} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Nom de la prestation</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="ex: Formule Moteur & Châssis Pro"
                  className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Badge Catégorie</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white focus:outline-none cursor-pointer"
                  >
                    <option value="Shine">Shine</option>
                    <option value="Gloss">Gloss</option>
                    <option value="Glint">Glint</option>
                    <option value="VIP">VIP</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Prix de Base ($ ou équivalent)</label>
                  <input
                    type="number"
                    required
                    value={basePrice}
                    onChange={e => setBasePrice(e.target.value)}
                    className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Durée Indicative (minutes)</label>
                <input
                  type="number"
                  value={durationMinutes}
                  onChange={e => setDurationMinutes(e.target.value)}
                  className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Description des opérations</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Dégraissage, rinçage déminéralisé, etc."
                  className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#222734] text-xs font-semibold text-gray-300"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white shadow-md"
                >
                  Enregistrer Formule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
