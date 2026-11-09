/** Validates decimal digit strings without accepting floats, signs or exponents. */
export function parseServiceInteger(value: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= min && number <= max ? number : null;
}
