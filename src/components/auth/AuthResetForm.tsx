import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthField, authButton, authInput, authLink } from './AuthLayout';
import { MIN_PASSWORD_LENGTH, validateNewPassword } from '../../lib/passwordRecovery';

/**
 * Step two of "forgot password": the user arrived from the e-mail link with a
 * recovery session, and chooses a new password. Confirmation is checked
 * locally so a typo is caught before it reaches the server.
 */
export function AuthResetForm({ supabase, onLeave, onMessage }: {
  supabase: SupabaseClient;
  onLeave: () => void;
  onMessage: (message: string) => void;
}) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const check = validateNewPassword(password, confirmation);
    if (!check.ok) {
      setFieldError(check.reason === 'too_short'
        ? `Le nouveau mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`
        : check.reason === 'mismatch'
          ? 'Les deux mots de passe ne correspondent pas.'
          : 'Saisissez un nouveau mot de passe.');
      return;
    }
    setFieldError('');
    setBusy(true); setError(''); onMessage('');
    try {
      const { error: failure } = await supabase.auth.updateUser({ password });
      if (failure) setError(`Mot de passe non modifié : ${failure.message}`);
      else onMessage('Mot de passe modifié. Vous pouvez utiliser votre nouveau mot de passe.');
    } catch {
      setError('Mot de passe non modifié. Vérifiez votre connexion et réessayez.');
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit} noValidate className="space-y-5">
    <p className="text-sm leading-relaxed text-gray-400">
      Choisissez un nouveau mot de passe pour votre compte.
    </p>

    <AuthField label="Nouveau mot de passe" hint={`Au moins ${MIN_PASSWORD_LENGTH} caractères.`}>
      <div className="relative">
        <input
          className={`${authInput} pr-20`}
          type={reveal ? 'text' : 'password'}
          name="new-password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={password}
          aria-invalid={!!fieldError}
          onChange={event => setPassword(event.target.value)}
        />
        <button
          type="button"
          onClick={() => setReveal(value => !value)}
          aria-pressed={reveal}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-200"
        >
          {reveal ? 'Masquer' : 'Voir'}
        </button>
      </div>
    </AuthField>

    <AuthField label="Confirmation" error={fieldError}>
      <input
        className={authInput}
        type={reveal ? 'text' : 'password'}
        name="confirm-password"
        autoComplete="new-password"
        placeholder="••••••••"
        value={confirmation}
        aria-invalid={!!fieldError}
        onChange={event => { setConfirmation(event.target.value); setFieldError(''); }}
      />
    </AuthField>

    {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">{error}</p>}

    <button type="submit" className={authButton} disabled={busy}>
      {busy ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
    </button>

    <div className="text-center">
      <button type="button" className={authLink} disabled={busy} onClick={onLeave}>Revenir à la connexion</button>
    </div>
  </form>;
}
