import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell, 
  StatusBadge, buttonStyles, formControlStyles, FormField, Modal, Alert, EmptyState 
} from './ui/designSystem';
import { Users, UserPlus, Shield, XCircle, RotateCw } from 'lucide-react';

type Role = 'gerant' | 'caissier' | 'laveur';
type Member = { user_id: string; role: Role; created_at: string; revoked_at: string | null };
type Invitation = { id: string; email: string; role: Role; created_at: string; expires_at: string; accepted_at: string | null; cancelled_at: string | null };
const roleNames: Record<Role, string> = { gerant: 'Gérant', caissier: 'Caissier', laveur: 'Laveur' };

export function StationStaff({ stationId, canManageRoles }: { stationId: string; canManageRoles: boolean }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('laveur');
  /** Member awaiting revocation confirmation (replaces window.confirm). */
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    const roster = supabase!.from('station_memberships').select('user_id,role,created_at,revoked_at').eq('station_id', stationId).order('created_at');
    const invites = canManageRoles
      ? supabase!.from('station_invitations').select('id,email,role,created_at,expires_at,accepted_at,cancelled_at').eq('station_id', stationId).order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null });
    Promise.all([roster, invites]).then(([rosterResult, invitationResult]) => {
      if (!active) return;
      const firstError = rosterResult.error || invitationResult.error;
      if (firstError) setError(`Chargement du personnel impossible : ${firstError.message}`);
      else { setMembers(rosterResult.data ?? []); setInvitations(invitationResult.data ?? []); }
      setLoading(false);
    });
    return () => { active = false; };
  }, [stationId, canManageRoles, reload]);

  async function createInvitation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const { data, error } = await supabase!.rpc('create_station_invitation', { p_station_id: stationId, p_email: cleanEmail, p_role: role });
      if (error) { setError(`Création de l’invitation impossible : ${error.message}`); return; }
      setEmail(''); 
      setModalOpen(false);
      setMessage(`Invitation créée pour ${cleanEmail}. Référence à transmettre manuellement : ${data}`); 
      setReload(value => value + 1);
    } catch { setError('Création de l’invitation impossible. Vérifiez votre connexion.'); }
    finally { setBusy(false); }
  }

  async function cancelInvitation(id: string) {
    setBusy(true); setError(''); setMessage('');
    try {
      const { error } = await supabase!.rpc('cancel_station_invitation', { p_invitation_id: id });
      if (error) setError(`Annulation impossible : ${error.message}`);
      else { setMessage('Invitation annulée.'); setReload(value => value + 1); }
    } catch { setError('Annulation impossible.'); }
    finally { setBusy(false); }
  }

  async function revokeMember(userId: string) {
    setBusy(true); setError(''); setMessage('');
    try {
      const { error } = await supabase!.rpc('revoke_station_membership', { p_station_id: stationId, p_user_id: userId });
      if (error) setError(`Révocation impossible : ${error.message}`);
      else { setMessage('Accès révoqué.'); setReload(value => value + 1); }
    } catch { setError('Révocation impossible.'); }
    finally { setBusy(false); }
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
            onClick={() => setReload(v => v + 1)}
            disabled={loading || busy}
          >
            <RotateCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
          {canManageRoles && (
            <button
              type="button"
              className={buttonStyles({ variant: 'primary', size: 'sm' })}
              onClick={() => { setModalOpen(true); setError(''); setMessage(''); }}
              disabled={loading || busy}
            >
              <UserPlus className="w-4 h-4 mr-1.5" />
              Inviter un employé
            </button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="error" action={
          <button type="button" className="underline text-xs font-semibold text-rose-300" onClick={() => setReload(value => value + 1)}>
            Réessayer
          </button>
        }>
          {error}
        </Alert>
      )}

      {message && (
        <Alert variant="success">
          {message}
        </Alert>
      )}

      {loading ? (
        <div className="p-8 text-center text-sm text-slate-400 rounded-xl bg-[#141720] border border-[#232834]">
          Chargement du personnel…
        </div>
      ) : (
        <div className="space-y-6">
          {/* Members section */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" />
              Membres actifs ({members.filter(m => !m.revoked_at).length})
            </h3>
            {members.length === 0 ? (
              <EmptyState
                icon={<Users className="w-6 h-6 text-slate-400" />}
                title="Aucun membre actif"
                description="Invitez des gérants, caissiers ou laveurs pour leur déléguer des fonctions au sein de la station."
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
                            <span className="font-mono text-xs text-white block">
                              UUID: {member.user_id.slice(0, 8)}...{member.user_id.slice(-4)}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              Rejoint le {new Date(member.created_at).toLocaleDateString('fr-FR')}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-xs px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 border border-slate-700">
                          {roleNames[member.role]}
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
                        {canManageRoles && !member.revoked_at && (
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

          {/* Invitations section */}
          {canManageRoles && (
            <div className="space-y-3 pt-4 border-t border-[#232834]">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-sky-400" />
                Invitations émises ({invitations.length})
              </h3>
              {invitations.length === 0 ? (
                <p className="text-xs text-slate-400">Aucune invitation en attente.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email de connexion</TableHead>
                      <TableHead>Rôle proposé</TableHead>
                      <TableHead>Référence d'invitation</TableHead>
                      <TableHead>État</TableHead>
                      <TableHead align="right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.map(invitation => {
                      const isExpired = new Date(invitation.expires_at) <= new Date();
                      const status = invitation.accepted_at 
                        ? 'Acceptée' 
                        : invitation.cancelled_at 
                        ? 'Annulée' 
                        : isExpired 
                        ? 'Expirée' 
                        : 'En attente';
                      const badgeStatus = invitation.accepted_at 
                        ? 'success' 
                        : invitation.cancelled_at || isExpired 
                        ? 'danger' 
                        : 'warning';

                      return (
                        <TableRow key={invitation.id}>
                          <TableCell>
                            <span className="font-semibold text-white text-xs">{invitation.email}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-slate-300">{roleNames[invitation.role]}</span>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-[11px] text-slate-400 bg-slate-900/60 px-2 py-0.5 rounded border border-slate-800">
                              {invitation.id}
                            </span>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={badgeStatus} label={status} size="sm" />
                          </TableCell>
                          <TableCell align="right">
                            {!invitation.accepted_at && !invitation.cancelled_at && !isExpired && (
                              <button
                                type="button"
                                disabled={busy}
                                className={buttonStyles({ variant: 'outline', size: 'sm' })}
                                onClick={() => void cancelInvitation(invitation.id)}
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

      {/* Invite Modal Dialog */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Inviter un collaborateur"
        description="Générez un code d'invitation sécurisé avec attribution de rôle."
      >
        <form onSubmit={event => void createInvitation(event)} className="space-y-4">
          <FormField label="Adresse email de connexion" required hint="L'employé utilisera cet email pour se connecter">
            <input
              className={formControlStyles.input}
              type="email"
              autoComplete="email"
              maxLength={254}
              required
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="employe@exemple.ci"
              autoFocus
            />
          </FormField>

          <FormField label="Rôle opérationnel" required hint="Définit les modules et actions accessibles">
            <select
              className={formControlStyles.select}
              value={role}
              onChange={event => setRole(event.target.value as Role)}
            >
              <option value="gerant">Gérant — gestion totale des opérations, catalogue, clients et affectations</option>
              <option value="caissier">Caissier — gestion des clients et suivi de caisse</option>
              <option value="laveur">Laveur — visualisation et réalisation des prestations affectées uniquement</option>
            </select>
          </FormField>

          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-300">
            Les invitations ne sont pas transmises par courrier automatique : communiquez la référence d'invitation générée à la personne concernée.
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#232834]">
            <button
              type="button"
              disabled={busy}
              className={buttonStyles({ variant: 'ghost', size: 'md' })}
              onClick={() => setModalOpen(false)}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={busy || loading}
              className={buttonStyles({ variant: 'primary', size: 'md' })}
            >
              {busy ? 'Génération…' : 'Générer l’invitation'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Revoking access is immediate for the member: confirm it in a dialog. */}
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
              onClick={() => { const id = revokeTarget; setRevokeTarget(null); if (id) void revokeMember(id); }}
            >
              Révoquer l’accès
            </button>
          </>
        }
      >
        <p className="text-xs text-slate-400">Les prestations déjà affectées à ce membre resteront dans l’historique.</p>
      </Modal>
    </section>
  );
}
