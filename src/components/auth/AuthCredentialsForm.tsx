import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Mail } from 'lucide-react';
import { AuthField, authButton, authInput, authLink } from './AuthLayout';
import { MIN_PASSWORD_LENGTH } from '../../lib/passwordRecovery';
import { parseForm, signInSchema, signUpSchema } from '../../lib/schemas';
import { describeError } from '../../lib/errorMessages';
import { isMockMode, toggleMockMode } from '../../lib/supabase';

/**
 * Sign-in / sign-up form. Both modes share the same fields so switching keeps
 * what the user already typed; only the password autocomplete and the minimum
 * length differ, which is what the browser needs to offer the right thing.
 */
export function AuthCredentialsForm({
  supabase,
  mode,
  onModeChange,
  onForgot,
  onMessage,
}: {
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
  const [verificationPending, setVerificationPending] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

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

    setBusy(true);
    setError('');
    onMessage('');
    try {
      if (signup) {
        const { data, error: failure } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        // Supabase returns a fake user for an address that already exists, so
        // a success here proves nothing about the account being new.
        // `describeError` traduit le code GoTrue ; afficher le texte brut
        // montrait « User already registered » en anglais.
        if (failure) {
          const described = describeError(failure);
          setError(described.action ? `${described.message} ${described.action}` : described.message);
        } else if (data?.session) {
          onMessage('Compte créé et connecté avec succès.');
        } else {
          onMessage(
            'Compte créé. Vérifiez votre boîte de réception : un e-mail de confirmation vous a été envoyé.',
          );
          setRegisteredEmail(email.trim());
          setVerificationPending(true);
        }
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

  async function handleResendConfirmation(targetEmail?: string) {
    const toSend = (targetEmail || email).trim();
    if (!toSend) return;
    setBusy(true);
    try {
      const { error: resendErr } = await (supabase.auth as any).resend({
        type: 'signup',
        email: toSend,
        options: { emailRedirectTo: `${window.location.origin}/` },
      });
      if (resendErr) setError(describeError(resendErr).message);
      else onMessage('Lien de confirmation renvoyé. Vérifiez votre boîte de réception.');
    } catch (cause) {
      setError(describeError(cause).message);
    } finally {
      setBusy(false);
    }
  }

  if (verificationPending) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-violet-500/30 bg-violet-950/20 p-5 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-violet-600/20 text-violet-300 ring-1 ring-violet-500/40">
            <Mail className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white/95">Vérification de l’adresse e-mail</h2>
            <p className="mt-1 text-xs text-gray-400">
              Un e-mail de confirmation avec un lien sécurisé a été envoyé à :
            </p>
            <p className="mt-2 inline-block rounded-md bg-black/40 px-3 py-1 font-mono text-sm font-medium text-violet-300 border border-violet-500/30">
              {registeredEmail || email}
            </p>
          </div>
          <p className="text-xs leading-relaxed text-gray-300">
            Pour des raisons de sécurité et de validité de votre compte, vous devez cliquer sur ce lien avant de pouvoir vous connecter.
          </p>
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="space-y-3">
          <button
            type="button"
            className={authButton}
            disabled={busy}
            onClick={() => void handleResendConfirmation(registeredEmail || email)}
          >
            {busy ? 'Envoi en cours…' : "Renvoyer l’e-mail de confirmation"}
          </button>

          {isMockMode && (
            <button
              type="button"
              className="w-full rounded-lg border border-sky-500/40 bg-sky-950/50 px-4 py-2.5 text-xs font-semibold text-sky-200 transition hover:bg-sky-900/60 cursor-pointer"
              onClick={() => {
                const target = registeredEmail || email;
                (supabase.auth as any).confirmEmail?.(target);
                onMessage('Adresse e-mail confirmée avec succès (mode démo). Vous pouvez maintenant vous connecter.');
                setVerificationPending(false);
                onModeChange('signin');
              }}
            >
              Confirmer l’e-mail immédiatement (mode démo)
            </button>
          )}

          <button
            type="button"
            className="w-full text-center text-sm text-gray-400 hover:text-white transition cursor-pointer"
            onClick={() => {
              setVerificationPending(false);
              setError('');
              onModeChange('signin');
            }}
          >
            Retourner à la page de connexion
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
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
          onChange={event => {
            setEmail(event.target.value);
            setFieldErrors(prev => ({ ...prev, email: undefined }));
          }}
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
            onChange={event => {
              setPassword(event.target.value);
              setFieldErrors(prev => ({ ...prev, password: undefined }));
            }}
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

      {!signup && (
        <div className="flex justify-end -mt-2">
          <button
            type="button"
            className="text-xs font-medium text-violet-300 hover:text-violet-200 hover:underline transition cursor-pointer"
            disabled={busy}
            onClick={onForgot}
          >
            Mot de passe oublié ? (Forgot Password)
          </button>
        </div>
      )}

      {error && (
        <div className="space-y-2">
          <p
            role="alert"
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300"
          >
            {error}
          </p>
          {error.toLowerCase().includes('confirm') && (
            <div className="flex flex-wrap items-center gap-3 pt-0.5">
              <button
                type="button"
                className="text-xs text-amber-300 underline hover:text-amber-200 cursor-pointer"
                disabled={busy}
                onClick={() => void handleResendConfirmation()}
              >
                Renvoyer l’email de confirmation
              </button>
              {isMockMode && (
                <button
                  type="button"
                  className="text-xs text-sky-300 underline hover:text-sky-200 cursor-pointer"
                  onClick={() => {
                    (supabase.auth as any).confirmEmail?.(email.trim());
                    setError('');
                    onMessage('Email confirmé en mode démo ! Vous pouvez vous connecter.');
                  }}
                >
                  Confirmer l’e-mail (démo)
                </button>
              )}
            </div>
          )}

          {(error.toLowerCase().includes('envoi') || error.toLowerCase().includes('quota') || error.toLowerCase().includes('smtp')) && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-950/30 p-3 text-xs text-amber-200 space-y-2">
              <p className="font-semibold text-amber-300">
                Serveur SMTP Supabase non disponible ou quota d’e-mails atteint
              </p>
              <p className="text-amber-200/90 leading-relaxed">
                Le serveur distant n’a pas pu acheminer l’e-mail. Vous pouvez activer le mode local autonome pour créer votre compte et explorer immédiatement la station.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  className="rounded-md bg-amber-500/20 border border-amber-500/40 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/30 transition cursor-pointer"
                  onClick={() => toggleMockMode(true)}
                >
                  Activer le mode local autonome
                </button>
                <button
                  type="button"
                  className="rounded-md bg-white/10 border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/90 hover:bg-white/20 transition cursor-pointer"
                  onClick={() => {
                    setEmail('owner@servicelavage.ci');
                    setPassword('password123');
                    setError('');
                    onModeChange('signin');
                  }}
                >
                  Utiliser le compte démo
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {isMockMode ? (
        <div className="rounded-lg border border-sky-500/30 bg-sky-950/40 p-3 text-xs text-sky-200 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-sky-300">Mode démo local</span>
            <button
              type="button"
              className="text-xs font-semibold underline text-sky-300 hover:text-white cursor-pointer"
              onClick={() => {
                setEmail('owner@servicelavage.ci');
                setPassword('password123');
                setFieldErrors({});
                setError('');
              }}
            >
              Remplir (démo)
            </button>
          </div>
          <p className="text-sky-300/80 leading-relaxed">
            Créez un compte avec votre propre e-mail ou utilisez le compte propriétaire préconfiguré.
          </p>
          <div className="pt-1">
            <button
              type="button"
              className="text-[11px] text-sky-400 hover:text-sky-300 underline cursor-pointer"
              onClick={() => toggleMockMode(false)}
            >
              Basculer vers le serveur Supabase distant
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-2.5 text-xs text-gray-300 flex flex-wrap items-center justify-between gap-2">
          <span>Compte test préconfiguré :</span>
          <button
            type="button"
            className="text-xs font-medium text-violet-300 hover:text-violet-200 underline cursor-pointer"
            onClick={() => {
              setEmail('owner@servicelavage.ci');
              setPassword('password123');
              setFieldErrors({});
              setError('');
            }}
          >
            Remplir (owner@servicelavage.ci)
          </button>
        </div>
      )}

      <button type="submit" className={authButton} disabled={busy}>
        {busy ? 'Veuillez patienter…' : signup ? 'Créer ma station' : 'Accéder à ma station'}
      </button>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-1">
        <button
          type="button"
          className={authLink}
          disabled={busy}
          onClick={() => {
            setError('');
            setFieldErrors({});
            onMessage('');
            onModeChange(signup ? 'signin' : 'signup');
          }}
        >
          {signup ? 'Déjà un compte ? Se connecter' : 'Ouvrir mon compte gratuitement'}
        </button>
        {!signup && (
          <button type="button" className={authLink} disabled={busy} onClick={onForgot}>
            Mot de passe oublié ?
          </button>
        )}
      </div>
    </form>
  );
}
