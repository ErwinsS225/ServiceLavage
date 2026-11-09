import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  X, 
  Car, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Receipt, 
  Share2, 
  DollarSign, 
  User, 
  Calendar,
  AlertTriangle,
  Send,
  MessageCircle
} from 'lucide-react';
import { WashOrder, WashStatus, PaymentMethod } from '../types';

interface OrderDetailModalProps {
  order: WashOrder | null;
  onClose: () => void;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({ order, onClose }) => {
  const { 
    updateOrderStatus, 
    updatePaymentStatus, 
    formatCurrency, 
    employees, 
    setSelectedOrderForTicket, 
    currentTenant,
    showBanner 
  } = useApp();

  const [notes, setNotes] = useState(order?.notes || '');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(order?.paymentMethod || 'wave');
  const [partialAmount, setPartialAmount] = useState<string>(order ? String(order.amount) : '0');

  if (!order) return null;

  const assignedWashers = employees.filter(e => order.assignedStaffIds.includes(e.id));
  const isPaid = order.paymentStatus === 'paye';

  const handleStatusChange = (newStatus: WashStatus) => {
    updateOrderStatus(order.id, newStatus);
    showBanner(`Statut de ${order.ticketNumber} passé à : ${newStatus.toUpperCase()}`);
  };

  const handlePayment = () => {
    updatePaymentStatus(order.id, 'paye', selectedMethod);
    showBanner(`Paiement de ${formatCurrency(order.amount)} enregistré via ${selectedMethod.toUpperCase()}`);
  };

  const handleWhatsAppNotify = () => {
    const text = encodeURIComponent(
      `Bonjour M./Mme ${order.customerName || ''}, votre véhicule ${order.vehicleInfo} (${order.plateNumber}) est prêt chez ${currentTenant.name} ! Montant : ${formatCurrency(order.amount)}. Merci de votre visite !`
    );
    window.open(`https://wa.me/${order.customerPhone?.replace(/[^0-9]/g, '') || ''}?text=${text}`, '_blank');
  };

  const timelineSteps = [
    { key: 'en_attente', label: 'Enregistré / Accueil', time: new Date(order.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) },
    { key: 'affecte', label: `Affecté Piste ${order.bayArea}`, time: order.startedAt ? new Date(order.startedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—' },
    { key: 'en_cours', label: 'Lavage en cours', time: order.status === 'en_cours' || order.status === 'termine' ? 'Actif' : 'En attente' },
    { key: 'termine', label: 'Terminé & Contrôle qualité', time: order.completedAt ? new Date(order.completedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—' },
  ];

  const currentStepIndex = timelineSteps.findIndex(s => s.key === order.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#1a1e27] border border-[#2b3242] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl text-gray-200">
        {/* Header */}
        <div className="p-5 border-b border-[#272e3d] flex items-center justify-between sticky top-0 bg-[#1a1e27] z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">{order.vehicleInfo}</h3>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-bold">
                  {order.plateNumber}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-[#282f3e] text-gray-300 font-bold">
                  {order.ticketNumber}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Piste {order.bayArea} • Formule {order.washCategory} • Créé le {new Date(order.createdAt).toLocaleString('fr-FR')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#242a38] text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Timeline of the wash cycle */}
          <div>
            <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">
              Cycle Opérationnel du Lavage
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {timelineSteps.map((step, idx) => {
                const isPassed = idx <= (currentStepIndex === -1 ? 0 : currentStepIndex);
                const isCurrent = step.key === order.status;
                return (
                  <div
                    key={step.key}
                    className={`p-3 rounded-xl border transition-all ${
                      isCurrent
                        ? 'bg-cyan-500/15 border-cyan-400 text-white shadow-sm'
                        : isPassed
                        ? 'bg-[#202532] border-emerald-500/30 text-emerald-300'
                        : 'bg-[#181c24] border-[#252b39] text-gray-500'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-bold">Étape {idx + 1}</span>
                      <span className="text-[10px] opacity-80">{step.time}</span>
                    </div>
                    <div className="text-xs font-semibold">{step.label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick status progress actions */}
          <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-[#202532] border border-[#2b3242]">
            <span className="text-xs font-semibold text-gray-400 mr-2">Changer Statut :</span>
            {(['en_attente', 'affecte', 'en_cours', 'termine'] as WashStatus[]).map(st => (
              <button
                key={st}
                onClick={() => handleStatusChange(st)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  order.status === st
                    ? 'bg-cyan-500 text-white shadow-sm'
                    : 'bg-[#282f3e] text-gray-300 hover:bg-[#343e52]'
                }`}
              >
                {st.replace('_', ' ').toUpperCase()}
              </button>
            ))}

            {order.customerPhone && (
              <button
                onClick={handleWhatsAppNotify}
                className="ml-auto px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Notifier le client sur WhatsApp</span>
              </button>
            )}
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Left: Client & Staff */}
            <div className="p-4 rounded-xl bg-[#202532] border border-[#2b3242] space-y-3">
              <h5 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-cyan-400" />
                <span>Client & Équipe de Lavage</span>
              </h5>

              <div className="space-y-1.5 text-xs text-gray-300">
                <div className="flex justify-between">
                  <span className="text-gray-400">Nom du client :</span>
                  <span className="font-bold text-white">{order.customerName || 'Client de passage'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Téléphone :</span>
                  <span className="font-mono text-cyan-400">{order.customerPhone || 'Non renseigné'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Piste de lavage :</span>
                  <span className="font-bold text-white">Bay Area : {order.bayArea}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-[#293040]">
                <span className="text-[11px] text-gray-400 block mb-1">Laveurs affectés :</span>
                <div className="flex flex-wrap gap-1.5">
                  {assignedWashers.map(washer => (
                    <span key={washer.id} className="px-2 py-0.5 rounded-md bg-[#2b3345] text-cyan-300 text-[11px] font-semibold">
                      {washer.name} (15% commission)
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Payment & Invoicing */}
            <div className="p-4 rounded-xl bg-[#202532] border border-[#2b3242] space-y-3">
              <h5 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                <span>Finances & Règlement</span>
              </h5>

              <div className="space-y-1.5 text-xs text-gray-300">
                <div className="flex justify-between">
                  <span className="text-gray-400">Montant prestation :</span>
                  <span className="font-bold text-white">{formatCurrency(order.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Remise accordée :</span>
                  <span className="text-rose-400 font-bold">{order.discount > 0 ? `-${formatCurrency(order.discount)}` : '0 FCFA'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Statut de paiement :</span>
                  <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                    isPaid ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {isPaid ? 'RÉGLÉ' : 'EN ATTENTE'}
                  </span>
                </div>
                {order.paymentMethod && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Mode de paiement :</span>
                    <span className="font-bold uppercase text-white">{order.paymentMethod}</span>
                  </div>
                )}
              </div>

              {!isPaid && (
                <div className="pt-2 border-t border-[#293040] space-y-2">
                  <span className="text-[11px] text-gray-400 block font-semibold">Régler maintenant :</span>
                  <div className="grid grid-cols-4 gap-1">
                    {(['wave', 'orange_money', 'mtn_momo', 'especes'] as PaymentMethod[]).map(pm => (
                      <button
                        key={pm}
                        type="button"
                        onClick={() => setSelectedMethod(pm)}
                        className={`p-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                          selectedMethod === pm
                            ? 'bg-cyan-500 text-white shadow-sm'
                            : 'bg-[#293040] text-gray-400 hover:text-white'
                        }`}
                      >
                        {pm === 'orange_money' ? 'Orange' : pm === 'mtn_momo' ? 'MTN' : pm}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handlePayment}
                    className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md mt-1"
                  >
                    Valider Paiement ({formatCurrency(order.amount)})
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Audit trail log */}
          <div className="p-3.5 rounded-xl bg-[#171a22] border border-[#242b38] text-xs text-gray-400 space-y-1">
            <span className="font-bold text-gray-300 text-[11px] block uppercase">Journal d'Audit du Véhicule</span>
            <p>• {new Date(order.createdAt).toLocaleTimeString('fr-FR')} : Véhicule enregistré à l'accueil par le Caissier.</p>
            <p>• Attribution automatique à la piste {order.bayArea} ({order.washCategory}).</p>
            {order.paymentStatus === 'paye' && (
              <p className="text-emerald-400">• Règlement complet validé via {order.paymentMethod?.toUpperCase()}.</p>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#1f2430] border-t border-[#272e3d] flex items-center justify-between">
          <button
            onClick={() => {
              setSelectedOrderForTicket(order);
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-[#282f3e] hover:bg-[#343e52] text-xs font-bold text-cyan-300 flex items-center gap-1.5 transition-colors"
          >
            <Receipt className="w-4 h-4" />
            <span>Voir / Imprimer le Ticket</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#2b3345] text-xs font-semibold text-gray-300 hover:text-white transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
