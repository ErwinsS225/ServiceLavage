import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  STATION_TABS,
  allowedTabsFor,
  canOpenTab,
  resolveTab,
  parseStationRole,
  type StationRole,
} from '../src/lib/portalNavigation';

/**
 * La matrice d'onglets vivait dans le JSX du portail : les tests la relisaient
 * au regex, ce qui vérifiait l'écriture du code plutôt que la règle. Depuis la
 * P1 elle est exportée, donc ces assertions appellent la vraie fonction.
 *
 * Ce qui reste vérifié dans le source : que l'affichage de l'onglet et le
 * montage du panneau passent tous deux par la même fonction. C'est le seul
 * moyen de garantir qu'ils ne divergent pas à nouveau.
 */
const roles: StationRole[] = ['owner', 'gerant', 'caissier', 'laveur'];

test('la matrice couvre les huit modules, une fois chacun', () => {
  assert.deepEqual(
    STATION_TABS.map(tab => tab.id),
    ['dashboard', 'orders', 'services', 'customers', 'inventory', 'staff', 'reports', 'subscription'],
  );
});

test('aucun rôle ne reste sans aucun module', () => {
  for (const role of roles) {
    assert.ok(allowedTabsFor(role).length > 0, `${role} n'a aucun module`);
  }
  assert.deepEqual(allowedTabsFor(null), [], 'un rôle inconnu ne doit rien ouvrir');
});

test('un caissier ne peut pas ouvrir les prestations, un laveur ne gère rien', () => {
  // Le serveur refuse aussi : create_station_order_idempotent exige
  // propriétaire ou gérant.
  assert.equal(canOpenTab('caissier', 'orders'), false);
  assert.equal(canOpenTab('laveur', 'orders'), true, 'le laveur voit les prestations qui lui sont affectées');

  for (const forbidden of ['services', 'inventory', 'staff', 'reports', 'subscription'] as const) {
    assert.equal(canOpenTab('laveur', forbidden), false, `le laveur ne doit pas ouvrir ${forbidden}`);
  }
  assert.deepEqual(allowedTabsFor('laveur'), ['orders']);
});

test('les abonnements restent réservés au propriétaire', async () => {
  assert.equal(canOpenTab('owner', 'subscription'), true);
  for (const other of ['gerant', 'caissier', 'laveur'] as const) {
    assert.equal(canOpenTab(other, 'subscription'), false);
  }
  // Même règle côté module : le panneau n'est rendu que si canOpenTab passe.
  assert.match(
    await readFile('src/components/portal/StationModulePanel.tsx', 'utf8'),
    /canOpenTab\(role, tab\)/,
  );
});

test('un changement de station ne peut pas laisser un onglet interdit ouvert', () => {
  // Un gérant sur l'onglet Personnel rejoint une station où il est laveur :
  // il doit retomber sur le premier onglet autorisé, pas sur un panneau vide.
  assert.equal(resolveTab('gerant', 'staff'), 'staff');
  assert.equal(resolveTab('laveur', 'staff'), 'orders');
  assert.equal(resolveTab('caissier', 'dashboard'), 'dashboard');
  assert.equal(resolveTab(null, 'orders'), null);
  // Un onglet inconnu de la matrice ne fuit pas non plus.
  assert.equal(resolveTab('caissier', 'subscription' as never), 'dashboard');
});

test('l’onglet affiché et le panneau monté partagent la même fonction', async () => {
  const nav = await readFile('src/components/portal/StationModuleNav.tsx', 'utf8');
  const portal = await readFile('src/components/OwnerPortal.tsx', 'utf8');
  // La barre dérive sa liste de la matrice, elle ne la recopie pas.
  assert.match(nav, /STATION_TABS\.filter/);
  assert.doesNotMatch(nav, /\{ id: '/, 'aucun onglet ne doit être redéclaré dans la barre');
  // Le portail résout l'onglet via le helper, jamais par un test local.
  assert.match(portal, /resolveTab\(stationRole, tab\)/);
});

test('un rôle renvoyé par le serveur est validé avant usage', () => {
  assert.equal(parseStationRole('gerant'), 'gerant');
  assert.equal(parseStationRole('admin'), null);
  assert.equal(parseStationRole(null), null);
  assert.equal(parseStationRole(42), null);
});
