/** Display the stored XOF value without guessing a currency or converting it. */
export function formatXof(amount: number): string {
  return `${amount.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} FCFA`;
}
