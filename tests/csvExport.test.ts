import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOrdersCsv, csvCell, ORDERS_CSV_HEADERS, type CsvOrderRow } from '../src/lib/csvExport';

/**
 * L'export CSV est le seul chemin par lequel des données saisies par un
 * utilisateur (nom de véhicule, plaque) quittent l'application pour un tableur.
 * Une cellule non échappée exécute une formule à l'ouverture du fichier : ce
 * n'est pas un détail de mise en forme.
 */

const ROW: CsvOrderRow = {
  id: 'ab12cd34-0000-4000-8000-000000000001',
  created_at: '2026-11-10T10:00:00.000Z',
  vehicle_info: 'Toyota RAV4 Blanc',
  plate_number: '1234 AB 01',
  total_xof: 8500,
  billedXof: 8500,
  statusLabel: 'Terminé',
};

test('les formules de tableur sont neutralisées', () => {
  for (const dangerous of ['=SUM(A1:A2)', '+1+1', '-2+3', '@SUM(1)', '\t=1', '\r=1']) {
    assert.equal(csvCell(dangerous).startsWith(`"'`), true, `${JSON.stringify(dangerous)} doit être préfixé`);
  }
  // Une valeur normale n'est pas altérée.
  assert.equal(csvCell('Toyota RAV4'), '"Toyota RAV4"');
});

test('les guillemets internes sont doublés', () => {
  assert.equal(csvCell('Lavage "premium"'), '"Lavage ""premium"""');
  // Une formule contenant un guillemet reste une seule cellule.
  assert.equal(csvCell('=HYPERLINK("http://x","y")'), `"'=HYPERLINK(""http://x"",""y"")"`);
});

test('le contenu exporté porte un BOM, un en-tête et une ligne par prestation', () => {
  const csv = buildOrdersCsv([ROW]);
  assert.equal(csv.startsWith('\ufeff'), true, 'le BOM garde les accents lisibles dans Excel');
  const lines = csv.slice(1).split('\r\n');
  assert.equal(lines[0], ORDERS_CSV_HEADERS.join(','));
  assert.equal(lines.length, 2);
  assert.match(lines[1], /"1234 AB 01"/);
  assert.match(lines[1], /"Toyota RAV4 Blanc"/);
});

test('le prix figé et le montant facturé restent deux colonnes distinctes', () => {
  // Une prestation annulée garde son prix d'origine mais rien n'est facturé.
  const cancelled = buildOrdersCsv([{ ...ROW, statusLabel: 'Annulé', billedXof: 0 }])
    .slice(1)
    .split('\r\n')[1]
    .split(',');
  assert.equal(cancelled[4], '"8500"');
  assert.equal(cancelled[5], '"0"');
  assert.equal(cancelled[6], '"Annulé"');
});

test('un export vide ne produit que l’en-tête', () => {
  const csv = buildOrdersCsv([]);
  assert.equal(csv.slice(1), ORDERS_CSV_HEADERS.join(','));
});
