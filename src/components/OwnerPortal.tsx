import { lazy, Suspense, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isRecoveryLink, supabase } from '../lib/supabase';
import { AuthLayout } from './auth/AuthLayout';
import { AuthCredentialsForm } from './auth/AuthCredentialsForm';
import { AuthForgotForm } from './auth/AuthForgotForm';
import { AuthResetForm } from './auth/AuthResetForm';
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
  const [forgot, setForgot] = useState(false);
  /** The recovery link opened this tab: the user must choose a new password. */
  const [recovery, setRecovery] = useState(isRecoveryLink);
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

  /** Leaving the recovery screen returns to a clean sign-in form. */
  function leaveRecovery() {
    setRecovery(false);
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
  const banner = <>
    {!online && <p role="status" className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">Connexion indisponible. Les prestations peuvent être mises en attente si les données de la station ont été chargées auparavant ; les autres modules ne fonctionnent pas encore hors ligne.</p>}
    {error && <p role="alert" className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">{error}</p>}
    {message && <p role="status" className="mb-5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-300">{message}</p>}
  </>;

  if (!supabase) return <AuthLayout title="Configuration requise" subtitle="Renseignez l’URL et la clé publiques Supabase pour activer l’espace propriétaire.">
    <p className="text-sm leading-relaxed text-gray-400">
      Les variables <code className="rounded bg-[#20242e] px-1.5 py-0.5 text-gray-200">VITE_SUPABASE_URL</code> et{' '}
      <code className="rounded bg-[#20242e] px-1.5 py-0.5 text-gray-200">VITE_SUPABASE_PUBLISHABLE_KEY</code>{' '}
      sont absentes de la configuration de build.
    </p>
  </AuthLayout>;

  if (loading) return <AuthLayout title="Connexion" subtitle="Vérification de votre session en cours.">
    <p role="status" className="text-sm text-gray-400">Chargement…</p>
  </AuthLayout>;

  if (!session || recovery) {
    const reset = recovery;
    const title = reset ? 'Nouveau mot de passe' : forgot ? 'Mot de passe oublié' : signup ? 'Créer un compte' : 'Connexion';
    const subtitle = reset
      ? 'Choisissez un mot de passe que vous n’utilisez nulle part ailleurs.'
      : forgot ? 'Nous vous enverrons un lien pour repartir du bon pied.'
      : signup ? 'Rejoignez la plateforme et pilotez votre station.' : 'Accédez à votre espace propriétaire.';
    return <AuthLayout
      title={title}
      subtitle={subtitle}
      footer={<p className="text-center text-xs leading-relaxed text-gray-500">En continuant, vous acceptez que vos données de station soient hébergées par Supabase. Aucune donnée de paiement n’est stockée par l’application.</p>}
    >
      {banner}
      {reset
        ? <AuthResetForm supabase={supabase} onLeave={leaveRecovery} onMessage={setMessage} />
        : forgot
          ? <AuthForgotForm supabase={supabase} onBack={() => { setForgot(false); setError(''); setMessage(''); }} onMessage={setMessage} />
          : <AuthCredentialsForm
              supabase={supabase}
              mode={signup ? 'signup' : 'signin'}
              onModeChange={next => { setSignup(next === 'signup'); setError(''); setMessage(''); }}
              onForgot={() => { setForgot(true); setError(''); setMessage(''); }}
              onMessage={setMessage}
            />}
    </AuthLayout>;
  }

  return <main className="min-h-screen bg-[#111317] text-gray-100 flex items-start justify-center p-6">
    <section className="w-full max-w-3xl space-y-5 py-6">
      {banner}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gray-500">Clean It CI</p>
          <h1 className="mt-1 text-2xl font-bold">Espace propriétaire</h1>
        </div>
        <button type="button" className="rounded-lg border border-[#343b48] px-4 py-2 text-sm font-semibold text-gray-300 hover:border-violet-500/50 hover:text-white" onClick={async () => { const { error } = await supabase!.auth.signOut(); if (error) setError(error.message); }}>Se déconnecter</button>
      </header>
      <p className="text-sm text-gray-400">Connecté : {session.user.email}</p>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="rounded-2xl border border-[#303640] bg-[#16181d] p-5">
          <h2 className="font-bold">Mes stations</h2>
          {stations.length
            ? <ul className="mt-3 space-y-2">{stations.map(s => <li className={stationId === s.id ? 'rounded-xl border border-violet-500/40 bg-violet-500/10 p-3 text-sm text-white' : 'rounded-xl bg-[#20242e] p-3 text-sm'} key={s.id}>{s.name}</li>)}</ul>
            : <p className="mt-2 text-sm text-gray-400">Aucune station enregistrée pour ce compte.</p>}
          {stations.length > 0 && <label className="mt-4 block text-sm">Station active
            <select className={`${input} mt-1`} value={stationId} onChange={e => setStationId(e.target.value)}>
              <option value="">Choisir une station</option>{stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>}
        </section>

        <div className="space-y-5">
          {(stationRole === 'owner' || stations.length === 0) && <section className="rounded-2xl border border-[#303640] bg-[#16181d] p-5">
            <h2 className="font-bold">Créer une station</h2>
            <p className="mt-1 text-sm text-gray-400">Elle sera rattachée à votre compte propriétaire.</p>
            <form onSubmit={createStation} className="mt-3 space-y-2">
              <input className={input} value={name} onChange={e => setName(e.target.value)} placeholder="Nom de la station" maxLength={120} required />
              <button type="submit" className={`${button} w-full`} disabled={busy}>Créer la station</button>
            </form>
          </section>}

          <section className="rounded-2xl border border-[#303640] bg-[#16181d] p-5">
            <h2 className="font-bold">Rejoindre une équipe</h2>
            <form onSubmit={acceptInvitation} className="mt-3 space-y-2">
              <label className="block text-sm">Référence d’invitation
                <input className={`${input} mt-1`} value={inviteCode} onChange={event => setInviteCode(event.target.value)} placeholder="Référence communiquée par le propriétaire" />
              </label>
              <button type="submit" className={`${button} w-full`} disabled={busy || !online}>Vérifier et accepter</button>
              <p className="text-xs text-gray-500">L’adresse de connexion doit être confirmée. L’acceptation est validée côté serveur.</p>
            </form>
          </section>
        </div>
      </div>

      {stationId && roleLoading ? <p role="status" className="text-sm text-gray-400">Vérification des accès…</p> : stationId && !stationRole ? <p role="alert" className="text-sm text-amber-300">Votre compte n’a pas d’accès actif à cette station. Demandez une invitation au propriétaire.</p> : <>{(() => {
        const tabs = [
          ...(stationRole === 'owner' || stationRole === 'gerant' || stationRole === 'laveur' ? [['orders', 'Prestations'] as const] : []),
          ...(stationRole === 'owner' || stationRole === 'gerant' ? [['services', 'Catalogue'] as const] : []),
          ...(stationRole === 'owner' || stationRole === 'gerant' || stationRole === 'caissier' ? [['customers', 'Clients'] as const] : []),
          ...(stationRole === 'owner' || stationRole === 'gerant' ? [['inventory', 'Inventaire'] as const] : []),
          ...(stationRole === 'owner' || stationRole === 'gerant' ? [['staff', 'Personnel'] as const] : []),
          ...(stationRole === 'owner' ? [['subscription', 'Abonnements'] as const] : []),
        ];
        return <><nav aria-label="Modules autorisés" className="flex flex-wrap gap-2">{tabs.map(([key, label]) => <button key={key} type="button" onClick={() => setTab(key)} aria-current={tab === key ? 'page' : undefined} className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${tab === key ? 'bg-violet-600 text-white' : 'bg-[#20242e] text-gray-300 hover:bg-[#262b35]'}`}>{label}</button>)}</nav>
          <div className="rounded-2xl border border-[#303640] bg-[#16181d] p-5">
          {tab === 'subscription' && stationRole === 'owner' && <SubscriptionPlans />}
          {stationId && stationRole && <>{tab === 'orders' && <StationOrders key={`orders:${session.user.id}:${stationId}`} stationId={stationId} userId={session.user.id} role={stationRole} roleFeaturesReady={rolesReady} />}
            {tab === 'services' && (stationRole === 'owner' || stationRole === 'gerant') && <StationServices key={`services:${session.user.id}:${stationId}`} stationId={stationId} />}
            {tab === 'customers' && (stationRole === 'owner' || stationRole === 'gerant' || stationRole === 'caissier') && <StationCustomers key={`customers:${session.user.id}:${stationId}`} stationId={stationId} />}
            {tab === 'inventory' && (stationRole === 'owner' || stationRole === 'gerant') && <Suspense fallback={<p className="text-sm text-gray-400">Chargement de l’inventaire…</p>}><StationInventory key={`inventory:${session.user.id}:${stationId}`} stationId={stationId} userId={session.user.id} /></Suspense>}
            {tab === 'staff' && (stationRole === 'owner' || stationRole === 'gerant') && (rolesReady ? <Suspense fallback={<p className="text-sm text-gray-400">Chargement du personnel…</p>}><StationStaff key={`staff:${session.user.id}:${stationId}`} stationId={stationId} canManageRoles={stationRole === 'owner'} /></Suspense> : <p role="status" className="text-sm text-amber-300">Le module Personnel nécessite le déploiement préalable des migrations de rôles.</p>)}
          </>}
          </div></>;
      })()}</>}
    </section>
  </main>;
}
