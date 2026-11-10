import './domEnvironment';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthCredentialsForm } from '../src/components/auth/AuthCredentialsForm';
import { AuthForgotForm } from '../src/components/auth/AuthForgotForm';
import { AuthResetForm } from '../src/components/auth/AuthResetForm';

/**
 * Behaviour-level tests: the components are mounted in a real DOM and driven
 * through their actual controls. The sibling authForms.test.ts checks source
 * invariants; this file checks what a user experiences.
 */

// Each test renders into the same document. Cleaning up in a hook rather than
// at the end of each test means a failing assertion cannot leak its DOM into
// the next one.
afterEach(cleanup);

/** Records every call made through the fake Supabase client. */
function fakeClient(overrides: Record<string, (payload: any, options?: any) => any> = {}) {
  const calls: Array<{ method: string; args: any[] }> = [];
  const auth = {
    signInWithPassword: async (...args: any[]) => { calls.push({ method: 'signInWithPassword', args }); return overrides.signInWithPassword?.(...args as [any]) ?? { error: null }; },
    signUp: async (...args: any[]) => { calls.push({ method: 'signUp', args }); return overrides.signUp?.(...args as [any]) ?? { error: null, data: { session: null } }; },
    resetPasswordForEmail: async (...args: any[]) => { calls.push({ method: 'resetPasswordForEmail', args }); return overrides.resetPasswordForEmail?.(...args as [any]) ?? { error: null }; },
    updateUser: async (...args: any[]) => { calls.push({ method: 'updateUser', args }); return overrides.updateUser?.(...args as [any]) ?? { error: null }; },
  };
  return { client: { auth } as any, calls };
}

const noop = () => {};

test('a wrong password shows a French message and never leaks the raw one', async () => {
  const user = userEvent.setup();
  const { client } = fakeClient({ signInWithPassword: () => ({ error: { message: 'Invalid login credentials' } }) });
  render(<AuthCredentialsForm supabase={client} mode="signin" onModeChange={noop} onForgot={noop} onMessage={noop} />);

  await user.type(screen.getByLabelText(/E-mail/), 'owner@example.ci');
  await user.type(screen.getByLabelText(/Mot de passe/), 'supersecret');
  await user.click(screen.getByRole('button', { name: 'Accéder à ma station' }));

  const alert = await screen.findByRole('alert');
  // L'intention du test est « l'utilisateur lit un franc¸ais utile, jamais le
  // texte GoTrue ». Le libellé exact est celui de `describeError`.
  assert.match(alert.textContent ?? '', /ne correspondent à aucun compte/);
  assert.doesNotMatch(alert.textContent ?? '', /Invalid login credentials/);
});

test('an empty form is refused locally, without calling the server', async () => {
  const user = userEvent.setup();
  const { client, calls } = fakeClient();
  render(<AuthCredentialsForm supabase={client} mode="signin" onModeChange={noop} onForgot={noop} onMessage={noop} />);

  await user.click(screen.getByRole('button', { name: 'Accéder à ma station' }));

  assert.equal(calls.length, 0, 'no request may be sent for an empty form');
  const alerts = await screen.findAllByRole('alert');
  assert.ok(alerts.length >= 1, 'the user must be told what is missing');
});

test('a malformed address is rejected before the server sees it', async () => {
  const user = userEvent.setup();
  const { client, calls } = fakeClient();
  render(<AuthCredentialsForm supabase={client} mode="signin" onModeChange={noop} onForgot={noop} onMessage={noop} />);

  await user.type(screen.getByLabelText(/E-mail/), 'pas-une-adresse');
  await user.type(screen.getByLabelText(/Mot de passe/), 'quelquechose');
  await user.click(screen.getByRole('button', { name: 'Accéder à ma station' }));

  assert.equal(calls.length, 0);
  assert.match((await screen.findByRole('alert')).textContent ?? '', /ne semble pas valide/);
});

test('sign-up refuses a password under the documented minimum', async () => {
  const user = userEvent.setup();
  const { client, calls } = fakeClient();
  render(<AuthCredentialsForm supabase={client} mode="signup" onModeChange={noop} onForgot={noop} onMessage={noop} />);

  await user.type(screen.getByLabelText(/E-mail/), 'nouveau@example.ci');
  await user.type(screen.getByLabelText(/Mot de passe/), 'court');
  await user.click(screen.getByRole('button', { name: 'Créer ma station' }));

  assert.equal(calls.length, 0);
  assert.match((await screen.findByRole('alert')).textContent ?? '', /au moins 8 caractères/);
});

