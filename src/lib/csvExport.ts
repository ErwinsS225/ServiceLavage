/**
 * Export CSV des prestations.
 *
 * Deux pièges traités ici plutôt que dans le composant :
 *  1. une valeur commençant par `=`, `+`, `-`, `@`, une tabulation ou un retour
 *     chariot est interprétée comme une formule par Excel/LibreOffice. Un
 *     véhicule nommé `=HYPERLINK("http://…","cliquez")` exécuterait du code à
 *     l'ouverture : la cellule est préfixée d'une apostrophe pour rester du texte ;
 *  2. les guillemets internes doivent être doublés, sinon la colonne se décale.
 *
 * Le BOM UTF-8 en tête garde les accents lisibles dans Excel.
 */

/** Échappe une valeur et neutralise les formules de tableur. */
export function csvCell(value: string | number): string {
  const text = String(value);
  const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export interface CsvOrderRow {
  id: string;
  created_at: string;
  vehicle_info: string;
  plate_number: string | null;
  total_xof: number;
  /** Montant réellement facturé (0 si la prestation n'est pas terminée). */
  billedXof: number;
  statusLabel: string;
}

export const ORDERS_CSV_HEADERS = [
  'ID',
  'Date',
  'Véhicule',
  'Immatriculation',
  'Prix figé (non facturé) XOF',
  'Montant facturé XOF',
  'Statut',
] as const;

/** Construit le contenu CSV complet, en-tête compris. */
export function buildOrdersCsv(rows: readonly CsvOrderRow[]): string {
  const lines = rows.map(row => [
    csvCell(row.id),
    csvCell(new Date(row.created_at).toLocaleString('fr-FR')),
    csvCell(row.vehicle_info),
    csvCell(row.plate_number ?? ''),
    csvCell(row.total_xof),
    // 0 pour une prestation non terminée : le prix existe, rien n'est dû.
    csvCell(row.billedXof),
    csvCell(row.statusLabel),
  ].join(','));

  return '\ufeff' + [ORDERS_CSV_HEADERS.join(','), ...lines].join('\r\n');
}

/** Déclenche le téléchargement d'un CSV dans le navigateur. */
export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
