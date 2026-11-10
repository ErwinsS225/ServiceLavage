import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { X, Printer, Share2, Download, QrCode, CheckCircle2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export const TicketModal: React.FC = () => {
  const { 
    selectedOrderForTicket, 
    setSelectedOrderForTicket, 
    currentTenant, 
    formatCurrency,
    employees 
  } = useApp();

  const [shareStatus, setShareStatus] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const ticketRef = useRef<HTMLDivElement>(null);

  if (!selectedOrderForTicket) return null;

  const order = selectedOrderForTicket;
  const assignedWashers = employees.filter(e => order.assignedStaffIds.includes(e.id));

  // Generate vector PDF fallback
  const buildReceiptPdf = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 165],
    });

    // Brand Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('SERVICELAVAGE CI', 40, 12, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(currentTenant.name || 'Station de Lavage Auto', 40, 17, { align: 'center' });
    doc.text(`${currentTenant.commune || 'Abidjan'} • Tél : ${currentTenant.phone || '+225 07 00 00 00'}`, 40, 21, { align: 'center' });

    // Dotted separator
    doc.setDrawColor(203, 213, 225);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(6, 26, 74, 26);

    // Ticket info
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('TICKET N° :', 6, 31);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(String(order.ticketNumber), 74, 31, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('DATE / HEURE :', 6, 36);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(new Date(order.createdAt).toLocaleString('fr-FR'), 74, 36, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('PISTE / BAY :', 6, 41);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`BAY AREA #${order.bayArea}`, 74, 41, { align: 'right' });

    // Vehicle Section
    doc.line(6, 45, 74, 45);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('VÉHICULE ENREGISTRÉ', 6, 49);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(order.vehicleInfo || 'Véhicule', 6, 54);
    doc.text(`IMMAT : ${order.plateNumber || 'N/A'}`, 74, 54, { align: 'right' });

    // Prestations
    doc.line(6, 58, 74, 58);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('PRESTATION', 6, 62);
    doc.text('PRIX (FCFA)', 74, 62, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    const serviceName = order.serviceNames?.[0] || order.washCategory || 'Lavage standard';
    doc.text(serviceName.slice(0, 22), 6, 67);
    doc.text(`${order.amount.toLocaleString('fr-FR')} XOF`, 74, 67, { align: 'right' });

    if (assignedWashers.length > 0) {
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Laveur(s) affecté(s) : ${assignedWashers.map(w => w.name).join(', ')}`, 6, 72);
    }

    // Total Amount Section
    doc.setLineDashPattern([], 0);
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.4);
    doc.line(6, 78, 74, 78);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('TOTAL NET :', 6, 84);
    doc.text(`${order.amount.toLocaleString('fr-FR')} FCFA`, 74, 84, { align: 'right' });

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`MODE : ${(order.paymentMethod || 'Espèces').toUpperCase()}`, 6, 90);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(order.paymentStatus === 'paye' ? 22 : 180, order.paymentStatus === 'paye' ? 101 : 83, 52);
    doc.text(order.paymentStatus === 'paye' ? 'RÉGLÉ - MERCI' : 'EN ATTENTE', 74, 90, { align: 'right' });

    // QR Verification & Legal Notice
    doc.setLineDashPattern([1, 1], 0);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.line(6, 97, 74, 97);

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('ServiceLavage CI • Reçu officiel certifié conforme', 40, 103, { align: 'center' });
    doc.text('Merci pour votre visite ! À très bientôt.', 40, 107, { align: 'center' });

    return doc;
  };

  const handlePrint = () => {
    window.print();
  };

  // Download directly as formatted PDF using html2canvas
  const handleDownloadPdf = async () => {
    setIsProcessing(true);
    setShareStatus('Génération du fichier PDF...');
    const fileName = `recu_servicelavage_${order.ticketNumber}.pdf`;

    try {
      if (ticketRef.current) {
        const canvas = await html2canvas(ticketRef.current, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
        });
        const imgData = canvas.toDataURL('image/png', 0.95);
        const pdfWidth = 80;
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        const doc = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: [pdfWidth, Math.max(pdfHeight, 80)],
        });
        doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        doc.save(fileName);
      } else {
        const doc = buildReceiptPdf();
        doc.save(fileName);
      }
      setShareStatus('Reçu PDF téléchargé avec succès !');
      setTimeout(() => setShareStatus(''), 3500);
    } catch (err) {
      console.error('Erreur téléchargement PDF:', err);
      const doc = buildReceiptPdf();
      doc.save(fileName);
      setShareStatus('Reçu PDF téléchargé !');
      setTimeout(() => setShareStatus(''), 3000);
    } finally {
      setIsProcessing(false);
    }
  };

  // Share via WhatsApp as a formatted PDF file
  const handleWhatsAppPdfShare = async () => {
    setIsProcessing(true);
    setShareStatus('Génération du PDF pour WhatsApp...');
    const fileName = `recu_servicelavage_${order.ticketNumber}.pdf`;

    try {
      let pdfBlob: Blob;

      if (ticketRef.current) {
        const canvas = await html2canvas(ticketRef.current, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
        });
        const imgData = canvas.toDataURL('image/png', 0.95);
        const pdfWidth = 80;
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        const doc = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: [pdfWidth, Math.max(pdfHeight, 80)],
        });
        doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdfBlob = doc.output('blob');
      } else {
        const doc = buildReceiptPdf();
        pdfBlob = doc.output('blob');
      }

      const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

      // Web Share API support for sending PDF file directly to WhatsApp
      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          files: [pdfFile],
          title: `Reçu ${order.ticketNumber} - ServiceLavage`,
          text: `Bonjour, voici le reçu officiel PDF pour votre véhicule ${order.vehicleInfo} (${order.plateNumber}). Montant : ${formatCurrency(order.amount)}.`,
        });
        setShareStatus('Reçu PDF partagé avec succès !');
        setTimeout(() => setShareStatus(''), 4000);
        return;
      }

      // Fallback: Download PDF to device and open WhatsApp with direct link
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const phone = (order.customerPhone || '').replace(/[^0-9]/g, '');
      const messageText = encodeURIComponent(
        `Bonjour, votre reçu officiel ServiceLavage N° ${order.ticketNumber} pour le véhicule ${order.vehicleInfo} (${order.plateNumber}) d'un montant de ${formatCurrency(order.amount)} a été édité au format PDF. Le fichier PDF a été téléchargé sur votre appareil.`
      );
      window.open(`https://wa.me/${phone}?text=${messageText}`, '_blank');
      setShareStatus('PDF téléchargé & WhatsApp ouvert pour l’envoi !');
      setTimeout(() => setShareStatus(''), 4500);
    } catch (err) {
      console.error('Erreur partage PDF WhatsApp:', err);
      setShareStatus('Erreur lors du partage.');
      setTimeout(() => setShareStatus(''), 3000);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#1a1e27] border border-[#2b3242] rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl text-gray-200">
        {/* Header */}
        <div className="p-4 border-b border-[#272e3d] flex items-center justify-between bg-[#1f2430]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span className="text-xs font-bold text-gray-200">Reçu Officiel · ServiceLavage</span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedOrderForTicket(null)}
            className="p-1 rounded-lg bg-[#272e3d] text-gray-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status notification */}
        {shareStatus && (
          <div className="px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>{shareStatus}</span>
          </div>
        )}

        {/* Printable & HTML-to-PDF Ticket Receipt Area (formatted for 80mm POS printer) */}
        <div 
          ref={ticketRef}
          className="p-6 bg-white text-gray-900 font-mono text-xs select-text printable-ticket"
        >
          {/* Header */}
          <div className="text-center pb-3 border-b-2 border-dashed border-gray-400 space-y-1">
            <div className="flex items-center justify-center gap-1.5 font-sans font-black text-lg text-cyan-600">
              <span className="w-3.5 h-3.5 rounded-full bg-cyan-500 inline-block" />
              SERVICELAVAGE
            </div>
            <p className="font-bold text-[11px] uppercase">{currentTenant.name}</p>
            <p className="text-[10px] text-gray-600">{currentTenant.address} • {currentTenant.commune}</p>
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
              <span className="font-bold">BAY AREA #{order.bayArea}</span>
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
              ServiceLavage CI • Plateforme Multitenant
            </p>
          </div>
        </div>

        {/* Modal Buttons: Print, Download as PDF, WhatsApp PDF */}
        <div className="p-3 bg-[#1a1e27] border-t border-[#272e3d] flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleWhatsAppPdfShare}
              className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm cursor-pointer"
              title="Envoyer le fichier PDF officiel par WhatsApp"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>WhatsApp (PDF)</span>
            </button>

            <button
              type="button"
              disabled={isProcessing}
              onClick={handleDownloadPdf}
              className="py-2 px-3 rounded-xl bg-[#202532] hover:bg-[#2b3343] disabled:opacity-50 border border-[#2e3748] text-gray-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm cursor-pointer"
              title="Télécharger directement en PDF"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Télécharger PDF</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="py-2 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm cursor-pointer"
              title="Imprimer le ticket de caisse"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimer</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
