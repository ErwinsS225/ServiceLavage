/**
 * Dumps a normalized catalog snapshot of the schema produced by the local
 * migrations, so it can be compared with the *real* production catalog.
 *
 * Why: `supabase db push` compares versions, not schemas. The five last
 * migrations were applied through the Supabase connector with timestamps taken
 * at execution time, so their remote versions differ from the local file names
 * and the CLI considers them pending. Before anything is deployed, the schema
 * itself must be proven identical.
 *
 * Usage:
 *   npx tsx scripts/dumpLocalSchema.ts            # prints JSON on stdout
 *   npx tsx scripts/dumpLocalSchema.ts > out.json
 *
 * The same snapshot is compared to `docs/sauvegardes/prod-schema-2026-11-10.json`
 * (captured from the deployed project) by `tests/productionSchemaDrift.test.ts`.
 */
import { readdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

export interface SchemaSnapshot {
  tables: Array<{ name: string; rls: boolean }>;
  columns: Array<{ table: string; name: string; type: string; nullable: string }>;
  policies: Array<{ table: string; name: string; cmd: string; roles: string }>;
  functions: Array<{ name: string; args: string; secdef: boolean }>;
  triggers: Array<{ table: string; name: string }>;
  indexes: Array<{ table: string; name: string; columns: string }>;
  constraints: Array<{ table: string; name: string; type: string }>;
  grants: Array<{ table: string; grantee: string; privs: string }>;
}

/** Roles provided by Supabase, emulated here (see tests/tenantIsolation.test.ts). */
const SUPABASE_EMULATION = `
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
`;

/** Everything the platform installs and that our migrations do not create. */
const PLATFORM_FUNCTIONS = ['rls_auto_enable'];

export async function dumpLocalSchema(): Promise<SchemaSnapshot> {
  const db = new PGlite();
  try {
    await db.exec(SUPABASE_EMULATION);
    const files = (await readdir('supabase/migrations')).filter(name => name.endsWith('.sql')).sort();
    for (const file of files) {
      await db.exec(await readFile(`supabase/migrations/${file}`, 'utf8'));
    }

    const query = async <T>(sql: string): Promise<T[]> => {
      const { rows } = await db.query<T>(sql);
      return rows;
    };

    const tables = await query<{ name: string; rls: boolean }>(
      `select c.relname as name, c.relrowsecurity as rls
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' order by c.relname`,
    );
    const columns = await query<{ table: string; name: string; type: string; nullable: string }>(
      `select table_name as "table", column_name as name, data_type as type, is_nullable as nullable
         from information_schema.columns where table_schema = 'public'
        order by table_name, column_name`,
    );
    const policies = await query<{ table: string; name: string; cmd: string; roles: string }>(
      `select tablename as "table", policyname as name, cmd, roles::text as roles
         from pg_policies where schemaname = 'public' order by tablename, policyname`,
    );
    const functions = await query<{ name: string; args: string; secdef: boolean }>(
      `select p.proname as name, pg_get_function_identity_arguments(p.oid) as args, p.prosecdef as secdef
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' order by p.proname, args`,
    );
    const triggers = await query<{ table: string; name: string }>(
      `select c.relname as "table", t.tgname as name
         from pg_trigger t join pg_class c on c.oid = t.tgrelid
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and not t.tgisinternal order by c.relname, t.tgname`,
    );
    const indexes = await query<{ table: string; name: string; columns: string }>(
      `select tablename as "table", indexname as name,
              coalesce(substring(indexdef from '\\((.*)\\)$'), '') as columns
         from pg_indexes where schemaname = 'public' order by tablename, indexname`,
    );
    // Only named constraints (`contype` p/f/u/c). `pg_constraint` also stores
    // one row per NOT NULL column on PostgreSQL 17, which carry generated
    // names and only add noise to the comparison.
    const constraints = await query<{ table: string; name: string; type: string }>(
      `select conrelid::regclass::text as "table", conname as name, contype as type
         from pg_constraint where connamespace = 'public'::regnamespace
          and contype in ('p', 'f', 'u', 'c')
        order by 1, 2`,
    );
    const grants = await query<{ table: string; grantee: string; privs: string }>(
      `select table_name as "table", grantee,
              string_agg(privilege_type, ',' order by privilege_type) as privs
         from information_schema.table_privileges
        where table_schema = 'public' and grantee in ('anon', 'authenticated')
        group by table_name, grantee order by table_name, grantee`,
    );

    return {
      tables,
      columns,
      policies,
      functions: functions.filter(fn => !PLATFORM_FUNCTIONS.includes(fn.name)),
      triggers,
      indexes,
      constraints,
      grants,
    };
  } finally {
    await db.close();
  }
}

if (process.argv[1]?.endsWith('dumpLocalSchema.ts') || process.argv[1]?.endsWith('dumpLocalSchema.mjs')) {
  const snapshot = await dumpLocalSchema();
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
}
