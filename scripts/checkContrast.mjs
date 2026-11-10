/**
 * Vérifie les contrastes WCAG 2.1 des paires de couleurs réellement utilisées.
 *
 * Pourquoi un script plutôt qu'un contrôle manuel : un thème se dégrade par
 * petites touches. Une couleur ajoutée pour un cas précis passe le contrôle
 * visuel sur le fond pour lequel elle a été choisie, puis se retrouve un jour
 * sur l'autre thème. C'est exactement ce qui s'est produit ici : `text-rose-300`
 * sur `bg-rose-500/10` donne 8,83:1 en sombre et **1,66:1** en clair, et
 * personne ne l'avait mesuré.
 *
 * Les valeurs sont mesurées, pas estimées : conversion sRGB → luminance
 * relative selon WCAG 2.1, formule officielle.
 *
 * Mode d'emploi :
 *   node scripts/checkContrast.mjs          # vérifie
 *   node scripts/checkContrast.mjs --json   # sortie machine
 *
 * Code de sortie 1 si une paire tombe sous son seuil.
 */

/** Seuils WCAG 2.1. AA texte normal = 4,5:1 ; AA grand texte = 3:1. */
const THRESHOLD = { text: 4.5, large: 3, ui: 3 };

function hexToRgb(value) {
  const hex = value.replace('#', '');
  const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
  return [0, 2, 4].map(index => parseInt(full.slice(index, index + 2), 16));
}

function luminance([r, g, b]) {
  const channel = value => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(foreground, background) {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

/** Superpose une couleur avec opacité sur un fond, comme le fait le navigateur. */
function over(foreground, background, alpha) {
  return foreground.map((channel, index) => Math.round(channel * alpha + background[index] * (1 - alpha)));
}

const hex = value => hexToRgb(value);

/**
 * Jetons de `src/index.css`. Recopiés ici volontairement : si quelqu'un les
 * change dans la feuille de style sans mettre à jour ce fichier, le contrôle
 * devient faux — mais `tests/contrast.test.ts` compare les deux et échoue.
 * C'est le compromis le plus sûr sans analyseur CSS.
 */
export const DARK = {
  canvas: '#0c0e14',
  card: '#12151c',
  elevated: '#181c25',
  textPrimary: '#f8fafc',
  textSecondary: '#94a3b8',
  textMuted: '#9aa5b5',
  borderStrong: '#5c6880',
  brandPrimary: '#4f46e5',
  focusRing: '#a5b4fc',
  alert: {
    infoText: '#7dd3fc', infoBg: [14, 165, 233, 0.1],
    warningText: '#fcd34d', warningBg: [245, 158, 11, 0.1],
    successText: '#6ee7b7', successBg: [16, 185, 129, 0.1],
    errorText: '#fda4af', errorBg: [244, 63, 94, 0.1],
  },
};

export const LIGHT = {
  canvas: '#f8fafc',
  card: '#ffffff',
  elevated: '#f1f5f9',
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#5b6779',
  borderStrong: '#828fa1',
  brandPrimary: '#4f46e5',
  focusRing: '#4f46e5',
  alert: {
    infoText: '#1e40af', infoBg: '#eff6ff',
    warningText: '#92400e', warningBg: '#fffbeb',
    successText: '#065f46', successBg: '#ecfdf5',
    errorText: '#9f1239', errorBg: '#fff1f2',
  },
};

/**
 * Paires à contrôler, par thème. `level` : `text` (4,5), `large` (3) ou `ui`
 * (3, composants et contours).
 */
export function pairs(theme) {
  const t = theme;
  return [
    { label: 'texte principal sur carte', fg: t.textPrimary, bg: t.card, level: 'text' },
    { label: 'texte principal sur fond de page', fg: t.textPrimary, bg: t.canvas, level: 'text' },
    { label: 'texte secondaire sur carte', fg: t.textSecondary, bg: t.card, level: 'text' },
    { label: 'texte secondaire sur surface élevée', fg: t.textSecondary, bg: t.elevated, level: 'text' },
    { label: 'texte atténué sur carte', fg: t.textMuted, bg: t.card, level: 'text' },
    { label: 'texte atténué sur fond de page', fg: t.textMuted, bg: t.canvas, level: 'text' },
    // Le focus n'est pas de l'information textuelle mais un composant
    // d'interface : le seuil applicable est 3:1 (WCAG 1.4.11).
    { label: 'anneau de focus sur carte', fg: t.focusRing, bg: t.card, level: 'ui' },
    { label: 'anneau de focus sur fond de page', fg: t.focusRing, bg: t.canvas, level: 'ui' },
    { label: 'bordure forte sur carte', fg: t.borderStrong, bg: t.card, level: 'ui' },
    { label: 'texte blanc sur bouton principal', fg: '#ffffff', bg: t.brandPrimary, level: 'text' },
  ];
}

/** Alertes : le fond est calculé, pas codé, quand il est translucide. */
function alertPairs(theme) {
  const t = theme.alert;
  const surface = hex(theme.card);
  const resolve = value => (Array.isArray(value) ? over(hex(rgbHex(value[0], value[1], value[2])), surface, value[3]) : hex(value));
  const result = [];
  for (const variant of ['info', 'warning', 'success', 'error']) {
    result.push({
      label: `alerte ${variant} (texte sur fond)`,
      fg: hex(t[`${variant}Text`]),
      bg: resolve(t[`${variant}Bg`]),
      level: 'text',
    });
  }
  return result;
}

function rgbHex(r, g, b) {
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

export function audit() {
  const rows = [];
  const failures = [];
  for (const [themeName, theme] of [['sombre', DARK], ['clair', LIGHT]]) {
    for (const pair of [...pairs(theme), ...alertPairs(theme)]) {
      // `pairs` décrit ses couleurs en hexadécimal (lisible, comparable à la
      // feuille de style) ; `alertPairs` renvoie déjà des triplets calculés
      // parce qu'un fond translucide doit être superposé avant mesure.
      const toRgb = value => (typeof value === 'string' ? hex(value) : value);
      const ratio = contrast(toRgb(pair.fg), toRgb(pair.bg));
      const threshold = THRESHOLD[pair.level];
      const pass = ratio >= threshold;
      rows.push({ theme: themeName, label: pair.label, ratio: Number(ratio.toFixed(2)), threshold, pass });
      if (!pass) failures.push({ theme: themeName, label: pair.label, ratio: Number(ratio.toFixed(2)), threshold });
    }
  }
  return { rows, failures };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { rows, failures } = audit();
  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify({ rows, failures }, null, 2)}\n`);
  } else {
    let lastTheme = '';
    for (const row of rows) {
      if (row.theme !== lastTheme) {
        console.log(`\n--- thème ${row.theme} ---`);
        lastTheme = row.theme;
      }
      console.log(`${row.pass ? 'OK  ' : 'ÉCHEC'} ${row.ratio.toFixed(2).padStart(6)} / ${row.threshold}  ${row.label}`);
    }
    console.log();
    if (failures.length === 0) console.log(`${rows.length} paires contrôlées, toutes conformes AA.`);
    else console.log(`${failures.length} paire(s) sous le seuil.`);
  }
  process.exitCode = failures.length === 0 ? 0 : 1;
}
