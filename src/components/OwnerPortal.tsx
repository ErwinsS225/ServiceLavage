import { lazy, Suspense, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isRecoveryLink, supabase } from '../lib/supabase';
import { AuthLayout } from './auth/AuthLayout';
import { NO_STATION_COPY } from './auth/authCopy';
import { AuthCredentialsForm } from './auth/AuthCredentialsForm';
import { AuthForgotForm } from './auth/AuthForgotForm';
import { AuthResetForm } from './auth/AuthResetForm';
import { StationCustomers } from './StationCustomers';
import { StationServices } from './StationServices';
import { StationOrders } from './StationOrders';
import { SubscriptionPlans } from './SubscriptionPlans';
import { 
  BrandLogo, 
  buttonStyles, 
  formControlStyles, 
  FormField, 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent, 
  StatusBadge, 
  Alert 
} from './ui/designSystem';
import { useTheme } from '../context/ThemeContext';
import { 
  LogOut, 
  Building2, 
  Plus, 
  Users, 
  Sparkles, 
  Car, 
  Boxes, 
  CreditCard, 
  ShieldCheck, 
  WifiOff,
  Sun,
  Moon,
  TrendingUp,
  FileText
} from 'lucide-react';

const StationInventory = lazy(() => import('./StationInventory').then(module => ({ default: module.StationInventory })));
const StationStaff = lazy(() => import('./StationStaff').then(module => ({ default: module.StationStaff })));
const StationDashboard = lazy(() => import('./StationDashboard').then(module => ({ default: module.StationDashboard })));
const StationReports = lazy(() => import('./StationReports').then(module => ({ default: module.StationReports })));

type Station = { id: string; name: string; owner_id?: string };
type StationRole = 'owner' | 'gerant' | 'caissier' | 'laveur';
type StationTabId = 'dashboard' | 'orders' | 'services' | 'customers' | 'inventory' | 'staff' | 'reports' | 'subscription';

/**
 * One authoritative matrix for the station modules. The navigation, the panel
 * rendering and the reset-on-station-change effect all read it, so a role can
 * never see a tab it is not allowed to open (the server enforces the same
 * rules independently through RLS and the SECURITY DEFINER functions).
 */
const STATION_TABS: ReadonlyArray<{ id: StationTabId; label: string; roles: readonly StationRole[] }> = [
  { id: 'dashboard', label: 'Tableau de bord', roles: ['owner', 'gerant', 'caissier'] },
  { id: 'orders', label: 'Prestations', roles: ['owner', 'gerant', 'laveur'] },
  { id: 'services', label: 'Catalogue', roles: ['owner', 'gerant'] },
  { id: 'customers', label: 'Clients', roles: ['owner', 'gerant', 'caissier'] },
  { id: 'inventory', label: 'Inventaire', roles: ['owner', 'gerant'] },
  { id: 'staff', label: 'Personnel', roles: ['owner', 'gerant'] },
  { id: 'reports', label: 'Rapports', roles: ['owner', 'gerant'] },
  { id: 'subscription', label: 'Abonnements', roles: ['owner'] },
];

const TAB_ICONS: Record<StationTabId, React.ReactNode> = {
  dashboard: <TrendingUp className="w-4 h-4" />,
  orders: <Car className="w-4 h-4" />,
  services: <Sparkles className="w-4 h-4" />,
  customers: <Users className="w-4 h-4" />,
  inventory: <Boxes className="w-4 h-4" />,
  staff: <ShieldCheck className="w-4 h-4" />,
  reports: <FileText className="w-4 h-4" />,
  subscription: <CreditCard className="w-4 h-4" />,
};

