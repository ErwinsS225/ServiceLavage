import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

/**
 * Invariants d'accessibilité, vérifiés sur le code source.
 *
 * Ces tests ne remplacent pas un audit par un utilisateur réel ni un test avec
 * lecteur d'écran. Ils empêchent la **régression mécanique** : un `outline-none`
 * ajouté sans anneau de remplacement, un `<label>` détaché de son champ, un
 * `<th>` sans portée, une icône cliquable sans nom. Ce sont les défauts qu'on
 * réintroduit sans le vouloir, pas ceux qui demandent du jugement.
 *
 * Chaque test cite le défaut historique qu'il empêche de revenir.
 */

const SRC = 'src';

async function tsxFiles(): Promise<string[]> {
  const found: string[] = [];
  async function walk(dir: string) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (full.endsWith('.tsx')) found.push(full);
    }
  }
  await walk(SRC);
  return found;
}

const sources = await (async () => {
  const files = await tsxFiles();
  return Promise.all(files.map(async file => ({ file, source: await readFile(file, 'utf8') })));
})();

test('aucun outline supprimé sans anneau de remplacement', () => {
  // 7 fichiers posaient `outline-none` ; seuls 2 avaient un `focus-visible`.
  // Ailleurs, le focus clavier devenait invisible.
  const offenders: string[] = [];
  for (const { file, source } of sources) {
    // `:focus-visible` global de index.css couvre les cas génériques ; ce qu'on
    // refuse, c'est un `outline-none` dans un composant qui n'offre rien.
    for (const match of source.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
      const value = match[1] ?? match[2];
      if (!/\boutline-none\b/.test(value)) continue;
      if (/focus-visible|focus:ring|focus:border/.test(value)) continue;
      offenders.push(`${file} : ${value.slice(0, 80)}`);
    }
  }
  assert.deepEqual(offenders, [], 'outline supprimé sans indicateur de focus');
});

test('index.css définit une règle de focus globale', async () => {
  const css = await readFile('src/index.css', 'utf8');
  assert.match(css, /:where\([^)]*\):focus-visible/, 'règle de focus globale attendue');
  assert.match(css, /--focus-ring/);
  // Le contour doit être visible sur les deux thèmes : une seule valeur ne
  // peut pas convenir à un fond clair et à un fond sombre.
  const values = [...css.matchAll(/--focus-ring:\s*([^;]+);/g)].map(m => m[1].trim());
  assert.equal(values.length, 2, 'une valeur par thème');
  assert.notEqual(values[0], values[1]);
});

test('chaque champ de formulaire est relié à un libellé', async () => {
  // Défaut historique : les `label` de `FormField` n'avaient pas de `htmlFor`,
  // donc cliquer sur le libellé ne donnait pas le focus, et les tests devaient
  // chercher le champ par sa position.
  const offenders: string[] = [];
  for (const { file, source } of sources) {
    // `Input.tsx` est le composant de champ lui-même : il reçoit son `id` du
    // parent, on ne peut pas le vérifier ici.
    if (file.endsWith('ui/Input.tsx')) continue;
    for (const match of source.matchAll(/<(input|select|textarea)\b[^>]*>/gs)) {
      const tag = match[0];
      const hasId = /\bid=/.test(tag);
      const hasAria = /aria-label|aria-labelledby/.test(tag);
      const isSpecial = /\btype="(hidden|checkbox|radio)"/.test(tag);
      // Un `input` imbriqué dans un `<label>` est aussi correct (auth) ; on le
      // reconnaît à `AuthField`, qui l'enveloppe.
      const wrapped = source.includes('AuthField');
      if (!hasId && !hasAria && !isSpecial && !wrapped) {
        offenders.push(`${file} : ${tag.slice(0, 70).replace(/\s+/g, ' ')}`);
      }
    }
  }
  assert.deepEqual(offenders, [], 'champ sans libellé associé');
});

