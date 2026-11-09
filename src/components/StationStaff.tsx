import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type Role = 'gerant' | 'caissier' | 'laveur';
type Member = { user_id: string; role: Role; created_at: string; revoked_at: string | null };
type Invitation = { id: string; email: string; role: Role; created_at: string; expires_at: string; accepted_at: string | null; cancelled_at: string | null };
const roleNames: Record<Role, string> = { gerant: 'Gérant', caissier: 'Caissier', laveur: 'Laveur' };
const fieldClass = 'w-full rounded-xl border border-[#343b48] bg-[#20242e] px-4 py-3 text-white';

export function StationStaff({ stationId, canManageRoles }: { stationId: string; canManageRoles: boolean }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('laveur');
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
      setEmail(''); setMessage(`Invitation créée pour ${cleanEmail}. Référence à transmettre manuellement : ${data}`); setReload(value => value + 1);
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
    if (!window.confirm('Révoquer immédiatement l’accès de ce membre à la station ?')) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const { error } = await supabase!.rpc('revoke_station_membership', { p_station_id: stationId, p_user_id: userId });
      if (error) setError(`Révocation impossible : ${error.message}`);
      else { setMessage('Accès révoqué.'); setReload(value => value + 1); }
    } catch { setError('Révocation impossible.'); }
    finally { setBusy(false); }
  }

  return <section className="space-y-4 border-t border-[#303640] pt-5" aria-label="Personnel de la station">
    <h2 className="font-bold">Personnel et accès</h2>
    <p className="text-sm text-gray-400">Les contrôles de rôle sont appliqués par PostgreSQL. Les invitations ne sont pas envoyées par e-mail : transmettez la référence à la personne concernée.</p>
    {error && <p role="alert" className="text-sm text-red-400">{error} <button type="button" className="underline" onClick={() => setReload(value => value + 1)}>Réessayer</button></p>}
    {message && <p role="status" className="break-words text-sm text-emerald-300">{message}</p>}
    {loading ? <p>Chargement du personnel…</p> : <>
      <h3 className="font-semibold">Membres</h3>
      {members.length === 0 ? <p className="text-sm text-gray-400">Aucun employé n’a accepté d’invitation.</p> : <ul className="space-y-2">{members.map(member => <li key={member.user_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#20242e] p-3 text-sm">
        <span><strong>{roleNames[member.role]}</strong><br /><span className="break-all text-xs text-gray-400">Compte : {member.user_id}</span>{member.revoked_at && <span className="block text-amber-300">Accès révoqué</span>}</span>
        {canManageRoles && !member.revoked_at && <button type="button" disabled={busy} className="text-red-300 underline disabled:opacity-50" onClick={() => void revokeMember(member.user_id)}>Révoquer</button>}
      </li>)}</ul>}
      {canManageRoles && <>
        <form onSubmit={event => void createInvitation(event)} className="space-y-3 rounded-xl border border-[#343b48] p-4">
          <h3 className="font-semibold">Inviter un employé</h3>
          <label className="block text-sm">Adresse e-mail de connexion<input className={`${fieldClass} mt-1`} type="email" autoComplete="email" maxLength={254} required value={email} onChange={event => setEmail(event.target.value)} /></label>
          <label className="block text-sm">Rôle<select className={`${fieldClass} mt-1`} value={role} onChange={event => setRole(event.target.value as Role)}><option value="gerant">Gérant — opérations et affectations</option><option value="caissier">Caissier — clients (encaissements à venir)</option><option value="laveur">Laveur — prestations affectées uniquement</option></select></label>
          <button disabled={busy || loading} className="rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-gray-950 disabled:opacity-50">Créer l’invitation</button>
        </form>
        <h3 className="font-semibold">Invitations</h3>
        {invitations.length === 0 ? <p className="text-sm text-gray-400">Aucune invitation enregistrée.</p> : <ul className="space-y-2">{invitations.map(invitation => {
          const status = invitation.accepted_at ? 'Acceptée' : invitation.cancelled_at ? 'Annulée' : new Date(invitation.expires_at) <= new Date() ? 'Expirée' : 'En attente';
          return <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#20242e] p-3 text-sm">
            <span><strong>{invitation.email}</strong><br /><span className="text-gray-400">{roleNames[invitation.role]} · {status}</span><br /><span className="break-all text-xs text-gray-500">Référence : {invitation.id}</span></span>
            {!invitation.accepted_at && !invitation.cancelled_at && status === 'En attente' && <button type="button" disabled={busy} className="text-red-300 underline disabled:opacity-50" onClick={() => void cancelInvitation(invitation.id)}>Annuler</button>}
          </li>;
        })}</ul>}
      </>}
    </>}
  </section>;
}
