import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Settings, HelpCircle, Save, Printer, MapPin, Building, Phone, DollarSign, Wifi, Shield } from 'lucide-react';

export const SettingsAndHelp: React.FC = () => {
  const { currentTenant, updateCurrentTenant, isOfflineMode, toggleOfflineMode, showBanner } = useApp();

  const [name, setName] = useState(currentTenant.name);
  const [commune, setCommune] = useState(currentTenant.commune);
  const [quarter, setQuarter] = useState(currentTenant.quarter);
  const [address, setAddress] = useState(currentTenant.address);
  const [phone, setPhone] = useState(currentTenant.phone);
  const [hours, setHours] = useState(currentTenant.openingHours);
  const [description, setDescription] = useState(currentTenant.description);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateCurrentTenant({
      name,
      commune,
      quarter,
      address,
      phone,
      openingHours: hours,
      description,
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto text-gray-200">
      {/* Top Header */}
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-cyan-400" />
          <span>Paramètres de la Station & Configuration Système</span>
        </h2>
        <p className="text-xs text-gray-400">
          Personnalisation des coordonnées, impression des tickets, mode de fonctionnement réseau
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Settings Form */}
        <div className="lg:col-span-8 bg-[#1c202a] border border-[#272d3b] rounded-2xl p-6 shadow-sm space-y-5">
          <h3 className="text-sm font-bold text-white border-b border-[#272e3d] pb-3">
            Informations de l'Établissement (Imprimées sur les Tickets)
          </h3>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Nom Commercial</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Téléphone Professionnel</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Commune</label>
                <input
                  type="text"
                  required
                  value={commune}
                  onChange={e => setCommune(e.target.value)}
                  className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Quartier & Boulevard</label>
                <input
                  type="text"
                  required
                  value={quarter}
                  onChange={e => setQuarter(e.target.value)}
                  className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Adresse Détaillée (Repère)</label>
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Horaires d'Ouverture</label>
              <input
                type="text"
                value={hours}
                onChange={e => setHours(e.target.value)}
                className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Description Commerciale</label>
              <textarea
                rows={3}
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full px-3 py-2 bg-[#202532] border border-[#2b3242] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-xs font-bold text-white shadow-md flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>Enregistrer les Modifications</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right: Offline Resilience & Guide */}
        <div className="lg:col-span-4 space-y-5">
          {/* Offline resilience box */}
          <div className="bg-[#1c202a] border border-[#272d3b] rounded-2xl p-5 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Wifi className="w-4 h-4 text-cyan-400" />
              <span>Résilience Coupures Internet CI</span>
            </h4>
            <p className="text-xs text-gray-300 leading-relaxed">
              En cas de coupure de connexion ou d'instabilité réseau à Abidjan, Clean It enregistre toutes les prestations et encaissements dans le stockage local de l'appareil (Local-first).
            </p>

            <div className="pt-2">
              <button
                onClick={toggleOfflineMode}
                className={`w-full py-2 px-3 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-2 ${
                  isOfflineMode
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-[#222734] border-[#2c3343] text-gray-300 hover:text-white'
                }`}
              >
                <span>{isOfflineMode ? 'Désactiver Mode Hors-Ligne' : 'Tester Mode Hors-Ligne'}</span>
              </button>
            </div>
          </div>

          {/* Guide Rapide */}
          <div className="bg-[#1c202a] border border-[#272d3b] rounded-2xl p-5 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-emerald-400" />
              <span>Guide d'Utilisation Station</span>
            </h4>

            <ul className="space-y-2 text-xs text-gray-400">
              <li className="flex items-start gap-1.5">
                <span className="text-cyan-400 font-bold">1.</span>
                <span><strong>POS Lavage :</strong> Utilisez le bouton "+ Nouveau Lavage" pour enregistrer un véhicule en 15 secondes.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-cyan-400 font-bold">2.</span>
                <span><strong>Ticket & WhatsApp :</strong> Cliquez sur le bouton ticket pour imprimer ou envoyer le reçu directement au client.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-cyan-400 font-bold">3.</span>
                <span><strong>Caisse Mobile :</strong> Vérifiez vos encaissements Wave, Orange et MTN sans risque d'erreur de caisse.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