test('the reveal toggle switches the field type without losing its value', async () => {
  const user = userEvent.setup();
  const { client } = fakeClient();
  render(<AuthCredentialsForm supabase={client} mode="signin" onModeChange={noop} onForgot={noop} onMessage={noop} />);

  const field = screen.getByLabelText(/Mot de passe/) as HTMLInputElement;
  await user.type(field, 'monmotdepasse');
  assert.equal(field.type, 'password');

  await user.click(screen.getByRole('button', { name: 'Voir' }));
  assert.equal(field.type, 'text');
  assert.equal(field.value, 'monmotdepasse', 'the value must survive the toggle');

  await user.click(screen.getByRole('button', { name: 'Masquer' }));
  assert.equal(field.type, 'password');
});

test('a successful sign-in sends exactly the typed credentials', async () => {
  const user = userEvent.setup();
  const { client, calls } = fakeClient();
  render(<AuthCredentialsForm supabase={client} mode="signin" onModeChange={noop} onForgot={noop} onMessage={noop} />);

  await user.type(screen.getByLabelText(/E-mail/), '  owner@example.ci  ');
  await user.type(screen.getByLabelText(/Mot de passe/), 'motdepasse123');
  await user.click(screen.getByRole('button', { name: 'Accéder à ma station' }));

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'signInWithPassword');
  assert.deepEqual(calls[0].args[0], { email: 'owner@example.ci', password: 'motdepasse123' });
});

test('sign-up warns to confirm the address instead of claiming a session', async () => {
  const user = userEvent.setup();
  const messages: string[] = [];
  const { client } = fakeClient();
  render(<AuthCredentialsForm supabase={client} mode="signup" onModeChange={noop} onForgot={noop} onMessage={m => messages.push(m)} />);

  await user.type(screen.getByLabelText(/E-mail/), 'nouveau@example.ci');
  await user.type(screen.getByLabelText(/Mot de passe/), 'motdepasse123');
  await user.click(screen.getByRole('button', { name: 'Créer ma station' }));

  // The form clears the previous message on submit, so only the last one counts.
  const shown = messages.filter(Boolean);
  assert.equal(shown.length, 1);
  assert.match(shown[0], /Vérifiez votre boîte de réception/);
  cleanup();
});

test('the recovery request always shows the same message, even for a failing address', async () => {
  const user = userEvent.setup();
  const messages: string[] = [];
  const { client, calls } = fakeClient({ resetPasswordForEmail: () => ({ error: { message: 'User not found' } }) });
  render(<AuthForgotForm supabase={client} onBack={noop} onMessage={m => messages.push(m)} />);

  await user.type(screen.getByLabelText(/E-mail/), 'inconnu@example.ci');
  await user.click(screen.getByRole('button', { name: 'Envoyer le lien de réinitialisation' }));

  assert.equal(calls.length, 1);
  // The address is sent, but the outcome says nothing about whether it exists.
  assert.ok(!messages.some(message => /User not found/.test(message)));
});

test('the reset form refuses two different passwords before calling the server', async () => {
  const user = userEvent.setup();
  const { client, calls } = fakeClient();
  render(<AuthResetForm supabase={client} onLeave={noop} onMessage={noop} />);

  await user.type(screen.getByLabelText(/Nouveau mot de passe/), 'motdepasse123');
  await user.type(screen.getByLabelText(/Confirmation/), 'motdepasse124');
  await user.click(screen.getByRole('button', { name: 'Enregistrer le mot de passe' }));

  assert.equal(calls.length, 0);
  assert.match((await screen.findByRole('alert')).textContent ?? '', /ne correspondent pas/);
});

test('the reset form sends the password once it is confirmed', async () => {
  const user = userEvent.setup();
  const { client, calls } = fakeClient();
  render(<AuthResetForm supabase={client} onLeave={noop} onMessage={noop} />);

  await user.type(screen.getByLabelText(/Nouveau mot de passe/), 'motdepasse123');
  await user.type(screen.getByLabelText(/Confirmation/), 'motdepasse123');
  await user.click(screen.getByRole('button', { name: 'Enregistrer le mot de passe' }));

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].args[0], { password: 'motdepasse123' });
});
