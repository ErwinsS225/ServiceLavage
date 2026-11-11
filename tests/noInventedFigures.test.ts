import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

/**
 * The dashboard and the financial report used to display invented figures
 * whenever the real data was empty (a simulated revenue curve, a hard-coded
 * "+14% vs hier", a 22% expense estimate and a 52/26/12% payment split).
 * Those numbers look exactly like measured ones: an owner reads them as
 * revenue. These assertions keep that class of fake data out of the screens.
 */
const dashboard = await readFile('src/components/StationDashboard.tsx', 'utf8');
const reports = await readFile('src/components/StationReports.tsx', 'utf8');
const orders = await readFile('src/components/StationOrders.tsx', 'utf8');
// The receipt was split in P1: wording lives in `receiptDocument`, the paper in
// `receipt/ReceiptPaper`, the QR in `receipt/ReceiptQrCode`.
const receiptModal = await readFile('src/components/ReceiptModal.tsx', 'utf8');
const receipt =
  (await readFile('src/lib/receiptDocument.ts', 'utf8')) +
  (await readFile('src/components/receipt/ReceiptPaper.tsx', 'utf8')) +
  receiptModal;
const metrics = await readFile('src/lib/stationMetrics.ts', 'utf8');
const receiptPayload = await readFile('src/lib/receiptPayload.ts', 'utf8');

/** Source of every screen that displays a figure. */
const SCREENS: Array<[string, string]> = [
  ['StationDashboard', dashboard],
  ['StationReports', reports],
  ['StationOrders', orders],
  ['ReceiptModal', receipt],
];

test('the dashboard never fabricates a revenue curve or a status split', () => {
  assert.doesNotMatch(dashboard, /simulatedBaseline|Baseline simulation/);
  assert.doesNotMatch(dashboard, /\.length \|\| \d+/); // e.g. `|| 12` empty-state padding
});

test('a queued offline order carries no invented amount', () => {
  assert.doesNotMatch(dashboard, /total_xof: 5000/);
  assert.match(metrics, /A queued offline order has no price at all/i);
  // No monetary literal is hard-coded in any screen: a figure must come from
  // the data or from `stationMetrics`, never from the source.
  for (const [name, source] of SCREENS) {
    assert.doesNotMatch(source, /total_?[xX]of\s*[:=]\s*\d/, `${name} code un montant en dur`);
    assert.doesNotMatch(source, /\b\d{1,3}(?:[ .]\d{3})+\s*(?:FCFA|XOF)/i, `${name} code un montant formaté`);
  }
});

test('KPI cards show no hard-coded growth claim', () => {
  for (const figure of ['+14% vs hier', '8 véhicules en file', '+12% ce mois-ci', '+5 livrés']) {
    assert.ok(!dashboard.includes(figure), `${figure} is presented as a measurement`);
  }
  for (const figure of ['+16% vs période préc.', 'Marge préservée', 'Rentabilité saine']) {
    assert.ok(!reports.includes(figure), `${figure} is presented as a measurement`);
  }
});

test('no expense ratio or payment split is invented', () => {
  for (const [name, source] of SCREENS) {
    assert.doesNotMatch(source, /0\.22|0\.52|0\.26|0\.12/, `${name} contient un ratio en dur`);
    assert.doesNotMatch(source, /22\s*%|52\s*%|26\s*%|12\s*%/, `${name} affiche un pourcentage non mesuré`);
  }
  assert.doesNotMatch(
    reports,
    /Wave\s*(CI|Money)|Orange\s*Money|MTN\s*Mobile/i,
    'aucune répartition par opérateur',
  );
  assert.match(reports, /Moyens de paiement non enregistrés|aucun moyen de paiement n’est stocké/);
});

test('a completed wash is never presented as a paid wash', () => {
  // The receipt used to print "RÉGLÉ - MERCI" as soon as status === 'termine'.
  assert.doesNotMatch(receipt, /RÉGLÉ|REGL[EÉ]\s*-\s*MERCI/);
  assert.doesNotMatch(receipt, /paymentMethod\s*\|\|\s*['"]Esp/);
  assert.match(receipt, /receiptPaymentLabel/);
  // The wording contract lives in stationMetrics: a terminated wash only says so.
  assert.match(metrics, /'LAVAGE TERMINÉ'/);
  assert.match(metrics, /terminée : the wash is done \(`status = 'termine'`\)/);
});

test('no claim of an official or approved document', () => {
  for (const [name, source] of SCREENS) {
    assert.doesNotMatch(source, /officiel/i, `${name} présente le document comme officiel`);
    assert.doesNotMatch(source, /agr[ée][ée]/i, `${name} présente le système comme agréé`);
    // "sans valeur fiscale" is a disclaimer, any other claim is not.
    const fiscalClaims = source
      .split('\n')
      .filter(line => /valeur fiscale/i.test(line) && !/sans valeur fiscale/i.test(line));
    assert.deepEqual(fiscalClaims, [], `${name} revendique une valeur fiscale`);
  }
});

test('the receipt QR code carries real data instead of a decorative icon', async () => {
  // The old screen drew a lucide <QrCode> icon plus "Scannez pour valider".
  assert.doesNotMatch(receiptModal, /\bQrCode\b/, 'aucune icône QR décorative');
  assert.doesNotMatch(receipt, /Scannez pour valider/);
  assert.match(receiptModal, /buildReceiptPayload\(/);
  // The drawing itself moved to `components/receipt/ReceiptQrCode`.
  const qrComponent = await readFile('src/components/receipt/ReceiptQrCode.tsx', 'utf8');
  assert.match(qrComponent, /receiptQrMatrix\(/);
  // The payload is built from the order fields, never from a constant string.
  for (const field of ['orderId', 'vehicleInfo', 'totalXof', 'status', 'createdAt']) {
    assert.ok(receiptPayload.includes(field), `${field} doit faire partie du contenu du QR`);
  }
});

test('the receipt PDF library is not loaded with the portal', () => {
  // jsPDF + html2canvas are ~600 kB: the receipt must stay a lazy chunk.
  assert.doesNotMatch(orders, /^import .*pdfExport/m);
  assert.match(orders, /lazy\(\(\) => import\('\.\/ReceiptModal'\)/);
});

test('the CSV export neutralises spreadsheet formulas', async () => {
  // Extrait dans `lib/csvExport` (P1) : la règle est testée sur sa fonction,
  // pas relue au regex dans le JSX.
  const { readFile: read } = await import('node:fs/promises');
  const source = await read('src/lib/csvExport.ts', 'utf8');
  const cell = source.slice(
    source.indexOf('export function csvCell'),
    source.indexOf('export interface CsvOrderRow'),
  );
  // A leading =, +, -, @, tab or CR must be prefixed so Excel keeps it as text.
  assert.match(cell, /\/\^\[=\+/);
  // Quotes inside a value must be doubled, otherwise the column escapes.
  assert.ok(cell.includes(`replace(/"/g, '""')`), 'les guillemets internes doivent être doublés');
});
