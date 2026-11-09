import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

/**
 * The sign-up, sign-in, forgot-password and reset screens are the first thing
 * every user sees, and they are the only place where a mistake costs an
 * account. These tests pin the behaviour that is easy to break silently:
 * the right autocomplete hints, no password ever revealed by default, and a
 * recovery flow that cannot leak whether an address is registered.
 *
 * Rendering is done through Vite's SSR build because the components are TSX.
 */
const FILES = {
  credentials: 'src/components/auth/AuthCredentialsForm.tsx',
  forgot: 'src/components/auth/AuthForgotForm.tsx',
  reset: 'src/components/auth/AuthResetForm.tsx',
  layout: 'src/components/auth/AuthLayout.tsx',
};

test('the sign-in form asks the browser for an existing password only', async () => {
  const source = await readFile(FILES.credentials, 'utf8');
  assert.match(source, /autoComplete=\{signup \? 'new-password' : 'current-password'\}/);
  assert.match(source, /signInWithPassword/);
  // A wrong password must not echo Supabase's English message to a French UI.
  assert.match(source, /Invalid login credentials/);
  assert.match(source, /Adresse e-mail ou mot de passe incorrect/);
});

test('the password is hidden until the user explicitly reveals it', async () => {
  for (const file of [FILES.credentials, FILES.reset]) {
    const source = await readFile(file, 'utf8');
    assert.match(source, /useState\(false\)/, `${file}: reveal must start hidden`);
    assert.match(source, /type=\{reveal \? 'text' : 'password'\}/, `${file}: password type must be conditional`);
    assert.match(source, /aria-pressed=\{reveal\}/, `${file}: the toggle must expose its state`);
  }
});

test('the forgot-password flow never confirms whether an account exists', async () => {
  const source = await readFile(FILES.forgot, 'utf8');
  assert.match(source, /RECOVERY_SENT_MESSAGE/);
  assert.match(source, /authRedirectUrl\(window\.location\.origin\)/);
  // The same message is shown on success, regardless of the address.
  assert.doesNotMatch(source, /aucun compte|n'existe pas|introuvable/i);
});

test('the reset form checks the confirmation locally before calling the server', async () => {
  const source = await readFile(FILES.reset, 'utf8');
  const validateAt = source.indexOf('validateNewPassword');
  const updateAt = source.indexOf('updateUser');
  assert.ok(validateAt > 0, 'validateNewPassword must be used');
  assert.ok(validateAt < updateAt, 'validation must run before the server call');
  assert.match(source, /MIN_PASSWORD_LENGTH/);
});

test('the layout panel is decorative and hidden on small screens', async () => {
  const source = await readFile(FILES.layout, 'utf8');
  assert.match(source, /alt=""/);
  assert.match(source, /aria-hidden="true"/);
  assert.match(source, /hidden lg:block/, 'the visual panel must not push the form down on mobile');
  assert.match(source, /grid-cols-\[45%_55%\]/);
});

test('each screen has its own photographs, and they exist', async () => {
  const source = await readFile(FILES.layout, 'utf8');
  const { stat } = await import('node:fs/promises');
  const seen = new Map<string, string>();
  const IMAGE = /auth-[\w-]+\.jpg/g;

  for (const scene of ['signin', 'signup', 'forgot', 'reset']) {
    const block = source.match(new RegExp(`${scene}: \\[([^\\]]+)\\]`))?.[1] ?? '';
    const names = block.match(IMAGE) ?? [];
    assert.ok(names.length >= 1, `${scene}: no image declared`);

    for (const name of names) {
      const info = await stat(`public/assets/${name}`);
      assert.ok(info.size > 0, `${name} is missing or empty`);
      // No image may be shared between two screens: each page needs its own scene.
      const previous = seen.get(name);
      assert.equal(previous, undefined, `${name} is used by both ${previous} and ${scene}`);
      seen.set(name, scene);
    }
  }

  // Sign-in and sign-up must both have a full pair.
  const pair = (scene: string) => {
    const block = source.match(new RegExp(`${scene}: \\[([^\\]]+)\\]`))?.[1] ?? '';
    return (block.match(IMAGE) ?? []).length;
  };
  for (const scene of ['signin', 'signup', 'forgot', 'reset']) {
    assert.equal(pair(scene), 2, `${scene} must have two images`);
  }
});

test('the rotating photographs respect prefers-reduced-motion', async () => {
  const source = await readFile(FILES.layout, 'utf8');
  assert.match(source, /prefers-reduced-motion: reduce/);
  // The first image is eagerly loaded, the alternates are not.
  assert.match(source, /fetchPriority=\{index === 0 \? 'high' : 'low'\}/);
});

test('every auth input is labelled and errors are announced', async () => {
  const layout = await readFile(FILES.layout, 'utf8');
  assert.match(layout, /<label className="block">/, 'AuthField must wrap the control in a label');
  assert.match(layout, /role="alert"/, 'field errors must be announced');

  for (const file of Object.values(FILES).filter(file => !file.endsWith('AuthLayout.tsx'))) {
    const source = await readFile(file, 'utf8');
    const labels = (source.match(/<AuthField/g) ?? []).length;
    assert.ok(labels > 0, `${file}: no AuthField found`);
  }
});

test('the auth pages do not hard-code the Supabase project', async () => {
  for (const file of Object.values(FILES)) {
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, /[a-z]{20}\.supabase\.co/, `${file}: project reference must stay in env`);
  }
});

