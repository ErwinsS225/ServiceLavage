import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type Item = { id: string; name: string; unit: string; quantity: number; min_threshold: number };
const fields = 'id,name,unit,quantity,min_threshold';
const input = 'w-full rounded-xl bg-[#20242e] border border-[#343b48] px-4 py-3 text-white';

export function StationInventory({ stationId }: { stationId: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [quantity, setQuantity] = useState('');
  const [minimum, setMinimum] = useState('');
  const [adjustments, setAdjustments] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    supabase!.from('station_inventory').select(fields).eq('station_id', stationId).order('name')
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setError(`Impossible de charger l’inventaire : ${error.message}`);
        else setItems(data ?? []);
        setLoading(false);
      });
    return () => { active = false; };
  }, [stationId, reload]);

  async function submitOperation(args: {
    p_request_id: string; p_station_id: string; p_item_id: string | null;
    p_name: string | null; p_unit: string | null; p_quantity: number; p_min_threshold: number | null;
  }) {
    const { data, error } = await supabase!.rpc('apply_inventory_operation', args);
    if (error) throw new Error(error.message);
    if (!data?.length) throw new Error('Le serveur n’a pas confirmé la modification.');
  }

  async function createItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(quantity); const threshold = Number(minimum);
    if (!name.trim() || !unit.trim() || !Number.isSafeInteger(amount) || amount < 0 || amount > 1_000_000_000 || !Number.isSafeInteger(threshold) || threshold < 0 || threshold > 1_000_000_000) {
      setError('Renseignez un article, une unité et des quantités entières comprises entre 0 et 1 000 000 000.'); return;
    }
    setBusy(true); setError(''); setMessage('');
    try {
      await submitOperation({ p_request_id: crypto.randomUUID(), p_station_id: stationId, p_item_id: null, p_name: name.trim(), p_unit: unit.trim(), p_quantity: amount, p_min_threshold: threshold });
      setName(''); setUnit(''); setQuantity(''); setMinimum(''); setMessage('Article enregistré.'); setReload(v => v + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Enregistrement impossible.'); }
    finally { setBusy(false); }
  }

  async function adjust(item: Item) {
    const delta = Number(adjustments[item.id]);
    if (!Number.isSafeInteger(delta) || delta === 0) { setError('L’ajustement doit être un entier différent de zéro.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      await submitOperation({ p_request_id: crypto.randomUUID(), p_station_id: stationId, p_item_id: item.id, p_name: null, p_unit: null, p_quantity: delta, p_min_threshold: null });
      setAdjustments(prev => ({ ...prev, [item.id]: '' })); setMessage(`Stock de « ${item.name} » ajusté.`); setReload(v => v + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Ajustement impossible.'); }
    finally { setBusy(false); }
  }

  return <section className="space-y-4 border-t border-[#303640] pt-5" aria-label="Inventaire de la station">
    <h2 className="font-bold">Inventaire</h2>
    <p className="text-sm text-gray-400">Stock réel de cette station. Les écritures nécessitent Pro ou Business. Les opérations ne sont pas disponibles hors ligne.</p>
    {loading ? <p>Chargement de l’inventaire…</p> : items.length ? <ul className="space-y-3">{items.map(item => <li key={item.id} className="rounded-xl bg-[#20242e] p-4 space-y-3">
      <div className="flex items-center justify-between gap-3"><strong>{item.name}</strong><span className={item.quantity <= item.min_threshold ? 'text-amber-300' : 'text-gray-300'}>{item.quantity} {item.unit}{item.quantity <= item.min_threshold ? ' · Stock bas' : ''}</span></div>
      <p className="text-xs text-gray-400">Seuil d’alerte : {item.min_threshold} {item.unit}</p>
      <div className="flex gap-2"><label className="sr-only" htmlFor={`adjust-${item.id}`}>Ajustement de stock pour {item.name}</label><input id={`adjust-${item.id}`} className={input} type="number" step="1" value={adjustments[item.id] ?? ''} onChange={event => setAdjustments(prev => ({ ...prev, [item.id]: event.target.value }))} placeholder="+ ajout / − retrait" /><button type="button" disabled={busy || loading} className="rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-gray-950 disabled:opacity-50" onClick={() => void adjust(item)}>Ajuster</button></div>
    </li>)}</ul> : !error && <p className="text-sm text-gray-400">Aucun article en stock.</p>}
    {error && <p role="alert" className="text-sm text-red-400">{error} <button type="button" className="underline" onClick={() => setReload(v => v + 1)}>Recharger</button></p>}
    {message && <p role="status" className="text-sm text-emerald-400">{message}</p>}
    <form onSubmit={event => void createItem(event)} className="space-y-3">
      <h3 className="font-semibold">Ajouter un article</h3>
      <label className="block text-sm">Nom<input className={`${input} mt-1`} maxLength={120} required value={name} onChange={event => setName(event.target.value)} /></label>
      <label className="block text-sm">Unité (ex. litre, pièce)<input className={`${input} mt-1`} maxLength={30} required value={unit} onChange={event => setUnit(event.target.value)} /></label>
      <label className="block text-sm">Quantité de départ<input className={`${input} mt-1`} type="number" min="0" max="1000000000" step="1" required value={quantity} onChange={event => setQuantity(event.target.value)} /></label>
      <label className="block text-sm">Seuil de stock bas<input className={`${input} mt-1`} type="number" min="0" max="1000000000" step="1" required value={minimum} onChange={event => setMinimum(event.target.value)} /></label>
      <button disabled={busy || loading} className="rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-gray-950 disabled:opacity-50">Ajouter au stock</button>
    </form>
  </section>;
}
