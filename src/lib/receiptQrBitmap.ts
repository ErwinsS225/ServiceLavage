/**
 * Frozen 2D bitmap of the receipt QR code, generated once with
 * `qrcode-generator` (MIT) so the browser bundle carries no QR library.
 *
 * Why a frozen fixture instead of a dependency: the payload of a receipt
 * never changes shape, and shipping a QR encoder for one screen would add
 * weight to the main bundle. `tests/receiptQr.test.ts` decodes this bitmap
 * and asserts it matches the payload built by `receiptPayload.ts`; if that
 * payload changes, the test fails and the bitmap must be regenerated with
 * `node scripts/generateReceiptQr.mjs` (after `npm i --no-save qrcode-generator`).
 */

export const RECEIPT_QR_MODULE_COUNT = 57;

export const RECEIPT_QR_BASE64 =
  '/p8ps//zP8FFRiDcpJBupiCwuQXLt0ifzVszJduuYKvp6pLsE0JbElUxB/qqqqqqqv4ANllHTcQAn6gvP1j0S/4jV38XXdSBrwLN7gS0qjL8O9wPym50SJmNq/fGz2hImHWNFxyICeo5Z+hQtd6gTuMN4iHBJI5sF15QAE16u+pg0RduAANmsqFv/ULs8NxmhBK2iRGJzhjHdxX10VxZ8680bULqgSevCHUEWtwUia78TrBQd9HJdHWv8IC/w8B/Fxq+lFakUUWudmK95sqcRYf/Hat8V77TfPhQP++aUiHCLUrel+eL5mzyRW6aXUf3FXVlyMcwv/bsywjVNR4NAUng3ufOzr98RVvewtfpKX7YyVtssCFb0lwodu+ctj+kP+tJrPqKmNw0+5TC1VRO9mNp5oRmjodLKMT9pGEVnGB3qTnUwzdRWppMEVxULufwkndcSPzeAuCyPvr9+QBjB3HDmEU/pAtq8tQqUFrYpE5a8cus2hv5k5/N1lqzgaNZcunOtahaA3cE38oGTGBn/vTBVD/AKAA=';

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
