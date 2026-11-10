import { useCallback, useState } from 'react';
import {
  cancelInvitation as cancelInvitationRequest,
  createInvitation as createInvitationRequest,
  fetchStaff,
  resolveClient,
  revokeMembership,
  type InvitationRow,
  type MemberRow,
  type StaffRole,
  type StationClient,
} from '../lib/stationApi';
import {
  isValidInvitationEmail,
  normalizeInvitationEmail,
} from '../lib/staffRules';
import { describeError } from '../lib/queryResult';
import { useResource } from './useResource';

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
  const api = useCallback(() => resolveClient(client), [client]);

  const roster = useResource(
    async () => {
      const { members, invitations } = await fetchStaff(api(), stationId, canManageRoles);
      return { members, invitations };
    },
    [stationId, canManageRoles],
    {
      fallback: 'Chargement du personnel impossible.',
      initial: { members: [] as MemberRow[], invitations: [] as InvitationRow[] },
      enabled,
    },
  );

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [message, setMessage] = useState('');

  const clearMessages = useCallback(() => { setActionError(''); setMessage(''); }, []);

  /** Crée l'invitation et renvoie sa référence, à transmettre manuellement. */
  const invite = useCallback(async (rawEmail: string, role: StaffRole): Promise<string> => {
    const email = normalizeInvitationEmail(rawEmail);
    if (!isValidInvitationEmail(email)) throw new Error('Adresse email invalide.');
    setBusy(true);
    setActionError('');
    setMessage('');
    try {
      const reference = await createInvitationRequest(api(), stationId, email, role);
      roster.reload();
      return reference;
    } catch (cause) {
      throw new Error(describeError(cause, 'Création de l’invitation impossible.'));
    } finally {
      setBusy(false);
    }
  }, [api, stationId, roster]);

  const cancel = useCallback(async (invitationId: string): Promise<void> => {
    setBusy(true);
    setActionError('');
    setMessage('');
    try {
      await cancelInvitationRequest(api(), invitationId);
      setMessage('Invitation annulée.');
      roster.reload();
    } catch (cause) {
      setActionError(describeError(cause, 'Annulation impossible.'));
    } finally {
      setBusy(false);
    }
  }, [api, roster]);

  const revoke = useCallback(async (userId: string): Promise<void> => {
    setBusy(true);
    setActionError('');
    setMessage('');
    try {
      await revokeMembership(api(), stationId, userId);
      setMessage('Accès révoqué.');
      roster.reload();
    } catch (cause) {
      setActionError(describeError(cause, 'Révocation impossible.'));
    } finally {
      setBusy(false);
    }
  }, [api, stationId, roster]);

  return {
    members: roster.data.members,
    invitations: roster.data.invitations,
    loading: roster.loading,
    error: roster.error,
    actionError,
    message,
    busy,
    reload: roster.reload,
    setActionError,
    setMessage,
    clearMessages,
    invite,
    cancel,
    revoke,
  };
}
