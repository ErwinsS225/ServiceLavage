import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Building2, 
  User, 
  Car, 
  Sparkles, 
  DollarSign, 
  Users, 
  CreditCard, 
  Globe, 
  Crown, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  X,
  Sparkle
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ isOpen, onClose }) => {
  const { currentTenant, updateCurrentTenant, showBanner, setActiveTab } = useApp();

  const [currentStep, setCurrentStep] = useState(1);

  // Form State
  const [ownerName, setOwnerName] = useState('Yao Michel');
  const [ownerPhone, setOwnerPhone] = useState('+225 07 48 99 10 22');
  const [ownerEmail, setOwnerEmail] = useState('michel.yao@cleanit.ci');

  const [stationName, setStationName] = useState('Clean It - Cocody Riviera');
  const [commune, setCommune] = useState('Cocody');
  const [quarter, setQuarter] = useState('Riviera Bonoumin');
  const [address, setAddress] = useState('Boulevard Mitterrand face Cap Sud');

  const [enabledVehicles, setEnabledVehicles] = useState<string[]>([
    'berline', 'suv_4x4', 'pickup', 'particulier', 'taxi_communal', 'taxi_classique'
  ]);

  const [waveEnabled, setWaveEnabled] = useState(true);
  const [orangeEnabled, setOrangeEnabled] = useState(true);
  const [mtnEnabled, setMtnEnabled] = useState(true);
  const [cashEnabled, setCashEnabled] = useState(true);

  if (!isOpen) return null;

  const totalSteps = 9;

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Completed!
      updateCurrentTenant({
        name: stationName,
        commune,
        quarter,
        address,
        subscriptionStatus: 'trial',
      });
      try {
        confetti({ particleCount: 80, spread: 80, origin: { y: 0.6 } });
      } catch {}
      showBanner('Félicitations ! Votre station est configurée avec 7 jours d\'essai gratuit !', 'success');
      onClose();
      setActiveTab('dashboard');
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const stepsList = [
    { num: 1, title: 'Propriétaire', icon: User },
    { num: 2, title: 'Station', icon: Building2 },
    { num: 3, title: 'Véhicules', icon: Car },
    { num: 4, title: 'Catalogue', icon: Sparkles },
    { num: 5, title: 'Tarification', icon: DollarSign },
    { num: 6, title: 'Employés', icon: Users },
    { num: 7, title: 'Paiements', icon: CreditCard },
    { num: 8, title: 'Vitrine Web', icon: Globe },
    { num: 9, title: 'Essai 7 jours', icon: Crown },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-[#191d26] border border-[#2c3344] rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl text-gray-200 flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="p-6 border-b border-[#262c3b] bg-[#1d222d] flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 uppercase tracking-wider">
                Assistant Onboarding Station
              </span>
              <span className="text-xs text-gray-400 font-semibold">
                Étape {currentStep} sur {totalSteps}
              </span>
            </div>
            <h3 className="text-lg font-bold text-white mt-1">
              Configuration de votre ERP Lavage Auto
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-[#262c3a] text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Stepper Bar */}
        <div className="px-6 py-3 bg-[#161922] border-b border-[#242938] overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-2 min-w-max">
            {stepsList.map(s => {
              const Icon = s.icon;
              const isDone = s.num < currentStep;
              const isCurrent = s.num === currentStep;
              return (
                <div
                  key={s.num}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    isCurrent
                      ? 'bg-cyan-500 text-white shadow-md shadow-cyan-600/30'
                      : isDone
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-[#202532] text-gray-500'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{s.title}</span>
                  {isDone && <Check className="w-3 h-3 ml-0.5" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Dynamic Step Content */}
        <div className="p-6 sm:p-8 flex-1 overflow-y-auto space-y-5">
          {/* STEP 1 : Propriétaire */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <h4 className="text-base font-bold text-white">Étape 1 : Informations du Propriétaire</h4>
                <p className="text-xs text-gray-400">Vos identifiants d'accès administrateur principal</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Nom Complet</label>
                  <input
                    type="text"
                    value={ownerName}
                    onChange={e => setOwnerName(e.target.value)}
                    className="w-full px-3 py-2 bg-[#212634] border border-[#2b3345] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Numéro de Téléphone (Mobile CI)</label>
                  <input
                    type="tel"
                    value={ownerPhone}
                    onChange={e => setOwnerPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-[#212634] border border-[#2b3345] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Adresse Email Professionnelle</label>
                <input
                  type="email"
                  value={ownerEmail}
                  onChange={e => setOwnerEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-[#212634] border border-[#2b3345] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          )}

          {/* STEP 2 : Station */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <h4 className="text-base font-bold text-white">Étape 2 : Informations de la Station</h4>
                <p className="text-xs text-gray-400">Localisation précise à Abidjan pour vos clients</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Nom Commercial de la Station</label>
                <input
                  type="text"
                  value={stationName}
                  onChange={e => setStationName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#212634] border border-[#2b3345] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Commune</label>
                  <select
                    value={commune}
                    onChange={e => setCommune(e.target.value)}
                    className="w-full px-3 py-2 bg-[#212634] border border-[#2b3345] rounded-xl text-xs text-white focus:outline-none cursor-pointer"
                  >
                    <option value="Cocody">Cocody</option>
                    <option value="Marcory">Marcory</option>
                    <option value="Plateau">Plateau</option>
                    <option value="Yopougon">Yopougon</option>
                    <option value="Koumassi">Koumassi</option>
                    <option value="Deux Plateaux">Deux Plateaux</option>
                    <option value="Autre commune">Autre commune</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Quartier</label>
                  <input
                    type="text"
                    value={quarter}
                    onChange={e => setQuarter(e.target.value)}
                    className="w-full px-3 py-2 bg-[#212634] border border-[#2b3345] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Repère ou adresse physique</label>
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-[#212634] border border-[#2b3345] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          )}

          {/* STEP 3 : Véhicules */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <h4 className="text-base font-bold text-white">Étape 3 : Catégories de Véhicules Acceptées</h4>
                <p className="text-xs text-gray-400">Activez ou désactivez les types de véhicules pris en charge</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { id: 'particulier', name: 'Véhicule Particulier', icon: '🚗' },
                  { id: 'berline', name: 'Berline de luxe', icon: '🚘' },
                  { id: 'suv_4x4', name: '4x4 & SUV', icon: '🚙' },
                  { id: 'pickup', name: 'Pick-up Double Cabine', icon: '🛻' },
                  { id: 'taxi_communal', name: 'Wôrô-wôrô (Taxi communal)', icon: '🚕' },
                  { id: 'taxi_classique', name: 'Taxi Compteur', icon: '🚖' },
                  { id: 'minibus', name: 'Gbaka / Minibus', icon: '🚐' },
                  { id: 'moto', name: 'Moto / Deux-roues', icon: '🏍️' },
                  { id: 'gros_camion', name: 'Gros Camion / Poids lourd', icon: '🚛' },
                ].map(v => {
                  const isChecked = enabledVehicles.includes(v.id);
                  return (
                    <button
                      type="button"
                      key={v.id}
                      onClick={() => {
                        setEnabledVehicles(prev =>
                          isChecked ? prev.filter(x => x !== v.id) : [...prev, v.id]
                        );
                      }}
                      className={`p-3 rounded-xl border text-left text-xs transition-all flex items-center justify-between ${
                        isChecked
                          ? 'bg-cyan-500/20 border-cyan-400 text-white font-bold'
                          : 'bg-[#202532] border-[#2b3242] text-gray-500'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span>{v.icon}</span>
                        <span className="truncate">{v.name}</span>
                      </div>
                      {isChecked && <Check className="w-4 h-4 text-cyan-400 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 4 & 5 : Prestations & Tarifs */}
          {(currentStep === 4 || currentStep === 5) && (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <h4 className="text-base font-bold text-white">
                  {currentStep === 4 ? 'Étape 4 : Catalogue des Prestations' : 'Étape 5 : Grille Tarifaire Configurée'}
                </h4>
                <p className="text-xs text-gray-400">Les 3 formules standard de l'application sont préchargées :</p>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-[#212634] border border-[#2b3345] flex items-center justify-between">
                  <div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#483d6a] text-purple-200">
                      SHINE
                    </span>
                    <h5 className="font-bold text-white text-xs mt-1">Lavage Complet + Cire Lustrante</h5>
                    <p className="text-[11px] text-gray-400">Mousse active, aspiration habitacle, vitres & cire</p>
                  </div>
                  <div className="text-right font-extrabold text-cyan-400 text-sm">
                    60 $ / 39 000 FCFA
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#212634] border border-[#2b3345] flex items-center justify-between">
                  <div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#5c3e24] text-amber-200">
                      GLOSS
                    </span>
                    <h5 className="font-bold text-white text-xs mt-1">Intérieur & Extérieur Standard</h5>
                    <p className="text-[11px] text-gray-400">Lavage carrosserie, dégraissage jantes, dépoussiérage</p>
                  </div>
                  <div className="text-right font-extrabold text-cyan-400 text-sm">
                    45 $ / 29 000 FCFA
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#212634] border border-[#2b3345] flex items-center justify-between">
                  <div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#293d56] text-sky-200">
                      GLINT
                    </span>
                    <h5 className="font-bold text-white text-xs mt-1">Lavage Rapide Extérieur Haute Pression</h5>
                    <p className="text-[11px] text-gray-400">Canon à mousse et séchage microfibre (15 min)</p>
                  </div>
                  <div className="text-right font-extrabold text-cyan-400 text-sm">
                    35 $ / 22 500 FCFA
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 6 : Personnel */}
          {currentStep === 6 && (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <h4 className="text-base font-bold text-white">Étape 6 : Personnel & Laveurs</h4>
                <p className="text-xs text-gray-400">Configuration automatique de l'équipe initiale (6 laveurs, 1 caissier, 1 gérant)</p>
              </div>

              <div className="p-4 rounded-xl bg-[#212634] border border-[#2b3345] space-y-2 text-xs">
                <div className="flex justify-between text-gray-300">
                  <span>Règle de commission par lavage :</span>
                  <strong className="text-emerald-400">15% reversés aux laveurs</strong>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>Nombre de pistes gérées :</span>
                  <strong className="text-white">8 Pistes Haute Pression</strong>
                </div>
              </div>
            </div>
          )}

          {/* STEP 7 : Paiements */}
          {currentStep === 7 && (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <h4 className="text-base font-bold text-white">Étape 7 : Modes de Paiement Acceptés</h4>
                <p className="text-xs text-gray-400">Sélectionnez les moyens de règlement en station</p>
              </div>

              <div className="space-y-2.5">
                <label className="flex items-center justify-between p-3.5 rounded-xl bg-[#212634] border border-[#2b3345] cursor-pointer">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-xs">W</span>
                    <div>
                      <div className="font-bold text-white text-xs">Wave Côte d'Ivoire</div>
                      <div className="text-[10px] text-gray-400">Paiement QR code sans frais</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={waveEnabled}
                    onChange={e => setWaveEnabled(e.target.checked)}
                    className="w-4 h-4 text-cyan-500 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-xl bg-[#212634] border border-[#2b3345] cursor-pointer">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold text-xs">OM</span>
                    <div>
                      <div className="font-bold text-white text-xs">Orange Money CI</div>
                      <div className="text-[10px] text-gray-400">Code marchand #144#</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={orangeEnabled}
                    onChange={e => setOrangeEnabled(e.target.checked)}
                    className="w-4 h-4 text-cyan-500 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-xl bg-[#212634] border border-[#2b3345] cursor-pointer">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-yellow-500/20 text-yellow-400 flex items-center justify-center font-bold text-xs">MTN</span>
                    <div>
                      <div className="font-bold text-white text-xs">MTN Mobile Money</div>
                      <div className="text-[10px] text-gray-400">Paiement marchand *133#</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={mtnEnabled}
                    onChange={e => setMtnEnabled(e.target.checked)}
                    className="w-4 h-4 text-cyan-500 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-xl bg-[#212634] border border-[#2b3345] cursor-pointer">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">CFA</span>
                    <div>
                      <div className="font-bold text-white text-xs">Espèces en Caisse</div>
                      <div className="text-[10px] text-gray-400">Contrôle du tiroir-caisse avec écarts</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={cashEnabled}
                    onChange={e => setCashEnabled(e.target.checked)}
                    className="w-4 h-4 text-cyan-500 rounded"
                  />
                </label>
              </div>
            </div>
          )}

          {/* STEP 8 : Vitrine Publique */}
          {currentStep === 8 && (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <h4 className="text-base font-bold text-white">Étape 8 : Vitrine Commerciale Web</h4>
                <p className="text-xs text-gray-400">Votre page publique de promotion et prise de contact WhatsApp</p>
              </div>

              <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30 space-y-2 text-xs">
                <span className="font-bold text-white block">Adresse URL publique attribuée :</span>
                <span className="font-mono text-cyan-300 font-bold block">cleanit.ci/stations/{currentTenant.slug}</span>
                <p className="text-gray-300 text-[11px]">
                  Vos clients pourront consulter les prix, voir les photos de vos installations et vous contacter sur WhatsApp en 1 clic.
                </p>
              </div>
            </div>
          )}

          {/* STEP 9 : Activation Essai Gratuit */}
          {currentStep === 9 && (
            <div className="space-y-4 text-center py-4 animate-in fade-in">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-500 to-yellow-400 mx-auto flex items-center justify-center text-white shadow-xl shadow-amber-500/30">
                <Crown className="w-8 h-8" />
              </div>

              <div>
                <h4 className="text-xl font-black text-white">Activation de l'Essai Gratuit 7 Jours</h4>
                <p className="text-xs text-gray-300 max-w-md mx-auto mt-1">
                  Profitez de l'intégralité des fonctionnalités <strong>PRO</strong> (Gestion des 8 pistes, Caisse Wave & MoMo, Commissions laveurs, Vitrine web) sans aucun engagement.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#212634] border border-[#2b3345] max-w-sm mx-auto text-left text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-400">Offre d'essai :</span>
                  <span className="font-bold text-emerald-400">7 jours 100% gratuits</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Expiration :</span>
                  <span className="font-bold text-white">16 Novembre 2026</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Après l'essai :</span>
                  <span className="text-gray-300">Starter 5 000 F ou Pro 15 000 F</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Navigation Buttons */}
        <div className="p-5 bg-[#1d222d] border-t border-[#262c3b] flex items-center justify-between">
          <button
            type="button"
            disabled={currentStep === 1}
            onClick={handlePrev}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              currentStep === 1
                ? 'opacity-40 cursor-not-allowed text-gray-500'
                : 'bg-[#262c3a] text-gray-300 hover:text-white'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Précédent</span>
          </button>

          <button
            type="button"
            onClick={handleNext}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-600/25 transition-all active:scale-[0.98]"
          >
            <span>{currentStep === totalSteps ? 'Terminer & Activer la Station' : 'Étape Suivante'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
