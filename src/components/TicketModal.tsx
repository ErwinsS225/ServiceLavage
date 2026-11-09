import React from 'react';
import { useApp } from '../context/AppContext';
import { X, Printer, Share2, Check, QrCode } from 'lucide-react';

export const TicketModal: React.FC = () => {
  const { 
    selectedOrderForTicket, 
    setSelectedOrderForTicket, 
    currentTenant, 
    formatCurrency,
    employees 
  } = useApp();

  if (!selectedOrderForTicket) return null;

  const order = selectedOrderForTicket;
  const assignedWashers = employees.filter(e => order.assignedStaffIds.includes(e.id));

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(
      `*CLEAN IT CI - REÇU DE LAVAGE*\n` +
      `Station: ${currentTenant.name} (${currentTenant.commune})\n` +
      `Ticket N°: ${order.ticketNumber}\n` +
      `Véhicule: ${order.vehicleInfo} (${order.plateNumber})\n` +
      `Formule: ${order.washCategory}\n` +
      `Piste: Bay ${order.bayArea}\n` +
      `Montant: ${formatCurrency(order.amount)}\n` +
      `Statut: ${order.paymentStatus === 'paye' ? 'PAYÉ' : 'EN ATTENTE'}\n` +
      `Merci pour votre confiance !`
    );
    window.open(`https://wa.me/${order.customerPhone?.replace(/[^0-9]/g, '') || ''}?text=${text}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#1a1e27] border border-[#2b3242] rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl text-gray-200">
        {/* Header */}
        <div className="p-4 border-b border-[#272e3d] flex items-center justify-between bg-[#1f2430]">
          <span className="text-xs font-bold text-gray-200">Ticket Officiel de Caisse</span>
          <button
            onClick={() => setSelectedOrderForTicket(null)}
            className="p-1 rounded-lg bg-[#272e3d] text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable Ticket Receipt Area */}
        <div className="p-6 bg-white text-gray-900 font-mono text-xs select-text printable-ticket">
          {/* Header */}
          <div className="text-center pb-3 border-b-2 border-dashed border-gray-400 space-y-1">
            <div className="flex items-center justify-center gap-1.5 font-sans font-black text-lg text-cyan-600">
              <span className="w-3.5 h-3.5 rounded-full bg-cyan-500 inline-block" />
              CLEAN IT CI
            </div>
            <p className="font-bold text-[11px] uppercase">{currentTenant.name}</p>
            <p className="text-[10px] text-gray-600">{currentTenant.address}</p>
            <p className="text-[10px] text-gray-600">Tél : {currentTenant.phone}</p>
          </div>

          {/* Ticket metadata */}
          <div className="py-3 border-b border-dashed border-gray-300 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-gray-600">N° TICKET :</span>
              <span className="font-bold">{order.ticketNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">DATE :</span>
              <span>{new Date(order.createdAt).toLocaleString('fr-FR')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">PISTE :</span>
              <span className="font-bold">BAY AREA : {order.bayArea}</span>
            </div>
          </div>

          {/* Vehicle & Services */}
          <div className="py-3 border-b border-dashed border-gray-300 space-y-2 text-[11px]">
            <div>
              <span className="text-gray-500 text-[10px]">VÉHICULE</span>
              <div className="font-bold text-xs">{order.vehicleInfo}</div>
              <div className="text-[10px] text-gray-700">Immat : {order.plateNumber}</div>
            </div>

            <div>
              <span className="text-gray-500 text-[10px]">PRESTATION</span>
              <div className="flex justify-between font-bold">
                <span>{order.serviceNames?.[0] || order.washCategory}</span>
                <span>{formatCurrency(order.amount)}</span>
              </div>
            </div>

            {assignedWashers.length > 0 && (
              <div className="text-[10px] text-gray-600">
                Laveur(s) : {assignedWashers.map(w => w.name).join(', ')}
              </div>
            )}
          </div>

          {/* Total & Payment */}
          <div className="py-3 border-b-2 border-dashed border-gray-400 space-y-1.5 text-[11px]">
            <div className="flex justify-between text-sm font-black">
              <span>TOTAL :</span>
              <span>{formatCurrency(order.amount)}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-gray-600">MODE RÈGLEMENT :</span>
              <span className="font-bold uppercase">{order.paymentMethod || 'Espèces'}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-gray-600">STATUT :</span>
              <span className={`font-bold ${order.paymentStatus === 'paye' ? 'text-green-700' : 'text-amber-700'}`}>
                {order.paymentStatus === 'paye' ? 'RÉGLÉ - MERCI' : 'EN ATTENTE'}
              </span>
            </div>
          </div>

          {/* QR Code & Footer */}
          <div className="pt-4 text-center space-y-2">
            <div className="flex justify-center">
              <div className="p-2 border border-gray-300 rounded bg-gray-50">
                <QrCode className="w-16 h-16 text-gray-800" />
              </div>
            </div>
            <p className="text-[9px] text-gray-500 uppercase">
              Scannez pour suivre l'état d'avancement de votre lavage
            </p>
            <p className="text-[9px] font-bold text-gray-700">
              Clean It CI • www.cleanit-ci.com
            </p>
          </div>
        </div>

        {/* Modal Buttons */}
        <div className="p-4 bg-[#1a1e27] border-t border-[#272e3d] flex items-center justify-between gap-2">
          <button
            onClick={handleWhatsAppShare}
            className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>WhatsApp</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex-1 py-2 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimer</span>
          </button>
        </div>
      </div>
    </div>
  );
};
