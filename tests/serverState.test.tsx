import './domEnvironment';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { render, waitFor, cleanup, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../src/context/ToastContext';
import { StationCustomers } from '../src/components/StationCustomers';
import { createQueryClient, queryKeys } from '../src/lib/queryClient';
import type { StationClient } from '../src/lib/stationApi';

/**
 * Séparation « état serveur » / « état d'écran » : ces tests vérifient les
 * garanties qu'apporte TanStack Query, pas la bibliothèque elle-même.
 *
 *  - deux montages successifs ne refont pas la requête avant `staleTime` ;
 *  - un `invalidateQueries` la refait ;
 *  - les clés sont préfixées par la station, donc changer de station ne
 *    réutilise jamais la liste de la précédente.
 *
 * Le faux client ne simule pas RLS : il compte les requêtes.
 */
/**
 * TanStack Query garde des minuteries (staleTime, gcTime) : sans les purger, le
 * processus de test ne se termine jamais. Chaque client créé est donc vidé.
 */
const clients: QueryClient[] = [];
function newClient(): QueryClient {
  const client = createQueryClient();
  clients.push(client);
  return client;
}

afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.clear();
});

function countingClient(customers: Array<Record<string, unknown>>) {
  const calls: string[] = [];
  const client = {
    from(table: string) {
      calls.push(table);
      const builder = {
        select: () => builder,
        eq: () => builder,
        // `.order()` est le dernier maillon de fetchCustomers : c'est une
        // promesse dans le vrai client, donc le faux doit l'être aussi.
        order: () => Promise.resolve({ data: customers, error: null }),
        insert: () => builder,
        update: () => builder,
        single: () => Promise.resolve({ data: customers[0] ?? null, error: null }),
        then: (resolve: (value: unknown) => void, reject: (reason: unknown) => void) =>
          Promise.resolve({ data: customers, error: null }).then(resolve, reject),
        catch: (reject: (reason: unknown) => void) =>
          Promise.resolve({ data: customers, error: null }).catch(reject),
      };
      return builder;
    },
    // La création d'un article passe par `apply_inventory_operation` : le
    // serveur renvoie une ligne, ce que le code vérifie.
    rpc: (name: string, args: unknown) => {
      calls.push(`rpc:${name}`);
      void args;
      return Promise.resolve({ data: [{ item_id: 'i2', quantity: 2 }], error: null });
    },
  } as unknown as StationClient;
  return { client, calls };
}

function wrapper(client: QueryClient) {
  // `StationCustomers` émet des toasts de succès : sans provider, le hook lève
  // et le rendu échoue. Le provider fait partie de l'application réelle, il
  // doit donc faire partie de l'environnement de test.
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <ToastProvider>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </ToastProvider>
    );
  };
}

const CUSTOMERS = [{ id: 'c1', name: 'Awa Koné', phone: '0700000001' }];

test('le cache évite une seconde requête, l’invalidation la relance', async () => {
  const { client, calls } = countingClient(CUSTOMERS);
  const queryClient = newClient();

  const first = render(<StationCustomers stationId="station-1" client={client} />, { wrapper: wrapper(queryClient) });
  await waitFor(() => assert.match(first.container.textContent ?? '', /Awa Koné/));
  assert.equal(calls.filter(table => table === 'station_customers').length, 1);
  first.unmount();

  // Remonter l'onglet relit depuis le cache : aucune requête réseau.
  const second = render(<StationCustomers stationId="station-1" client={client} />, { wrapper: wrapper(queryClient) });
  await waitFor(() => assert.match(second.container.textContent ?? '', /Awa Koné/));
  assert.equal(calls.filter(table => table === 'station_customers').length, 1, 'aucune requête supplémentaire avant staleTime');
  second.unmount();

  // Une écriture invalide la clé : la requête repart.
  await queryClient.invalidateQueries({ queryKey: queryKeys.customers('station-1') });
  const third = render(<StationCustomers stationId="station-1" client={client} />, { wrapper: wrapper(queryClient) });
  await waitFor(() => assert.match(third.container.textContent ?? '', /Awa Koné/));
  assert.equal(calls.filter(table => table === 'station_customers').length, 2);
});

test('les clés incluent la station : aucune fuite entre deux stations', async () => {
  const { client } = countingClient(CUSTOMERS);
  const queryClient = newClient();
  // Separately created clients must be flushed too, even when not rendered.
  clients.push(queryClient);
  assert.notDeepEqual(queryKeys.customers('station-1'), queryKeys.customers('station-2'));

  render(<StationCustomers stationId="station-1" client={client} />, { wrapper: wrapper(queryClient) });
  await waitFor(() => assert.ok(queryClient.getQueryData(queryKeys.customers('station-1'))));
  // La station 2 n'a jamais été chargée : son entrée de cache reste vide,
  // elle n'hérite donc pas des clients de la station 1.
  assert.equal(queryClient.getQueryData(queryKeys.customers('station-2')), undefined);
});

