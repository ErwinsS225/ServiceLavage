import { useState } from 'react';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
  StatusBadge, buttonStyles, formControlStyles, FormField, Modal, Alert, EmptyState
} from './ui/designSystem';
import { Users, UserPlus, Shield, XCircle, RotateCw, Copy } from 'lucide-react';
import { useStationStaff } from '../hooks/useStationStaff';
import {
  STAFF_ROLE_LABELS, STAFF_ROLES, activeMemberCount, canCancelInvitation,
  canRevokeMember, describeMember, invitationState, isValidInvitationEmail, normalizeInvitationEmail,
} from '../lib/staffRules';
import type { StaffRole } from '../lib/stationApi';

/**
 * Module Personnel & rôles — interface seule.
 *
 * Requêtes et mutations : `hooks/useStationStaff`. Règles d'état (invitation
 * expirée, adresse refusée, accès révocable) : `lib/staffRules`. Ce fichier ne
 * garde que les formulaires, les modales et le rendu.
 *
 * Deux limites assumées, écrites à l'écran plutôt que masquées :
 *  - les invitations ne partent par aucun email : la référence est à
 *    transmettre soi-même ;
 *  - l'email saisi ne sert qu'à retrouver le compte au moment de l'acceptation,
 *    il n'est pas vérifié par le serveur à la création.
 *
 * Les trois actions (inviter, annuler, révoquer) sont réservées au propriétaire
 * par les RPC `SECURITY DEFINER` ; `canManageRoles` ne fait qu'aligner
 * l'affichage. RLS reste l'autorité.
 */
