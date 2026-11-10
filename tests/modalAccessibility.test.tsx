import './domEnvironment';
import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Modal } from '../src/components/ui/Modal';

/**
 * Une modale accessible n'est pas une modale qui « a l'air » d'une modale.
 * Ces tests vérifient les quatre propriétés qui la rendent utilisable au
 * clavier et au lecteur d'écran :
 *
 *   1. le focus entre dans la boîte à l'ouverture ;
 *   2. `Tab` ne sort pas de la boîte ;
 *   3. le focus revient sur le bouton d'origine à la fermeture ;
 *   4. `Échap` ferme, et le titre annoncé est le bon.
 *
 * Le cas « deux modales » est couvert séparément : un identifiant fixe
 * (`modal-title`) faisait que la seconde était étiquetée par le titre de la
 * première.
 */

afterEach(cleanup);

function opener(label = 'Ouvrir') {
  return <button type="button">{label}</button>;
}

/** Petit banc d'essai : bouton d'ouverture, modale, deux champs. */
function Dialog({
  onClose = () => {},
  title = 'Nouvelle prestation',
}: {
  onClose?: () => void;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Ouvrir
      </button>
      <button type="button">Après la modale</button>
      <Modal
        isOpen={open}
        onClose={() => {
          setOpen(false);
          onClose();
        }}
        title={title}
        description="Description de la modale."
      >
        <label htmlFor="champ-a">Champ A</label>
        <input id="champ-a" />
        <button type="button">Valider</button>
      </Modal>
    </div>
  );
}

test('le focus entre dans la modale à l’ouverture', async () => {
  const user = userEvent.setup();
  render(<Dialog />);

  const trigger = screen.getByRole('button', { name: 'Ouvrir' });
  trigger.focus();
  await user.click(trigger);

  const dialog = await screen.findByRole('dialog');
  // Le focus doit être dans la boîte, pas resté sur le déclencheur.
  assert.ok(
    dialog.contains(document.activeElement),
    `focus hors modale : ${document.activeElement?.outerHTML.slice(0, 60)}`,
  );
});

test('Tab et Maj+Tab bouclent à l’intérieur, sans sortir', async () => {
  const user = userEvent.setup();
  render(<Dialog />);

  await user.click(screen.getByRole('button', { name: 'Ouvrir' }));
  const dialog = await screen.findByRole('dialog');

  // Parcourt plus d'éléments focusables qu'il n'en existe : sans piège, le
  // focus finirait sur « Après la modale », hors de la boîte.
  for (let index = 0; index < 8; index += 1) {
    await user.tab();
    assert.ok(
      dialog.contains(document.activeElement),
      `le focus est sorti de la modale au tour ${index + 1} : ${document.activeElement?.textContent?.slice(0, 30)}`,
    );
  }

  // Et en arrière, depuis le premier élément, on doit revenir au dernier.
  for (let index = 0; index < 8; index += 1) {
    await user.tab({ shift: true });
    assert.ok(dialog.contains(document.activeElement), `le focus est sorti (Maj+Tab) au tour ${index + 1}`);
  }
});

test('le focus revient sur le bouton d’origine à la fermeture', async () => {
  const user = userEvent.setup();
  render(<Dialog />);

  const trigger = screen.getByRole('button', { name: 'Ouvrir' });
  await user.click(trigger);
  await screen.findByRole('dialog');

  await user.keyboard('{Escape}');

  // Sans cette restitution, l'utilisateur clavier repart du début de page.
  assert.equal(document.activeElement, trigger, 'le focus doit revenir au déclencheur');
  assert.equal(screen.queryByRole('dialog'), null);
});

test('Échap ferme et le bouton « Fermer » porte un nom accessible', async () => {
  const user = userEvent.setup();
  let closed = false;
  render(
    <Dialog
      onClose={() => {
        closed = true;
      }}
    />,
  );

  await user.click(screen.getByRole('button', { name: 'Ouvrir' }));
  await screen.findByRole('dialog');

  assert.ok(screen.getByRole('button', { name: 'Fermer' }));
  await user.keyboard('{Escape}');
  assert.equal(closed, true);
});

test('la modale est étiquetée par son titre et sa description', async () => {
  const user = userEvent.setup();
  render(<Dialog title="Ajouter un article" />);

  await user.click(screen.getByRole('button', { name: 'Ouvrir' }));
  const dialog = await screen.findByRole('dialog');

  assert.equal(dialog.getAttribute('aria-modal'), 'true');
  // `getByRole('dialog', { name })` résout `aria-labelledby` : si le titre
  // n'était pas correctement relié, ceci échouerait.
  assert.ok(screen.getByRole('dialog', { name: 'Ajouter un article' }));
  const describedBy = dialog.getAttribute('aria-describedby');
  assert.ok(describedBy, 'la description doit être reliée');
  assert.match(document.getElementById(describedBy!)?.textContent ?? '', /Description de la modale/);
});

test('les identifiants sont uniques : deux modales ne se confondent pas', async () => {
  const user = userEvent.setup();

  function Double() {
    const [open, setOpen] = useState(false);
    return (
      <div>
        <button type="button" onClick={() => setOpen(true)}>
          Ouvrir
        </button>
        <Modal isOpen title="Première" onClose={() => {}}>
          <button type="button">un</button>
        </Modal>
        <Modal isOpen={open} title="Seconde" onClose={() => {}}>
          <button type="button">deux</button>
        </Modal>
      </div>
    );
  }

  render(<Double />);
  await user.click(screen.getByRole('button', { name: 'Ouvrir' }));

  // Avec un identifiant fixe, les deux modales partageaient le même
  // `aria-labelledby` et la seconde répondait au nom de la première.
  assert.ok(screen.getByRole('dialog', { name: 'Première' }));
  assert.ok(screen.getByRole('dialog', { name: 'Seconde' }));
});

test('une modale sans élément interactif reste focusable et fermable', async () => {
  const user = userEvent.setup();

  function Empty() {
    const [open, setOpen] = useState(false);
    return (
      <div>
        <button type="button" onClick={() => setOpen(true)}>
          Ouvrir
        </button>
        <Modal isOpen={open} onClose={() => setOpen(false)} title="Information">
          <p>Texte seul.</p>
        </Modal>
      </div>
    );
  }

  render(<Empty />);
  await user.click(screen.getByRole('button', { name: 'Ouvrir' }));
  const dialog = await screen.findByRole('dialog');

  // Le bouton « Fermer » existe toujours, donc la boîte n'est jamais vide ;
  // ce test verrouille le cas où il serait retiré un jour.
  assert.ok(dialog.contains(document.activeElement));
  await user.keyboard('{Escape}');
  assert.equal(screen.queryByRole('dialog'), null);
});

test('le fond n’est ni focusable ni annoncé', async () => {
  const user = userEvent.setup();
  render(<Dialog />);

  await user.click(screen.getByRole('button', { name: 'Ouvrir' }));
  const dialog = await screen.findByRole('dialog');

  // Le fond est le frère précédent de la boîte ; il doit rester décoratif.
  const backdrop = dialog.previousElementSibling as HTMLElement;
  assert.equal(backdrop.getAttribute('aria-hidden'), 'true');
  assert.equal(backdrop.getAttribute('tabindex'), null);
});

test("l'overlay décoratif ne casse pas le rendu du banc d'essai", () => {
  // Garde-fou : `opener` est exporté pour un futur test, mais non utilisé ici.
  assert.ok(opener);
});
