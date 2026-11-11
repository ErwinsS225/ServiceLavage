import './domEnvironment';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { render, cleanup } from '@testing-library/react';
import { ReceiptModal } from '../src/components/ReceiptModal';
import { buildReceiptPayload } from '../src/lib/receiptPayload';
import { receiptQrMatrix } from '../src/lib/receiptQrBitmap';

/**
 * The ticket used to show a green QR *icon* with "Scannez pour valider le
 * ticket", and to print "RÉGLÉ - MERCI" as soon as a wash was `termine`.
 * Nothing was encoded and no payment exists in the database. These tests check
 * the rendered document, not the source.
 */

afterEach(cleanup);

const ORDER = {
  id: '0f0e0d0c-1111-2222-3333-444455556666',
  vehicleInfo: 'Toyota RAV4 Blanc',
  plateNumber: '1234 AB 01',
  totalXof: 5000,
  status: 'termine',
  createdAt: '2026-11-10T10:00:00.000Z',
};

function renderReceipt(order: Partial<typeof ORDER> = {}) {
  return render(
    <ReceiptModal order={{ ...ORDER, ...order }} stationName="Station Test" onClose={() => {}} />,
  );
}

/** Dark modules actually drawn by the receipt's QR. */
function drawnModules(container: HTMLElement): number {
  const svg = container.querySelector('svg[role="img"]');
  assert.ok(svg, 'le reçu doit contenir un code QR');
  const path = svg.querySelector('path');
  assert.ok(path, 'le code QR doit être dessiné');
  return (path.getAttribute('d') ?? '').split('M').length - 1;
}

test('the receipt draws a QR whose content is the order data', () => {
  const { container } = renderReceipt();
  const svg = container.querySelector('svg[role="img"]') as SVGElement;
  const label = svg.getAttribute('aria-label') ?? '';
  const payload = buildReceiptPayload({
    orderId: ORDER.id,
    stationName: 'Station Test',
    vehicleInfo: ORDER.vehicleInfo,
    plateNumber: ORDER.plateNumber,
    totalXof: ORDER.totalXof,
    status: ORDER.status,
    createdAt: ORDER.createdAt,
  });
  // The accessible label carries the exact payload, field by field.
  for (const fragment of [
    'ref:0F0E0D0C',
    'vehicle:Toyota RAV4 Blanc',
    'amount:5000',
    'currency:XOF',
    'status:termine',
  ]) {
    assert.ok(label.includes(fragment), `le QR doit contenir « ${fragment} »`);
  }
  assert.equal(label.includes(payload.split('\n')[0]), true);

  // And the modules drawn are the dark modules of the matrix.
  const darkModules = receiptQrMatrix().flat().filter(Boolean).length;
  assert.equal(drawnModules(container), darkModules);
});

test('the QR text instructs a real scan instead of a fake validation', () => {
  const { container } = renderReceipt();
  const text = container.textContent ?? '';
  assert.doesNotMatch(text, /Scannez pour valider/);
  assert.match(text, /Scanner ce code affiche la référence, le véhicule, le montant et la date/);
});

test('a completed wash is printed as a wash, never as a payment', () => {
  const { container } = renderReceipt();
  const text = container.textContent ?? '';
  assert.match(text, /LAVAGE TERMINÉ/);
  assert.doesNotMatch(text, /RÉGLÉ|MERCI/);
  assert.match(text, /MONTANT FACTURÉ/);
  assert.match(text, /Paiement non enregistré par l’application/);
  // No payment method is guessed from the absence of data.
  assert.doesNotMatch(text, /MODE DE PAIEMENT/);
  assert.doesNotMatch(text, /Espèces|Esp[eè]ces/i);
});

test('a cancelled wash is never presented as a completed or paid one', () => {
  const { container } = renderReceipt({ status: 'annule' });
  const text = container.textContent ?? '';
  assert.match(text, /PRESTATION ANNULÉE/);
  assert.doesNotMatch(text, /LAVAGE TERMINÉ|RÉGLÉ/);
});

test('the document claims no official or approved status', () => {
  const { container } = renderReceipt();
  const text = container.textContent ?? '';
  assert.doesNotMatch(text, /officiel/i);
  assert.doesNotMatch(text, /agr[ée][ée]/i);
  assert.match(text, /Reçu de prestation, document interne/);
});
