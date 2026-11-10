import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthField, authButton, authInput, authLink } from './AuthLayout';
import { MIN_PASSWORD_LENGTH } from '../../lib/passwordRecovery';
import { newPasswordSchema, parseForm } from '../../lib/schemas';
import { describeError } from '../../lib/errorMessages';

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    // Le schéma porte les mêmes règles que `validateNewPassword` (longueur
    // annoncée, concordance) et nomme le champ fautif : l'erreur s'affiche
    // sous « Nouveau mot de passe » ou sous « Confirmation », pas au hasard.
    const parsed = parseForm(newPasswordSchema, { password, confirmation });
    if (!parsed.ok) {
      setFieldErrors(parsed.errors);
      return;
    }
    setFieldErrors({});
    setBusy(true); setError(''); onMessage('');
    try {
      const { error: failure } = await supabase.auth.updateUser({ password });
      // Le message brut de GoTrue est en anglais ; la traduction est centralisée.
      if (failure) setError(describeError(failure).message);
      else onMessage('Mot de passe modifié. Vous pouvez utiliser votre nouveau mot de passe.');
    } catch (cause) {
      setError(describeError(cause).message);
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit} noValidate className="space-y-5">
    <p className="text-sm leading-relaxed text-gray-400">
      Choisissez un nouveau mot de passe pour votre compte.
    </p>

    <AuthField
      label="Nouveau mot de passe"
      hint={`Au moins ${MIN_PASSWORD_LENGTH} caractères.`}
      error={fieldErrors.password}
    >
      <div className="relative">
        <input
          className={`${authInput} pr-20`}
          type={reveal ? 'text' : 'password'}
          name="new-password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={password}
          aria-invalid={!!fieldErrors.password}
          onChange={event => { setPassword(event.target.value); setFieldErrors(previous => { const next = { ...previous }; delete next.password; return next; }); }}
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

    <AuthField label="Confirmation" error={fieldErrors.confirmation}>
      <input
        className={authInput}
        type={reveal ? 'text' : 'password'}
        name="confirm-password"
        autoComplete="new-password"
        placeholder="••••••••"
        value={confirmation}
        aria-invalid={!!fieldErrors.confirmation}
        onChange={event => { setConfirmation(event.target.value); setFieldErrors(previous => { const next = { ...previous }; delete next.confirmation; return next; }); }}
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
