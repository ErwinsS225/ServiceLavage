import { useCallback, useState } from 'react';
import { type StaffRole, type StationClient } from '../lib/stationApi';
import { isValidInvitationEmail, normalizeInvitationEmail } from '../lib/staffRules';
import { describeError } from '../lib/queryResult';
import { useInvitationMutations, useStaff } from './useStationQueries';

/**
 * Données et mutations du module Personnel.
 *
 * Les trois RPC (`create_station_invitation`, `cancel_station_invitation`,
 * `revoke_station_membership`) sont `SECURITY DEFINER` et **propriétaire
 * uniquement** : elles rejettent un gérant. L'interface suit donc la même
 * règle (`canManageRoles`), sans la remplacer — un appel direct resterait
 * refusé par le serveur.
 *
 * `enabled` laisse l'appelant suspendre le chargement tant que le rôle n'est
 * pas confirmé par `current_station_role` : les invitations ne sont lisibles
 * que par le propriétaire, les demander sans droit produirait une erreur
 * trompeuse.
 */
export function useStationStaff({
  stationId,
  canManageRoles,
  enabled = true,
  client,
}: {
  stationId: string;
  canManageRoles: boolean;
  enabled?: boolean;
  client?: StationClient | null;
}) {
  const rosterQuery = useStaff(stationId, canManageRoles, enabled, client);
  const {
    invite: inviteMutation,
    cancel: cancelMutation,
    revoke: revokeMutation,
  } = useInvitationMutations(stationId, client);

  const members = rosterQuery.data?.members ?? [];
  const invitations = rosterQuery.data?.invitations ?? [];
  const loading = rosterQuery.isPending;
  const error = rosterQuery.error
    ? describeError(rosterQuery.error, 'Chargement du personnel impossible.')
    : '';
  const reload = () => {
    void rosterQuery.refetch();
  };

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [message, setMessage] = useState('');

  const clearMessages = useCallback(() => {
    setActionError('');
    setMessage('');
  }, []);

  /** Crée l'invitation et renvoie sa référence, à transmettre manuellement. */
  const invite = useCallback(
    async (rawEmail: string, role: StaffRole): Promise<string> => {
      const email = normalizeInvitationEmail(rawEmail);
      if (!isValidInvitationEmail(email)) throw new Error('Adresse email invalide.');
      setBusy(true);
      setActionError('');
      setMessage('');
      try {
        const reference = await inviteMutation.mutateAsync({ email, role });
        return reference;
      } catch (cause) {
        // `cause` conserve l'erreur d'origine : sans elle, un rapport de bug ne
        // contient plus que la phrase traduite, et le code serveur est perdu.
        throw new Error(describeError(cause, 'Création de l’invitation impossible.'), { cause });
      } finally {
        setBusy(false);
      }
    },
    [inviteMutation],
  );

  const cancel = useCallback(
    async (invitationId: string): Promise<void> => {
      setBusy(true);
      setActionError('');
      setMessage('');
      try {
        await cancelMutation.mutateAsync(invitationId);
        setMessage('Invitation annulée.');
      } catch (cause) {
        setActionError(describeError(cause, 'Annulation impossible.'));
      } finally {
        setBusy(false);
      }
    },
    [cancelMutation],
  );

  const revoke = useCallback(
    async (userId: string): Promise<void> => {
      setBusy(true);
      setActionError('');
      setMessage('');
      try {
        await revokeMutation.mutateAsync(userId);
        setMessage('Accès révoqué.');
      } catch (cause) {
        setActionError(describeError(cause, 'Révocation impossible.'));
      } finally {
        setBusy(false);
      }
    },
    [revokeMutation],
  );

  return {
    members,
    invitations,
    loading,
    error,
    actionError,
    message,
    busy,
    reload,
    setActionError,
    setMessage,
    clearMessages,
    invite,
    cancel,
    revoke,
  };
}
