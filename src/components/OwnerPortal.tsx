import { lazy, Suspense, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isRecoveryLink, supabase } from '../lib/supabase';
import {
  MIN_PASSWORD_LENGTH, RECOVERY_SENT_MESSAGE, authRedirectUrl, validateNewPassword,
} from '../lib/passwordRecovery';
import { StationCustomers } from './StationCustomers';
import { StationServices } from './StationServices';
import { StationOrders } from './StationOrders';
import { SubscriptionPlans } from './SubscriptionPlans';

const StationInventory = lazy(() => import('./StationInventory').then(module => ({ default: module.StationInventory })));
const StationStaff = lazy(() => import('./StationStaff').then(module => ({ default: module.StationStaff })));

type Station = { id: string; name: string; owner_id?: string };
type StationRole = 'owner' | 'gerant' | 'caissier' | 'laveur';

export function OwnerPortal() {
  const [session, setSession] = useState<Session | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [forgot, setForgot] = useState(false);
  /** The recovery link opened this tab: the user must choose a new password. */
  const [recovery, setRecovery] = useState(isRecoveryLink);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [stations, setStations] = useState<Station[]>([]);
  const [stationId, setStationId] = useState('');
  const [stationRole, setStationRole] = useState<StationRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const [rolesReady, setRolesReady] = useState(false);
  const [stationReload, setStationReload] = useState(0);
  const [inviteCode, setInviteCode] = useState('');
  const [tab, setTab] = useState<'orders' | 'services' | 'customers' | 'inventory' | 'staff' | 'subscription'>('orders');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setError(error.message);
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      setSession(next);
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session || !supabase) { setStations([]); setStationId(''); setStationRole(null); return; }
    setStations([]);
    setStationId('');
    let active = true;
    const cacheKey = `servicelavage:stations:v2:${session.user.id}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const saved: unknown = JSON.parse(cached);
        if (Array.isArray(saved)) setStations(saved.filter((item): item is Station => !!item && typeof item.id === 'string' && typeof item.name === 'string'));
      } else {
        // Version-one cache was populated only from the owner-only stations RLS.
        const legacy = localStorage.getItem(`servicelavage:stations:v1:${session.user.id}`);
        const saved: unknown = legacy ? JSON.parse(legacy) : null;
        if (Array.isArray(saved)) {
          const migrated = saved.filter((item): item is Station => !!item && typeof item.id === 'string' && typeof item.name === 'string').map(item => ({ ...item, owner_id: session.user.id }));
          setStations(migrated);
          localStorage.setItem(cacheKey, JSON.stringify(migrated));
        }
      }
    } catch { setError('Impossible de lire les stations locales.'); }
    Promise.resolve(supabase.from('stations').select('id,name,owner_id').order('created_at')).then(({ data, error }) => {
      if (!active) return;
      if (error) setError('Stations hors ligne : les données enregistrées sur cet appareil sont utilisées si disponibles.');
      else {
        setStations(data || []);
        try { localStorage.setItem(cacheKey, JSON.stringify(data || [])); } catch { setError('Impossible de sauvegarder les stations pour le mode hors ligne.'); }
      }
    }).catch(() => { if (active) setError('Chargement des stations impossible.'); });
    return () => { active = false; };
  }, [session?.user.id, stationReload]);

  useEffect(() => {
    if (!session || !supabase) { setStationRole(null); setRoleLoading(false); setRolesReady(false); return; }
    if (!stationId) {
      setStationRole(stations.length === 0 ? 'owner' : null);
      setRoleLoading(false);
      setRolesReady(false);
      return;
    }
    setStationRole(null); setRoleLoading(true); setRolesReady(false);
    let active = true;
    const resolveOwnerFallback = async () => {
      try {
        const { data } = await supabase!.from('stations').select('owner_id').eq('id', stationId).maybeSingle();
        if (!active) return;
        setStationRole(data?.owner_id === session.user.id ? 'owner' : null);
      } catch { if (active) setStationRole(null); }
      finally { if (active) { setRolesReady(false); setRoleLoading(false); } }
    };
    if (!online) {
      const cachedStation = stations.find(station => station.id === stationId);
      setStationRole(cachedStation?.owner_id === session.user.id ? 'owner' : null);
      setRolesReady(false);
      setRoleLoading(false);
      return () => { active = false; };
    }
    Promise.resolve(supabase.rpc('current_station_role', { p_station_id: stationId })).then(({ data, error }) => {
      if (!active) return;
      if (error) { void resolveOwnerFallback(); return; }
      setRolesReady(true);
      setStationRole(data === 'owner' || data === 'gerant' || data === 'caissier' || data === 'laveur' ? data : null);
      setRoleLoading(false);
    }).catch(() => { if (active) void resolveOwnerFallback(); });
    return () => { active = false; };
  }, [session?.user.id, stationId, stations, online]);

  async function acceptInvitation(e: React.FormEvent) {
    e.preventDefault();
    const code = inviteCode.trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(code)) {
      setError('Saisissez la référence UUID reçue du propriétaire.'); return;
    }
    setBusy(true); setError(''); setMessage('');
    try {
      const { error } = await supabase!.rpc('accept_station_invitation', { p_invitation_id: code });
      if (error) setError(`Invitation non acceptée : ${error.message}`);
      else { setInviteCode(''); setMessage('Invitation acceptée. Choisissez la station dans la liste.'); setStationReload(value => value + 1); }
    } catch { setError('Impossible de vérifier cette invitation.'); }
    finally { setBusy(false); }
  }

  async function authenticate(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true); setError(''); setMessage('');
    try {
      // An explicit redirectTo keeps the confirmation link on the public origin
      // instead of the project's Site URL, which can drift between environments.
      const result = signup
        ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: authRedirectUrl(window.location.origin) } })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) setError(result.error.message);
      else if (signup && !result.data.session) setMessage('Vérifiez votre e-mail pour confirmer votre compte, puis connectez-vous.');
    } catch { setError('Connexion impossible. Vérifiez votre réseau et réessayez.'); }
    finally { setBusy(false); }
  }

  async function requestRecovery(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: authRedirectUrl(window.location.origin),
      });
      if (error) setError(`Envoi impossible : ${error.message}`);
      else { setForgot(false); setMessage(RECOVERY_SENT_MESSAGE); }
    } catch { setError('Envoi impossible. Vérifiez votre connexion et réessayez.'); }
    finally { setBusy(false); }
  }

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    const check = validateNewPassword(newPassword, confirmPassword);
    if (!check.ok) {
      setError(check.reason === 'too_short'
        ? `Le nouveau mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`
        : check.reason === 'mismatch'
        ? 'Les deux mots de passe ne correspondent pas.'
        : 'Saisissez un nouveau mot de passe.');
      return;
    }
    setBusy(true); setError(''); setMessage('');
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) setError(`Mot de passe non modifié : ${error.message}`);
      else {
        setRecovery(false); setNewPassword(''); setConfirmPassword('');
        setMessage('Mot de passe modifié. Vous pouvez utiliser votre nouveau mot de passe.');
      }
    } catch { setError('Mot de passe non modifié. Vérifiez votre connexion et réessayez.'); }
    finally { setBusy(false); }
  }

  function leaveRecovery() {
    setRecovery(false); setNewPassword(''); setConfirmPassword('');
    setError(''); setMessage('');
  }

  async function createStation(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !session || !name.trim()) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const { data, error } = await supabase.from('stations')
        .insert({ name: name.trim(), owner_id: session.user.id }).select('id,name,owner_id').single();
      if (error) setError(error.message);
      else { setStations(prev => [...prev, data]); setStationId(data.id); setStationRole('owner'); setName(''); setMessage('Station créée.'); }
    } catch { setError('Impossible de créer la station. Vérifiez votre connexion.'); }
    finally { setBusy(false); }
  }

  const input = 'w-full rounded-xl bg-[#20242e] border border-[#343b48] px-4 py-3 text-white';
  const button = 'rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-gray-950 disabled:opacity-50';
  return <main className="min-h-screen bg-[#111317] text-gray-100 flex items-center justify-center p-6">
    <section className="w-full max-w-lg rounded-2xl border border-[#303640] bg-[#16181d] p-8 space-y-5">
      <h1 className="text-2xl font-bold">LavAuto · Espace propriétaire</h1>
      {!online && <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">Connexion indisponible. Les prestations peuvent être mises en attente si les données de la station ont été chargées auparavant ; les autres modules ne fonctionnent pas encore hors ligne.</p>}
      {!supabase ? <p>Configuration Supabase manquante. Renseignez les variables VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY.</p>
        : loading ? <p>Chargement…</p>
        : session ? <>
          <p className="text-sm text-gray-400">Connecté : {session.user.email}</p>
          <h2 className="font-bold">Mes stations</h2>
          {stations.length ? <ul className="space-y-2">{stations.map(s => <li className="rounded-xl bg-[#20242e] p-3" key={s.id}>{s.name}</li>)}</ul> : <p className="text-sm text-gray-400">Aucune station enregistrée.</p>}
          {(stationRole === 'owner' || stations.length === 0) && <form onSubmit={createStation} className="flex gap-2"><input className={input} value={name} onChange={e => setName(e.target.value)} placeholder="Nom de la station" maxLength={120} required /><button className={button} disabled={busy}>Créer</button></form>}
          {stations.length > 0 && <label className="block text-sm">Station active
            <select className={`${input} mt-1`} value={stationId} onChange={e => setStationId(e.target.value)}>
              <option value="">Choisir une station</option>{stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>}
          <form onSubmit={acceptInvitation} className="space-y-2 rounded-xl border border-[#343b48] p-3"><label className="block text-sm">Accepter une invitation d’employé<input className={`${input} mt-1`} value={inviteCode} onChange={event => setInviteCode(event.target.value)} placeholder="Référence communiquée par le propriétaire" /></label><button type="submit" disabled={busy || !online} className="text-sm text-cyan-300 underline disabled:opacity-50">Vérifier et accepter</button><p className="text-xs text-gray-400">L’adresse de connexion doit être confirmée. L’acceptation est validée côté serveur.</p></form>
          {stationId && roleLoading ? <p role="status">Vérification des accès…</p> : stationId && !stationRole ? <p role="alert" className="text-sm text-amber-300">Votre compte n’a pas d’accès actif à cette station. Demandez une invitation au propriétaire.</p> : <>{(() => {
            const tabs = [
              ...(stationRole === 'owner' || stationRole === 'gerant' || stationRole === 'laveur' ? [['orders', 'Prestations'] as const] : []),
              ...(stationRole === 'owner' || stationRole === 'gerant' ? [['services', 'Catalogue'] as const] : []),
              ...(stationRole === 'owner' || stationRole === 'gerant' || stationRole === 'caissier' ? [['customers', 'Clients'] as const] : []),
              ...(stationRole === 'owner' || stationRole === 'gerant' ? [['inventory', 'Inventaire'] as const] : []),
              ...(stationRole === 'owner' || stationRole === 'gerant' ? [['staff', 'Personnel'] as const] : []),
              ...(stationRole === 'owner' ? [['subscription', 'Abonnements'] as const] : []),
            ];
            return <><nav aria-label="Modules autorisés" className="flex flex-wrap gap-2">{tabs.map(([key, label]) => <button key={key} type="button" onClick={() => setTab(key)} aria-current={tab === key ? 'page' : undefined} className={`rounded-xl px-3 py-2 text-sm ${tab === key ? 'bg-cyan-500 text-gray-950' : 'bg-[#20242e] text-gray-300'}`}>{label}</button>)}</nav>
              {tab === 'subscription' && stationRole === 'owner' && <SubscriptionPlans />}
              {stationId && stationRole && <>{tab === 'orders' && <StationOrders key={`orders:${session.user.id}:${stationId}`} stationId={stationId} userId={session.user.id} role={stationRole} roleFeaturesReady={rolesReady} />}
                {tab === 'services' && (stationRole === 'owner' || stationRole === 'gerant') && <StationServices key={`services:${session.user.id}:${stationId}`} stationId={stationId} />}
                {tab === 'customers' && (stationRole === 'owner' || stationRole === 'gerant' || stationRole === 'caissier') && <StationCustomers key={`customers:${session.user.id}:${stationId}`} stationId={stationId} />}
                {tab === 'inventory' && (stationRole === 'owner' || stationRole === 'gerant') && <Suspense fallback={<p>Chargement de l’inventaire…</p>}><StationInventory key={`inventory:${session.user.id}:${stationId}`} stationId={stationId} userId={session.user.id} /></Suspense>}
                {tab === 'staff' && (stationRole === 'owner' || stationRole === 'gerant') && (rolesReady ? <Suspense fallback={<p>Chargement du personnel…</p>}><StationStaff key={`staff:${session.user.id}:${stationId}`} stationId={stationId} canManageRoles={stationRole === 'owner'} /></Suspense> : <p role="status" className="text-sm text-amber-300">Le module Personnel nécessite le déploiement préalable des migrations de rôles.</p>)}
              </>}</>;
          })()}</>}
          <button className="text-cyan-400 underline" onClick={async () => { const { error } = await supabase!.auth.signOut(); if (error) setError(error.message); }}>Se déconnecter</button>
        </> : recovery ? <form onSubmit={updatePassword} className="space-y-4">
          <p className="text-sm text-gray-400">Choisissez un nouveau mot de passe pour votre compte.</p>
          <label className="block text-sm">Nouveau mot de passe<input className={`${input} mt-1`} type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required value={newPassword} onChange={e => setNewPassword(e.target.value)} /></label>
          <label className="block text-sm">Confirmation<input className={`${input} mt-1`} type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /></label>
          <button className={`${button} w-full`} disabled={busy}>Enregistrer le mot de passe</button>
          <button type="button" className="text-sm text-cyan-400 underline" disabled={busy} onClick={leaveRecovery}>Revenir à la connexion</button>
        </form> : forgot ? <form onSubmit={requestRecovery} className="space-y-4">
          <p className="text-sm text-gray-400">Saisissez l’adresse de votre compte : un lien de réinitialisation vous sera envoyé.</p>
          <label className="block text-sm">E-mail<input className={`${input} mt-1`} type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
          <button className={`${button} w-full`} disabled={busy}>Envoyer le lien de réinitialisation</button>
          <button type="button" className="text-sm text-cyan-400 underline" disabled={busy} onClick={() => { setForgot(false); setError(''); setMessage(''); }}>Revenir à la connexion</button>
        </form> : <form onSubmit={authenticate} className="space-y-4">
          <p className="text-sm text-gray-400">{signup ? 'Créez votre compte propriétaire.' : 'Connectez-vous à votre compte propriétaire.'}</p>
          <label className="block text-sm">E-mail<input className={`${input} mt-1`} type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
          <label className="block text-sm">Mot de passe<input className={`${input} mt-1`} type="password" autoComplete={signup ? 'new-password' : 'current-password'} minLength={signup ? MIN_PASSWORD_LENGTH : 6} required value={password} onChange={e => setPassword(e.target.value)} /></label>
          <button className={`${button} w-full`} disabled={busy}>{signup ? 'Créer mon compte' : 'Se connecter'}</button>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <button type="button" className="text-sm text-cyan-400 underline" onClick={() => { setSignup(!signup); setError(''); setMessage(''); }}>{signup ? 'Déjà inscrit ? Se connecter' : 'Créer un compte propriétaire'}</button>
            {!signup && <button type="button" className="text-sm text-cyan-400 underline" onClick={() => { setForgot(true); setError(''); setMessage(''); }}>Mot de passe oublié ?</button>}
          </div>
        </form>}
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      {message && <p role="status" className="text-sm text-emerald-400">{message}</p>}
    </section>
  </main>;
}
