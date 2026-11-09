import test from 'node:test';
import { readdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Disposable PostgreSQL-in-Wasm database. Supabase roles and auth.uid() are
// emulated; hosted PostgREST/Auth behavior still needs a separate integration test.
test('migrations enforce tenant isolation and retry safety under authenticated role', async () => {
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
    const files = (await readdir('supabase/migrations')).filter(name => name.endsWith('.sql')).sort();
    for (const file of files) await db.exec(await readFile(`supabase/migrations/${file}`, 'utf8'));
    await db.exec(await readFile('supabase/tests/tenant_isolation.sql', 'utf8'));
    await db.exec(await readFile('supabase/tests/station_memberships.sql', 'utf8'));
    await db.exec(await readFile('supabase/tests/subscription_limits.sql', 'utf8'));
  } finally {
    await db.close();
  }
});