export function StationStaff({
  stationId,
  canManageRoles,
  roleFeaturesReady = true,
}: {
  stationId: string;
  canManageRoles: boolean;
  /** `false` tant que `current_station_role` n'a pas répondu. */
  roleFeaturesReady?: boolean;
}) {
  const staff = useStationStaff({ stationId, canManageRoles, enabled: roleFeaturesReady });
  const { members, invitations, loading, error, actionError, message, busy } = staff;

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StaffRole>('laveur');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  /** Référence affichée une seule fois, après création. */
  const [createdReference, setCreatedReference] = useState('');

  const emailValid = isValidInvitationEmail(email);
  const activeMembers = activeMemberCount(members);

  function closeInvite() {
    setInviteOpen(false);
    setEmail('');
    setRole('laveur');
  }

  async function submitInvitation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!emailValid) return;
    try {
      const reference = await staff.invite(email, role);
      closeInvite();
      setCreatedReference(reference);
    } catch {
      // The hook has already surfaced the message in `actionError`.
    }
  }

  async function copyReference(reference: string) {
    try {
      await navigator.clipboard.writeText(reference);
      staff.setMessage('Référence copiée. Transmettez-la au collaborateur concerné.');
    } catch {
      staff.setActionError('Copie impossible : sélectionnez la référence et copiez-la manuellement.');
    }
  }

  return (
    <section className="space-y-6 border-t border-[#232834] pt-6" aria-label="Personnel de la station">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Personnel & Rôles</h2>
          <p className="text-xs text-slate-400 mt-0.5">Permissions appliquées au niveau de la base de données (RLS PostgreSQL)</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={buttonStyles({ variant: 'outline', size: 'sm' })}
            onClick={staff.reload}
            disabled={loading || busy}
          >
            <RotateCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
          {canManageRoles && (
            <button
              type="button"
              className={buttonStyles({ variant: 'primary', size: 'sm' })}
              onClick={() => { setInviteOpen(true); staff.clearMessages(); setCreatedReference(''); }}
              disabled={loading || busy || !roleFeaturesReady}
            >
              <UserPlus className="w-4 h-4 mr-1.5" />
              Inviter un collaborateur
            </button>
          )}
        </div>
      </div>

      {!roleFeaturesReady && (
        <Alert variant="info">
          Votre rôle sur cette station n’est pas encore confirmé par le serveur : la liste reste en lecture seule.
        </Alert>
      )}

      {(error || actionError) && (
        <Alert
          variant="error"
          action={
            <button type="button" className="underline text-xs font-semibold text-rose-300" onClick={() => { staff.clearMessages(); staff.reload(); }}>
              Réessayer
            </button>
          }
        >
          {actionError || error}
        </Alert>
      )}

      {message && <Alert variant="success">{message}</Alert>}

      {/* A reference is shown once and never stored in the clear afterwards:
          it is a bearer credential for joining the station. */}
      {createdReference && (
        <Alert
          variant="warning"
          title="Invitation créée — référence à transmettre"
          action={
            <button type="button" className="underline text-xs font-semibold text-amber-200" onClick={() => void copyReference(createdReference)}>
              <Copy className="inline w-3 h-3 mr-1" />Copier
            </button>
          }
        >
          <p className="text-xs mb-1">Aucun email n’est envoyé automatiquement. Transmettez cette référence au collaborateur invité :</p>
          <code className="block font-mono text-[11px] break-all bg-black/30 rounded px-2 py-1">{createdReference}</code>
        </Alert>
      )}

      {loading ? (
        <div className="p-8 text-center text-sm text-slate-400 rounded-xl bg-[#141720] border border-[#232834]">
          Chargement du personnel…
        </div>
      ) : (
        <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" />
              Membres ({activeMembers} actif{activeMembers > 1 ? 's' : ''} sur {members.length})
            </h3>
            {members.length === 0 ? (
              <EmptyState
                icon={<Users className="w-6 h-6 text-slate-400" />}
                title="Aucun membre"
                description="Invitez un gérant, un caissier ou un laveur pour lui déléguer des fonctions au sein de la station."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Collaborateur</TableHead>
                    <TableHead>Rôle attribué</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead align="right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map(member => (
                    <TableRow key={member.user_id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-xs">
                            <Shield className="w-4 h-4" />
                          </div>
                          <div>
                            {/* The roster exposes a UUID, not an email: showing
                                anything friendlier would mean joining user data
                                this role has no right to read. */}
                            <span className="font-mono text-xs text-white block">{describeMember(member.user_id)}</span>
                            <span className="text-[11px] text-slate-500">
                              Membre depuis le {new Date(member.created_at).toLocaleDateString('fr-FR')}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-xs px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 border border-slate-700">
                          {STAFF_ROLE_LABELS[member.role]}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          status={member.revoked_at ? 'danger' : 'active'}
                          label={member.revoked_at ? 'Accès révoqué' : 'Actif'}
                          size="sm"
                        />
                      </TableCell>
                      <TableCell align="right">
                        {canManageRoles && canRevokeMember(member) && (
                          <button
                            type="button"
                            disabled={busy}
                            className={buttonStyles({ variant: 'danger', size: 'sm' })}
                            onClick={() => setRevokeTarget(member.user_id)}
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" />
                            Révoquer
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {canManageRoles && (
            <div className="space-y-3 pt-4 border-t border-[#232834]">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-sky-400" />
                Invitations émises ({invitations.length})
              </h3>
              {invitations.length === 0 ? (
                <p className="text-xs text-slate-400">Aucune invitation émise pour l’instant.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email destinataire</TableHead>
                      <TableHead>Rôle proposé</TableHead>
                      <TableHead>Référence</TableHead>
                      <TableHead>État</TableHead>
                      <TableHead align="right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.map(invitation => {
                      const state = invitationState(invitation);
                      const badge = {
                        en_attente: { status: 'warning' as const, label: 'En attente' },
                        acceptee: { status: 'success' as const, label: 'Acceptée' },
                        annulee: { status: 'danger' as const, label: 'Annulée' },
                        expiree: { status: 'danger' as const, label: 'Expirée' },
                      }[state];

                      return (
                        <TableRow key={invitation.id}>
                          <TableCell>
                            <span className="font-semibold text-white text-xs">{invitation.email}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-slate-300">{STAFF_ROLE_LABELS[invitation.role]}</span>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-[11px] text-slate-400 bg-slate-900/60 px-2 py-0.5 rounded border border-slate-800">
                              {invitation.id}
                            </span>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={badge.status} label={badge.label} size="sm" />
                          </TableCell>
                          <TableCell align="right">
                            {canCancelInvitation(invitation) && (
                              <button
                                type="button"
                                disabled={busy}
                                className={buttonStyles({ variant: 'outline', size: 'sm' })}
                                onClick={() => void staff.cancel(invitation.id)}
                              >
                                Annuler
                              </button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </div>
      )}

      <Modal
        isOpen={inviteOpen}
        onClose={closeInvite}
        title="Inviter un collaborateur"
        description="Génère une référence d’invitation à transmettre manuellement."
      >
        <form onSubmit={event => void submitInvitation(event)} className="space-y-4">
          <FormField
            label="Adresse email de connexion"
            required
            hint="Doit correspondre au compte que le collaborateur utilisera"
            error={email.length > 0 && !emailValid ? 'Adresse incomplète ou invalide.' : undefined}
          >
            <input
              className={formControlStyles.input}
              type="email"
              autoComplete="email"
              maxLength={254}
              required
              value={email}
              onChange={event => setEmail(event.target.value)}
              onBlur={() => setEmail(normalizeInvitationEmail(email))}
              placeholder="employe@exemple.ci"
              autoFocus
            />
          </FormField>

          <FormField label="Rôle opérationnel" required hint="Détermine les modules et les actions accessibles">
            <select
              className={formControlStyles.select}
              value={role}
              onChange={event => setRole(event.target.value as StaffRole)}
            >
              {STAFF_ROLES.map(value => (
                <option key={value} value={value}>
                  {value === 'gerant' && 'Gérant — opérations, catalogue, clients, inventaire'}
                  {value === 'caissier' && 'Caissier — clients et suivi des prestations'}
                  {value === 'laveur' && 'Laveur — uniquement les prestations qui lui sont affectées'}
                </option>
              ))}
            </select>
          </FormField>

          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-300">
            Aucun email automatique n’est envoyé : la référence générée devra être transmise vous-même au collaborateur.
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#232834]">
            <button type="button" disabled={busy} className={buttonStyles({ variant: 'ghost', size: 'md' })} onClick={closeInvite}>
              Annuler
            </button>
            <button
              type="submit"
              disabled={busy || !emailValid}
              className={buttonStyles({ variant: 'primary', size: 'md' })}
            >
              {busy ? 'Génération…' : 'Générer l’invitation'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Revoking is immediate for the member: confirm it in a dialog. */}
      <Modal
        isOpen={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        title="Révoquer l’accès de ce membre ?"
        description="Le membre perdra immédiatement l’accès aux données de la station. Une nouvelle invitation sera nécessaire."
        size="sm"
        footer={
          <>
            <button type="button" className={buttonStyles({ variant: 'ghost', size: 'sm' })} onClick={() => setRevokeTarget(null)}>Conserver l’accès</button>
            <button
              type="button"
              disabled={busy}
              className={buttonStyles({ variant: 'danger', size: 'sm' })}
              onClick={() => {
                const id = revokeTarget;
                setRevokeTarget(null);
                if (id) void staff.revoke(id);
              }}
            >
              Révoquer l’accès
            </button>
          </>
        }
      >
        <p className="text-xs text-slate-400">Les prestations déjà affectées à ce membre restent dans l’historique.</p>
      </Modal>
    </section>
  );
}
