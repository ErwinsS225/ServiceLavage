import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  listQueuedInventoryAdjustments, saveQueuedInventoryAdjustment, synchronizeInventoryAdjustments,
  type QueuedInventoryAdjustment,
} from '../lib/offlineInventory';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
  StatusBadge, buttonStyles, formControlStyles, FormField, Modal, Alert, EmptyState
} from './ui/designSystem';
import { Plus, Boxes, ArrowUpDown, RotateCw } from 'lucide-react';

type Item = { id: string; name: string; unit: string; quantity: number; min_threshold: number };
const fields = 'id,name,unit,quantity,min_threshold';
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
  const [modalOpen, setModalOpen] = useState(false);
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
      setName(''); setUnit(''); setQuantity(''); setMinimum(''); setMessage('Article enregistré.');
      setModalOpen(false);
      setReload(value => value + 1);
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

  return (
    <section className="space-y-5 border-t border-[#232834] pt-6" aria-label="Inventaire de la station">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Gestion des Stocks & Produits</h2>
          <p className="text-xs text-slate-400 mt-0.5">Suivi des consommables (shampoing, cire, microfibres) avec file hors ligne sécurisée</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={buttonStyles({ variant: 'outline', size: 'sm' })}
            onClick={() => setReload(v => v + 1)}
            disabled={loading || busy}
          >
            <RotateCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
          <button
            type="button"
            className={buttonStyles({ variant: 'primary', size: 'sm' })}
            onClick={() => { setModalOpen(true); setError(''); setMessage(''); }}
            disabled={loading || busy || !online}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Nouvel article
          </button>
        </div>
      </div>

      {!online && (
        <Alert variant="warning">
          Mode hors ligne actif. Le stock affiché provient du dernier cache local. Les ajustements sont placés en file d’attente locale.
        </Alert>
      )}

      {cached && online && (
        <p className="text-xs text-amber-300">
          Affichage du dernier cache local ; il peut être périmé.
        </p>
      )}

      {pending.length > 0 && (
        <Alert
          variant="warning"
          title={`${pending.length} ajustement(s) en attente de synchronisation`}
          action={
            online && (
              <button
                type="button"
                disabled={busy}
                className="underline text-xs font-semibold text-amber-200 hover:text-white"
                onClick={() => void syncQueue()}
              >
                Synchroniser maintenant
              </button>
            )
          }
        >
          <ul className="text-xs mt-1 space-y-0.5 font-mono">
            {pending.map(operation => (
              <li key={operation.requestId}>
                {operation.delta > 0 ? '+' : ''}{operation.delta} · article {operation.itemId.slice(0, 8)} · {new Date(operation.createdAt).toLocaleTimeString('fr-FR')}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {error && (
        <Alert variant="error" action={
          <button type="button" className="underline text-xs font-semibold text-rose-300" onClick={() => setReload(value => value + 1)}>
            Recharger
          </button>
        }>
          {error}
        </Alert>
      )}

      {message && (
        <Alert variant="success">
          {message}
        </Alert>
      )}

      {loading ? (
        <div className="p-8 text-center text-sm text-slate-400 rounded-xl bg-[#141720] border border-[#232834]">
          Chargement de l’inventaire…
        </div>
      ) : items.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produit / Consommable</TableHead>
              <TableHead align="right">Stock actuel</TableHead>
              <TableHead align="right">Seuil d'alerte</TableHead>
              <TableHead align="center">État du stock</TableHead>
              <TableHead align="right">Ajustement rapide</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(item => {
              const queuedDelta = pending.filter(entry => entry.itemId === item.id).reduce((sum, entry) => sum + entry.delta, 0);
              const estimate = item.quantity + queuedDelta;
              const isLow = estimate <= item.min_threshold;
              const isDepleted = estimate === 0;

              return (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-xs">
                        <Boxes className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-semibold text-white block">{item.name}</span>
                        <span className="text-[11px] text-slate-400 font-mono">Unité: {item.unit}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell align="right">
                    <span className="font-bold text-white text-base font-mono tabular-nums">
                      {estimate}
                    </span>
                    <span className="text-xs text-slate-400 ml-1 font-sans">{item.unit}</span>
                    {queuedDelta !== 0 && (
                      <span className="text-[11px] text-amber-300 block font-mono">
                        ({queuedDelta > 0 ? '+' : ''}{queuedDelta} en attente)
                      </span>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <span className="font-mono tabular-nums text-slate-400 text-xs">
                      {item.min_threshold} {item.unit}
                    </span>
                  </TableCell>
                  <TableCell align="center">
                    <StatusBadge
                      status={isDepleted ? 'danger' : isLow ? 'warning' : 'success'}
                      label={isDepleted ? 'Rupture' : isLow ? 'Stock bas' : 'Normal'}
                      size="sm"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <div className="flex items-center justify-end gap-2">
                      <label className="sr-only" htmlFor={`adjust-${item.id}`}>Ajustement de stock pour {item.name}</label>
                      <input
                        id={`adjust-${item.id}`}
                        className="w-24 rounded-lg bg-[#181c25] border border-[#2d3444] px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 outline-none focus:border-indigo-500 font-mono text-center"
                        type="number"
                        min={-maxStock}
                        max={maxStock}
                        step="1"
                        value={adjustments[item.id] ?? ''}
                        onChange={event => setAdjustments(prev => ({ ...prev, [item.id]: event.target.value }))}
                        placeholder="+ / −"
                      />
                      <button
                        type="button"
                        disabled={busy || loading}
                        className={buttonStyles({ variant: 'secondary', size: 'sm' })}
                        onClick={() => void adjust(item)}
                      >
                        <ArrowUpDown className="w-3.5 h-3.5 mr-1 text-slate-400" />
                        Ajuster
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <EmptyState
          icon={<Boxes className="w-6 h-6 text-slate-400" />}
          title="Aucun article enregistré"
          description="Gérez les stocks de shampoings, cires, chiffons et pièces d'usure avec alertes de réapprovisionnement."
          action={
            <button
              type="button"
              className={buttonStyles({ variant: 'primary', size: 'sm' })}
              onClick={() => { setModalOpen(true); setError(''); setMessage(''); }}
              disabled={!online}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Ajouter un premier produit
            </button>
          }
        />
      )}

      {/* Add Item Modal Dialog */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Ajouter un article en stock"
        description="Créez une référence pour le suivi des consommables de la station."
      >
        <form onSubmit={event => void createItem(event)} className="space-y-4">
          <FormField label="Nom du produit ou consommable" required>
            <input
              className={formControlStyles.input}
              maxLength={120}
              required
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="Ex: Shampoing Mousse Actif Pro"
              autoFocus
            />
          </FormField>

          <FormField label="Unité de mesure" required hint="Ex: bidon de 5L, litre, rouleau, flacon">
            <input
              className={formControlStyles.input}
              maxLength={30}
              required
              value={unit}
              onChange={event => setUnit(event.target.value)}
              placeholder="Ex: Litres"
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Quantité initiale en réserve" required>
              <input
                className={formControlStyles.input}
                type="number"
                min="0"
                max={maxStock}
                step="1"
                required
                value={quantity}
                onChange={event => setQuantity(event.target.value)}
                placeholder="Ex: 50"
              />
            </FormField>

            <FormField label="Seuil d'alerte de réapprovisionnement" required hint="Déclenche l'alerte Stock bas">
              <input
                className={formControlStyles.input}
                type="number"
                min="0"
                max={maxStock}
                step="1"
                required
                value={minimum}
                onChange={event => setMinimum(event.target.value)}
                placeholder="Ex: 10"
              />
            </FormField>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#232834]">
            <button
              type="button"
              disabled={busy}
              className={buttonStyles({ variant: 'ghost', size: 'md' })}
              onClick={() => setModalOpen(false)}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={busy || loading || !online}
              className={buttonStyles({ variant: 'primary', size: 'md' })}
            >
              {busy ? 'Création…' : 'Ajouter l’article (en ligne)'}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
