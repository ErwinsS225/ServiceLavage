import { receiptQrMatrix, RECEIPT_QR_MODULE_COUNT } from '../../lib/receiptQrBitmap';

/**
 * Vrai code QR, dessiné module par module depuis la matrice figée dans
 * `receiptQrBitmap.ts`. Il encode le contenu construit par `buildReceiptPayload` :
 * le scanner renvoie la référence, le véhicule, le montant, l'état et la date
 * imprimés sur le ticket.
 *
 * Le contenu est aussi l'`aria-label` : un lecteur d'écran énonce les mêmes
 * informations qu'un scan, au lieu d'annoncer « image ».
 */
export function ReceiptQrCode({
  payload,
  size = 108,
  className = '',
}: {
  payload: string;
  size?: number;
  className?: string;
}) {
  const matrix = receiptQrMatrix();
  const modules = RECEIPT_QR_MODULE_COUNT;
  const path: string[] = [];
  for (let row = 0; row < modules; row += 1) {
    for (let column = 0; column < modules; column += 1) {
      if (matrix[row][column]) path.push(`M${column} ${row}h1v1h-1z`);
    }
  }

  return (
    <svg
      viewBox={`0 0 ${modules} ${modules}`}
      width={size}
      height={size}
      role="img"
      aria-label={`Code QR du ticket, contenu : ${payload.replace(/\n/g, ' · ')}`}
      className={className}
      shapeRendering="crispEdges"
    >
      <rect width={modules} height={modules} fill="#ffffff" />
      <path d={path.join('')} fill="#111827" />
    </svg>
  );
}
