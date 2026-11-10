import { useEffect, useState } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { isRecoveryLink } from '../lib/supabase';

/**
 * Session Supabase du portail : écoute `onAuthStateChange`, capture le lien de
 * récupération, et expose l'état « chargement ».
 *
 * `isRecoveryLink` est lu une seule fois à l'initialisation, avant que le
 * client Supabase ne consomme le fragment d'URL : garder ce détail dans le
 * composant l'aurait rendu dépendant de l'ordre de montage.
 */
export interface PortalSession {
  session: Session | null;
  loading: boolean;
  error: string;
  /** Le lien de récupération a ouvert cette session : mot de passe à choisir. */
  recovery: boolean;
  leaveRecovery: () => void;
  startRecovery: () => void;
}

export function usePortalSession(client: SupabaseClient | null): PortalSession {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recovery, setRecovery] = useState(isRecoveryLink);

  useEffect(() => {
    if (!client) {
      setLoading(false);
      return;
    }
    let active = true;
    client.auth.getSession()
      .then(({ data, error: sessionError }) => {
        if (!active) return;
        if (sessionError) setError(sessionError.message);
        setSession(data.session);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError('Impossible de vérifier la session en cours.');
        setLoading(false);
      });
    const { data } = client.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      setSession(next);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  return {
    session,
    loading,
    error,
    recovery,
    leaveRecovery: () => { setRecovery(false); setError(''); },
    startRecovery: () => setRecovery(true),
  };
}
