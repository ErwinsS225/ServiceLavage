import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assignOrder,
  createService,
  fetchActiveServices,
  fetchCustomers,
  fetchInventory,
  fetchOrders,
  fetchServices,
  resolveClient,
  transitionOrder,
  updateService,
} from '../src/lib/stationApi';
import { describeError, unwrap, unwrapNullable } from '../src/lib/queryResult';

/**
 * La couche `stationApi` a été extraite des composants pour être testable.
 * Ces tests vérifient exactement cela : les requêtes envoyées au client, les
 * bornes, et le fait que le serveur — jamais React — reste l'autorité.
 *
 * Le faux client enregistre les appels ; il ne simule aucune politique RLS.
 */

interface Call {
  table?: string;
  method: 'select' | 'insert' | 'update' | 'rpc';
  column?: string;
  value?: unknown;
  args?: unknown;
}

/** Client minimal qui rejoue une réponse fixée par table. */
function fakeClient(responses: Record<string, { data: unknown; error: { message: string } | null }>) {
  const calls: Call[] = [];
  const builder = (table: string) => {
    const response = responses[table] ?? { data: [], error: null };
    const chain = {
      select: () => { calls.push({ table, method: 'select' }); return chain; },
      insert: (values: unknown) => { calls.push({ table, method: 'insert', args: values }); return chain; },
      update: (values: unknown) => { calls.push({ table, method: 'update', args: values }); return chain; },
      eq: (column: string, value: unknown) => { calls.push({ table, method: 'select', column, value }); return chain; },
      is: (column: string, value: unknown) => { calls.push({ table, method: 'select', column, value }); return chain; },
      order: () => chain,
      limit: (value: number) => { calls.push({ table, method: 'select', column: 'limit', value }); return chain; },
      single: () => Promise.resolve(response),
      maybeSingle: () => Promise.resolve(response),
      then: (resolve: (value: unknown) => void, reject: (reason: unknown) => void) => Promise.resolve(response).then(resolve, reject),
    };
    return chain;
  };
  return {
    calls,
    client: {
      from: (table: string) => builder(table),
      rpc: (name: string, args: unknown) => {
        calls.push({ method: 'rpc', args: { name, ...(args as object) } });
        return Promise.resolve(responses[`rpc:${name}`] ?? { data: [{ ok: true }], error: null });
      },
      auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: 'user-1' } } } }) },
    } as unknown as Parameters<typeof fetchServices>[0],
  };
}

const SERVICE = { id: 'svc-1', name: 'Lavage simple', price_xof: 3000, duration_minutes: 20, is_active: true };

test('fetchServices filters by the requested station and no other', async () => {
  const { client, calls } = fakeClient({ station_services: { data: [SERVICE], error: null } });
  const rows = await fetchServices(client, 'station-1');
  assert.deepEqual(rows, [SERVICE]);
  const filter = calls.find(call => call.column === 'station_id');
  assert.equal(filter?.value, 'station-1', 'la requête doit viser la station demandée');
});

test('a PostgREST error becomes a French sentence, never an empty table', async () => {
  const { client } = fakeClient({ station_customers: { data: null, error: { message: 'permission denied for table station_customers' } } });
  await assert.rejects(
    () => fetchCustomers(client, 'station-1'),
    /Impossible de charger les clients : permission denied for table station_customers/,
  );
});

test('the orders query is bounded instead of loading the whole history', async () => {
  const { client, calls } = fakeClient({ station_orders: { data: [], error: null } });
  await fetchOrders(client, 'station-1');
  const limit = calls.find(call => call.column === 'limit');
  assert.ok(limit, 'la requête doit porter une limite');
  assert.equal(limit?.value, 200);
});

test('creating or updating a service passes the station id, not only the row id', async () => {
  const created = fakeClient({ station_services: { data: SERVICE, error: null } });
  await createService(created.client, 'station-1', { name: SERVICE.name, price_xof: 3000, duration_minutes: 20, is_active: true });
  const insert = created.calls.find(call => call.method === 'insert');
  assert.equal((insert?.args as { station_id?: string }).station_id, 'station-1');

  const updated = fakeClient({ station_services: { data: SERVICE, error: null } });
  await updateService(updated.client, 'station-1', 'svc-1', { name: SERVICE.name, price_xof: 3000, duration_minutes: 20, is_active: false });
  const filters = updated.calls.filter(call => call.method === 'select' && call.column);
  assert.ok(filters.some(call => call.column === 'station_id' && call.value === 'station-1'));
});

test('active services and inventory are read-only projections of the server', async () => {
  const { client, calls } = fakeClient({ station_services: { data: [SERVICE], error: null }, station_inventory: { data: [], error: null } });
  const services = await fetchActiveServices(client, 'station-1');
  assert.equal(services.length, 1);
  assert.ok(calls.some(call => call.column === 'is_active' && call.value === true));
  await fetchInventory(client, 'station-1');
});

test('permissions are delegated to SECURITY DEFINER RPCs, not decided in the client', async () => {
  const assignment = fakeClient({});
  await assignOrder(assignment.client, 'order-1', 'washer-1');
  assert.deepEqual(assignment.calls[0].args, { name: 'assign_station_order', p_order_id: 'order-1', p_user_id: 'washer-1' });

  const transition = fakeClient({});
  await transitionOrder(transition.client, 'order-1', 'termine');
  assert.deepEqual(transition.calls[0].args, { name: 'transition_station_order', p_order_id: 'order-1', p_status: 'termine' });
});

test('an RPC refusal surfaces the server message and never a fake success', async () => {
  const { client } = fakeClient({ 'rpc:transition_station_order': { data: null, error: { message: 'not allowed' } } });
  await assert.rejects(() => transitionOrder(client, 'order-1', 'annule'), /Mise à jour impossible : not allowed/);
});

test('a missing configuration fails with an actionable message', () => {
  assert.throws(() => resolveClient(null), /Supabase n’est pas configuré/);
});

test('unwrap treats a null payload as a failure and unwrapNullable does not', () => {
  assert.throws(() => unwrap({ data: null, error: null }, 'Absent'), /Absent/);
  assert.equal(unwrapNullable({ data: null, error: null }, 'Absent'), null);
  assert.deepEqual(unwrap({ data: [1], error: null }, 'Absent'), [1]);
});

test('network failures are translated, server failures are kept as-is', () => {
  assert.match(describeError(new TypeError('Failed to fetch'), 'Chargement impossible.'), /Vérifiez votre connexion/);
  assert.equal(describeError(new Error('permission denied'), 'Chargement impossible.'), 'permission denied');
  assert.equal(describeError('boom', 'Chargement impossible.'), 'Chargement impossible.');
});
