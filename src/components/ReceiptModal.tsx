import { useState, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { X, Printer, Share2, Download, CheckCircle2, QrCode } from 'lucide-react';
import { formatXof } from '../lib/money';
import { generatePdfFromElement, downloadPdfBlob, sharePdfToMessaging } from '../lib/pdfExport';

export interface ReceiptItem {
  name: string;
  price: number;
}

export interface OrderReceiptData {
  id: string;
  ticketNumber?: string;
  vehicleInfo: string;
  plateNumber: string | null;
  totalXof: number;
  status: string;
  createdAt: string;
  items?: ReceiptItem[];
  customerName?: string;
  customerPhone?: string;
  paymentMethod?: string;
  bayArea?: string | number;
}

interface ReceiptModalProps {
  order: OrderReceiptData;
  stationName: string;
  onClose: () => void;
}

export function ReceiptModal({ order, stationName, onClose }: ReceiptModalProps) {
  const [feedback, setFeedback] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const ticketRef = useRef<HTMLDivElement>(null);

  const ticketCode = order.ticketNumber || `SL-${order.id.slice(0, 8).toUpperCase()}`;
  const dateFormatted = new Date(order.createdAt).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Vector fallback constructor using jsPDF
  const buildReceiptPdf = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 165],
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('SERVICELAVAGE CI', 40, 12, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(stationName || 'Station de Lavage Auto', 40, 17, { align: 'center' });
    doc.text('Abidjan, Côte d’Ivoire • Reçu officiel', 40, 21, { align: 'center' });

    doc.setDrawColor(203, 213, 225);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(6, 26, 74, 26);

    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('TICKET N° :', 6, 31);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(ticketCode, 74, 31, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('DATE & HEURE :', 6, 36);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(dateFormatted, 74, 36, { align: 'right' });

    if (order.bayArea) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('PISTE / BAY :', 6, 41);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`Piste #${order.bayArea}`, 74, 41, { align: 'right' });
    }

    doc.line(6, 45, 74, 45);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('VÉHICULE & IMMATRICULATION', 6, 50);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(order.vehicleInfo || 'Véhicule client', 6, 55);
    doc.text(`Immat : ${order.plateNumber || 'N/A'}`, 74, 55, { align: 'right' });

    doc.line(6, 59, 74, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('PRESTATION', 6, 64);
    doc.text('MONTANT', 74, 64, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    let currentY = 70;
    if (order.items && order.items.length > 0) {
      order.items.forEach(item => {
        doc.text(item.name.slice(0, 24), 6, currentY);
        doc.text(`${item.price.toLocaleString('fr-FR')} XOF`, 74, currentY, { align: 'right' });
        currentY += 5;
      });
    } else {
      doc.text('Lavage complet véhicule', 6, currentY);
      doc.text(`${order.totalXof.toLocaleString('fr-FR')} XOF`, 74, currentY, { align: 'right' });
      currentY += 5;
    }

    doc.setLineDashPattern([], 0);
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.4);
    doc.line(6, currentY + 3, 74, currentY + 3);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('TOTAL NET :', 6, currentY + 9);
    doc.text(`${order.totalXof.toLocaleString('fr-FR')} FCFA`, 74, currentY + 9, { align: 'right' });

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`RÈGLEMENT : ${(order.paymentMethod || 'Espèces').toUpperCase()}`, 6, currentY + 15);
    doc.setFont('helvetica', 'bold');
    const isPaid = order.status === 'termine' || order.status === 'paye';
    doc.setTextColor(isPaid ? 22 : 180, isPaid ? 101 : 83, 52);
    doc.text(isPaid ? 'RÉGLÉ - MERCI' : 'EN ATTENTE', 74, currentY + 15, { align: 'right' });

    doc.setLineDashPattern([1, 1], 0);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.line(6, currentY + 22, 74, currentY + 22);

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('ServiceLavage CI • Plateforme Multitenant', 40, currentY + 28, { align: 'center' });
    doc.text('Conservez ce reçu pour tout retrait de véhicule.', 40, currentY + 32, { align: 'center' });

    return doc;
  };

  const handlePrint = () => {
    window.print();
  };

  // Download directly as formatted PDF using html2canvas + jsPDF
  const handleDownloadPdf = async () => {
    setIsProcessing(true);
    setFeedback('Génération du PDF...');
    const fileName = `recu_servicelavage_${ticketCode}.pdf`;

    try {
      if (ticketRef.current) {
        const { blob } = await generatePdfFromElement(ticketRef.current, { format: 'thermal' });
        downloadPdfBlob(blob, fileName);
      } else {
        const doc = buildReceiptPdf();
        doc.save(fileName);
      }
      setFeedback('Reçu PDF téléchargé avec succès !');
      setTimeout(() => setFeedback(''), 3500);
    } catch (err) {
      console.error('Erreur téléchargement PDF:', err);
      const doc = buildReceiptPdf();
      doc.save(fileName);
      setFeedback('Reçu PDF téléchargé !');
      setTimeout(() => setFeedback(''), 3000);
    } finally {
      setIsProcessing(false);
    }
  };

  // Share via WhatsApp as a formatted PDF file
  const handleWhatsAppPdf = async () => {
    setIsProcessing(true);
    setFeedback('Génération du fichier PDF pour WhatsApp...');
    const fileName = `recu_servicelavage_${ticketCode}.pdf`;

    try {
      let pdfBlob: Blob;
      if (ticketRef.current) {
        const result = await generatePdfFromElement(ticketRef.current, { format: 'thermal' });
        pdfBlob = result.blob;
      } else {
        const doc = buildReceiptPdf();
        pdfBlob = doc.output('blob');
      }

      const outcome = await sharePdfToMessaging(
        pdfBlob,
        fileName,
        `Reçu ${ticketCode} - ServiceLavage`,
        `Bonjour, voici votre reçu officiel ServiceLavage au format PDF pour votre véhicule ${order.vehicleInfo} (${order.plateNumber || 'N/A'}). Montant total : ${formatXof(order.totalXof)}.`,
        order.customerPhone
      );

      if (outcome === 'shared') {
        setFeedback('Fichier PDF partagé avec succès !');
      } else {
        setFeedback('PDF téléchargé & WhatsApp ouvert pour l’envoi !');
      }
      setTimeout(() => setFeedback(''), 4500);
    } catch (err) {
      console.error('Erreur partage PDF WhatsApp:', err);
      setFeedback('Erreur lors du partage.');
      setTimeout(() => setFeedback(''), 3000);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#181c24] border border-[#2b3343] rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl text-slate-200">
        {/* Top Header */}
        <div className="p-3.5 border-b border-[#262e3d] flex items-center justify-between bg-[#1f2430]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Reçu de Caisse · ServiceLavage
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="p-1 rounded-lg bg-[#272e3d] text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div className="px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Printable & HTML-to-PDF Target Receipt Paper (80mm width standard) */}
        <div 
          ref={ticketRef} 
          className="p-5 bg-white text-gray-900 font-mono text-xs select-text printable-ticket"
        >
          {/* Header */}
          <div className="text-center pb-3 border-b-2 border-dashed border-gray-400 space-y-1">
            <div className="font-sans font-black text-lg text-cyan-700 tracking-tight flex items-center justify-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-full bg-cyan-600 inline-block" />
              SERVICELAVAGE
            </div>
            <p className="font-bold text-[11px] uppercase text-gray-800">{stationName || 'Station Auto'}</p>
            <p className="text-[10px] text-gray-600">Abidjan • Côte d’Ivoire</p>
          </div>

          {/* Ticket metadata */}
          <div className="py-2.5 border-b border-dashed border-gray-300 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-gray-600">N° TICKET :</span>
              <span className="font-bold text-gray-900">{ticketCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">DATE :</span>
              <span className="text-gray-800">{dateFormatted}</span>
            </div>
          </div>

          {/* Vehicle info */}
          <div className="py-2.5 border-b border-dashed border-gray-300 space-y-1 text-[11px]">
            <span className="text-gray-500 text-[10px] uppercase font-bold block">Véhicule</span>
            <div className="flex justify-between font-bold text-xs text-gray-900">
              <span>{order.vehicleInfo}</span>
              <span className="font-mono">{order.plateNumber || 'N/A'}</span>
            </div>
          </div>

          {/* Services list */}
          <div className="py-2.5 border-b border-dashed border-gray-300 space-y-1.5 text-[11px]">
            <span className="text-gray-500 text-[10px] uppercase font-bold block">Prestations</span>
            {order.items && order.items.length > 0 ? (
              order.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-gray-800">
                  <span className="truncate pr-2">{item.name}</span>
                  <span className="font-semibold">{formatXof(item.price)}</span>
                </div>
              ))
            ) : (
              <div className="flex justify-between text-gray-800">
                <span>Lavage véhicule</span>
                <span className="font-semibold">{formatXof(order.totalXof)}</span>
              </div>
            )}
          </div>

          {/* Total & Payment details */}
          <div className="py-3 border-b-2 border-dashed border-gray-400 space-y-1.5 text-[11px]">
            <div className="flex justify-between text-sm font-black text-gray-900">
              <span>TOTAL NET :</span>
              <span>{formatXof(order.totalXof)}</span>
            </div>
            <div className="flex justify-between text-[10px] text-gray-700">
              <span>MODE DE PAIEMENT :</span>
              <span className="font-bold uppercase">{order.paymentMethod || 'Espèces'}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-gray-600">ÉTAT DU RÈGLEMENT :</span>
              <span className={`font-bold ${order.status === 'termine' ? 'text-emerald-700' : 'text-amber-700'}`}>
                {order.status === 'termine' ? 'RÉGLÉ - MERCI' : 'EN ATTENTE'}
              </span>
            </div>
          </div>

          {/* QR code and validation stamp */}
          <div className="pt-3 text-center space-y-1.5">
            <div className="flex justify-center">
              <div className="p-1.5 border border-gray-300 rounded bg-gray-50">
                <QrCode className="w-12 h-12 text-gray-800" />
              </div>
            </div>
            <p className="text-[9px] text-gray-500">
              Scannez pour valider le ticket ou suivre le lavage
            </p>
            <p className="text-[9px] font-bold text-gray-700">
              ServiceLavage CI • Système de Gestion Agréé
            </p>
          </div>
        </div>

        {/* Action Buttons: WhatsApp PDF, Download as PDF, Print */}
        <div className="p-3.5 bg-[#141820] border-t border-[#262e3d] flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleWhatsAppPdf}
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
              className="py-2 px-3 rounded-xl bg-[#202532] hover:bg-[#2b3343] disabled:opacity-50 border border-[#2e3748] text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm cursor-pointer"
              title="Télécharger directement en fichier PDF"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Télécharger PDF</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm cursor-pointer"
              title="Imprimer le ticket sur imprimante thermique"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimer</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
