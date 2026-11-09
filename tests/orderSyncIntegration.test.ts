import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { listQueuedOrders, saveQueuedOrder, synchronizeOrders, type QueuedOrder } from '../src/lib/offlineOrders';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, value); }
}

test('offline order retries after lost response against real PostgreSQL RPC', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
      create schema auth; create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth to anon, authenticated, service_role;
      grant execute on function auth.uid() to anon, authenticated, service_role;
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    `);
    for (const file of (await readdir('supabase/migrations')).filter(n => n.endsWith('.sql')).sort()) {
      await db.exec(await readFile(`supabase/migrations/${file}`, 'utf8'));
    }
    const userId = randomUUID(), stationId = randomUUID(), serviceId = randomUUID();
    await db.query('insert into auth.users(id,email) values ($1,$2)', [userId, `${userId}@example.invalid`]);
    await db.query('insert into public.stations(id,owner_id,name) values ($1,$2,$3)', [stationId, userId, 'Station']);
    await db.query('insert into public.station_services(id,station_id,name,price_xof,duration_minutes) values ($1,$2,$3,1000,10)', [serviceId, stationId, 'Lavage']);
    await db.exec('set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
    const storage = new MemoryStorage();
    const order: QueuedOrder = { version: 1, userId, stationId, requestId: randomUUID(), customerId: null, vehicle: 'Voiture', plate: null, serviceIds: [serviceId], createdAt: new Date().toISOString() };
    saveQueuedOrder(storage, order); // offline enqueue, no server call
    await db.query('update public.station_services set price_xof = 2500 where id = $1', [serviceId]);
    let calls = 0;
    const deliver = async (item: QueuedOrder) => {
      await db.query('select public.create_station_order_idempotent($1::uuid,$2::uuid,$3::uuid,$4::text,$5::text,$6::uuid[])',
        [item.requestId, item.stationId, item.customerId, item.vehicle, item.plate, item.serviceIds]);
      if (++calls === 1) throw new Error('response lost after server commit');
    };
    const first = await synchronizeOrders(storage, userId, stationId, deliver);
    assert.ok(first.error);
    assert.equal(listQueuedOrders(storage, userId, stationId).length, 1);
    const second = await synchronizeOrders(storage, userId, stationId, deliver);
    assert.equal(second.error, null);
    assert.equal(second.completed, 1);
    assert.equal(listQueuedOrders(storage, userId, stationId).length, 0);
    const result = await db.query<{ total_xof: number }>('select total_xof from public.station_orders where station_id=$1', [stationId]);
    assert.deepEqual(result.rows.map(row => row.total_xof), [2500]);
  } finally { await db.close(); }
});
