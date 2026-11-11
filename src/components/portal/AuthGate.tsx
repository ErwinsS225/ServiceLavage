import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthLayout } from '../auth/AuthLayout';
import { AuthCredentialsForm } from '../auth/AuthCredentialsForm';
import { AuthForgotForm } from '../auth/AuthForgotForm';
import { AuthResetForm } from '../auth/AuthResetForm';
import type { AuthScreen } from '../auth/authCopy';

/**
 * Écrans d'authentification (connexion, inscription, mot de passe oublié,
 * nouveau mot de passe) et leurs transitions.
 *
 * Extrait de `OwnerPortal`, où cet arbre de conditions occupait la moitié du
 * composant et empêchait de lire la partie « station ». Les formulaires
 * vivaient déjà dans `components/auth` ; il ne restait ici que la machine à
 * états `signin | signup | forgot | reset` et le choix du titre.
 */
export type { AuthScreen };

const TITLES: Record<AuthScreen, string> = {
  signin: 'Connexion',
  signup: 'Créer un compte',
  forgot: 'Mot de passe oublié',
  reset: 'Nouveau mot de passe',
};

export function AuthGate({
  client,
  screen,
  onScreenChange,
  onMessage,
  onRecoveryLeft,
  banner,
}: {
  client: SupabaseClient;
  screen: AuthScreen;
  onScreenChange: (screen: AuthScreen) => void;
  onMessage: (message: string) => void;
  onRecoveryLeft: () => void;
  banner: React.ReactNode;
}) {
  return (
    <AuthLayout
      title={TITLES[screen]}
      screen={screen}
      scene={screen}
      footer={
        <p className="text-center text-xs leading-relaxed text-gray-500">
          En continuant, vous acceptez que les données de votre station soient hébergées par Supabase. Aucune
          donnée de paiement n’est stockée par l’application.
        </p>
      }
    >
      {banner}
      {screen === 'reset' && (
        <AuthResetForm supabase={client} onLeave={onRecoveryLeft} onMessage={onMessage} />
      )}
      {screen === 'forgot' && (
        <AuthForgotForm supabase={client} onBack={() => onScreenChange('signin')} onMessage={onMessage} />
      )}
      {(screen === 'signin' || screen === 'signup') && (
        <AuthCredentialsForm
          supabase={client}
          mode={screen}
          onModeChange={next => onScreenChange(next)}
          onForgot={() => onScreenChange('forgot')}
          onMessage={onMessage}
        />
      )}
    </AuthLayout>
  );
}
