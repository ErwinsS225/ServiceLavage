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

test('the dashboard never fabricates a revenue curve or a status split', () => {
  assert.doesNotMatch(dashboard, /simulatedBaseline|Baseline simulation/);
  assert.doesNotMatch(dashboard, /\.length \|\| \d+/); // e.g. `|| 12` empty-state padding
});

test('a queued offline order carries no invented amount', () => {
  assert.doesNotMatch(dashboard, /total_xof: 5000/);
  assert.match(dashboard, /A queued order has no server price yet/);
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
  assert.doesNotMatch(reports, /0\.22|0\.52|0\.26|0\.12/);
  assert.match(reports, /Moyens de paiement non enregistrés/);
});

test('the receipt PDF library is not loaded with the portal', () => {
  // jsPDF + html2canvas are ~600 kB: the receipt must stay a lazy chunk.
  assert.doesNotMatch(orders, /^import .*pdfExport/m);
  assert.match(orders, /lazy\(\(\) => import\('\.\/ReceiptModal'\)/);
});

test('the CSV export neutralises spreadsheet formulas', () => {
  const cell = reports.slice(reports.indexOf('const csvCell'), reports.indexOf('const handleExportCsv'));
  // A leading =, +, -, @, tab or CR must be prefixed so Excel keeps it as text.
  assert.match(cell, /\/\^\[=\+/);
  // Quotes inside a value must be doubled, otherwise the column escapes.
  assert.ok(cell.includes(`replace(/"/g, '""')`), 'les guillemets internes doivent être doublés');
});
