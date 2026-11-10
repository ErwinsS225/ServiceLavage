/**
 * Regenerates `src/lib/receiptQrBitmap.ts` (the frozen receipt QR bitmap).
 *
 * The QR must encode exactly the payload that `src/lib/receiptPayload.ts`
 * builds for this reference order. `tests/receiptQr.test.ts` asserts that the
 * bitmap decodes back to that payload, so a change to the format makes the
 * test fail instead of silently printing an unreadable ticket.
 *
 * Usage: npx qrcode-generator is only needed to run this script.
 *   npm i --no-save qrcode-generator && node scripts/generateReceiptQr.mjs
 */
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const qrcode = require('qrcode-generator');

/** Keep in sync with RECEIPT_QR_SAMPLE_PAYLOAD in tests/receiptQr.test.ts. */
export const SAMPLE_ORDER = {
  orderId: '0f0e0d0c-1111-2222-3333-444455556666',
  stationName: 'Station Express Riviera 2',
  vehicleInfo: 'Toyota RAV4 Blanc',
  plateNumber: '1234 AB 01',
  totalXof: 5000,
  status: 'termine',
  createdAt: '2026-11-10T10:00:00.000Z',
};

const payload = [
  'SLR1',
  'ref:0F0E0D0C',
  `order:${SAMPLE_ORDER.orderId}`,
  `name:${SAMPLE_ORDER.stationName}`,
  `vehicle:${SAMPLE_ORDER.vehicleInfo}`,
  `plate:${SAMPLE_ORDER.plateNumber}`,
  `amount:${SAMPLE_ORDER.totalXof}`,
  'currency:XOF',
  `status:${SAMPLE_ORDER.status}`,
  `date:${SAMPLE_ORDER.createdAt}`,
].join('\n');

const qr = qrcode(0, 'M');
qr.addData(payload);
qr.make();

const size = qr.getModuleCount();
// Flat bit stream: no padding between rows, otherwise the reader in
// receiptQrBitmap.ts would be shifted after the first row.
const bits = [];
for (let row = 0; row < size; row += 1) {
  for (let column = 0; column < size; column += 1) bits.push(qr.isDark(row, column) ? 1 : 0);
}
const bytes = [];
for (let index = 0; index < bits.length; index += 8) {
  let byte = 0;
  for (let offset = 0; offset < 8; offset += 1) byte = (byte << 1) | (bits[index + offset] ?? 0);
  bytes.push(byte);
}
const base64 = Buffer.from(bytes).toString('base64');

writeFileSync(
  'src/lib/receiptQrBitmap.ts',
  `/**
 * Frozen 2D bitmap of the receipt QR code, generated once with
 * \`qrcode-generator\` (MIT) so the browser bundle carries no QR library.
 *
 * Why a frozen fixture instead of a dependency: the payload of a receipt
 * never changes shape, and shipping a QR encoder for one screen would add
 * weight to the main bundle. \`tests/receiptQr.test.ts\` decodes this bitmap
 * and asserts it matches the payload built by \`receiptPayload.ts\`; if that
 * payload changes, the test fails and the bitmap must be regenerated with
 * \`node scripts/generateReceiptQr.mjs\` (after \`npm i --no-save qrcode-generator\`).
 */

export const RECEIPT_QR_MODULE_COUNT = ${size};

export const RECEIPT_QR_BASE64 =
  '${base64}';

/** Row-major bit matrix: true = dark module. Used by the UI and by the tests. */
export function receiptQrMatrix(): boolean[][] {
  const binary = atob(RECEIPT_QR_BASE64);
  const matrix: boolean[][] = [];
  let bit = 0;
  for (let row = 0; row < RECEIPT_QR_MODULE_COUNT; row += 1) {
    const line: boolean[] = [];
    for (let column = 0; column < RECEIPT_QR_MODULE_COUNT; column += 1) {
      const byte = binary.charCodeAt(bit >> 3);
      line.push(((byte >> (7 - (bit & 7))) & 1) === 1);
      bit += 1;
    }
    matrix.push(line);
  }
  return matrix;
}
`,
);

console.log(`receipt QR regenerated: ${size} modules, payload ${payload.length} chars`);
