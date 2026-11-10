import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthField, authButton, authInput, authLink } from './AuthLayout';
import { RECOVERY_SENT_MESSAGE, authRedirectUrl } from '../../lib/passwordRecovery';
import { parseForm, signInSchema } from '../../lib/schemas';
import { describeError } from '../../lib/errorMessages';

/** Step one of "forgot password": ask for the address and send the link. */
export function AuthForgotForm({
  supabase,
  onBack,
  onMessage,
}: {
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
    // Seule la forme de l'adresse est vérifiée : refuser une adresse inconnue
    // ici révélerait quels comptes existent, ce que cette écran évite.
    const parsed = parseForm(signInSchema.shape.email, email);
    if (!parsed.ok) {
      setFieldError(parsed.errors._form ?? 'Saisissez l’adresse de votre compte.');
      return;
    }
    setFieldError('');
    setBusy(true);
    setError('');
    onMessage('');
    try {
      const { error: failure } = await supabase.auth.resetPasswordForEmail(parsed.data, {
        redirectTo: authRedirectUrl(window.location.origin),
      });
      if (failure) setError(describeError(failure).message);
      // Same message whether or not the address exists: never confirm
      // that an account is registered.
      else onMessage(RECOVERY_SENT_MESSAGE);
    } catch (cause) {
      setError(describeError(cause).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <p className="text-sm leading-relaxed text-gray-400">
        Saisissez l’adresse de votre compte : nous vous enverrons un lien pour choisir un nouveau mot de
        passe.
      </p>
      <AuthField label="E-mail" error={fieldError}>
        <input
          id="forgot-email"
          className={authInput}
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder="vous@exemple.ci"
          value={email}
          aria-invalid={!!fieldError}
          onChange={event => {
            setEmail(event.target.value);
            setFieldError('');
          }}
        />
      </AuthField>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300"
        >
          {error}
        </p>
      )}

      <button type="submit" className={authButton} disabled={busy}>
        {busy ? 'Envoi en cours…' : 'Envoyer le lien de réinitialisation'}
      </button>

      <div className="text-center">
        <button type="button" className={authLink} disabled={busy} onClick={onBack}>
          Revenir à la connexion
        </button>
      </div>
    </form>
  );
}
