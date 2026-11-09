import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatXof } from '../lib/money';
import { listQueuedOrders, saveQueuedOrder, synchronizeOrders, type QueuedOrder } from '../lib/offlineOrders';

type Service = { id: string; name: string; price_xof: number };
type Customer = { id: string; name: string; phone: string };
type Order = { id: string; vehicle_info: string; plate_number: string | null; total_xof: number; status: 'en_attente' | 'en_cours' | 'termine' | 'annule'; created_at: string; station_order_items: { id: string; service_name: string; price_xof: number }[] };
const labels = { en_attente: 'En attente', en_cours: 'En cours', termine: 'Terminée', annule: 'Annulée' };

export function StationOrders({ stationId, userId }: { stationId: string; userId: string }) {
  const [services, setServices] = useState<Service[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);
  const [vehicle, setVehicle] = useState('');
  const [plate, setPlate] = useState('');
  const [customer, setCustomer] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState<QueuedOrder[]>([]);
  const [cached, setCached] = useState(false);
  const syncing = useRef(false);
  const syncAgain = useRef(false);
  const cacheKey = `servicelavage:order-data:v1:${userId}:${stationId}`;

  function refreshQueue() {
    const queued = listQueuedOrders(localStorage, userId, stationId);
    setPending(queued);
    return queued;
  }

  async function syncQueue() {
    if (!navigator.onLine) { setError('Connexion indisponible : les prestations restent en attente sur cet appareil.'); return; }
    if (syncing.current) { syncAgain.current = true; return; }
    syncing.current = true;
    setError('');
    try {
      const result = await synchronizeOrders(localStorage, userId, stationId, async order => {
        const { data: currentSession } = await supabase!.auth.getSession();
        if (currentSession.session?.user.id !== userId) throw new Error('Reconnectez-vous au compte propriétaire pour synchroniser.');
        const { error } = await supabase!.rpc('create_station_order_idempotent', {
          p_request_id: order.requestId, p_station_id: order.stationId, p_customer_id: order.customerId,
          p_vehicle_info: order.vehicle, p_plate_number: order.plate, p_service_ids: order.serviceIds,
        });
        if (error) throw new Error(`Synchronisation en attente : ${error.message}`);
      });
      refreshQueue();
      if (result.completed) { setMessage(`${result.completed} prestation(s) synchronisée(s). Le tarif serveur a été appliqué.`); setReload(v => v + 1); }
      if (result.error) throw result.error;
    } catch (err) {
      try { refreshQueue(); } catch { /* keep original error */ }
      setError(err instanceof Error ? err.message : 'Synchronisation impossible. Les opérations restent sur cet appareil.');
    } finally {
      syncing.current = false;
      if (syncAgain.current) { syncAgain.current = false; void syncQueue(); }
    }
  }

  useEffect(() => {
    try { refreshQueue(); } catch (err) { setError(err instanceof Error ? err.message : 'File locale inaccessible.'); }
    const onOnline = () => { void syncQueue(); };
    const onStorage = () => { try { refreshQueue(); } catch { setError('File locale inaccessible.'); } };
    window.addEventListener('online', onOnline);
    window.addEventListener('storage', onStorage);
    void syncQueue();
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('storage', onStorage); };
  }, [stationId, userId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    try {
      const snapshot = localStorage.getItem(cacheKey);
      if (snapshot) {
        const saved = JSON.parse(snapshot);
        if (Array.isArray(saved.services) && Array.isArray(saved.customers)) {
          setServices(saved.services); setCustomers(saved.customers); setCached(true);
        }
      }
    } catch { setError('Impossible de lire les données locales.'); }
    if (!navigator.onLine) { setOrders([]); setLoading(false); return () => { active = false; }; }
    Promise.all([
      supabase!.from('station_services').select('id,name,price_xof').eq('station_id', stationId).eq('is_active', true).order('name'),
      supabase!.from('station_customers').select('id,name,phone').eq('station_id', stationId).order('name'),
      supabase!.from('station_orders').select('id,vehicle_info,plate_number,total_xof,status,created_at,station_order_items(id,service_name,price_xof)').eq('station_id', stationId).order('created_at', { ascending: false }),
    ]).then(([serviceResult, customerResult, orderResult]) => {
      if (!active) return;
      const firstError = serviceResult.error || customerResult.error || orderResult.error;
      if (firstError) setError(`Chargement impossible : ${firstError.message}`);
      else {
        const snapshot = { services: serviceResult.data ?? [], customers: customerResult.data ?? [] };
        setServices(snapshot.services); setCustomers(snapshot.customers); setOrders((orderResult.data ?? []) as Order[]); setCached(false);
        try { localStorage.setItem(cacheKey, JSON.stringify(snapshot)); }
        catch { setError('Données chargées, mais leur stockage hors ligne a échoué.'); }
      }
      setLoading(false);
    }).catch(() => { if (active) { setError('Chargement impossible. Vérifiez votre connexion.'); setLoading(false); } });
    return () => { active = false; };
  }, [stationId, userId, reload]);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!vehicle.trim() || selected.length < 1 || selected.length > 20) { setError('Renseignez le véhicule et sélectionnez entre 1 et 20 services.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      const order: QueuedOrder = { version: 1, userId, stationId, requestId: crypto.randomUUID(), customerId: customer || null,
        vehicle: vehicle.trim(), plate: plate.trim() || null, serviceIds: selected, createdAt: new Date().toISOString() };
      saveQueuedOrder(localStorage, order);
      setVehicle(''); setPlate(''); setCustomer(''); setSelected([]);
      setMessage('Prestation enregistrée sur cet appareil, en attente de synchronisation.');
      try { refreshQueue(); } catch { setError('Prestation enregistrée localement, mais la file contient une entrée illisible : ne créez pas de doublon.'); return; }
      void syncQueue();
    } catch (err) { setError(err instanceof Error ? `Enregistrement local impossible : ${err.message}` : 'Enregistrement local impossible.'); }
    finally { setBusy(false); }
  }
  async function transition(id: string, status: 'en_cours' | 'termine' | 'annule') {
    setBusy(true); setError(''); setMessage('');
    try {
      const { error } = await supabase!.rpc('transition_station_order', { p_order_id: id, p_status: status });
      if (error) setError(`Mise à jour impossible : ${error.message}`);
      else setMessage('Statut mis à jour.');
      setReload(v => v + 1);
    } catch { setError('Résultat inconnu. Actualisez la liste avant de réessayer.'); }
    finally { setBusy(false); }
  }
  const input = 'w-full rounded-xl bg-[#20242e] border border-[#343b48] px-4 py-3 text-white';
  return <section className="space-y-4 border-t border-[#303640] pt-5" aria-label="Prestations de la station">
    <h2 className="font-bold">Prestations</h2>
    <p className="text-xs text-gray-400">Création et suivi des prestations. Les paiements ne sont pas encore disponibles.</p>
    <p className="text-xs text-amber-300">{pending.length} prestation(s) en attente sur cet appareil. La synchronisation est tentée au retour du réseau lorsque cet écran et cette station sont ouverts. Le tarif serveur au moment de l’envoi s’applique.</p>
    <p className="text-xs text-gray-400">Les données locales ne sont pas chiffrées : éviter les appareils partagés. Ne pas effacer les données du navigateur avant synchronisation.</p>
    {cached && <p className="text-xs text-amber-300">Catalogue et clients locaux : leur état et leurs tarifs peuvent être périmés.</p>}
    {pending.length > 0 && <><ul className="text-sm text-amber-200">{pending.map(item => <li key={item.requestId}>{item.vehicle} · en attente</li>)}</ul><button type="button" className="text-cyan-400 underline text-sm" onClick={() => void syncQueue()}>Réessayer la synchronisation</button></>}
    {error && <div role="alert" className="text-sm text-red-400">{error} <button type="button" className="underline" onClick={() => setReload(v => v + 1)}>Actualiser</button></div>}
    {message && <p role="status" className="text-sm text-emerald-400">{message}</p>}
    {loading ? <p>Chargement…</p> : <>
      <form onSubmit={create} className="space-y-3">
        <h3 className="font-semibold">Nouvelle prestation</h3>
        <label className="block text-sm">Véhicule<input className={`${input} mt-1`} required maxLength={120} value={vehicle} onChange={e => setVehicle(e.target.value)} placeholder="Marque et modèle" /></label>
        <label className="block text-sm">Immatriculation (facultatif)<input className={`${input} mt-1`} maxLength={40} value={plate} onChange={e => setPlate(e.target.value)} /></label>
        <label className="block text-sm">Client (facultatif)<select className={`${input} mt-1`} value={customer} onChange={e => setCustomer(e.target.value)}><option value="">Client de passage</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name} · {c.phone}</option>)}</select></label>
        <fieldset className="space-y-2"><legend className="text-sm font-semibold mb-1">Services actifs</legend>
          {!services.length && <p className="text-sm text-amber-300">Ajoutez d’abord un service actif dans le catalogue.</p>}
          {services.map(s => <label className="flex gap-2 items-center text-sm" key={s.id}><input type="checkbox" checked={selected.includes(s.id)} onChange={e => setSelected(prev => e.target.checked ? [...prev, s.id] : prev.filter(id => id !== s.id))} />{s.name} · {formatXof(s.price_xof)}</label>)}
        </fieldset>
        <p className="text-sm">Total indicatif : {formatXof(services.filter(s => selected.includes(s.id)).reduce((sum, s) => sum + s.price_xof, 0))}. Le prix définitif est calculé par la base.</p>
        <button disabled={busy || !services.length} className="rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-gray-950 disabled:opacity-50">Créer la prestation</button>
      </form>
      <h3 className="font-semibold pt-4">Suivi</h3>
      {!orders.length ? <p className="text-sm text-gray-400">{cached ? "Historique indisponible hors ligne." : "Aucune prestation enregistrée."}</p> : <ul className="space-y-3">{orders.map(o => <li key={o.id} className="rounded-xl bg-[#20242e] p-4 space-y-2 text-sm">
        <div className="flex justify-between gap-2"><strong>{o.vehicle_info}{o.plate_number ? ` · ${o.plate_number}` : ''}</strong><span>{labels[o.status]}</span></div>
        <p className="text-gray-400">{new Date(o.created_at).toLocaleString('fr-FR')}</p>
        <ul className="text-gray-300">{o.station_order_items.map(i => <li key={i.id}>{i.service_name} · {formatXof(i.price_xof)}</li>)}</ul>
        <p className="font-bold">Total : {formatXof(o.total_xof)}</p>
        <div className="flex gap-4">{o.status === 'en_attente' && <button disabled={busy} className="text-cyan-400 underline" onClick={() => transition(o.id, 'en_cours')}>Démarrer</button>}
          {o.status === 'en_cours' && <button disabled={busy} className="text-emerald-400 underline" onClick={() => transition(o.id, 'termine')}>Terminer</button>}
          {(o.status === 'en_attente' || o.status === 'en_cours') && <button disabled={busy} className="text-red-400 underline" onClick={() => { if (window.confirm('Annuler cette prestation ?')) transition(o.id, 'annule'); }}>Annuler</button>}</div>
      </li>)}</ul>}
    </>}
  </section>;
}
