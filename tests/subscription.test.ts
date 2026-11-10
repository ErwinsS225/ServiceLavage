import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fetchSubscription, quotaUsage } from '../src/lib/stationApi';
import {
  SERVER_LIMITS,
  UNCONTROLLED_LIMITS,
  featureDeliveryLabels,
  planFeatures,
} from '../src/data/planFeatures';

/**
 * L'écran d'abonnement affichait « Code prêt, migration non déployée » alors que
 * les migrations d'abonnement sont appliquées et que `my_subscription()` est
 * réellement branchée. Il annonçait aussi des plafonds d'utilisateurs et de
 * photos que le serveur ne contrôle pas, sans le dire.
 *
 * Ces assertions figent la séparation : trois plafonds réels, deux objectifs
 * commerciaux, et un compteur qui vient du serveur uniquement.
 */

function fakeClient(response: { data: unknown; error: { message: string } | null }) {
  const calls: string[] = [];
  return {
    calls,
    client: {
      rpc: (name: string) => {
        calls.push(name);
        return Promise.resolve(response);
      },
      from: () => {
        throw new Error('aucune lecture de table ne doit être faite ici');
      },
    } as unknown as Parameters<typeof fetchSubscription>[0],
  };
}

const ROW = { plan: 'pro', max_stations: 2, max_monthly_orders: 2500, station_count: 1, monthly_orders: 37 };

test('la formule vient de my_subscription et de nulle part ailleurs', async () => {
  const { client, calls } = fakeClient({ data: [ROW], error: null });
  const subscription = await fetchSubscription(client);
  assert.deepEqual(calls, ['my_subscription']);
  assert.deepEqual(subscription, {
    plan: 'pro',
    max_stations: 2,
    max_monthly_orders: 2500,
    // Les compteurs sont ceux du serveur : 1 station, 37 prestations.
    station_count: 1,
    monthly_orders: 37,
  });
});

test('une réponse vide est une erreur, jamais un plan par défaut', async () => {
  const { client } = fakeClient({ data: [], error: null });
  await assert.rejects(() => fetchSubscription(client), /Aucune formule retournée/);
  // PostgreSQL renvoie des bigint pour les compteurs : ils doivent être convertis,
  // sinon l'affichage concatène « 12 » + « / 500 » ou pire, des BigInt bruts.
  const { client: textClient } = fakeClient({
    data: [
      { plan: 'starter', max_stations: 1, max_monthly_orders: 500, station_count: '1', monthly_orders: '0' },
    ],
    error: null,
  });
  const parsed = await fetchSubscription(textClient);
  assert.equal(parsed.station_count, 1);
  assert.equal(parsed.monthly_orders, 0);
});

test('une erreur de la RPC remonte son message, sans formule inventée', async () => {
  const { client } = fakeClient({
    data: null,
    error: { message: 'permission denied for function my_subscription' },
  });
  await assert.rejects(() => fetchSubscription(client), /permission denied for function my_subscription/);
});

test('le quota est borné et ne divise jamais par zéro', () => {
  assert.equal(quotaUsage(1, 2), 50);
  assert.equal(quotaUsage(0, 500), 0);
  assert.equal(quotaUsage(2500, 2500), 100);
  assert.equal(quotaUsage(3000, 2500), 100, 'au-delà du plafond, la barre reste pleine');
  assert.equal(quotaUsage(5, 0), null, 'un plafond nul ne produit pas Infinity');
  assert.equal(quotaUsage(Number.NaN, 10), null);
});

test('seuls les plafonds réellement appliqués sont présentés comme tels', async () => {
  // Vérifié dans les migrations : enforce_station_limit, enforce_monthly_order_limit
  // et le contrôle de plan dans apply_inventory_operation.
  assert.deepEqual(Object.keys(SERVER_LIMITS).sort(), ['inventory', 'monthlyOrders', 'stations']);
  assert.match(SERVER_LIMITS.stations.mechanism, /enforce_station_limit/);
  assert.match(SERVER_LIMITS.monthlyOrders.mechanism, /enforce_monthly_order_limit/);
  assert.match(SERVER_LIMITS.inventory.mechanism, /Pro ou Business/);
  // Utilisateurs et photos ne sont contrôlés par aucun trigger : ils restent
  // annoncés comme objectif, séparément.
  assert.deepEqual(
    [...UNCONTROLLED_LIMITS],
    ['Nombre d’utilisateurs par station', 'Nombre de photos de vitrine'],
  );

  const screen = await readFile('src/components/SubscriptionPlans.tsx', 'utf8');
  assert.match(screen, /Cible non contrôlée par le serveur/);
  assert.doesNotMatch(
    screen,
    /migration non déployée/i,
    'les migrations sont appliquées : ne plus l’annoncer',
  );
  assert.match(screen, /Aucun contrôle serveur pour/);
});

test('aucun tarif n’est codé dans le composant', async () => {
  const screen = await readFile('src/components/SubscriptionPlans.tsx', 'utf8');
  const data = await readFile('src/data/planFeatures.ts', 'utf8');
  // Les prix vivent dans les données, pas dans le rendu : ils étaient codés
  // dans un ternaire imbriqué sur l'id de la formule.
  assert.doesNotMatch(screen, /'5 000'|'15 000'|'35 000'/);
  assert.match(screen, /plan\.monthlyPriceXof/);
  for (const plan of planFeatures) {
    assert.equal(typeof plan.monthlyPriceXof, 'number');
    assert.ok(
      data.includes(`monthlyPriceXof: ${plan.monthlyPriceXof}`),
      `${plan.id} doit exposer son tarif en données`,
    );
  }
  // Le libellé « migration non déployée » ne doit subsister nulle part.
  assert.equal(featureDeliveryLabels.prepared, 'Préparé, non actif');
});
