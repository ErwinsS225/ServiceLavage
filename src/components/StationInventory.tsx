import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  listQueuedInventoryAdjustments, saveQueuedInventoryAdjustment, synchronizeInventoryAdjustments,
  type QueuedInventoryAdjustment,
} from '../lib/offlineInventory';

type Item = { id: string; name: string; unit: string; quantity: number; min_threshold: number };
const fields = 'id,name,unit,quantity,min_threshold';
const input = 'w-full rounded-xl bg-[#20242e] border border-[#343b48] px-4 py-3 text-white';
const maxStock = 1_000_000_000;

function isItem(value: unknown): value is Item {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<Item>;
  return typeof item.id === 'string' && typeof item.name === 'string' && typeof item.unit === 'string' &&
    Number.isSafeInteger(item.quantity) && Number.isSafeInteger(item.min_threshold);
}

export function StationInventory({ stationId, userId }: { stationId: string; userId: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [pending, setPending] = useState<QueuedInventoryAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [cached, setCached] = useState(false);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [quantity, setQuantity] = useState('');
  const [minimum, setMinimum] = useState('');
  const [adjustments, setAdjustments] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);
  const syncing = useRef(false);
  const syncAgain = useRef(false);
  const cacheKey = `servicelavage:inventory:v1:${userId}:${stationId}`;

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);

  function refreshQueue() {
    try {
      const queue = listQueuedInventoryAdjustments(localStorage, userId, stationId);
      setPending(queue);
      return queue;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La file locale d’inventaire est illisible ; elle a été conservée.');
      return [];
    }
  }

  async function deliver(adjustment: QueuedInventoryAdjustment) {
    const { data: sessionData } = await supabase!.auth.getSession();
    if (sessionData.session?.user.id !== userId) throw new Error('Reconnectez-vous au compte d’origine pour synchroniser le stock.');
    const { data, error } = await supabase!.rpc('apply_inventory_operation', {
      p_request_id: adjustment.requestId, p_station_id: adjustment.stationId, p_item_id: adjustment.itemId,
      p_name: null, p_unit: null, p_quantity: adjustment.delta, p_min_threshold: null,
    });
    if (error) throw new Error(error.message);
    if (!data?.length) throw new Error('Le serveur n’a pas confirmé l’ajustement de stock.');
  }

  async function syncQueue() {
    if (!navigator.onLine) return;
    if (syncing.current) { syncAgain.current = true; return; }
    syncing.current = true;
    setError('');
    try {
      const result = await synchronizeInventoryAdjustments(localStorage, userId, stationId, deliver);
      refreshQueue();
      if (result.completed > 0) {
        setMessage(`${result.completed} ajustement(s) confirmé(s) par le serveur.`);
        setReload(value => value + 1);
      }
      if (result.error) throw result.error;
    } catch (cause) {
      refreshQueue();
      setError(cause instanceof Error ? `Synchronisation en attente : ${cause.message}` : 'Synchronisation impossible. La file a été conservée.');
    } finally {
      syncing.current = false;
      if (syncAgain.current) { syncAgain.current = false; void syncQueue(); }
    }
  }

  useEffect(() => {
    refreshQueue();
    const onOnline = () => { void syncQueue(); };
    const onStorage = () => { refreshQueue(); };
    window.addEventListener('online', onOnline);
    window.addEventListener('storage', onStorage);
    void syncQueue();
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('storage', onStorage); };
  }, [stationId, userId]);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setItems([]); setCached(false);
    let hasCache = false;
    try {
      const snapshot = localStorage.getItem(cacheKey);
      if (snapshot !== null) {
        const parsed: unknown = JSON.parse(snapshot);
        if (!Array.isArray(parsed) || !parsed.every(isItem)) throw new Error('Le cache local d’inventaire est invalide.');
        setItems(parsed); setCached(true); hasCache = true;
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Impossible de lire le cache local.'); }
    if (!online) { setLoading(false); return () => { active = false; }; }
    Promise.resolve(supabase!.from('station_inventory').select(fields).eq('station_id', stationId).order('name'))
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          if (!hasCache) setError(`Impossible de charger l’inventaire : ${error.message}`);
          else setError(`Connexion à l’inventaire indisponible ; affichage du dernier cache local. ${error.message}`);
        } else {
          const freshItems = (data ?? []) as Item[];
          setItems(freshItems); setCached(false);
          try { localStorage.setItem(cacheKey, JSON.stringify(freshItems)); }
          catch { setError('Inventaire chargé, mais sauvegarde locale impossible.'); }
        }
        setLoading(false);
      }).catch(() => {
        if (!active) return;
        if (!hasCache) setError('Impossible de charger l’inventaire. Vérifiez votre connexion.');
        else setError('Connexion à l’inventaire indisponible ; affichage du dernier cache local.');
        setLoading(false);
      });
    return () => { active = false; };
  }, [stationId, userId, reload, online]);

  async function createItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!navigator.onLine) { setError('La création d’article nécessite une connexion ; seuls les ajustements d’articles existants peuvent être mis en file.'); return; }
    const amount = Number(quantity); const threshold = Number(minimum);
    if (!name.trim() || !unit.trim() || !Number.isSafeInteger(amount) || amount < 0 || amount > maxStock || !Number.isSafeInteger(threshold) || threshold < 0 || threshold > maxStock) {
      setError('Renseignez un article, une unité et des quantités entières comprises entre 0 et 1 000 000 000.'); return;
    }
    setBusy(true); setError(''); setMessage('');
    try {
      const { data, error } = await supabase!.rpc('apply_inventory_operation', {
        p_request_id: crypto.randomUUID(), p_station_id: stationId, p_item_id: null,
        p_name: name.trim(), p_unit: unit.trim(), p_quantity: amount, p_min_threshold: threshold,
      });
      if (error) { setError(`Enregistrement impossible : ${error.message}`); return; }
      if (!data?.length) { setError('Le serveur n’a pas confirmé la création.'); return; }
      setName(''); setUnit(''); setQuantity(''); setMinimum(''); setMessage('Article enregistré.'); setReload(value => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Enregistrement impossible.'); }
    finally { setBusy(false); }
  }

  async function adjust(item: Item) {
    const delta = Number(adjustments[item.id]);
    if (!Number.isSafeInteger(delta) || delta === 0 || Math.abs(delta) > maxStock) { setError('L’ajustement doit être un entier non nul compris entre −1 000 000 000 et 1 000 000 000.'); return; }
    let queuedDelta: number;
    try {
      queuedDelta = listQueuedInventoryAdjustments(localStorage, userId, stationId).filter(entry => entry.itemId === item.id).reduce((sum, entry) => sum + entry.delta, 0);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'La file locale est invalide.'); return; }
    if (item.quantity + queuedDelta + delta < 0) { setError('Le stock estimé deviendrait négatif. Actualisez le stock avant de réessayer.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      const operation: QueuedInventoryAdjustment = {
        version: 1, userId, stationId, requestId: crypto.randomUUID(), itemId: item.id,
        delta, createdAt: new Date().toISOString(),
      };
      saveQueuedInventoryAdjustment(localStorage, operation);
      setAdjustments(prev => ({ ...prev, [item.id]: '' }));
      refreshQueue();
      if (navigator.onLine) await syncQueue();
      else setMessage('Ajustement mis en attente sur cet appareil. Le stock serveur sera vérifié à la synchronisation.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Mise en file impossible.'); }
    finally { setBusy(false); }
  }

  return <section className="space-y-4 border-t border-[#303640] pt-5" aria-label="Inventaire de la station">
    <h2 className="font-bold">Inventaire</h2>
    <p className="text-sm text-gray-400">Le stock consulté hors ligne vient du dernier cache. Les ajustements sont mis en file puis validés par le serveur ; création d’article en ligne uniquement.</p>
    {!online && <p role="status" className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-300">Hors ligne : stock local potentiellement périmé. Les ajustements en attente ne sont pas encore appliqués au stock serveur.</p>}
    {cached && online && <p className="text-xs text-amber-300">Affichage du dernier cache local ; il peut être périmé.</p>}
    {pending.length > 0 && <div className="space-y-1 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-200"><p>{pending.length} ajustement(s) en attente.</p><ul>{pending.map(operation => <li key={operation.requestId}>{operation.delta > 0 ? '+' : ''}{operation.delta} · article {operation.itemId.slice(0, 8)} · {new Date(operation.createdAt).toLocaleString('fr-FR')}</li>)}</ul>{online && <button type="button" disabled={busy} className="text-cyan-300 underline" onClick={() => void syncQueue()}>Réessayer la synchronisation</button>}</div>}
    {loading ? <p>Chargement de l’inventaire…</p> : items.length ? <ul className="space-y-3">{items.map(item => {
      const queuedDelta = pending.filter(entry => entry.itemId === item.id).reduce((sum, entry) => sum + entry.delta, 0);
      const estimate = item.quantity + queuedDelta;
      return <li key={item.id} className="rounded-xl bg-[#20242e] p-4 space-y-3">
        <div className="flex items-center justify-between gap-3"><strong>{item.name}</strong><span className={estimate <= item.min_threshold ? 'text-amber-300' : 'text-gray-300'}>{estimate} {item.unit}{estimate <= item.min_threshold ? ' · Stock bas/estimé' : ''}</span></div>
        <p className="text-xs text-gray-400">Stock confirmé au dernier chargement : {item.quantity} {item.unit} · seuil d’alerte : {item.min_threshold} {item.unit}</p>
        <div className="flex gap-2"><label className="sr-only" htmlFor={`adjust-${item.id}`}>Ajustement de stock pour {item.name}</label><input id={`adjust-${item.id}`} className={input} type="number" min={-maxStock} max={maxStock} step="1" value={adjustments[item.id] ?? ''} onChange={event => setAdjustments(prev => ({ ...prev, [item.id]: event.target.value }))} placeholder="+ ajout / − retrait" /><button type="button" disabled={busy || loading} className="rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-gray-950 disabled:opacity-50" onClick={() => void adjust(item)}>Ajuster</button></div>
      </li>;
    })}</ul> : !error && <p className="text-sm text-gray-400">Aucun article enregistré dans le cache.</p>}
    {error && <p role="alert" className="text-sm text-red-400">{error} <button type="button" className="underline" onClick={() => setReload(value => value + 1)}>Recharger</button></p>}
    {message && <p role="status" className="text-sm text-emerald-400">{message}</p>}
    <form onSubmit={event => void createItem(event)} className="space-y-3">
      <h3 className="font-semibold">Ajouter un article</h3>
      <label className="block text-sm">Nom<input className={`${input} mt-1`} maxLength={120} required value={name} onChange={event => setName(event.target.value)} /></label>
      <label className="block text-sm">Unité (ex. litre, pièce)<input className={`${input} mt-1`} maxLength={30} required value={unit} onChange={event => setUnit(event.target.value)} /></label>
      <label className="block text-sm">Quantité de départ<input className={`${input} mt-1`} type="number" min="0" max={maxStock} step="1" required value={quantity} onChange={event => setQuantity(event.target.value)} /></label>
      <label className="block text-sm">Seuil de stock bas<input className={`${input} mt-1`} type="number" min="0" max={maxStock} step="1" required value={minimum} onChange={event => setMinimum(event.target.value)} /></label>
      <button type="submit" disabled={busy || loading || !online} className="rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-gray-950 disabled:opacity-50">Ajouter l’article (en ligne)</button>
    </form>
  </section>;
}