/** Tabs the current role may open; used by the effect that resets a stale tab. */
function allowedTabsFor(role: StationRole | null): StationTabId[] {
  if (!role) return [];
  return STATION_TABS.filter(item => item.roles.includes(role)).map(item => item.id);
}

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
  const [tab, setTab] = useState<StationTabId>('dashboard');
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

  // Switching station must not keep a tab the new role is not allowed to use:
  // a caissier opening Prestations after an owner left it on Catalogue used to
  // land on an empty panel. The allowed-tab list is derived once, below.
  useEffect(() => {
    const allowed = allowedTabsFor(stationRole);
    if (allowed.length > 0 && !allowed.includes(tab)) setTab(allowed[0]);
  }, [stationRole, tab]);

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
      else { setStations(prev => [...prev, data]); setStationId(data.id); setStationRole('owner'); setName(''); setMessage('Station créée avec succès.'); }
    } catch { setError('Impossible de créer la station. Vérifiez votre connexion.'); }
    finally { setBusy(false); }
  }

  const roleDisplayNames: Record<StationRole, string> = {
    owner: 'Propriétaire',
    gerant: 'Gérant',
    caissier: 'Caissier',
    laveur: 'Laveur',
  };

  const banner = (
    <div className="space-y-3">
      {!online && (
        <Alert variant="warning">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 shrink-0 text-amber-400" />
            <span>Connexion indisponible. Les prestations peuvent être mises en attente si les données de la station ont été chargées auparavant ; les autres modules ne fonctionnent pas encore hors ligne.</span>
          </div>
        </Alert>
      )}
      {error && <Alert variant="error">{error}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}
    </div>
  );

  if (!supabase) return <AuthLayout title="Configuration requise" screen="signin">
    <p className="text-sm leading-relaxed text-gray-400">
      Les variables <code className="rounded bg-[#20242e] px-1.5 py-0.5 text-gray-200">VITE_SUPABASE_URL</code> et{' '}
      <code className="rounded bg-[#20242e] px-1.5 py-0.5 text-gray-200">VITE_SUPABASE_PUBLISHABLE_KEY</code>{' '}
      sont absentes de la configuration de build.
    </p>
  </AuthLayout>;

  if (loading) return <AuthLayout title="Connexion" screen="signin">
    <p role="status" className="text-sm text-gray-400">Chargement…</p>
  </AuthLayout>;

  if (!session || recovery) {
    const reset = recovery;
    const screen = reset ? 'reset' : forgot ? 'forgot' : signup ? 'signup' : 'signin';
    const title = reset ? 'Nouveau mot de passe' : forgot ? 'Mot de passe oublié' : signup ? 'Créer un compte' : 'Connexion';
    return <AuthLayout
      title={title}
      screen={screen}
      scene={screen}
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

  const { isDarkMode, toggleDarkMode } = useTheme();
  const activeStation = stations.find(s => s.id === stationId);

  return (
    <main className="min-h-screen bg-[var(--surface-canvas)] text-[var(--text-primary)] flex items-start justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-5xl space-y-6">
        {/* Top Header */}
        <header className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-4">
            <BrandLogo size="md" showTagline={true} />
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] block">Compte actif</span>
              <span className="text-xs font-mono text-[var(--text-secondary)] font-medium">{session.user.email}</span>
            </div>
            <button
              type="button"
              aria-label={isDarkMode ? 'Passer en mode clair' : 'Passer en mode sombre'}
              className={buttonStyles({ variant: 'outline', size: 'sm' })}
              onClick={toggleDarkMode}
            >
              {isDarkMode ? <Sun className="w-3.5 h-3.5 mr-1.5 text-amber-300" /> : <Moon className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />}
              {isDarkMode ? 'Clair' : 'Sombre'}
            </button>
            <button
              type="button"
              className={buttonStyles({ variant: 'outline', size: 'sm' })}
              onClick={async () => { const { error: signErr } = await supabase!.auth.signOut(); if (signErr) setError(signErr.message); }}
            >
              <LogOut className="w-3.5 h-3.5 mr-1.5 text-[var(--text-muted)]" />
              Se déconnecter
            </button>
          </div>
        </header>

        {banner}

        {/* Stations & Team Workspace Grid */}
        <div className="grid gap-5 md:grid-cols-2">
          {/* Active Station Selector */}
          <Card>
            <CardHeader
              action={
                activeStation && stationRole && (
                  <StatusBadge
                    status="info"
                    label={roleDisplayNames[stationRole]}
                    size="sm"
                  />
                )
              }
            >
              <CardTitle as="h2" className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-400" />
                Mes stations de lavage
              </CardTitle>
              <CardDescription>
                Sélectionnez la station de travail pour charger ses données isolées
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {stations.length > 0 ? (
                <div className="space-y-3">
                  <FormField label="Station en cours d'exploitation">
                    <select
                      className={formControlStyles.select}
                      value={stationId}
                      onChange={e => setStationId(e.target.value)}
                    >
                      <option value="">Sélectionner une station</option>
                      {stations.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} {s.owner_id === session.user.id ? '· (Propriétaire)' : ''}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <div className="space-y-2 pt-1">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Stations rattachées ({stations.length})
                    </span>
                    <ul className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {stations.map(s => {
                        const isSelected = stationId === s.id;
                        return (
                          <li
                            key={s.id}
                            onClick={() => setStationId(s.id)}
                            className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-center justify-between transition-all ${
                              isSelected
                                ? 'border-indigo-500 bg-indigo-500/10 text-white font-semibold shadow-sm'
                                : 'border-[#242936] bg-[#161a23] text-slate-300 hover:border-slate-600'
                            }`}
                          >
                            <span className="truncate">{s.name}</span>
                            <span className="text-[10px] font-mono text-slate-500 shrink-0 ml-2">
                              {s.owner_id === session.user.id ? 'Propriétaire' : 'Membre'}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="space-y-1 p-3 rounded-xl bg-[#161a23] border border-[#242936]">
                  <p className="text-xs font-semibold text-white">{NO_STATION_COPY.title}</p>
                  <p className="text-xs text-slate-400">{NO_STATION_COPY.body}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Create Station & Join Team */}
          <div className="space-y-5">
            {(stationRole === 'owner' || stations.length === 0) && (
              <Card>
                <CardHeader>
                  <CardTitle as="h2" className="flex items-center gap-2">
                    <Plus className="w-4 h-4 text-sky-400" />
                    Créer une station
                  </CardTitle>
                  <CardDescription>
                    Crée un nouveau tenant étanche rattaché à votre compte propriétaire
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={createStation} className="space-y-3">
                    <FormField label="Nom commercial de la station" required>
                      <input
                        className={formControlStyles.input}
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Ex: Station Express Riviera 2"
                        maxLength={120}
                        required
                      />
                    </FormField>
                    <button
                      type="submit"
                      className={`${buttonStyles({ variant: 'primary', size: 'md' })} w-full`}
                      disabled={busy}
                    >
                      {busy ? 'Création en cours…' : 'Créer la station'}
                    </button>
                  </form>
                </CardContent>
              </Card>
            )}

            {stationRole !== 'laveur' && (
            <Card>
              <CardHeader>
                <CardTitle as="h2" className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Rejoindre une équipe
                </CardTitle>
                <CardDescription>
                  Activez un accès collaborateur à partir d'un code d'invitation reçu
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={acceptInvitation} className="space-y-3">
                  <FormField label="Référence d’invitation" required hint="Identifiant à 36 caractères transmis par le gérant">
                    <input
                      className={formControlStyles.input}
                      value={inviteCode}
                      onChange={event => setInviteCode(event.target.value)}
                      placeholder="Ex: 12345678-abcd-1234-abcd-1234567890ab"
                    />
                  </FormField>
                  <button
                    type="submit"
                    className={`${buttonStyles({ variant: 'secondary', size: 'md' })} w-full`}
                    disabled={busy || !online}
                  >
                    Vérifier et accepter l’invitation
                  </button>
                </form>
              </CardContent>
            </Card>
            )}
          </div>
        </div>

        {/* Dynamic Station Navigation & Content */}
        {stationId && roleLoading ? (
          <div className="p-8 text-center text-sm text-slate-400 rounded-2xl bg-[#12151c] border border-[#232834]">
            Vérification des accès serveur…
          </div>
        ) : stationId && !stationRole ? (
          <Alert variant="warning">
            Votre compte n’a pas d’accès actif à cette station. Demandez une invitation au propriétaire.
          </Alert>
        ) : (
          <>
            {(() => {
              const tabs = STATION_TABS.filter(item => stationRole && item.roles.includes(stationRole));

              return (
                <div className="space-y-4">
                  {/* Segmented Modules Tab Navigation */}
                  <nav
                    aria-label="Modules autorisés"
                    className="flex flex-wrap gap-1.5 p-1.5 rounded-2xl bg-[#12151c] border border-[#232834]"
                  >
                    {tabs.map(item => {
                      const isActive = tab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setTab(item.id)}
                          aria-current={isActive ? 'page' : undefined}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 select-none ${
                            isActive
                              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/40 border border-indigo-400/30'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                          }`}
                        >
                          <span className={isActive ? 'text-white' : 'text-slate-500'}>
                            {TAB_ICONS[item.id]}
                          </span>
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </nav>

                  {/* Main Station Active Module Panel */}
                  <div className="rounded-2xl border border-[#232834] bg-[#12151c] p-5 sm:p-6 shadow-sm">
                    {tab === 'subscription' && stationRole === 'owner' && <SubscriptionPlans />}
                    {stationId && stationRole && (
                      <>
                        {tab === 'dashboard' && (stationRole === 'owner' || stationRole === 'gerant' || stationRole === 'caissier') && (
                          <Suspense fallback={<p className="text-sm text-slate-400">Chargement du tableau de bord…</p>}>
                            <StationDashboard
                              key={`dashboard:${session.user.id}:${stationId}`}
                              stationId={stationId}
                              userId={session.user.id}
                              onNavigateTab={nextTab => setTab(nextTab)}
                            />
                          </Suspense>
                        )}
                        {tab === 'orders' && (stationRole === 'owner' || stationRole === 'gerant' || stationRole === 'laveur') && (
                          <StationOrders
                            key={`orders:${session.user.id}:${stationId}`}
                            stationId={stationId}
                            userId={session.user.id}
                            role={stationRole}
                            roleFeaturesReady={rolesReady}
                            stationName={activeStation?.name}
                          />
                        )}
                        {tab === 'services' && (stationRole === 'owner' || stationRole === 'gerant') && (
                          <StationServices
                            key={`services:${session.user.id}:${stationId}`}
                            stationId={stationId}
                          />
                        )}
                        {tab === 'customers' && (stationRole === 'owner' || stationRole === 'gerant' || stationRole === 'caissier') && (
                          <StationCustomers
                            key={`customers:${session.user.id}:${stationId}`}
                            stationId={stationId}
                          />
                        )}
                        {tab === 'inventory' && (stationRole === 'owner' || stationRole === 'gerant') && (
                          <Suspense fallback={<p className="text-sm text-slate-400">Chargement de l’inventaire…</p>}>
                            <StationInventory
                              key={`inventory:${session.user.id}:${stationId}`}
                              stationId={stationId}
                              userId={session.user.id}
                            />
                          </Suspense>
                        )}
                        {tab === 'staff' && (stationRole === 'owner' || stationRole === 'gerant') && (
                          rolesReady ? (
                            <Suspense fallback={<p className="text-sm text-slate-400">Chargement du personnel…</p>}>
                              <StationStaff
                                key={`staff:${session.user.id}:${stationId}`}
                                stationId={stationId}
                                canManageRoles={stationRole === 'owner'}
                              />
                            </Suspense>
                          ) : (
                            <Alert variant="warning">
                              Le module Personnel nécessite le déploiement préalable des migrations de rôles sur l’instance.
                            </Alert>
                          )
                        )}
                        {tab === 'reports' && (stationRole === 'owner' || stationRole === 'gerant') && (
                          <Suspense fallback={<p className="text-sm text-slate-400">Chargement des rapports…</p>}>
                            <StationReports
                              key={`reports:${session.user.id}:${stationId}`}
                              stationId={stationId}
                              stationName={activeStation?.name || 'Station ServiceLavage'}
                            />
                          </Suspense>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>
    </main>
  );
}
