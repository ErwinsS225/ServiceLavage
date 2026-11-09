import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  HelpCircle, 
  BookOpen, 
  Smartphone, 
  Wifi, 
  Wrench, 
  Users, 
  ChevronDown, 
  ChevronUp, 
  ShieldCheck, 
  Car,
  DollarSign
} from 'lucide-react';

export const HelpScreen: React.FC = () => {
  const { currentTenant, setActiveTab } = useApp();

  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  const faqs = [
    {
      q: "Comment enregistrer rapidement un véhicule en heure de pointe ?",
      a: "Accédez à l'onglet 'Nouvelle Prestation (POS)', sélectionnez la catégorie du véhicule (ex: Berline ou Wôrô-wôrô), saisissez la plaque, choisissez la formule (Shine, Gloss ou Glint) et cliquez sur 'Valider & Émettre le Ticket'. L'opération prend moins de 15 secondes."
    },
    {
      q: "Comment fonctionne le mode hors-ligne en cas de coupure Internet à Abidjan ?",
      a: "Clean It fonctionne en mode Local-First. Dès qu'une coupure est détectée, un badge orange 'Hors-ligne' apparaît. Toutes vos saisies et encaissements restent possibles et sont stockés de manière sécurisée dans la mémoire de l'appareil. Dès le rétablissement de la connexion, un clic sur le bouton de synchronisation transfère tout vers le cloud."
    },
    {
      q: "Comment sont calculées et reversées les commissions des laveurs ?",
      a: "Par défaut, chaque laveur affecté à une prestation validée perçoit 15% du montant hors taxe du lavage. Le système cumule automatiquement les montants sur leur fiche employé dans l'onglet 'Personnel & Commissions', permettant un versement transparent chaque samedi ou fin de mois."
    },
    {
      q: "Puis-je personnaliser les tarifs selon les types de véhicules ?",
      a: "Oui. Dans l'onglet 'Catalogue & Tarifs', vous pouvez définir des prix spécifiques pour les motos, taxis communaux, berlines, SUV/4x4, pick-up et poids lourds pour chaque formule."
    },
    {
      q: "Comment partager le reçu de caisse par WhatsApp au client ?",
      a: "Lors de la création du lavage ou depuis l'historique des transactions, ouvrez le ticket et cliquez sur le bouton vert 'WhatsApp'. Le reçu est instantanément formaté et prêt à être envoyé sur le numéro du client."
    },
    {
      q: "Comment fonctionne la vitrine commerciale de ma station ?",
      a: "Votre station dispose d'une page publique accessible sur l'URL cleanit.ci/stations/[nom-station]. Elle affiche vos photos, horaires, tarifs et intègre un bouton de contact WhatsApp direct pour générer des réservations régulières."
    }
  ];

  return (
    <div className="p-6 space-y-8 max-w-[1400px] mx-auto text-gray-200">
      {/* Top Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            BASE DE CONNAISSANCES & SUPPORT CI
          </span>
        </div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2 mt-1">
          <HelpCircle className="w-5 h-5 text-cyan-400" />
          <span>Guide d'Utilisation & Bonnes Pratiques Lavage Auto CI</span>
        </h2>
        <p className="text-xs text-gray-400">
          Toutes les procédures pour optimiser la gestion, les encaissements et la fidélisation dans votre station
        </p>
      </div>

      {/* 4 Feature Guide Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-5 rounded-2xl bg-[#1c202a] border border-[#272d3b] space-y-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
            <Car className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-white text-sm">Gestion de la File</h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            Attribution des pistes (1 à 8) et rotation rapide pour éliminer les goulots d'étranglement aux heures de pointe.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[#1c202a] border border-[#272d3b] space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
            <DollarSign className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-white text-sm">Paiements Mobile Money</h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            Privilégiez les règlements Wave, Orange et MTN pour sécuriser vos recettes et éliminer les erreurs de caisse.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[#1c202a] border border-[#272d3b] space-y-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-white text-sm">Commissions des Laveurs</h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            Suivi automatisé des 15% par prestation pour motiver vos équipes et valoriser la rapidité et la qualité du travail.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[#1c202a] border border-[#272d3b] space-y-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
            <Wifi className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-white text-sm">Résilience Hors-Ligne</h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            Ne perdez jamais une vente : travaillez en toute sérénité même en cas de coupure de réseau ou de courant temporaire.
          </p>
        </div>
      </div>

      {/* Procedural Step Guide for Station Staff */}
      <div className="bg-[#1c202a] border border-[#272d3b] rounded-2xl p-6 space-y-5">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-cyan-400" />
          <span>Procédure Journalière Type Recommandée pour le Caissier & Gérant</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-[#222734] border border-[#2c3343] space-y-2">
            <span className="font-bold text-cyan-400 text-xs block">06h30 — Ouverture</span>
            <p className="text-gray-300">
              Ouvrir la session de caisse avec le fond de caisse espèces (ex: 50 000 FCFA). Vérifier la pression des pompes karcher et le stock de shampoing.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#222734] border border-[#2c3343] space-y-2">
            <span className="font-bold text-emerald-400 text-xs block">Journée — Exploitation</span>
            <p className="text-gray-300">
              Enregistrer chaque véhicule dès l'entrée sur le POS. Attribuer la piste et le laveur. Émettre le ticket ou l'envoyer sur WhatsApp.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#222734] border border-[#2c3343] space-y-2">
            <span className="font-bold text-amber-400 text-xs block">21h00 — Clôture</span>
            <p className="text-gray-300">
              Clôturer la session de caisse, compter les espèces physiques, vérifier les transferts Wave et Orange Money reçus et exporter le rapport journalier.
            </p>
          </div>
        </div>
      </div>

      {/* Interactive FAQ Accordion */}
      <div className="bg-[#1c202a] border border-[#272d3b] rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-bold text-white">Foire Aux Questions (FAQ)</h3>

        <div className="divide-y divide-[#272d3b]">
          {faqs.map((faq, idx) => {
            const isExpanded = expandedFaq === idx;
            return (
              <div key={idx} className="py-3.5 first:pt-0 last:pb-0">
                <button
                  type="button"
                  onClick={() => setExpandedFaq(isExpanded ? null : idx)}
                  className="w-full flex items-center justify-between text-left text-xs font-bold text-gray-200 hover:text-white transition-colors"
                >
                  <span>{faq.q}</span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  )}
                </button>

                {isExpanded && (
                  <p className="text-xs text-gray-400 mt-2 leading-relaxed pl-2 border-l-2 border-cyan-500">
                    {faq.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
