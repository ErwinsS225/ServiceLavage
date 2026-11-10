import type { jsPDF, jsPDFOptions } from 'jspdf';
import { receiptPaymentLabel } from './stationMetrics';
import { receiptQrMatrix, RECEIPT_QR_MODULE_COUNT } from './receiptQrBitmap';
import { receiptReference } from './receiptPayload';

/**
 * Reçu de prestation : ce que le document affirme, et comment il est dessiné.
 *
 * Deux responsabilités sorties de `ReceiptModal` :
 *  - `receiptFields` : le contenu (référence, date, libellé d'état, message de
 *    partage). C'est ici que se joue la règle « on n'affirme jamais un
 *    paiement », pas dans le JSX ;
 *  - `drawReceiptPdf` : le tracé vectoriel du ticket 80 mm, utilisé en repli
 *    quand html2canvas ne peut pas capturer le DOM (navigateur restrictif).
 *
 * Le reçu ne contient aucune colonne de paiement : la base n'en enregistre
 * aucun. Un lavage terminé produit « LAVAGE TERMINÉ », jamais « réglé ».
 */

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

/**
 * Référence imprimée. Dérivée de l'UUID : ce n'est pas un numéro fiscal
 * séquentiel, la base n'en fournit pas et rien ne le prétend.
 */
export function receiptTicketCode(order: Pick<OrderReceiptData, 'id' | 'ticketNumber'>): string {
  return order.ticketNumber || `SL-${receiptReference(order.id)}`;
}

export function receiptDateLabel(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Nom de fichier du PDF, sans espace ni accent (les imprimantes n'aiment pas). */
export function receiptFileName(code: string): string {
  return `recu_servicelavage_${code.replace(/[^A-Za-z0-9-]/g, '_')}.pdf`;
}

/**
 * Message envoyé avec le PDF. Il rappelle explicitement que le document atteste
 * de la prestation, pas du règlement : sans cette phrase, un reçu « montant
 * facturé » se lit comme une quittance.
 */
export function receiptShareMessage(order: OrderReceiptData, code: string, totalLabel: string): string {
  return (
    `Bonjour, voici le reçu ServiceLavage pour votre véhicule ${order.vehicleInfo} (${order.plateNumber || 'N/A'}). ` +
    `Montant facturé : ${totalLabel}. Référence ${code}. ` +
    `L’application n’enregistre pas les paiements : ce reçu atteste de la prestation, pas du règlement.`
  );
}

/**
 * Tracé vectoriel du ticket (80 mm). Utilisé seulement en repli : le chemin
 * normal capture le DOM via html2canvas, ce qui garde un rendu identique à
 * l'écran.
 */
/** Constructeur injecté : c'est ce qui rend le tracé testable sans DOM. */
export type PdfConstructor = new (options: jsPDFOptions) => jsPDF;

export function drawReceiptPdf(
  create: PdfConstructor,
  order: OrderReceiptData,
  stationName: string,
  code: string,
): jsPDF {
  const doc = new create({ orientation: 'portrait', unit: 'mm', format: [80, 190] });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('SERVICELAVAGE CI', 40, 12, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(stationName || 'Station de Lavage Auto', 40, 17, { align: 'center' });
  doc.text('Reçu de prestation (document interne)', 40, 21, { align: 'center' });

  doc.setDrawColor(203, 213, 225);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(6, 26, 74, 26);

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('TICKET N° :', 6, 31);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(code, 74, 31, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('DATE & HEURE :', 6, 36);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(receiptDateLabel(order.createdAt), 74, 36, { align: 'right' });

  if (order.bayArea) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('PISTE / BAY :', 6, 41);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`Piste #${order.bayArea}`, 74, 41, { align: 'right' });
  }

  doc.setLineDashPattern([], 0);
  doc.setDrawColor(203, 213, 225);
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
    doc.text('Lavage véhicule', 6, currentY);
    doc.text(`${order.totalXof.toLocaleString('fr-FR')} XOF`, 74, currentY, { align: 'right' });
    currentY += 5;
  }

  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.4);
  doc.line(6, currentY + 3, 74, currentY + 3);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('MONTANT FACTURÉ :', 6, currentY + 9);
  doc.text(`${order.totalXof.toLocaleString('fr-FR')} FCFA`, 74, currentY + 9, { align: 'right' });

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  // Aucun paiement en base : le reçu dit ce qu'il sait (l'état du lavage) et
  // n'affirme jamais que le client a réglé.
  doc.setTextColor(100, 116, 139);
  doc.text('ÉTAT DU LAVAGE :', 6, currentY + 15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(receiptPaymentLabel(order.status), 74, currentY + 15, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Montant facturé. Paiement non suivi par l’application.', 40, currentY + 19, { align: 'center' });

  doc.setLineDashPattern([1, 1], 0);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.line(6, currentY + 22, 74, currentY + 22);

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('ServiceLavage CI • Plateforme de gestion de stations', 40, currentY + 27, { align: 'center' });

  // Même QR que le ticket affiché : le contenu est identique, donc un scan du
  // document imprimé renvoie les mêmes champs. Dessiné module par module, ce
  // qui reste net à toute taille et n'ajoute aucune librairie.
  const matrix = receiptQrMatrix();
  const qrSize = 26; // mm
  const module = qrSize / RECEIPT_QR_MODULE_COUNT;
  const qrLeft = (80 - qrSize) / 2;
  const qrTop = currentY + 31;
  doc.setFillColor(255, 255, 255);
  doc.rect(qrLeft - 1.5, qrTop - 1.5, qrSize + 3, qrSize + 3, 'F');
  doc.setFillColor(17, 24, 39);
  for (let row = 0; row < RECEIPT_QR_MODULE_COUNT; row += 1) {
    for (let column = 0; column < RECEIPT_QR_MODULE_COUNT; column += 1) {
      if (!matrix[row][column]) continue;
      doc.rect(qrLeft + column * module, qrTop + row * module, module, module, 'F');
    }
  }
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text('Scanner ce code affiche la référence, le véhicule,', 40, qrTop + qrSize + 4, { align: 'center' });
  doc.text('le montant et la date de ce ticket.', 40, qrTop + qrSize + 7, { align: 'center' });

  return doc;
}
