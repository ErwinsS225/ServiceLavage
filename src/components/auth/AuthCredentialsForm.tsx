import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthField, authButton, authInput, authLink } from './AuthLayout';
import { MIN_PASSWORD_LENGTH } from '../../lib/passwordRecovery';
import { parseForm, signInSchema, signUpSchema } from '../../lib/schemas';
import { describeError } from '../../lib/errorMessages';

/**
 * Sign-in / sign-up form. Both modes share the same fields so switching keeps
 * what the user already typed; only the password autocomplete and the minimum
 * length differ, which is what the browser needs to offer the right thing.
 */
export function AuthCredentialsForm({ supabase, mode, onModeChange, onForgot, onMessage }: {
  supabase: SupabaseClient;
  mode: 'signin' | 'signup';
  onModeChange: (mode: 'signin' | 'signup') => void;
  onForgot: () => void;
  onMessage: (message: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const signup = mode === 'signup';

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    // Deux schémas distincts : à l'inscription, le minimum annoncé par
    // l'application ; à la connexion, aucune longueur minimale, sinon un
    // compte plus ancien ne pourrait plus entrer.
    const parsed = parseForm(signup ? signUpSchema : signInSchema, { email, password });
    if (!parsed.ok) {
      setFieldErrors(parsed.errors);
      return;
    }
    setFieldErrors({});

    setBusy(true); setError(''); onMessage('');
    try {
      if (signup) {
        const { error: failure } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        // Supabase returns a fake user for an address that already exists, so
        // a success here proves nothing about the account being new.
        // `describeError` traduit le code GoTrue ; afficher le texte brut
        // montrait « User already registered » en anglais.
        if (failure) setError(describeError(failure).message);
        else onMessage('Compte créé. Vérifiez votre boîte de réception : un e-mail de confirmation vous a été envoyé.');
      } else {
        const { error: failure } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (failure) {
          const described = describeError(failure);
          setError(described.action ? `${described.message} ${described.action}` : described.message);
        }
      }
    } catch (cause) {
      setError(describeError(cause).message);
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit} noValidate className="space-y-5">
    <AuthField label="E-mail" error={fieldErrors.email}>
      <input
        className={authInput}
        type="email"
        name="email"
        autoComplete="email"
        inputMode="email"
        placeholder="vous@exemple.ci"
        value={email}
        aria-invalid={!!fieldErrors.email}
        onChange={event => { setEmail(event.target.value); setFieldErrors(prev => ({ ...prev, email: undefined })); }}
      />
    </AuthField>

    <AuthField
      label="Mot de passe"
      error={fieldErrors.password}
      hint={signup ? `Au moins ${MIN_PASSWORD_LENGTH} caractères, et unique à ce compte.` : undefined}
    >
      <div className="relative">
        <input
          className={`${authInput} pr-20`}
          type={reveal ? 'text' : 'password'}
          name="password"
          autoComplete={signup ? 'new-password' : 'current-password'}
          placeholder="••••••••"
          value={password}
          aria-invalid={!!fieldErrors.password}
          onChange={event => { setPassword(event.target.value); setFieldErrors(prev => ({ ...prev, password: undefined })); }}
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

    {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">{error}</p>}

    <button type="submit" className={authButton} disabled={busy}>
      {busy ? 'Veuillez patienter…' : signup ? 'Créer ma station' : 'Accéder à ma station'}
    </button>

    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-1">
      <button
        type="button"
        className={authLink}
        disabled={busy}
        onClick={() => { setError(''); setFieldErrors({}); onMessage(''); onModeChange(signup ? 'signin' : 'signup'); }}
      >
        {signup ? 'Déjà un compte ? Se connecter' : 'Ouvrir mon compte gratuitement'}
      </button>
      {!signup && <button type="button" className={authLink} disabled={busy} onClick={onForgot}>
        Mot de passe oublié ?
      </button>}
    </div>
  </form>;
}
