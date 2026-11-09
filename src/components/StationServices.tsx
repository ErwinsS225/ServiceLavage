import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatXof } from '../lib/money';
import { parseServiceInteger } from '../lib/serviceValidation';

type Service = { id: string; name: string; price_xof: number; duration_minutes: number; is_active: boolean };
const fields = 'id,name,price_xof,duration_minutes,is_active';

export function StationServices({ stationId }: { stationId: string }) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');
  const [active, setActive] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let current = true;
    setLoading(true); setError('');
    supabase!.from('station_services').select(fields).eq('station_id', stationId)
      .order('created_at', { ascending: false }).then(({ data, error }) => {
        if (!current) return;
        if (error) setError(`Impossible de charger le catalogue : ${error.message}`);
        else setServices(data ?? []);
        setLoading(false);
      });
    return () => { current = false; };
  }, [stationId, reload]);

  function reset() { setEditing(null); setName(''); setPrice(''); setDuration(''); setActive(true); }
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const priceXof = parseServiceInteger(price, 0, 100000000);
    const minutes = parseServiceInteger(duration, 1, 1440);
    if (!name.trim() || priceXof === null || minutes === null) {
      setError('Saisissez un nom, un prix entier de 0 à 100 000 000 FCFA et une durée entière de 1 à 1 440 minutes.');
      return;
    }
    setBusy(true); setError(''); setMessage('');
    try {
      const values = { name: name.trim(), price_xof: priceXof, duration_minutes: minutes, is_active: active };
      const request = editing
        ? supabase!.from('station_services').update(values).eq('id', editing).eq('station_id', stationId)
        : supabase!.from('station_services').insert({ ...values, station_id: stationId });
      const { data, error } = await request.select(fields).single();
      if (error) { setError(`Enregistrement impossible : ${error.message}`); return; }
      setServices(prev => editing ? prev.map(s => s.id === editing ? data : s) : [data, ...prev]);
      setMessage(editing ? 'Service modifié.' : 'Service ajouté.');
      reset();
    } catch { setError('Enregistrement impossible. Vérifiez votre connexion et réessayez.'); }
    finally { setBusy(false); }
  }

  const input = 'w-full rounded-xl bg-[#20242e] border border-[#343b48] px-4 py-3 text-white';
  return <section className="space-y-4 border-t border-[#303640] pt-5" aria-label="Catalogue de la station">
    <h2 className="font-bold">Catalogue de services</h2>
    <p className="text-xs text-gray-400">Tarifs propres à cette station, enregistrés en FCFA entiers dans Supabase.</p>
    {loading ? <p className="text-sm">Chargement du catalogue…</p> : services.length ?
      <ul className="space-y-2">{services.map(service => <li key={service.id} className="flex justify-between items-center gap-3 rounded-xl bg-[#20242e] p-3 text-sm">
        <span><strong>{service.name}</strong><br /><span className="text-gray-400">{formatXof(service.price_xof)} · {service.duration_minutes} min · {service.is_active ? 'Actif' : 'Inactif'}</span></span>
        <button type="button" disabled={busy} className="text-cyan-400 underline disabled:opacity-50" onClick={() => { setEditing(service.id); setName(service.name); setPrice(String(service.price_xof)); setDuration(String(service.duration_minutes)); setActive(service.is_active); setMessage(''); setError(''); }}>Modifier</button>
      </li>)}</ul> : !error && <p className="text-sm text-gray-400">Aucun service enregistré.</p>}
    {error && <div role="alert" className="text-sm text-red-400">{error} <button type="button" className="underline" onClick={() => setReload(v => v + 1)}>Réessayer le chargement</button></div>}
    {message && <p role="status" className="text-sm text-emerald-400">{message}</p>}
    <form onSubmit={save} className="space-y-3">
      <h3 className="text-sm font-semibold">{editing ? 'Modifier le service' : 'Ajouter un service'}</h3>
      <label className="block text-sm">Nom<input className={`${input} mt-1`} required maxLength={120} value={name} onChange={e => setName(e.target.value)} /></label>
      <label className="block text-sm">Prix (FCFA)<input className={`${input} mt-1`} type="number" min="0" max="100000000" step="1" required value={price} onChange={e => setPrice(e.target.value)} /></label>
      <label className="block text-sm">Durée (minutes)<input className={`${input} mt-1`} type="number" min="1" max="1440" step="1" required value={duration} onChange={e => setDuration(e.target.value)} /></label>
      <label className="flex gap-2 text-sm items-center"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} /> Service actif</label>
      <div className="flex gap-4"><button type="submit" disabled={busy || loading} className="rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-gray-950 disabled:opacity-50">{editing ? 'Enregistrer' : 'Ajouter'}</button>
        {editing && <button type="button" disabled={busy} className="text-gray-300 underline" onClick={() => { reset(); setError(''); }}>Annuler</button>}
      </div>
    </form>
  </section>;
}