test('les en-têtes de tableau déclarent leur portée', async () => {
  const table = await readFile('src/components/ui/Table.tsx', 'utf8');
  // Sans `scope`, l'association en-tête/cellule repose sur une heuristique du
  // navigateur : un lecteur d'écran annonce « 5 000 » sans dire « Tarif ».
  assert.match(table, /<th scope="col"/);
  // Chaque tableau porte un nom : deux tableaux anonymes dans la même page sont
  // indiscernables à la navigation par région.
  const users = sources.filter(({ file, source }) => file.includes('components/') && /<Table\b/.test(source));
  for (const { file, source } of users) {
    for (const match of source.matchAll(/<Table\b[^>]*>/g)) {
      assert.match(match[0], /label=/, `${file} : tableau sans nom accessible`);
    }
  }
});

test('les icônes purement décoratives sont masquées', async () => {
  // Une icône lucide dans un bouton qui a déjà un texte est annoncée deux fois.
  // On vérifie les cas où le bouton n'a PAS de texte visible mais un
  // `aria-label` : l'icône doit alors être `aria-hidden`.
  const offenders: string[] = [];
  for (const { file, source } of sources) {
    for (const match of source.matchAll(/<button\b[^>]*aria-label=[^>]*>([\s\S]*?)<\/button>/g)) {
      const inner = match[1];
      const hasIcon = /<[A-Z][A-Za-z0-9]*\s+className=/.test(inner);
      const iconHidden = /aria-hidden="true"/.test(inner);
      if (hasIcon && !iconHidden && !/\{/.test(inner.replace(/\s/g, ''))) {
        offenders.push(`${file} : ${match[0].slice(0, 70).replace(/\s+/g, ' ')}`);
      }
    }
  }
  assert.deepEqual(offenders, [], 'icône décorative non masquée dans un bouton étiqueté');
});

test('la préférence de mouvement réduit est respectée', async () => {
  const css = await readFile('src/index.css', 'utf8');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  // Le défilement doux doit être conditionné : une animation de défilement sur
  // une longue page provoque un vertige chez certaines personnes.
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\)[\s\S]{0,80}scroll-behavior: smooth/);
});

test('un lien d’évitement mène au contenu principal', async () => {
  const portal = await readFile('src/components/OwnerPortal.tsx', 'utf8');
  // Sans lui, l'utilisateur clavier traverse l'en-tête complet à chaque module.
  assert.match(portal, /className="skip-link"/);
  const target = portal.match(/href="#([a-z-]+)"/)?.[1];
  assert.ok(target, 'le lien doit viser une ancre');
  assert.match(portal, new RegExp(`id="${target}"`), 'la cible doit exister');
});

test('les modales piègent le focus et le restituent', async () => {
  const modal = await readFile('src/components/ui/Modal.tsx', 'utf8');
  assert.match(modal, /aria-modal="true"/);
  assert.match(modal, /useId\(\)/, 'identifiants uniques : deux modales ne doivent pas partager un titre');
  assert.match(modal, /returnFocusRef/, 'le focus doit revenir au déclencheur');
  assert.match(modal, /event\.key !== 'Tab'/, 'le piège de tabulation doit exister');
  assert.match(modal, /tabIndex=\{-1\}/, 'la boîte doit être focusable sans élément interactif');

  // Le reçu est aussi une modale, avec sa propre mise en page.
  const receipt = await readFile('src/components/ReceiptModal.tsx', 'utf8');
  assert.match(receipt, /aria-labelledby=\{titleId\}/);
  assert.match(receipt, /cancelAnimationFrame/, 'le focus doit être déplacé puis restitué');
});

test('aucune couleur de texte codée en dur sur une surface', async () => {
  // Mode clair : `text-white` sur fond blanc donne 1:1, donc invisible.
  // On tolère `text-white` uniquement sur un fond de marque, où il est mesuré.
  const BRAND = /bg-(indigo|rose|emerald|sky|amber|violet|red|green|blue)-\d+|bg-\[var\(--brand/;
  const offenders: string[] = [];
  for (const { file, source } of sources) {
    for (const match of source.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
      const value = match[1] ?? match[2];
      if (!/(^|\s)text-white(\s|$)/.test(value)) continue;
      if (BRAND.test(value)) continue;
      if (/text-white\/\d/.test(value)) continue;
      offenders.push(`${file} : ${value.slice(0, 80)}`);
    }
  }
  assert.deepEqual(offenders, [], 'texte blanc sur une surface qui peut être claire');
});
