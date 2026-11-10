/**
 * Content of the QR code printed on a receipt.
 *
 * The previous screen drew a `QrCode` icon with the instruction "scannez pour
 * valider le ticket", but no QR existed: nothing was encoded, and the ticket
 * could not be verified by anyone. This module builds a real payload from the
 * order data the customer already sees, so a scan returns exactly the same
 * information as the paper — no claim of server-side authentication.
 */

export interface ReceiptPayloadInput {
  orderId: string;
  stationName: string;
  vehicleInfo: string;
  plateNumber: string | null;
  totalXof: number;
  status: string;
  createdAt: string;
  /** Optional station identifier (uuid) when the caller knows it. */
  stationId?: string;
}

const FORMAT = 'SLR1';

/** Stable short reference derived from the order uuid (no invented numbering). */
export function receiptReference(orderId: string): string {
  return orderId.replace(/-/g, '').slice(0, 8).toUpperCase();
}

/**
 * Line-oriented, human-readable payload: a scan, a photo of the ticket or a
 * manual transcription all yield the same fields. Values are single-line and
 * length-capped so a malicious vehicle name cannot forge extra lines.
 */
export function buildReceiptPayload(input: ReceiptPayloadInput): string {
  const clean = (value: string, max: number) => value.replace(/[\r\n]+/g, ' ').trim().slice(0, max);
  const iso = new Date(input.createdAt);
  const stamp = Number.isFinite(iso.getTime()) ? iso.toISOString() : '';
  return [
    FORMAT,
    `ref:${receiptReference(input.orderId)}`,
    `order:${clean(input.orderId, 36)}`,
    ...(input.stationId ? [`station:${clean(input.stationId, 36)}`] : []),
    `name:${clean(input.stationName, 60)}`,
    `vehicle:${clean(input.vehicleInfo, 60)}`,
    ...(input.plateNumber ? [`plate:${clean(input.plateNumber, 20)}`] : []),
    `amount:${Number.isFinite(input.totalXof) ? Math.trunc(input.totalXof) : 0}`,
    'currency:XOF',
    `status:${clean(input.status, 20)}`,
    ...(stamp ? [`date:${stamp}`] : []),
  ].join('\n');
}

/**
 * Reads a payload back. Returns `null` when the format marker is absent, so a
 * ticket printed before this change (or any other QR) is not misread.
 */
export function parseReceiptPayload(payload: string): Record<string, string> | null {
  const lines = payload.split(/\r?\n/).filter(Boolean);
  if (lines[0] !== FORMAT) return null;
  const fields: Record<string, string> = { format: FORMAT };
  for (const line of lines.slice(1)) {
    const index = line.indexOf(':');
    if (index <= 0) continue;
    fields[line.slice(0, index)] = line.slice(index + 1);
  }
  return fields;
}
