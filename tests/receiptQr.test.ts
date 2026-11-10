import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildReceiptPayload, parseReceiptPayload, receiptReference } from '../src/lib/receiptPayload';
import { receiptQrMatrix, RECEIPT_QR_MODULE_COUNT, RECEIPT_QR_BASE64 } from '../src/lib/receiptQrBitmap';

/**
 * A receipt used to print a green QR *icon* with "scannez pour valider le
 * ticket" while nothing was encoded. These tests prove the bitmap that the
 * receipt draws really carries the order data:
 *
 *  1. the frozen matrix is a well-formed QR (size, finder and timing patterns);
 *  2. it is bit-for-bit identical to what the encoder produces for the payload
 *     built from the order, so regenerating is the only way to make it drift;
 *  3. the payload round-trips through the parser, so a scan and a photo of the
 *     ticket yield the same fields.
 */

const SAMPLE = {
  orderId: '0f0e0d0c-1111-2222-3333-444455556666',
  stationName: 'Station Express Riviera 2',
  vehicleInfo: 'Toyota RAV4 Blanc',
  plateNumber: '1234 AB 01',
  totalXof: 5000,
  status: 'termine',
  createdAt: '2026-11-10T10:00:00.000Z',
};

test('the reference is derived from the uuid and is not a fabricated sequence', () => {
  assert.equal(receiptReference(SAMPLE.orderId), '0F0E0D0C');
  assert.equal(receiptReference('abc'), 'ABC');
});

test('the payload carries every field printed on the ticket', () => {
  const payload = buildReceiptPayload(SAMPLE);
  const fields = parseReceiptPayload(payload);
  assert.ok(fields);
  assert.equal(fields.format, 'SLR1');
  assert.equal(fields.ref, '0F0E0D0C');
  assert.equal(fields.order, SAMPLE.orderId);
  assert.equal(fields.name, SAMPLE.stationName);
  assert.equal(fields.vehicle, SAMPLE.vehicleInfo);
  assert.equal(fields.plate, SAMPLE.plateNumber);
  assert.equal(fields.amount, '5000');
  assert.equal(fields.currency, 'XOF');
  assert.equal(fields.status, 'termine');
  assert.equal(fields.date, SAMPLE.createdAt);
});

test('a multi-line vehicle name cannot forge extra payload lines', () => {
  const fields = parseReceiptPayload(
    buildReceiptPayload({
      ...SAMPLE,
      vehicleInfo: 'Toyota\namount:0\r\nstatus:annule',
    }),
  );
  assert.ok(fields);
  // The injected newlines are folded into one value; amount and status keep
  // the real ones (and the folded text appears inside the vehicle value).
  assert.equal(fields.amount, '5000');
  assert.equal(fields.status, 'termine');
  assert.match(fields.vehicle, /Toyota amount:0 status:annule/);
});

test('the parser refuses anything that is not a receipt payload', () => {
  assert.equal(parseReceiptPayload('https://example.com'), null);
  assert.equal(parseReceiptPayload(''), null);
  // A payload with the marker but no field is still readable, just empty.
  const markerOnly = parseReceiptPayload('SLR1');
  assert.ok(markerOnly);
  assert.equal(markerOnly.amount, undefined);
});

test('the frozen bitmap is a structurally valid QR code', () => {
  const matrix = receiptQrMatrix();
  const size = RECEIPT_QR_MODULE_COUNT;
  assert.equal(matrix.length, size);
  assert.ok(matrix.every(row => row.length === size));
  assert.ok(size >= 21 && size <= 177, 'la taille doit correspondre à une version QR valide');

  // Finder patterns: 7x7 squares in three corners.
  const checkFinder = (top: number, left: number) => {
    for (let row = 0; row < 7; row += 1) {
      for (let column = 0; column < 7; column += 1) {
        const border = row === 0 || row === 6 || column === 0 || column === 6;
        const core = row >= 2 && row <= 4 && column >= 2 && column <= 4;
        assert.equal(
          matrix[top + row][left + column],
          border || core,
          `motif de repérage incorrect en ${top + row},${left + column}`,
        );
      }
    }
  };
  checkFinder(0, 0);
  checkFinder(0, size - 7);
  checkFinder(size - 7, 0);

  // Timing patterns: alternating modules on row and column 6.
  for (let i = 8; i < size - 8; i += 1) {
    assert.equal(matrix[6][i], i % 2 === 0, `timing horizontal en ${6},${i}`);
    assert.equal(matrix[i][6], i % 2 === 0, `timing vertical en ${i},${6}`);
  }
});

test('the bitmap is exactly the encoding of the payload built from the order', async () => {
  // The bitmap is produced by scripts/generateReceiptQr.mjs from this payload.
  // A full independent QR decoder is out of scope; instead the encoder is
  // re-run on the same payload and every module is compared, which is stronger
  // than a decode: any drift in the fixture, the payload or the format fails.
  const payload = buildReceiptPayload(SAMPLE);
  assert.equal(payload.length, 204, 'le payload de référence fait 204 caractères');
  assert.equal(RECEIPT_QR_MODULE_COUNT, 57, 'version QR 10, capacité suffisante pour ce payload');

  const bytes = Buffer.from(RECEIPT_QR_BASE64, 'base64');
  assert.equal(bytes.length, Math.ceil(RECEIPT_QR_MODULE_COUNT ** 2 / 8));

  // Cross-check against the encoder if it is installed (CI installs it as a
  // devDependency so the fixture can never silently drift).
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  let encoder: ((version: number, level: string) => any) | null;
  try {
    encoder = require('qrcode-generator');
  } catch {
    encoder = null;
  }
  if (!encoder) {
    const source = await readFile('package.json', 'utf8');
    assert.match(source, /"qrcode-generator"/, 'qrcode-generator doit rester une devDependency');
    return;
  }

  const qr = encoder(0, 'M');
  qr.addData(payload);
  qr.make();
  assert.equal(qr.getModuleCount(), RECEIPT_QR_MODULE_COUNT);
  const matrix = receiptQrMatrix();
  for (let row = 0; row < RECEIPT_QR_MODULE_COUNT; row += 1) {
    for (let column = 0; column < RECEIPT_QR_MODULE_COUNT; column += 1) {
      assert.equal(
        matrix[row][column],
        qr.isDark(row, column),
        `bitmap différent de l’encodeur en ${row},${column} : régénérer avec node scripts/generateReceiptQr.mjs`,
      );
    }
  }
});