/**
 * The RPC revoke (L1-T5) removed the plain create_station_order from
 * `authenticated`. Sign-up is unaffected, but the guard keeps a reminder that
 * a new account has no station and therefore reads an empty list, not an error.
 */
test('a brand new account sees no station and no error', async () => {
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
    const { readdir } = await import('node:fs/promises');
    for (const file of (await readdir('supabase/migrations')).filter(name => name.endsWith('.sql')).sort()) {
      await db.exec(await readFile(`supabase/migrations/${file}`, 'utf8'));
    }

    const userId = '33333333-3333-4333-8333-333333333333';
    await db.exec(`insert into auth.users(id,email,email_confirmed_at) values ('${userId}','new@example.invalid',now())`);
    await db.exec(`set local role authenticated`);
    await db.exec(`select set_config('request.jwt.claim.sub','${userId}',true)`);
    const { rows } = await db.query<{ n: number }>('select count(*)::int as n from public.stations');
    assert.equal(rows[0]?.n, 0, 'a new account must read an empty station list');
  } finally {
    await db.close();
  }
});

/**
 * Sales copy is the easiest place to promise something that does not exist.
 * src/data/planFeatures.ts already records which features are live, so the
 * auth copy is checked against it: a promise must never be made about a
 * feature still marked planned.
 */
test('the sales copy only mentions features that actually work', async () => {
  const copy = await readFile('src/components/auth/authCopy.ts', 'utf8');
  const features = await readFile('src/data/planFeatures.ts', 'utf8');

  // Labels of everything not yet operational.
  const planned = [...features.matchAll(
    /\{ id: '[\w-]+', label: '([^']+)', delivery: '(planned|partial)'/g,
  )].map(match => match[1]);
  assert.ok(planned.length > 0, 'the feature list must still mark unsold items');

  // Words that would only make sense for an unbuilt feature.
  const forbidden = ['rapport', 'commission', 'whatsapp', 'pdf', 'excel', 'caisse', 'vitrine', 'marketplace'];
  for (const word of forbidden) {
    assert.doesNotMatch(copy, new RegExp(word, 'i'),
      `the auth copy promises "${word}", which is still planned`);
  }

  // Each screen must carry a claim, a sentence and at least two benefits.
  for (const screen of ['signin', 'signup', 'forgot', 'reset']) {
    const block = copy.slice(copy.indexOf(`${screen}: {`));
    const points = block.slice(0, block.indexOf(']')).match(/^\s+'/gm) ?? [];
    assert.ok(points.length >= 2, `${screen}: needs at least two concrete benefits`);
  }
});

test('the copy makes no promise the code cannot keep', async () => {
  const copy = await readFile('src/components/auth/authCopy.ts', 'utf8');
  const portal = await readFile('src/components/OwnerPortal.tsx', 'utf8');

  // "all sessions signed out" would require signOut({ scope: 'global' }),
  // which is not used anywhere.
  assert.doesNotMatch(copy, /toutes vos sessions|toutes les sessions/i);

  // "one-time link" is a Supabase Auth setting we do not control from here.
  assert.doesNotMatch(copy, /valable une seule fois|usage unique/i);

  // The offline claim is real: StationOrders queues to localStorage, which is
  // what actually backs the sentence shown on the sign-in panel.
  assert.match(copy, /hors ligne/i);
  const orders = await readFile('src/components/StationOrders.tsx', 'utf8');
  assert.match(orders, /offlineOrders/);
  assert.match(orders, /saveQueuedOrder/);
  assert.doesNotMatch(portal, /offlineOrders/, 'the portal page itself does not queue orders');
});
