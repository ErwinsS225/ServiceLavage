import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const runIntegration = process.env.RUN_LOCAL_SUPABASE_INTEGRATION === '1';
const required = [
  'SUPABASE_LOCAL_URL',
  'SUPABASE_LOCAL_ANON_KEY',
  'SUPABASE_LOCAL_OWNER_EMAIL',
  'SUPABASE_LOCAL_OWNER_PASSWORD',
  'SUPABASE_LOCAL_MANAGER_EMAIL',
  'SUPABASE_LOCAL_MANAGER_PASSWORD',
  'SUPABASE_LOCAL_CASHIER_EMAIL',
  'SUPABASE_LOCAL_CASHIER_PASSWORD',
  'SUPABASE_LOCAL_WASHER_EMAIL',
  'SUPABASE_LOCAL_WASHER_PASSWORD',
  'SUPABASE_LOCAL_OUTSIDER_EMAIL',
  'SUPABASE_LOCAL_OUTSIDER_PASSWORD',
  'SUPABASE_LOCAL_STATION_ID',
  'SUPABASE_LOCAL_ASSIGNED_ORDER_ID',
  'SUPABASE_LOCAL_UNASSIGNED_ORDER_ID',
  'SUPABASE_LOCAL_INVENTORY_ITEM_ID',
];

function localValue(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing local integration setting: ${key}`);
  return value;
}

async function login(label: string): Promise<SupabaseClient> {
  const client = createClient(localValue('SUPABASE_LOCAL_URL'), localValue('SUPABASE_LOCAL_ANON_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: localValue(`SUPABASE_LOCAL_${label}_EMAIL`),
    password: localValue(`SUPABASE_LOCAL_${label}_PASSWORD`),
  });
  if (error) throw new Error(`Local Auth sign-in failed for ${label}: ${error.message}`);
  return client;
}

test(
  'local Supabase Auth/PostgREST role integration and concurrent idempotent retry',
  {
    skip: runIntegration ? false : 'Set RUN_LOCAL_SUPABASE_INTEGRATION=1 with the documented local fixtures.',
  },
  async () => {
    for (const key of required) localValue(key);
    const url = new URL(localValue('SUPABASE_LOCAL_URL'));
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      throw new Error(
        'Integration test safety stop: Supabase URL must resolve to localhost; remote projects are forbidden.',
      );
    }

    const [owner, manager, cashier, washer, outsider] = await Promise.all([
      login('OWNER'),
      login('MANAGER'),
      login('CASHIER'),
      login('WASHER'),
      login('OUTSIDER'),
    ]);
    const stationId = localValue('SUPABASE_LOCAL_STATION_ID');
    const assignedOrderId = localValue('SUPABASE_LOCAL_ASSIGNED_ORDER_ID');
    const unassignedOrderId = localValue('SUPABASE_LOCAL_UNASSIGNED_ORDER_ID');
    const itemId = localValue('SUPABASE_LOCAL_INVENTORY_ITEM_ID');
    const clients = { owner, manager, cashier, washer, outsider };
    const expectedRoles = {
      owner: 'owner',
      manager: 'gerant',
      cashier: 'caissier',
      washer: 'laveur',
      outsider: null,
    } as const;

    const roleResults = await Promise.all(
      Object.entries(clients).map(async ([name, client]) => {
        const { data, error } = await client.rpc('current_station_role', { p_station_id: stationId });
        if (error) throw new Error(`Role RPC failed for ${name}: ${error.message}`);
        return [name, data] as const;
      }),
    );
    for (const [name, role] of roleResults)
      assert.equal(role, expectedRoles[name as keyof typeof expectedRoles], `wrong role for ${name}`);

    async function ids(client: SupabaseClient, table: string, column = 'id') {
      const { data, error } = await client.from(table).select(column).eq('station_id', stationId);
      if (error) throw new Error(`PostgREST ${table} query failed: ${error.message}`);
      return ((data ?? []) as unknown as Array<Record<string, unknown>>).map(row => row[column]);
    }
    const [ownerCustomers, managerCustomers, cashierCustomers, washerCustomers, outsiderCustomers] =
      await Promise.all([
        ids(owner, 'station_customers'),
        ids(manager, 'station_customers'),
        ids(cashier, 'station_customers'),
        ids(washer, 'station_customers'),
        ids(outsider, 'station_customers'),
      ]);
    assert.ok(ownerCustomers.length > 0);
    assert.ok(managerCustomers.length > 0);
    assert.ok(cashierCustomers.length > 0);
    assert.equal(washerCustomers.length, 0);
    assert.equal(outsiderCustomers.length, 0);

    const [managerServices, cashierServices, washerServices, outsiderServices] = await Promise.all([
      ids(manager, 'station_services'),
      ids(cashier, 'station_services'),
      ids(washer, 'station_services'),
      ids(outsider, 'station_services'),
    ]);
    assert.ok(managerServices.length > 0);
    assert.equal(cashierServices.length, 0);
    assert.equal(washerServices.length, 0);
    assert.equal(outsiderServices.length, 0);

    const [ownerOrders, managerOrders, washerOrders, cashierOrders, outsiderOrders] = await Promise.all([
      ids(owner, 'station_orders'),
      ids(manager, 'station_orders'),
      ids(washer, 'station_orders'),
      ids(cashier, 'station_orders'),
      ids(outsider, 'station_orders'),
    ]);
    assert.ok(ownerOrders.includes(assignedOrderId) && ownerOrders.includes(unassignedOrderId));
    assert.ok(managerOrders.includes(assignedOrderId) && managerOrders.includes(unassignedOrderId));
    assert.ok(washerOrders.includes(assignedOrderId));
    assert.ok(!washerOrders.includes(unassignedOrderId));
    assert.equal(cashierOrders.length, 0);
    assert.equal(outsiderOrders.length, 0);

    const deniedTransition = await washer.rpc('transition_station_order', {
      p_order_id: unassignedOrderId,
      p_status: 'en_cours',
    });
    assert.ok(deniedTransition.error, 'washer must not transition an unassigned order');
    const deniedInvitation = await manager.rpc('create_station_invitation', {
      p_station_id: stationId,
      p_email: 'forbidden@example.invalid',
      p_role: 'laveur',
    });
    assert.ok(deniedInvitation.error, 'manager must not manage roles/invitations');

    const requestId = '55555555-5555-4555-8555-555555555555';
    const apply = () =>
      manager.rpc('apply_inventory_operation', {
        p_request_id: requestId,
        p_station_id: stationId,
        p_item_id: itemId,
        p_name: null,
        p_unit: null,
        p_quantity: 1,
        p_min_threshold: null,
      });
    const [first, concurrentRetry] = await Promise.all([apply(), apply()]);
    assert.ifError(first.error);
    assert.ifError(concurrentRetry.error);
    assert.equal(first.data?.[0]?.item_id, itemId);
    assert.equal(concurrentRetry.data?.[0]?.item_id, itemId);
    assert.equal(
      first.data?.[0]?.resulting_quantity,
      concurrentRetry.data?.[0]?.resulting_quantity,
      'same request ID must be idempotent across concurrent PostgREST calls',
    );
    const { data: stock, error: stockError } = await manager
      .from('station_inventory')
      .select('quantity')
      .eq('id', itemId)
      .single();
    assert.ifError(stockError);
    assert.equal(stock?.quantity, first.data?.[0]?.resulting_quantity);
  },
);
