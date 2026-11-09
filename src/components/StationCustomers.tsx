import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type Customer = { id: string; name: string; phone: string };

/** The server and RLS, not this component's station filter, enforce access. */
export function StationCustomers({ stationId }: { stationId: string }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    supabase!.from('station_customers').select('id,name,phone').eq('station_id', stationId)
      .order('created_at', { ascending: false }).then(({ data, error }) => {
        if (!active) return;
        if (error) setError(`Impossible de charger les clients : ${error.message}`);
        else setCustomers(data ?? []);
        setLoading(false);
      });
    return () => { active = false; };
  }, [stationId, reload]);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    if (!cleanName || !cleanPhone) { setError('Le nom et le téléphone sont obligatoires.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      const request = editing
        ? supabase!.from('station_customers').update({ name: cleanName, phone: cleanPhone }).eq('id', editing).eq('station_id', stationId)
        : supabase!.from('station_customers').insert({ station_id: stationId, name: cleanName, phone: cleanPhone });
      const { data, error } = await request.select('id,name,phone').single();
      if (error) { setError(`Enregistrement impossible : ${error.message}`); return; }
      setCustomers(prev => editing ? prev.map(c => c.id === editing ? data : c) : [data, ...prev]);
      setName(''); setPhone(''); setEditing(null);
      setMessage(editing ? 'Client modifié.' : 'Client ajouté.');
    } catch {
      setError('Enregistrement impossible. Vérifiez votre connexion et réessayez.');
    } finally { setBusy(false); }
  }

  const input = 'w-full rounded-xl bg-[#20242e] border border-[#343b48] px-4 py-3 text-white';
  return <section className="space-y-4 border-t border-[#303640] pt-5" aria-label="Clients de la station">
    <h2 className="font-bold">Clients de la station</h2>
    <p className="text-xs text-gray-400">Clients enregistrés dans Supabase pour cette station uniquement.</p>
    {loading ? <p className="text-sm">Chargement des clients…</p> : customers.length ?
      <ul className="space-y-2">{customers.map(customer => <li key={customer.id} className="flex justify-between items-center gap-3 rounded-xl bg-[#20242e] p-3 text-sm">
        <span><strong>{customer.name}</strong><br /><span className="text-gray-400">{customer.phone}</span></span>
        <button type="button" disabled={busy} className="text-cyan-400 underline disabled:opacity-50" onClick={() => { setEditing(customer.id); setName(customer.name); setPhone(customer.phone); setMessage(''); setError(''); }}>Modifier</button>
      </li>)}</ul> : !error && <p className="text-sm text-gray-400">Aucun client enregistré.</p>}
    {error && <div role="alert" className="text-sm text-red-400">{error} <button type="button" className="underline" onClick={() => setReload(v => v + 1)}>Réessayer le chargement</button></div>}
    {message && <p role="status" className="text-sm text-emerald-400">{message}</p>}
    <form onSubmit={save} className="space-y-3">
      <h3 className="text-sm font-semibold">{editing ? 'Modifier le client' : 'Ajouter un client'}</h3>
      <label className="block text-sm">Nom<input className={`${input} mt-1`} required maxLength={120} value={name} onChange={e => setName(e.target.value)} /></label>
      <label className="block text-sm">Téléphone<input className={`${input} mt-1`} type="tel" required maxLength={40} value={phone} onChange={e => setPhone(e.target.value)} /></label>
      <div className="flex gap-4"><button type="submit" disabled={busy || loading} className="rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-gray-950 disabled:opacity-50">{editing ? 'Enregistrer' : 'Ajouter'}</button>
        {editing && <button type="button" disabled={busy} className="text-gray-300 underline" onClick={() => { setEditing(null); setName(''); setPhone(''); setError(''); }}>Annuler</button>}
      </div>
    </form>
  </section>;
}
