import { useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import { X, Printer, Share2, Download, CheckCircle2 } from 'lucide-react';
import { formatXof } from '../lib/money';
import { generatePdfFromElement, downloadPdfBlob, sharePdfToMessaging } from '../lib/pdfExport';
import { buildReceiptPayload } from '../lib/receiptPayload';
import {
  drawReceiptPdf,
  receiptFileName,
  receiptShareMessage,
  receiptTicketCode,
  type OrderReceiptData,
} from '../lib/receiptDocument';
import { ReceiptPaper } from './receipt/ReceiptPaper';

export type { OrderReceiptData, ReceiptItem } from '../lib/receiptDocument';

/**
 * Reçu de prestation : coquille du dialogue et trois actions (imprimer,
 * télécharger, envoyer par WhatsApp).
 *
 * Découpé lors de la P1 (459 lignes) :
 *  - `lib/receiptDocument` : contenu du document (référence, date, message de
 *    partage) et tracé vectoriel de secours en jsPDF ;
 *  - `components/receipt/ReceiptPaper` : le ticket 80 mm capturé pour le PDF ;
 *  - `components/receipt/ReceiptQrCode` : le QR réel, module par module.
 *
 * Le téléchargement essaie d'abord html2canvas (rendu identique à l'écran),
 * puis retombe sur le tracé vectoriel si la capture échoue — certains
 * navigateurs embarqués la refusent. Dans les deux cas, le PDF contient le même
 * QR et la même mention : le paiement n'est pas suivi.
 */
export function ReceiptModal({
  order,
  stationName,
  onClose,
}: {
  order: OrderReceiptData;
  stationName: string;
  onClose: () => void;
}) {
  const [feedback, setFeedback] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const ticketRef = useRef<HTMLDivElement>(null);

  const code = receiptTicketCode(order);
  const fileName = receiptFileName(code);
  const qrPayload = buildReceiptPayload({
    orderId: order.id,
    stationName: stationName || 'Station de lavage',
    vehicleInfo: order.vehicleInfo,
    plateNumber: order.plateNumber,
    totalXof: order.totalXof,
    status: order.status,
    createdAt: order.createdAt,
  });

  function flash(message: string, delay = 4000) {
    setFeedback(message);
    setTimeout(() => setFeedback(''), delay);
  }

  /** PDF par capture du ticket ; repli vectoriel si la capture échoue. */
  async function buildPdfBlob(): Promise<Blob> {
    if (ticketRef.current) {
      try {
        const { blob } = await generatePdfFromElement(ticketRef.current, { format: 'thermal' });
        return blob;
      } catch {
        // Continue to the vector fallback below.
      }
    }
    return drawReceiptPdf(jsPDF, order, stationName, code).output('blob');
  }

  async function handleDownloadPdf() {
    setIsProcessing(true);
    setFeedback('Génération du PDF…');
    try {
      downloadPdfBlob(await buildPdfBlob(), fileName);
      flash('Reçu PDF téléchargé.');
    } catch {
      flash('Création du PDF impossible. Utilisez « Imprimer » puis « Enregistrer en PDF ».', 6000);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleWhatsAppPdf() {
    setIsProcessing(true);
    setFeedback('Préparation du PDF…');
    try {
      const outcome = await sharePdfToMessaging(
        await buildPdfBlob(),
        fileName,
        `Reçu ${code} - ServiceLavage`,
        receiptShareMessage(order, code, formatXof(order.totalXof)),
        order.customerPhone,
      );
      flash(outcome === 'shared' ? 'PDF partagé.' : 'PDF téléchargé et WhatsApp ouvert pour l’envoi.', 5000);
    } catch {
      flash('Partage impossible. Téléchargez le PDF puis envoyez-le manuellement.', 5000);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Reçu de la prestation ${code}`}
        className="bg-[#181c24] border border-[#2b3343] rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl text-slate-200"
      >
        <div className="p-3.5 border-b border-[#262e3d] flex items-center justify-between bg-[#1f2430]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Reçu de prestation · ServiceLavage
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

        {feedback && (
          <div role="status" className="px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        <ReceiptPaper ref={ticketRef} order={order} stationName={stationName} qrPayload={qrPayload} />

        <div className="p-3.5 bg-[#141820] border-t border-[#262e3d] flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => void handleWhatsAppPdf()}
              className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm cursor-pointer"
              title="Envoyer le reçu en PDF par WhatsApp"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>WhatsApp (PDF)</span>
            </button>

            <button
              type="button"
              disabled={isProcessing}
              onClick={() => void handleDownloadPdf()}
              className="py-2 px-3 rounded-xl bg-[#202532] hover:bg-[#2b3343] disabled:opacity-50 border border-[#2e3748] text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm cursor-pointer"
              title="Télécharger le reçu en PDF"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Télécharger PDF</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm cursor-pointer"
              title="Imprimer le ticket sur imprimante thermique"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimer</span>
            </button>
          </div>
          <p className="text-[10px] text-slate-500 text-center">
            Document interne : la prestation est attestée, le règlement n’est pas suivi par l’application.
          </p>
        </div>
      </div>
    </div>
  );
}
