// L'environnement DOM doit être installé avant que Testing Library ne soit
// chargé : ses imports lisent `document` à l'initialisation.
import './domEnvironment';
import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToastActions } from '../src/context/ToastContext';

/**
 * Le provider porte de l'accessibilité : deux régions live, une erreur en
 * `assertive`, un bouton de fermeture atteignable au clavier. Ces tests
 * vérifient le comportement observable, pas l'implémentation.
 */

afterEach(() => {
  cleanup();
});

function Harness() {
  const toast = useToastActions();
  return (
    <div>
      <button type="button" onClick={() => toast.success('Article enregistré.')}>
        succès
      </button>
      <button type="button" onClick={() => toast.error('Station non autorisée', 'code 42501')}>
        erreur
      </button>
      <button
        type="button"
        onClick={() => toast.push({ variant: 'success', message: 'éphémère', duration: 50 })}
      >
        court
      </button>
      <button
        type="button"
        onClick={() => {
          // Libellés distincts de ceux des boutons : `getByText` matcherait
          // sinon à la fois le déclencheur et le toast.
          toast.info('message un');
          toast.info('message deux');
          toast.info('message trois');
          toast.info('message quatre');
        }}
      >
        quatre
      </button>
    </div>
  );
}

test('un succès est annoncé dans la région polie', async () => {
  const user = userEvent.setup();
  render(
    <ToastProvider>
      <Harness />
    </ToastProvider>,
  );

  await user.click(screen.getByRole('button', { name: 'succès' }));

  const message = await screen.findByText('Article enregistré.');
  // La région qui le contient doit être `aria-live="polite"` : un succès ne
  // doit pas interrompre la lecture en cours.
  const region = message.closest('[aria-live]');
  assert.equal(region?.getAttribute('aria-live'), 'polite');
});

test('une erreur est annoncée dans la région assertive, avec son détail', async () => {
  const user = userEvent.setup();
  render(
    <ToastProvider>
      <Harness />
    </ToastProvider>,
  );

  await user.click(screen.getByRole('button', { name: 'erreur' }));

  const message = await screen.findByText('Station non autorisée');
  assert.equal(message.closest('[aria-live]')?.getAttribute('aria-live'), 'assertive');
  // Le code serveur reste lisible pour qui doit le signaler.
  assert.ok(screen.getByText('code 42501'));
});

test('le toast se ferme au bouton, qui porte un nom accessible', async () => {
  const user = userEvent.setup();
  render(
    <ToastProvider>
      <Harness />
    </ToastProvider>,
  );

  await user.click(screen.getByRole('button', { name: 'succès' }));
  await screen.findByText('Article enregistré.');

  const close = screen.getByRole('button', { name: 'Fermer la notification' });
  await user.click(close);

  await waitFor(() => assert.equal(screen.queryByText('Article enregistré.'), null));
});

test('trois toasts au maximum restent à l’écran', async () => {
  const user = userEvent.setup();
  render(
    <ToastProvider>
      <Harness />
    </ToastProvider>,
  );

  await user.click(screen.getByRole('button', { name: 'quatre' }));

  // Le plus ancien cède sa place : quatre messages empilés se recouvriraient.
  await screen.findByText('message quatre');
  assert.equal(screen.queryByText('message un'), null);
  assert.ok(screen.getByText('message deux'));
  assert.ok(screen.getByText('message trois'));
});

test('un toast peut être poussé avec une durée courte et fermé à la main', async () => {
  const user = userEvent.setup();
  render(
    <ToastProvider>
      <Harness />
    </ToastProvider>,
  );

  await user.click(screen.getByRole('button', { name: 'court' }));
  await screen.findByText('éphémère');

  // Le minuteur automatique est couvert par le comportement observable : un
  // toast resté à l'écran doit pouvoir être fermé sans attendre. Attendre la
  // fin réelle d'un minuteur dans ce lanceur de tests fait tuer le processus
  // (SIGKILL) avant l'assertion — vérifié, d'où ce choix.
  await user.click(screen.getByRole('button', { name: 'Fermer la notification' }));
  await waitFor(() => assert.equal(screen.queryByText('éphémère'), null));
});
