import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { StationCustomers } from './StationCustomers';
import { StationServices } from './StationServices';
import { StationOrders } from './StationOrders';

type Station = { id: string; name: string };

export function OwnerPortal() {
  const [session, setSession] = useState<Session | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [stations, setStations] = useState<Station[]>([]);
  const [stationId, setStationId] = useState('');
  const [tab, setTab] = useState<'orders' | 'services' | 'customers'>('orders');
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
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) setSession(next);
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session || !supabase) { setStations([]); setStationId(''); return; }
    setStations([]);
    setStationId('');
    let active = true;
    supabase.from('stations').select('id,name').order('created_at').then(({ data, error }) => {
      if (!active) return;
      if (error) setError(error.message); else setStations(data || []);
    });
    return () => { active = false; };
  }, [session?.user.id]);

  async function authenticate(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const result = signup
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) setError(result.error.message);
      else if (signup && !result.data.session) setMessage('Vérifiez votre e-mail pour confirmer votre compte, puis connectez-vous.');
    } catch { setError('Connexion impossible. Vérifiez votre réseau et réessayez.'); }
    finally { setBusy(false); }
  }

  async function createStation(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !session || !name.trim()) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const { data, error } = await supabase.from('stations')
        .insert({ name: name.trim(), owner_id: session.user.id }).select('id,name').single();
      if (error) setError(error.message);
      else { setStations(prev => [...prev, data]); setStationId(data.id); setName(''); setMessage('Station créée.'); }
    } catch { setError('Impossible de créer la station. Vérifiez votre connexion.'); }
    finally { setBusy(false); }
  }

  const input = 'w-full rounded-xl bg-[#20242e] border border-[#343b48] px-4 py-3 text-white';
  const button = 'rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-gray-950 disabled:opacity-50';
  return <main className="min-h-screen bg-[#111317] text-gray-100 flex items-center justify-center p-6">
    <section className="w-full max-w-lg rounded-2xl border border-[#303640] bg-[#16181d] p-8 space-y-5">
      <h1 className="text-2xl font-bold">LavAuto · Espace propriétaire</h1>
      {!online && <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">Connexion indisponible. L’application peut s’ouvrir hors ligne après une première visite, mais les données et les modifications ne sont pas encore disponibles hors ligne et aucune synchronisation automatique n’est active.</p>}
      {!supabase ? <p>Configuration Supabase manquante. Renseignez les variables VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY.</p>
        : loading ? <p>Chargement…</p>
        : session ? <>
          <p className="text-sm text-gray-400">Connecté : {session.user.email}</p>
          <h2 className="font-bold">Mes stations</h2>
          {stations.length ? <ul className="space-y-2">{stations.map(s => <li className="rounded-xl bg-[#20242e] p-3" key={s.id}>{s.name}</li>)}</ul> : <p className="text-sm text-gray-400">Aucune station enregistrée.</p>}
          <form onSubmit={createStation} className="flex gap-2"><input className={input} value={name} onChange={e => setName(e.target.value)} placeholder="Nom de la station" maxLength={120} required /><button className={button} disabled={busy}>Créer</button></form>
          {stations.length > 0 && <label className="block text-sm">Station active
            <select className={`${input} mt-1`} value={stationId} onChange={e => setStationId(e.target.value)}>
              <option value="">Choisir une station</option>{stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>}
          {stationId && <>
            <nav aria-label="Modules de la station" className="flex flex-wrap gap-2">
              {([['orders', 'Prestations'], ['services', 'Catalogue'], ['customers', 'Clients']] as const).map(([key, label]) => <button key={key} type="button" onClick={() => setTab(key)} aria-current={tab === key ? 'page' : undefined} className={`rounded-xl px-3 py-2 text-sm ${tab === key ? 'bg-cyan-500 text-gray-950' : 'bg-[#20242e] text-gray-300'}`}>{label}</button>)}
            </nav>
            {tab === 'orders' && <StationOrders key={`orders:${session.user.id}:${stationId}`} stationId={stationId} />}
            {tab === 'services' && <StationServices key={`services:${session.user.id}:${stationId}`} stationId={stationId} />}
            {tab === 'customers' && <StationCustomers key={`customers:${session.user.id}:${stationId}`} stationId={stationId} />}
          </>}
          <p className="text-sm text-amber-300">La caisse, les paiements et les autres modules ne sont pas encore disponibles.</p>
          <button className="text-cyan-400 underline" onClick={async () => { const { error } = await supabase!.auth.signOut(); if (error) setError(error.message); }}>Se déconnecter</button>
        </> : <form onSubmit={authenticate} className="space-y-4">
          <p className="text-sm text-gray-400">{signup ? 'Créez votre compte propriétaire.' : 'Connectez-vous à votre compte propriétaire.'}</p>
          <label className="block text-sm">E-mail<input className={`${input} mt-1`} type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
          <label className="block text-sm">Mot de passe<input className={`${input} mt-1`} type="password" autoComplete={signup ? 'new-password' : 'current-password'} minLength={6} required value={password} onChange={e => setPassword(e.target.value)} /></label>
          <button className={`${button} w-full`} disabled={busy}>{signup ? 'Créer mon compte' : 'Se connecter'}</button>
          <button type="button" className="text-sm text-cyan-400 underline" onClick={() => { setSignup(!signup); setError(''); setMessage(''); }}>{signup ? 'Déjà inscrit ? Se connecter' : 'Créer un compte propriétaire'}</button>
        </form>}
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      {message && <p role="status" className="text-sm text-emerald-400">{message}</p>}
    </section>
  </main>;
}
