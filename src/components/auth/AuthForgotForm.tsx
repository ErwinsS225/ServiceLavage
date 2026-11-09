import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthField, authButton, authInput, authLink } from './AuthLayout';
import { RECOVERY_SENT_MESSAGE, authRedirectUrl } from '../../lib/passwordRecovery';

/** Step one of "forgot password": ask for the address and send the link. */
export function AuthForgotForm({ supabase, onBack, onMessage }: {
  supabase: SupabaseClient;
  onBack: () => void;
  onMessage: (message: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim()) { setFieldError('Saisissez l’adresse de votre compte.'); return; }
    setFieldError('');
    setBusy(true); setError(''); onMessage('');
    try {
      const { error: failure } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: authRedirectUrl(window.location.origin),
      });
      if (failure) setError(`Envoi impossible : ${failure.message}`);
      // Same message whether or not the address exists: never confirm
      // that an account is registered.
      else onMessage(RECOVERY_SENT_MESSAGE);
    } catch {
      setError('Envoi impossible. Vérifiez votre connexion et réessayez.');
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit} noValidate className="space-y-5">
    <p className="text-sm leading-relaxed text-gray-400">
      Saisissez l’adresse de votre compte : nous vous enverrons un lien pour choisir un nouveau mot de passe.
    </p>
    <AuthField label="E-mail" error={fieldError}>
      <input
        className={authInput}
        type="email"
        name="email"
        autoComplete="email"
        inputMode="email"
        placeholder="vous@exemple.ci"
        value={email}
        aria-invalid={!!fieldError}
        onChange={event => { setEmail(event.target.value); setFieldError(''); }}
      />
    </AuthField>

    {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">{error}</p>}

    <button type="submit" className={authButton} disabled={busy}>
      {busy ? 'Envoi en cours…' : 'Envoyer le lien de réinitialisation'}
    </button>

    <div className="text-center">
      <button type="button" className={authLink} disabled={busy} onClick={onBack}>Revenir à la connexion</button>
    </div>
  </form>;
}
