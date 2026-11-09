import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

/**
 * Guards the *upgrade path* rather than a from-scratch install: production has
 * the six first migrations applied and four pending ones. Applying all ten at
 * once (as tenantIsolation.test.ts does) cannot prove that the pending set
 * applies cleanly on top of the deployed state.
 */
const DEPLOYED = [
  '20261109121406_owner_stations.sql',
  '20261109122729_station_customers.sql',
  '20261109122929_station_services.sql',
  '20261109123327_station_orders.sql',
  '20261109130303_order_idempotency.sql',
  '20261109130602_restrict_station_privileges.sql',
];
const PENDING = [
  '20261109140000_station_memberships.sql',
  '20261109141000_subscription_limits.sql',
  '20261109142000_station_inventory.sql',
  '20261109150000_station_role_permissions.sql',
];
// Written after the four above were deployed, so it is a separate increment:
// it only tightens a grant and adds no table.
const REVOKE = ['20261109160000_revoke_legacy_order_rpc.sql'];

async function apply(db: PGlite, file: string) {
  await db.exec(await readFile(`supabase/migrations/${file}`, 'utf8'));
}

/** Reads the single scalar of a `select count(*) ...` query without relying on an alias. */
async function count(db: PGlite, sql: string) {
  const { rows } = await db.query<Record<string, number | string>>(sql);
  const row = rows[0];
  if (!row) return -1;
  return Number(Object.values(row)[0]);
}

test('the four pending migrations apply in order on top of the deployed schema', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin bypassrls;
      create schema auth;
      create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth to anon, authenticated, service_role;
      grant execute on function auth.uid() to anon, authenticated, service_role;
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    `);

    // The repository must not drift from the expected split.
    const files = (await readdir('supabase/migrations')).filter(name => name.endsWith('.sql')).sort();
    assert.deepEqual(files, [...DEPLOYED, ...PENDING, ...REVOKE]);

    for (const file of DEPLOYED) await apply(db, file);

    // Reproduce a production-like state before upgrading.
    const ownerId = '11111111-1111-4111-8111-111111111111';
    await db.exec(`
      insert into auth.users(id,email,email_confirmed_at) values ('${ownerId}','owner@example.invalid',now());
      insert into public.stations(owner_id,name) values ('${ownerId}','Station existante');
    `);
    const before = await count(db, `select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r'`);
    assert.equal(before, 6, 'six tables are deployed before the upgrade');

    // Apply one migration at a time and check the boundary after each.
    await apply(db, PENDING[0]);
    assert.equal(await count(db, `select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r'`), 8, 'memberships adds two tables');
    assert.equal(await count(db, `select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='accept_station_invitation'`), 1);

    await apply(db, PENDING[1]);
    assert.equal(await count(db, `select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r'`), 9, 'subscription_limits adds owner_subscriptions');
    assert.equal(await count(db, `select count(*) from pg_trigger where tgname='enforce_station_limit'`), 1);
    assert.equal(await count(db, `select count(*) from pg_trigger where tgname='enforce_monthly_order_limit'`), 1);

    await apply(db, PENDING[2]);
    assert.equal(await count(db, `select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r'`), 11, 'inventory adds station_inventory and station_inventory_operations');

    await apply(db, PENDING[3]);
    assert.equal(await count(db, `select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r'`), 12, 'role_permissions adds station_order_assignments');

    // No table may be left without RLS, including the four new ones.
    assert.equal(await count(db, `select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r' and not c.relrowsecurity`), 0);

    // The existing station survives and is now covered by the Starter default plan.
    assert.equal(await count(db, `select count(*) from public.stations`), 1);
    const { rows: plan } = await db.query<{ plan: string; max_stations: number; max_monthly_orders: number }>(
      `select * from public.subscription_limits('${ownerId}')`,
    );
    assert.deepEqual(plan[0], { plan: 'starter', max_stations: 1, max_monthly_orders: 500 });

    // The deployed-data scripts must still pass on the upgraded database.
    for (const script of ['tenant_isolation', 'station_memberships', 'subscription_limits',
      'station_inventory', 'station_role_permissions']) {
      await db.exec(await readFile(`supabase/tests/${script}.sql`, 'utf8'));
    }
  } finally {
    await db.close();
  }
});

test('the upgrade keeps an existing station readable but blocks a second one under Starter', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon nologin; create role authenticated nologin;
      create role service_role nologin bypassrls;
      create schema auth;
      create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth to anon, authenticated, service_role;
      grant execute on function auth.uid() to anon, authenticated, service_role;
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    `);
    for (const file of [...DEPLOYED, ...PENDING]) await apply(db, file);

    const ownerId = '22222222-2222-4222-8222-222222222222';
    await db.exec(`
      insert into auth.users(id,email,email_confirmed_at) values ('${ownerId}','owner2@example.invalid',now());
      insert into public.stations(owner_id,name) values ('${ownerId}','Station existante');
    `);
    // A second station must now be refused by the trigger, as documented in
    // docs/plan-implementation-2026-11-09.md (risk "quota Starter").
    await assert.rejects(
      () => db.exec(`insert into public.stations(owner_id,name) values ('${ownerId}','Station 2')`),
      /Limite de stations atteinte/,
    );
  } finally {
    await db.close();
  }
});
