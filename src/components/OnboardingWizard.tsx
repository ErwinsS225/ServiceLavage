import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  User, Building2, Car, Sparkles, DollarSign, Users, CreditCard, Globe, Crown, ArrowRight, ArrowLeft, Check, X
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = {
  key: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
};

const STEPS: Step[] = [
  { key: 'owner', title: 'Propriétaire', subtitle: 'Vos identifiants d\'administrateur', icon: User },
  { key: 'station', title: 'Station', subtitle: 'Nom, ville et adresse de votre lavage', icon: Building2 },
  { key: 'vehicles', title: 'Véhicules', subtitle: 'Catégories acceptées en station', icon: Car },
  { key: 'catalog', title: 'Catalogue & Tarifs', subtitle: 'Formules de lavage préchargées', icon: Sparkles },
  { key: 'staff', title: 'Personnel', subtitle: 'Laveurs, caissier et commissions', icon: Users },
  { key: 'payments', title: 'Paiements', subtitle: 'Modes de règlement acceptés', icon: CreditCard },
  { key: 'showcase', title: 'Vitrine Web', subtitle: 'Page publique de votre station', icon: Globe },
  { key: 'trial', title: 'Essai Gratuit', subtitle: 'Activation de l\'offre PRO 7 jours', icon: Crown },
];

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ isOpen, onClose }) => {
  const { currentTenant, updateCurrentTenant, showBanner, setActiveTab } = useApp();

  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Form State
  const [ownerName, setOwnerName] = useState('Yao Michel');
  const [ownerPhone, setOwnerPhone] = useState('+225 07 48 99 10 22');
  const [ownerEmail, setOwnerEmail] = useState('michel.yao@cleanit.ci');

  const [stationName, setStationName] = useState('Clean It - Cocody Riviera');
  const [city, setCity] = useState('Abidjan');
  const [commune, setCommune] = useState('Cocody');
  const [quarter, setQuarter] = useState('Riviera Bonoumin');
  const [address, setAddress] = useState('Boulevard Mitterrand face Cap Sud');

  const [enabledVehicles, setEnabledVehicles] = useState<string[]>([
    'berline', 'suv_4x4', 'pickup', 'particulier', 'taxi_communal', 'taxi_classique'
  ]);

  const totalSteps = STEPS.length;
  const currentStep = STEPS[currentStepIndex];
  const isLastStep = currentStepIndex === totalSteps - 1;

  const handleNext = () => {
    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      // Spectaculaire animation confetti de validation
      const duration = 1500;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 60 };

      const randomInRange = (min: number, max: number) =>
        Math.random() * (max - min) + min;

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          clearInterval(interval);
          return;
        }

        const particleCount = 50 * (timeLeft / duration);

        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.9), y: randomInRange(0.1, 0.3) },
          colors: ['#22d3ee', '#10b981', '#f59e0b', '#ef4444', '#a855f7'],
        });

        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0, 0.3), y: 0.7 },
          colors: ['#22d3ee', '#10b981', '#f59e0b'],
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 1), y: 0.7 },
          colors: ['#ef4444', '#a855f7', '#f59e0b'],
        });
      }, 250);

      updateCurrentTenant({
        name: stationName,
        city,
        commune,
        quarter,
        address,
        subscriptionStatus: 'trial',
      });
      try {
        confetti({
          particleCount: 150,
          spread: 100,
          origin: { y: 0.6 },
          colors: ['#22d3ee', '#10b981'],
        });
      } catch {}
      showBanner('Félicitations ! Votre station est configurée avec 7 jours d\'essai gratuit !', 'success');
      onClose();
      setActiveTab('dashboard');
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const getStepStatus = (index: number) => {
    if (index < currentStepIndex) return 'done';
    if (index === currentStepIndex) return 'active';
    return 'pending';
  };

  const Icon = currentStep.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-[#191d26] border border-[#2c3344] rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl text-gray-200 flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="p-6 border-b border-[#262c3b] bg-[#1d222d] flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 uppercase tracking-wider">
                Assistant Onboarding
              </span>
              <span className="text-xs text-gray-400 font-semibold">
                Étape {currentStepIndex + 1} sur {totalSteps}
              </span>
            </div>
            <h3 className="text-lg font-bold text-white mt-1">{currentStep.title}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{currentStep.subtitle}</p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-[#262c3a] text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Stepper */}
        <div className="px-6 py-4 bg-[#161922] border-b border-[#242938]">
          <div className="flex items-center justify-between space-x-2">
            {STEPS.map((step, index) => {
              const status = getStepStatus(index);
              const isDone = status === 'done';
              const isActive = status === 'active';
              return (
                <div
                  key={step.key}
                  className="flex flex-col items-center gap-1 relative z-10"
                >
                  <div
                    className={`
                      flex size-7 items-center justify-center rounded-full font-bold text-xs transition-all
                      ${isDone ? 'bg-emerald-500 text-white shadow-md shadow-emerald-600/30' : ''}
                      ${isActive ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-600/40' : ''}
                      ${!isDone && !isActive ? 'bg-[#202532] text-gray-500 border border-[#2c3344]' : ''}
                    `}
                  >
                    {isDone ? <Check className="w-3.5 h-3.5" /> : index + 1}
                  </div>
                  <span className={`text-[10px] font-semibold leading-tight text-center ${isActive ? 'text-cyan-400' : isDone ? 'text-emerald-400' : 'text-gray-500'}`}>
                    {step.title}
                  </span>
                  {index < totalSteps - 1 && (
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-[calc(100%+2rem)] h-px -z-10">
                      <div
                        className={`
                          h-full ${isDone ? 'bg-emerald-500' : 'bg-[#2c3344]'}
                          transition-all duration-300
                          ${isDone ? 'w-full' : 'w-0'}
                        `}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="p-6 sm:p-8 flex-1 overflow-y-auto space-y-6 animate-in fade-in">
          {/* STEP: owner */}
          {currentStep.key === 'owner' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-base font-bold text-white">Étape : Informations du Propriétaire</h4>
                <p className="text-xs text-gray-400">Créez votre compte administrateur principal de la station.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Nom Complet</label>
                  <input
                    type="text"
                    value={ownerName}
                    onChange={e => setOwnerName(e.target.value)}
                    placeholder="Ex: Yao Michel"
                    className="w-full px-3 py-2 bg-[#212634] border border-[#2b3345] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Téléphone (Mobile CI)</label>
                  <input
                    type="tel"
                    value={ownerPhone}
                    onChange={e => setOwnerPhone(e.target.value)}
                    placeholder="+225 07 XX XX XX XX"
                    className="w-full px-3 py-2 bg-[#212634] border border-[#2b3345] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Email Professionnel</label>
                <input
                  type="email"
                  value={ownerEmail}
                  onChange={e => setOwnerEmail(e.target.value)}
                  placeholder="michel.yao@cleanit.ci"
                  className="w-full px-3 py-2 bg-[#212634] border border-[#2b3345] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          )}

          {/* STEP: station */}
          {currentStep.key === 'station' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-base font-bold text-white">Étape : Informations de la Station</h4>
                <p className="text-xs text-gray-400">Localisation précise pour que vos clients vous trouvent.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Nom Commercial</label>
                <input
                  type="text"
                  value={stationName}
                  onChange={e => setStationName(e.target.value)}
                  placeholder="Ex: Clean It - Cocody Riviera"
                  className="w-full px-3 py-2 bg-[#212634] border border-[#2b3345] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Ville</label>
                  <select
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    className="w-full px-3 py-2 bg-[#212634] border border-[#2b3345] rounded-xl text-xs text-white focus:outline-none cursor-pointer"
                  >
                    <option value="Abidjan">Abidjan</option>
                    <option value="Yamoussoukro">Yamoussoukro</option>
                    <option value="Bouaké">Bouaké</option>
                    <option value="Daloa">Daloa</option>
                    <option value="Korhogo">Korhogo</option>
                    <option value="San Pedro">San Pedro</option>
                    <option value="Autre">Autre ville</option>
                  </select>
                </div>
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
                    <option value="Autre">Autre commune</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Quartier</label>
                  <input
                    type="text"
                    value={quarter}
                    onChange={e => setQuarter(e.target.value)}
                    placeholder="Ex: Riviera Bonoumin"
                    className="w-full px-3 py-2 bg-[#212634] border border-[#2b3345] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Adresse / Repère physique</label>
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="Ex: Boulevard Mitterrand face Cap Sud"
                  className="w-full px-3 py-2 bg-[#212634] border border-[#2b3345] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          )}

          {/* STEP: vehicles */}
          {currentStep.key === 'vehicles' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-base font-bold text-white">Étape : Catégories de Véhicules</h4>
                <p className="text-xs text-gray-400">Sélectionnez les types de véhicules pris en charge en station.</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {[
                  { id: 'particulier', name: 'Particulier', icon: '🚗' },
                  { id: 'berline', name: 'Berline', icon: '🚘' },
                  { id: 'suv_4x4', name: '4x4 & SUV', icon: '🚙' },
                  { id: 'pickup', name: 'Pick-up', icon: '🛻' },
                  { id: 'taxi_communal', name: 'Wôrô-wôrô', icon: '🚕' },
                  { id: 'taxi_classique', name: 'Taxi Compteur', icon: '🚖' },
                  { id: 'minibus', name: 'Gbaka / Minibus', icon: '🚐' },
                  { id: 'moto', name: 'Moto', icon: '🏍️' },
                  { id: 'gros_camion', name: 'Gros Camion', icon: '🚛' },
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
                      <div className="flex items-center gap-2">
                        <span>{v.icon}</span>
                        <span>{v.name}</span>
                      </div>
                      {isChecked && <Check className="w-4 h-4 text-cyan-400 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP: catalog */}
          {currentStep.key === 'catalog' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-base font-bold text-white">Étape : Catalogue des Prestations</h4>
                <p className="text-xs text-gray-400">Les 3 formules standards sont préchargées et prêtes à l'emploi.</p>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-[#212634] border border-[#2b3345] flex items-center justify-between">
                  <div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#483d6a] text-purple-200">SHINE</span>
                    <h5 className="font-bold text-white text-xs mt-1">Lavage Complet + Cire Lustrante</h5>
                    <p className="text-[11px] text-gray-400">Mousse active, aspiration, vitres & cire</p>
                  </div>
                  <div className="text-right font-extrabold text-cyan-400 text-sm">39 000 FCFA</div>
                </div>

                <div className="p-4 rounded-xl bg-[#212634] border border-[#2b3345] flex items-center justify-between">
                  <div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#5c3e24] text-amber-200">GLOSS</span>
                    <h5 className="font-bold text-white text-xs mt-1">Intérieur & Extérieur Standard</h5>
                    <p className="text-[11px] text-gray-400">Carrosserie, jantes, dépoussiérage</p>
                  </div>
                  <div className="text-right font-extrabold text-cyan-400 text-sm">29 000 FCFA</div>
                </div>

                <div className="p-4 rounded-xl bg-[#212634] border border-[#2b3345] flex items-center justify-between">
                  <div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#293d56] text-sky-200">GLINT</span>
                    <h5 className="font-bold text-white text-xs mt-1">Lavage Rapide Haute Pression</h5>
                    <p className="text-[11px] text-gray-400">Canon à mousse, séchage microfibre (15 min)</p>
                  </div>
                  <div className="text-right font-extrabold text-cyan-400 text-sm">22 500 FCFA</div>
                </div>
              </div>
            </div>
          )}

          {/* STEP: staff */}
          {currentStep.key === 'staff' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-base font-bold text-white">Étape : Personnel de Station</h4>
                <p className="text-xs text-gray-400">Configuration automatique de l'équipe initiale.</p>
              </div>

              <div className="p-4 rounded-xl bg-[#212634] border border-[#2b3345] space-y-2 text-xs">
                <div className="flex justify-between text-gray-300">
                  <span>Règle de commission :</span>
                  <strong className="text-emerald-400">15% reversés aux laveurs</strong>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>Pistes gérées :</span>
                  <strong className="text-white">8 Pistes Haute Pression</strong>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>Équipe initiale :</span>
                  <strong className="text-white">6 laveurs, 1 caissier, 1 gérant</strong>
                </div>
              </div>
            </div>
          )}

          {/* STEP: payments */}
          {currentStep.key === 'payments' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-base font-bold text-white">Étape : Modes de Paiement</h4>
                <p className="text-xs text-gray-400">Sélectionnez les moyens de règlement acceptés en station.</p>
              </div>

              <div className="space-y-2.5">
                <label className="flex items-center justify-between p-3.5 rounded-xl bg-[#212634] border border-[#2b3345] cursor-pointer">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">CFA</span>
                    <div>
                      <div className="font-bold text-white text-xs">Espèces en Caisse</div>
                      <div className="text-[10px] text-gray-400">Paiement par défaut activé</div>
                    </div>
                  </div>
                  <input type="checkbox" checked readOnly className="w-4 h-4 text-cyan-500 rounded" />
                </label>

                <p className="text-[10px] text-gray-500 mt-2 text-center">
                  Les paiements Mobile Money (Wave, Orange, MTN, Moov) sont pré-configurés. Activez-les depuis les paramètres ou le fichier <code className="text-cyan-400">.env</code> ({'VITE_PAYMENT_WAVE=true'}).
                </p>
              </div>
            </div>
          )}

          {/* STEP: showcase */}
          {currentStep.key === 'showcase' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-base font-bold text-white">Étape : Vitrine Commerciale Web</h4>
                <p className="text-xs text-gray-400">Votre page publique de promotion et prise de contact WhatsApp.</p>
              </div>

              <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30 space-y-2 text-xs">
                <span className="font-bold text-white block">Adresse URL publique attribuée :</span>
                <span className="font-mono text-cyan-300 font-bold block">cleanit.ci/stations/{currentTenant.slug}</span>
                <p className="text-gray-300 text-[11px]">
                  Vos clients consultent les prix, voient vos installations et vous contactent sur WhatsApp en 1 clic.
                </p>
              </div>
            </div>
          )}

          {/* STEP: trial */}
          {currentStep.key === 'trial' && (
            <div className="space-y-4 text-center py-4">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-500 to-yellow-400 mx-auto flex items-center justify-center text-white shadow-xl shadow-amber-500/30">
                <Crown className="w-8 h-8" />
              </div>

              <div>
                <h4 className="text-xl font-black text-white">Activation de l'Essai Gratuit 7 Jours</h4>
                <p className="text-xs text-gray-300 max-w-md mx-auto mt-1">
                  Profitez de l'intégralité des fonctionnalités <strong>PRO</strong> (8 pistes, Caisse, Commissions laveurs, Vitrine web) sans aucun engagement.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#212634] border border-[#2b3345] max-w-sm mx-auto text-left text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-400">Offre d'essai :</span>
                  <span className="font-bold text-emerald-400">7 jours 100% gratuits</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Après l'essai :</span>
                  <span className="text-gray-300">Starter 5 000 F ou Pro 15 000 F</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="p-5 bg-[#1d222d] border-t border-[#262c3b] flex items-center justify-between">
          <button
            type="button"
            disabled={currentStepIndex === 0}
            onClick={handlePrev}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              currentStepIndex === 0
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
            <span>{isLastStep ? 'Terminer & Activer la Station' : 'Étape Suivante'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
