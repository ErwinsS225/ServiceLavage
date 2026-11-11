import type { InvitationRow, MemberRow, StaffRole } from './stationApi';

/**
 * Règles du module Personnel, hors JSX.
 *
 * L'état d'une invitation et la validité d'une adresse étaient calculés dans le
 * rendu, en cascade de ternaires : impossible de vérifier qu'une invitation
 * expirée n'est pas proposée à l'annulation, ou qu'une adresse refusée par le
 * serveur est refusée avant l'appel. Le serveur reste l'arbitre
 * (`create_station_invitation` valide l'adresse et le rôle) ; ce module évite
 * simplement un aller-retour inutile et affiche le même verdict.
 */

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  gerant: 'Gérant',
  caissier: 'Caissier',
  laveur: 'Laveur',
};

export const STAFF_ROLES: readonly StaffRole[] = ['gerant', 'caissier', 'laveur'];

export type InvitationState = 'en_attente' | 'acceptee' | 'annulee' | 'expiree';

/**
 * État d'une invitation. Ordre volontaire : une invitation acceptée le reste
 * même après expiration, une invitation annulée n'est jamais « expirée ».
 */
export function invitationState(invitation: InvitationRow, now: Date = new Date()): InvitationState {
  if (invitation.accepted_at) return 'acceptee';
  if (invitation.cancelled_at) return 'annulee';
  if (new Date(invitation.expires_at).getTime() <= now.getTime()) return 'expiree';
  return 'en_attente';
}

/** Seule une invitation encore en attente peut être annulée. */
export function canCancelInvitation(invitation: InvitationRow, now: Date = new Date()): boolean {
  return invitationState(invitation, now) === 'en_attente';
}

/** Seul un accès non révoqué peut être retiré. */
export function canRevokeMember(member: MemberRow): boolean {
  return member.revoked_at === null;
}

export function activeMemberCount(members: readonly MemberRow[]): number {
  return members.filter(member => member.revoked_at === null).length;
}

/** Les invitations encore utilisables, les plus récentes d'abord. */
export function pendingInvitations(
  invitations: readonly InvitationRow[],
  now: Date = new Date(),
): InvitationRow[] {
  return invitations
    .filter(invitation => invitationState(invitation, now) === 'en_attente')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

/**
 * Même règle d'adresse que `create_station_invitation` : 3 à 254 caractères,
 * pas d'espace ni de second arobase. Volontairement permissive — elle ne
 * prétend pas vérifier que la boîte existe, seulement écarter une saisie qui
 * serait rejetée par le serveur.
 */
import { invitationSchema } from './schemas';

export function normalizeInvitationEmail(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Délègue au schéma partagé plutôt que de réécrire la règle : deux expressions
 * de la même contrainte finissent par diverger, et c'est alors l'une des deux
 * qui refuse à tort une adresse acceptée par le serveur.
 */
export function isValidInvitationEmail(value: string): boolean {
  return invitationSchema.shape.email.safeParse(value).success;
}

/** Seules les adresses qui ont réellement accepté apparaissent comme membres. */
export function describeMember(userId: string): string {
  return `Membre ${userId.slice(0, 8)}…${userId.slice(-4)}`;
}
