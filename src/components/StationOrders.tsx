import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatXof } from '../lib/money';

type Service = { id: string; name: string; price_xof: number };
type Customer = { id: string; name: string; phone: string };
type Order = { id: string; vehicle_info: string; plate_number: string | null; total_xof: number; status: 'en_attente' | 'en_cours' | 'termine' | 'annule'; created_at: string; station_order_items: { id: string; service_name: string; price_xof: number }[] };
const labels = { en_attente: 'En attente', en_cours: 'En cours', termine: 'Terminée', annule: 'Annulée' };

export function StationOrders({ stationId }: { stationId: string }) {
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

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    Promise.all([
      supabase!.from('station_services').select('id,name,price_xof').eq('station_id', stationId).eq('is_active', true).order('name'),
      supabase!.from('station_customers').select('id,name,phone').eq('station_id', stationId).order('name'),
      supabase!.from('station_orders').select('id,vehicle_info,plate_number,total_xof,status,created_at,station_order_items(id,service_name,price_xof)').eq('station_id', stationId).order('created_at', { ascending: false }),
    ]).then(([serviceResult, customerResult, orderResult]) => {
      if (!active) return;
      const firstError = serviceResult.error || customerResult.error || orderResult.error;
      if (firstError) setError(`Chargement impossible : ${firstError.message}`);
      else { setServices(serviceResult.data ?? []); setCustomers(customerResult.data ?? []); setOrders((orderResult.data ?? []) as Order[]); }
      setLoading(false);
    }).catch(() => { if (active) { setError('Chargement impossible. Vérifiez votre connexion.'); setLoading(false); } });
    return () => { active = false; };
  }, [stationId, reload]);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!vehicle.trim() || selected.length < 1 || selected.length > 20) { setError('Renseignez le véhicule et sélectionnez entre 1 et 20 services.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      const { error } = await supabase!.rpc('create_station_order', { p_station_id: stationId, p_customer_id: customer || null, p_vehicle_info: vehicle.trim(), p_plate_number: plate.trim() || null, p_service_ids: selected });
      if (error) { setError(`Création impossible : ${error.message}. Si la connexion a été interrompue, actualisez la liste avant de réessayer pour éviter un doublon.`); return; }
      setVehicle(''); setPlate(''); setCustomer(''); setSelected([]); setMessage('Prestation créée.'); setReload(v => v + 1);
    } catch { setError('Résultat inconnu. Actualisez la liste avant de réessayer pour éviter un doublon.'); }
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
      {!orders.length ? <p className="text-sm text-gray-400">Aucune prestation enregistrée.</p> : <ul className="space-y-3">{orders.map(o => <li key={o.id} className="rounded-xl bg-[#20242e] p-4 space-y-2 text-sm">
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
