import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export interface PdfExportOptions {
  format?: 'a4' | 'thermal';
  quality?: number;
  orientation?: 'portrait' | 'landscape';
}

/**
 * Captures an HTML element and generates a high-resolution PDF document.
 * Returns the PDF Blob for immediate download, preview, or messaging sharing.
 */
export async function generatePdfFromElement(
  element: HTMLElement,
  options: PdfExportOptions = {}
): Promise<{ doc: jsPDF; blob: Blob }> {
  // Capture the rendered DOM including styles, fonts, and borders
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    windowWidth: element.scrollWidth,
  });

  const imgData = canvas.toDataURL('image/png', options.quality ?? 0.95);

  if (options.format === 'thermal') {
    // 80mm standard POS receipt width
    const pdfWidth = 80;
    const pdfHeight = Math.max(60, (canvas.height * pdfWidth) / canvas.width);
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [pdfWidth, pdfHeight],
    });
    doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
    const blob = doc.output('blob');
    return { doc, blob };
  }

  // Standard A4 document for financial and operational reports
  const isLandscape = options.orientation === 'landscape';
  const doc = new jsPDF(isLandscape ? 'landscape' : 'portrait', 'mm', 'a4');
  const pageWidth = isLandscape ? 297 : 210;
  const pageHeight = isLandscape ? 210 : 297;
  const imgWidth = pageWidth - 20; // 10mm margins on left/right
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 10; // 10mm top margin

  // First page
  doc.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight, undefined, 'FAST');
  heightLeft -= (pageHeight - 20);

  // Additional pages if report content spans multiple A4 pages
  while (heightLeft > 0) {
    position = heightLeft - imgHeight + 10;
    doc.addPage();
    doc.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= (pageHeight - 20);
  }

  const blob = doc.output('blob');
  return { doc, blob };
}

/**
 * Downloads a PDF file to the user's device.
 */
export function downloadPdfBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Shares a PDF file via the Web Share API (WhatsApp, Telegram, etc.)
 * with automatic download and wa.me fallback when direct file sharing is unavailable.
 */
export async function sharePdfToMessaging(
  blob: Blob,
  filename: string,
  title: string,
  text: string,
  phone?: string
): Promise<'shared' | 'downloaded'> {
  const pdfFile = new File([blob], filename, { type: 'application/pdf' });

  // Native Web Share API with file attachment (works directly with WhatsApp on mobile & supported browsers)
  if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
    try {
      await navigator.share({
        files: [pdfFile],
        title,
        text,
      });
      return 'shared';
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        return 'shared';
      }
    }
  }

  // Fallback: download the file locally and open WhatsApp direct conversation
  downloadPdfBlob(blob, filename);
  const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
  const encodedMsg = encodeURIComponent(`${text} (Le fichier PDF "${filename}" a été téléchargé sur votre appareil).`);
  const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodedMsg}` : `https://api.whatsapp.com/send?text=${encodedMsg}`;
  window.open(waUrl, '_blank');
  return 'downloaded';
}