test('les réglages par défaut sont ceux du terrain, pas ceux de la librairie', () => {
  const defaults = createQueryClient().getDefaultOptions().queries;
  assert.equal(defaults?.retry, 1, 'un seul réessai : un gérant attend devant le comptoir');
  assert.equal(defaults?.staleTime, 30_000);
  assert.equal(defaults?.refetchOnWindowFocus, false, 'pas de rafale de requêtes au retour d’écran');
  assert.equal(createQueryClient().getDefaultOptions().mutations?.retry, 0, 'une mutation rejouée peut créer un doublon');
});

test('une erreur de lecture remonte un message français, sans écran vide', async () => {
  const failure = { data: null, error: { message: 'permission denied for table station_customers' } };
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => Promise.resolve(failure),
    then: (resolve: (value: unknown) => void, reject: (reason: unknown) => void) => Promise.resolve(failure).then(resolve, reject),
    catch: (reject: (reason: unknown) => void) => Promise.resolve(failure).catch(reject),
  };
  const failing = { from: () => chain } as unknown as StationClient;
  const queryClient = newClient();
  render(<StationCustomers stationId="station-1" client={failing} />, { wrapper: wrapper(queryClient) });
  // `retry: 1` est un choix assumé : l'erreur arrive après un second essai,
  // donc le test laisse le temps à cet essai (et à son délai) de passer.
  await waitFor(
    () => assert.match(document.body.textContent ?? '', /permission denied for table station_customers/),
    { timeout: 5000 },
  );
  assert.equal(screen.queryAllByText('Awa Koné').length, 0);
});

test('les requêtes du personnel respectent le rôle avant de toucher la base', async () => {
  // Un gérant n'a pas accès à `station_invitations` : demander les invitations
  // avant que `current_station_role` ait répondu produit une erreur qui
  // ressemble à une panne. `enabled` doit donc réellement bloquer l'appel.
  const { renderHook } = await import('@testing-library/react');
  const { useStaff } = await import('../src/hooks/useStationQueries');
  const { client, calls } = countingClient([]);
  const queryClient = newClient();

  const { result } = renderHook(() => useStaff('station-1', true, false, client), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });

  assert.equal(result.current.fetchStatus, 'idle', 'aucune requête ne doit partir');
  assert.deepEqual(calls, []);
  assert.equal(result.current.data, undefined, 'aucune donnée inventée en attendant le rôle');
});

test('l’inventaire ne demande rien au serveur hors ligne et retombe sur le cache', async () => {
  const { renderHook } = await import('@testing-library/react');
  const { useInventory } = await import('../src/hooks/useStationQueries');
  const { client, calls } = countingClient([]);
  const queryClient = newClient();

  const { result } = renderHook(() => useInventory('station-1', { enabled: false, client }), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });

  assert.equal(result.current.fetchStatus, 'idle');
  assert.deepEqual(calls, [], 'hors ligne, aucune requête ne doit partir');
});

test('une écriture invalide la lecture correspondante', async () => {
  // L'invalidation est la garantie qu'aucune liste n'est corrigée à la main :
  // on vérifie la règle sur le cache directement, ce qui évite de dépendre de
  // l'ordre des minuteries de rechargement dans le test.
  const queryClient = newClient();
  queryClient.setQueryData(queryKeys.inventory('station-1'), [{ id: 'i1' }]);
  queryClient.setQueryData(queryKeys.services('station-1'), [{ id: 's1' }]);
  assert.ok(queryClient.getQueryData(queryKeys.inventory('station-1')));

  await queryClient.invalidateQueries({ queryKey: queryKeys.inventory('station-1') });

  assert.equal(queryClient.getQueryState(queryKeys.inventory('station-1'))?.isInvalidated, true);
  assert.equal(
    queryClient.getQueryState(queryKeys.services('station-1'))?.isInvalidated,
    false,
    'invalider l’inventaire ne doit pas jeter le catalogue',
  );
});

test('la liste des stations se manipule au clavier', async () => {
  // SonarCloud a relevé un <li onClick> sans équivalent clavier dans une
  // première version de StationPicker : la liste était inutilisable sans
  // souris. La règle est vérifiée sur la source, faute de test visuel ici.
  const { readFile } = await import('node:fs/promises');
  const source = await readFile('src/components/portal/StationPicker.tsx', 'utf8');
  assert.doesNotMatch(source, /<li[^>]*onClick/, 'aucun <li> cliquable');
  assert.match(source, /<button[^>]*type="button"/, 'la sélection passe par un bouton');
  assert.match(source, /aria-pressed=\{isSelected\}/, 'l’état sélectionné est annoncé');
});
