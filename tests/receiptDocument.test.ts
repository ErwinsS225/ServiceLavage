import test from 'node:test';
import assert from 'node:assert/strict';
import {
  drawReceiptPdf,
  receiptDateLabel,
  receiptFileName,
  receiptShareMessage,
  receiptTicketCode,
  type OrderReceiptData,
} from '../src/lib/receiptDocument';
import { receiptReference } from '../src/lib/receiptPayload';
import { receiptPaymentLabel } from '../src/lib/stationMetrics';

/**
 * Le reçu est le document que le client garde. Deux choses ne doivent jamais
 * y apparaître : une référence présentée comme un numéro fiscal, et une
 * affirmation de paiement. Ces règles vivaient dans le JSX ; elles sont ici
 * testables, y compris dans le tracé PDF de secours.
 */

const ORDER: OrderReceiptData = {
  id: 'ab12cd34-1111-4222-8333-444455556666',
  vehicleInfo: 'Toyota RAV4 Blanc',
  plateNumber: '1234 AB 01',
  totalXof: 8500,
  status: 'termine',
  createdAt: '2026-11-10T10:00:00.000Z',
  items: [
    { name: 'Lavage extérieur', price: 5000 },
    { name: 'Aspiration', price: 3500 },
  ],
};

/** Les montants utilisent une espace fine insécable : on la normalise avant d'assertir. */
const normalize = (value: string) => value.replace(/[\u202f\u00a0]/g, ' ');

/** Faux jsPDF : enregistre le texte écrit, rien d'autre. */
function fakePdf() {
  const written: string[] = [];
  const noop = () => {};
  const doc = {
    setFont: noop,
    setFontSize: noop,
    setTextColor: noop,
    setDrawColor: noop,
    setLineDashPattern: noop,
    setLineWidth: noop,
    setFillColor: noop,
    line: noop,
    rect: noop,
    text: (value: string) => {
      written.push(normalize(value));
    },
    output: () => new Blob(),
  };
  const Constructor = function (this: unknown) {
    return doc as never;
  } as unknown as Parameters<typeof drawReceiptPdf>[0];
  return { Constructor, written };
}

test('la référence du ticket dérive de l’uuid et reste stable', () => {
  assert.equal(receiptTicketCode(ORDER), `SL-${receiptReference(ORDER.id)}`);
  assert.equal(receiptTicketCode(ORDER), receiptTicketCode(ORDER));
  // Un ticket explicite est respecté tel quel.
  assert.equal(receiptTicketCode({ ...ORDER, ticketNumber: 'TICK-AB12CD' }), 'TICK-AB12CD');
  assert.doesNotMatch(receiptTicketCode(ORDER), /^(FAC|REC)-?\d/);
});

test('le nom de fichier ne contient ni espace ni accent', () => {
  assert.equal(receiptFileName('SL-AB12CD34'), 'recu_servicelavage_SL-AB12CD34.pdf');
  assert.equal(receiptFileName('SL 12/34'), 'recu_servicelavage_SL_12_34.pdf');
});

test('le message de partage rappelle que le règlement n’est pas suivi', () => {
  const message = receiptShareMessage(ORDER, 'SL-AB12CD34', '8 500 FCFA');
  assert.match(message, /Toyota RAV4 Blanc/);
  assert.match(message, /1234 AB 01/);
  assert.match(message, /8 500 FCFA/);
  assert.match(message, /atteste de la prestation, pas du règlement/);
  // Aucun mot qui laisserait croire à un encaissement.
  assert.doesNotMatch(message, /payé|réglé|encaissé/i);
});

test('un lavage terminé n’est jamais écrit comme payé sur le PDF', () => {
  const { Constructor, written } = fakePdf();
  drawReceiptPdf(Constructor, ORDER, 'Station Test', 'SL-AB12CD34');
  const text = written.join('\n');

  // Le libellé vient de `stationMetrics` : il parle d'état, pas de paiement.
  assert.match(text, new RegExp(receiptPaymentLabel('termine')));
  assert.match(text, /MONTANT FACTURÉ/);
  assert.match(text, /Paiement non suivi par l’application/);
  assert.doesNotMatch(text, /RÉGLÉ|REGLÉ|PAYÉ|PAYE\b|MERCI/);
  assert.match(text, /document interne/);
});

test('le PDF reprend les lignes de la prestation et le montant figé', () => {
  const { Constructor, written } = fakePdf();
  drawReceiptPdf(Constructor, ORDER, 'Station Test', 'SL-AB12CD34');
  const text = written.join('\n');
  assert.match(text, /Lavage extérieur/);
  assert.match(text, /Aspiration/);
  assert.match(text, /8 500 FCFA/);
  // L'immatriculation absente est rendue explicitement, jamais vide.
  const { Constructor: emptyCtor, written: emptyText } = fakePdf();
  drawReceiptPdf(emptyCtor, { ...ORDER, plateNumber: null, items: [] }, '', 'X');
  assert.match(emptyText.join('\n'), /Immat : N\/A/);
  assert.match(emptyText.join('\n'), /Station de Lavage Auto/);
});

test('la date est rendue en français, heure comprise', () => {
  const label = receiptDateLabel(ORDER.createdAt);
  assert.match(label, /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
});
