import './domEnvironment';
import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DiagnosticPanel } from '../src/components/DiagnosticPanel';
import { clearEvents, track } from '../src/lib/telemetry';
import { clearMeasurements, measure } from '../src/lib/performance';
import { saveQueuedOrder } from '../src/lib/offlineOrders';

/**
 * Le panneau de diagnostic est lu par un caissier sur un téléphone, pas par un
 * développeur devant une console. Ces tests vérifient donc trois choses : il
 * affiche l'état réel de la file (pas une supposition), il ne masque jamais une
 * file illisible, et il est utilisable au clavier comme le reste du portail.
 */

afterEach(cleanup);

const perimeter = { userId: 'user-1', stationId: 'station-1', stationName: 'Station Cocody' };

// `localStorage` vit sur la fenêtre jsdom : Node n'en fournit pas de global, et
// en créer un second masquerait celui que l'application utilise vraiment.
const storage = window.localStorage;

function queuedOrder(requestId: string): void {
  saveQueuedOrder(storage, {
    version: 1,
    userId: 'user-1',
    stationId: 'station-1',
    requestId,
    customerId: null,
    vehicle: 'Toyota RAV4',
    plate: null,
    serviceIds: ['service-1'],
    createdAt: '2026-11-10T09:00:00.000Z',
  });
}

test('le panneau nomme la file en attente pour la station courante', () => {
  storage.clear();
  clearEvents();
  queuedOrder('req-1');
  queuedOrder('req-2');

  render(<DiagnosticPanel isOpen onClose={() => {}} perimeter={perimeter} appVersion="1.4.0" />);

  // La question du caissier : « est-ce que mes deux prestations sont parties ? ».
  assert.ok(screen.getByText(/2 prestations enregistrées sur cet appareil/));
  assert.ok(screen.getByText(/Version servie : 1\.4\.0\./));
  storage.clear();
});

test('sans périmètre, le panneau dit qu’il ne peut pas lire la file', () => {
  render(<DiagnosticPanel isOpen onClose={() => {}} perimeter={null} appVersion="dev" />);
  assert.ok(screen.getByText(/Aucune station sélectionnée/));
});

test('une mesure absente affiche un état vide explicite, pas un zéro', async () => {
  clearMeasurements();
  render(<DiagnosticPanel isOpen onClose={() => {}} perimeter={perimeter} appVersion="1.4.0" />);
  assert.ok(screen.getByText(/Aucune opération mesurée depuis l’ouverture de la page/));
  // Aucun tableau vide : un tableau sans ligne laisserait croire à des mesures.
  assert.equal(screen.queryByRole('table'), null);
});

test('les mesures présentes sont rendues en tableau accessible', async () => {
  clearMeasurements();
  await measure('prestations.chargement', async () => {});
  render(<DiagnosticPanel isOpen onClose={() => {}} perimeter={perimeter} appVersion="1.4.0" />);

  const table = screen.getByRole('table');
  assert.ok(within(table).getByText('prestations.chargement'));
  assert.ok(within(table).getByText('1'));
});

test('le journal affiche les événements, erreurs comprises, en clair', () => {
  clearEvents();
  track.error('offline.synchronisation_echouee', new Error('réseau absent'), { restants: 2 });

  render(<DiagnosticPanel isOpen onClose={() => {}} perimeter={perimeter} appVersion="1.4.0" />);

  assert.ok(screen.getByText('offline.synchronisation_echouee'));
  assert.ok(screen.getByText('réseau absent'));
  assert.ok(screen.getByText(/restants=2/));
  // Le titre de section et la ligne de constat disent tous deux « 1 erreur » :
  // on vise le titre, qui résume le journal affiché.
  assert.ok(screen.getByRole('heading', { name: /Journal récent \(1 événement, 1 erreur\)/ }));
});

test('le panneau s’ouvre en boîte de dialogue nommée et se ferme au clavier', async () => {
  clearEvents();
  let closed = 0;
  render(
    <DiagnosticPanel
      isOpen
      onClose={() => {
        closed += 1;
      }}
      perimeter={perimeter}
      appVersion="1.4.0"
    />,
  );

  const dialog = screen.getByRole('dialog', { name: /Diagnostic de cet appareil/ });
  assert.ok(dialog);
  // Le focus entre dans la boîte : sans cela, un lecteur d'écran reste sur la
  // page en arrière-plan et annonce du contenu invisible. Le déplacement se fait
  // après le rendu des enfants, donc après une frame.
  await waitFor(() => assert.ok(dialog.contains(document.activeElement)));

  await userEvent.keyboard('{Escape}');
  assert.equal(closed, 1);
});

test('les deux voies d’export sont présentes et nommées', () => {
  render(<DiagnosticPanel isOpen onClose={() => {}} perimeter={perimeter} appVersion="1.4.0" />);
  assert.ok(screen.getByRole('button', { name: /Copier le diagnostic/ }));
  assert.ok(screen.getByRole('button', { name: /Télécharger le fichier/ }));
});
