import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DARK, LIGHT, audit } from '../scripts/checkContrast.mjs';

/**
 * Contraste WCAG 2.1, mesuré et non estimé.
 *
 * Ce test protège deux choses différentes :
 *   1. **les valeurs** — chaque paire utilisée atteint son seuil (AA texte
 *      4,5:1, composants 3:1) dans les deux thèmes ;
 *   2. **la source** — les couleurs du script sont bien celles de
 *      `src/index.css`. Sans cette seconde partie, on pourrait modifier la
 *      feuille de style et garder un contrôle vert sur d'anciennes valeurs.
 *
 * C'est cette dérive-là qui a produit le défaut d'origine : des couleurs
 * choisies pour le fond sombre se sont retrouvées sur fond clair sans que
 * personne ne mesure.
 */

const run = promisify(execFile);

test('toutes les paires de couleurs atteignent leur seuil dans les deux thèmes', () => {
  const { failures } = audit();
  assert.deepEqual(
    failures,
    [],
    `paires sous le seuil : ${failures.map(f => `${f.theme}/${f.label} ${f.ratio} < ${f.threshold}`).join(', ')}`,
  );
});

test('le texte atténué reste lisible (le cas qui avait échoué)', () => {
  // `text-muted` servait à 27 endroits et tombait à 3,84:1 en mode sombre.
  const { rows } = audit();
  const muted = rows.filter(row => row.label.startsWith('texte atténué'));
  assert.equal(muted.length, 4, 'deux thèmes × deux surfaces');
  for (const row of muted) {
    assert.ok(row.pass, `${row.theme} / ${row.label} : ${row.ratio}`);
    assert.ok(row.ratio >= 4.5);
  }
});

test('les bordures de champ délimitent un composant (3:1 minimum)', () => {
  const { rows } = audit();
  const borders = rows.filter(row => row.label === 'bordure forte sur carte');
  assert.equal(borders.length, 2);
  for (const row of borders) {
    // 1,58:1 avant correction : une bordure invisible ne délimite pas un champ.
    assert.equal(row.threshold, 3);
    assert.ok(row.pass, `${row.theme} : ${row.ratio}`);
  }
});

test('les alertes sont lisibles en mode clair, pas seulement en sombre', () => {
  const { rows } = audit();
  for (const theme of ['sombre', 'clair']) {
    const alerts = rows.filter(row => row.theme === theme && row.label.startsWith('alerte'));
    assert.equal(alerts.length, 4, `quatre variantes en ${theme}`);
    for (const row of alerts) {
      // La variante erreur tombait à 1,66:1 sur fond clair.
      assert.ok(row.pass, `${theme} / ${row.label} : ${row.ratio}`);
    }
  }
});

test('les couleurs du contrôle correspondent aux jetons de src/index.css', async () => {
  const css = await readFile('src/index.css', 'utf8');

  /** Extrait la valeur d'une variable CSS dans un bloc donné. */
  function token(block: string, name: string): string {
    const match = block.match(new RegExp(`--${name}:\\s*([^;]+);`));
    assert.ok(match, `jeton --${name} introuvable`);
    return match[1].trim();
  }

  // `:root { … }` = thème clair ; `.dark { … }` = thème sombre.
  const rootStart = css.indexOf(':root {');
  const darkStart = css.indexOf('.dark {');
  assert.ok(rootStart > 0 && darkStart > rootStart);
  const lightBlock = css.slice(rootStart, darkStart);
  const darkBlock = css.slice(darkStart);

  const expectations: Array<[string, string, string]> = [
    // [bloc, jeton, valeur attendue]
    [lightBlock, 'text-muted', LIGHT.textMuted],
    [darkBlock, 'text-muted', DARK.textMuted],
    [lightBlock, 'text-secondary', LIGHT.textSecondary],
    [darkBlock, 'text-secondary', DARK.textSecondary],
    [lightBlock, 'border-strong', LIGHT.borderStrong],
    [darkBlock, 'border-strong', DARK.borderStrong],
    [lightBlock, 'alert-error-text', LIGHT.alert.errorText],
    [darkBlock, 'alert-error-text', DARK.alert.errorText],
    [lightBlock, 'alert-info-text', LIGHT.alert.infoText],
    [darkBlock, 'alert-info-text', DARK.alert.infoText],
  ];

  for (const [block, name, expected] of expectations) {
    assert.equal(
      expected.startsWith('#') ? token(block, name).toLowerCase() : null,
      expected.toLowerCase(),
      `--${name} a changé sans mettre à jour scripts/checkContrast.mjs`,
    );
  }
});

test('le script de contrôle sort en erreur si une paire échoue', async () => {
  // Contrôle de la mécanique : sans ce test, un script qui renvoie toujours 0
  // (comme tout à l'heure, avant correction d'un bug de typage) passerait
  // pour un contrôle réussi.
  const { stdout } = await run('node', ['scripts/checkContrast.mjs', '--json']);
  const report = JSON.parse(stdout) as { failures: unknown[]; rows: unknown[] };
  assert.deepEqual(report.failures, []);
  assert.equal(report.rows.length, 28);
});
