import { useEffect, useState } from 'react';
import {
  applyInventoryAdjustment,
  resolveClient,
  type InventoryRow,
} from '../lib/stationApi';
import {
  listQueuedInventoryAdjustments,
  saveQueuedInventoryAdjustment,
  synchronizeInventoryAdjustments,
  type QueuedInventoryAdjustment,
} from '../lib/offlineInventory';
import { useOfflineQueue } from '../hooks/useOfflineQueue';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useLocalCache, isArrayOf } from '../hooks/useLocalCache';
import { useCreateInventoryItem, useInventory } from '../hooks/useStationQueries';
import { describeError } from '../lib/queryResult';
import { inventoryAdjustmentSchema, inventoryItemSchema, parseForm } from '../lib/schemas';
import { errorText } from '../lib/errorMessages';
import { useToastActions } from '../context/ToastContext';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
  StatusBadge, buttonStyles, formControlStyles, FormField, Modal, Alert, EmptyState
} from './ui/designSystem';
import { Plus, Boxes, ArrowUpDown, RotateCw } from 'lucide-react';

const maxStock = 1_000_000_000;

function isItem(value: unknown): value is InventoryRow {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<InventoryRow>;
  return typeof item.id === 'string' && typeof item.name === 'string' && typeof item.unit === 'string' &&
    Number.isSafeInteger(item.quantity) && Number.isSafeInteger(item.min_threshold);
}

/**
 * Inventaire de la station, avec sa file d'ajustements hors ligne.
 *
 * Ce qui a été sorti du composant :
 *  - lecture, écriture et validation du cache local → `useLocalCache` ;
 *  - file d'ajustements et boucle de synchronisation → `useOfflineQueue` ;
 *  - appels Supabase (liste, création, ajustement) → `lib/stationApi.ts`.
 *
 * Ce qui reste ici, volontairement : la règle métier « le stock estimé ne peut
 * pas devenir négatif » et le calcul de l'estimation (stock serveur + deltas en
 * file). C'est de l'affichage d'aide à la décision ; l'arbitrage final reste
 * `apply_inventory_operation`, qui refuse un stock négatif côté serveur.
 */
export function StationInventory({ stationId, userId }: { stationId: string; userId: string }) {
  const online = useOnlineStatus();
  const cache = useLocalCache<InventoryRow[]>(
    `servicelavage:inventory:v1:${userId}:${stationId}`,
    isArrayOf(isItem),
  );

  // Hors ligne, on n'interroge pas le réseau : le cache local tient le rôle.
  // Le drapeau `cached` est calculé, pas mémorisé, pour qu'il ne survive pas à
  // une reconnexion (il restait auparavant affiché après un retour du réseau).
  const inventoryQuery = useInventory(stationId, { enabled: online });
  const createItemMutation = useCreateInventoryItem(stationId);

  const offlineSnapshot = online ? null : cache.read();
  const cached = !online && offlineSnapshot !== null;

  const itemsData = online ? (inventoryQuery.data ?? []) : (offlineSnapshot ?? []);
  const items = {
    data: itemsData,
    loading: !online ? false : inventoryQuery.isPending,
    error: inventoryQuery.error ? describeError(inventoryQuery.error, 'Impossible de charger l’inventaire.') : '',
    reload: () => { void inventoryQuery.refetch(); },
  };

  // Le cache local ne sert qu'à afficher pendant une coupure : dès que la
  // requête aboutit, on y écrit la photographie serveur.
  const latest = inventoryQuery.data;
  useEffect(() => {
    if (!online || !latest) return;
    try { cache.write(latest); } catch { /* quota plein : ne pas masquer les données fraîches */ }
  }, [online, latest, cache]);

  const queue = useOfflineQueue<QueuedInventoryAdjustment>({
    list: () => listQueuedInventoryAdjustments(localStorage, userId, stationId),
    deliver: async adjustment => {
      await applyInventoryAdjustment(resolveClient(), adjustment);
    },
    synchronize: deliver => synchronizeInventoryAdjustments(localStorage, userId, stationId, deliver),
    canSync: () => navigator.onLine,
    onDelivered: () => items.reload(),
    fallback: 'Synchronisation impossible. La file a été conservée.',
  });

  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [quantity, setQuantity] = useState('');
  const [minimum, setMinimum] = useState('');
  const [adjustments, setAdjustments] = useState<Record<string, string>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [message, setMessage] = useState('');
  /** Erreurs par champ, issues du schéma : une par champ, sous le champ. */
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const toast = useToastActions();

  async function createItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!navigator.onLine) {
      setFormError('La création d’article nécessite une connexion ; seuls les ajustements d’articles existants peuvent être mis en file.');
      return;
    }
    // Les bornes viennent du schéma, lui-même aligné sur les `check` de la
    // base : le message est ainsi précis (« Quantité : entre 0 et … ») au lieu
    // d'une phrase unique couvrant quatre causes possibles.
    const parsed = parseForm(inventoryItemSchema, { name, unit, quantity, minThreshold: minimum });
    if (!parsed.ok) {
      setFieldErrors(parsed.errors);
      setFormError(Object.values(parsed.errors)[0] ?? '');
      return;
    }
    setBusy(true);
    setFormError('');
    setFieldErrors({});
    setMessage('');
    try {
      // La mutation invalide la clé `inventory` : la liste revient du serveur.
      await createItemMutation.mutateAsync(parsed.data);
      setName('');
      setUnit('');
      setQuantity('');
      setMinimum('');
      setMessage('Article enregistré.');
      setModalOpen(false);
      toast.success('Article ajouté à l’inventaire.', parsed.data.name);
    } catch (cause) {
      setFormError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  async function adjust(item: InventoryRow) {
    const parsed = parseForm(inventoryAdjustmentSchema, adjustments[item.id] ?? '');
    if (!parsed.ok) {
      // L'ajustement vit dans une ligne de tableau : le message y est rattaché
      // par `aria-describedby`, pas par un toast qui masquerait la ligne.
      setFieldErrors(previous => ({ ...previous, [item.id]: Object.values(parsed.errors)[0] ?? '' }));
      setFormError(Object.values(parsed.errors)[0] ?? '');
      return;
    }
    const delta = parsed.data;
    let queuedDelta: number;
    try {
      queuedDelta = listQueuedInventoryAdjustments(localStorage, userId, stationId)
        .filter(entry => entry.itemId === item.id)
        .reduce((sum, entry) => sum + entry.delta, 0);
    } catch (cause) {
      setFormError(describeError(cause, 'La file locale est invalide.'));
      return;
    }
    if (item.quantity + queuedDelta + delta < 0) {
      setFieldErrors(previous => ({
        ...previous,
        [item.id]: 'Le stock estimé deviendrait négatif. Actualisez le stock avant de réessayer.',
      }));
      setFormError('Le stock estimé deviendrait négatif. Actualisez le stock avant de réessayer.');
      return;
    }
    setBusy(true);
    setFormError('');
    setFieldErrors({});
    setMessage('');
    try {
      saveQueuedInventoryAdjustment(localStorage, {
        version: 1,
        userId,
        stationId,
        requestId: crypto.randomUUID(),
        itemId: item.id,
        delta,
        createdAt: new Date().toISOString(),
      });
      setAdjustments(previous => ({ ...previous, [item.id]: '' }));
      queue.refresh();
      if (navigator.onLine) {
        await queue.sync();
        toast.success(`Stock de « ${item.name} » ajusté.`);
      } else {
        setMessage('Ajustement mis en attente sur cet appareil. Le stock serveur sera vérifié à la synchronisation.');
      }
    } catch (cause) {
      setFormError(describeError(cause, 'Mise en file impossible.'));
    } finally {
      setBusy(false);
    }
  }

  const error = formError || items.error || queue.error;

  return (
    <section className="space-y-5 border-t border-[var(--border-subtle)] pt-6" aria-label="Inventaire de la station">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">Gestion des Stocks & Produits</h2>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">Suivi des consommables (shampoing, cire, microfibres) avec file hors ligne sécurisée</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={buttonStyles({ variant: 'outline', size: 'sm' })}
            onClick={() => { setFormError(''); items.reload(); }}
            disabled={items.loading || busy}
          >
            <RotateCw className={`w-3.5 h-3.5 mr-1.5 ${items.loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
          <button
            type="button"
            className={buttonStyles({ variant: 'primary', size: 'sm' })}
            onClick={() => { setModalOpen(true); setFormError(''); setFieldErrors({}); setMessage(''); }}
            disabled={items.loading || busy || !online}
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

      {queue.pending.length > 0 && (
        <Alert
          variant="warning"
          title={`${queue.pending.length} ajustement(s) en attente de synchronisation`}
          action={
            online && (
              <button
                type="button"
                disabled={busy}
                className="underline text-xs font-semibold text-amber-200 hover:text-white"
                onClick={() => void queue.sync()}
              >
                Synchroniser maintenant
              </button>
            )
          }
        >
          <ul className="text-xs mt-1 space-y-0.5 font-mono">
            {queue.pending.map(operation => (
              <li key={operation.requestId}>
                {operation.delta > 0 ? '+' : ''}{operation.delta} · article {operation.itemId.slice(0, 8)} · {new Date(operation.createdAt).toLocaleTimeString('fr-FR')}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {error && (
        <Alert variant="error" action={
          <button
            type="button"
            className="underline text-xs font-semibold text-rose-300"
            onClick={() => { setFormError(''); items.reload(); void queue.sync(); }}
          >
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

      {items.loading ? (
        <div className="p-8 text-center text-sm text-[var(--text-secondary)] rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)]">
          Chargement de l’inventaire…
        </div>
      ) : items.data.length ? (
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
            {items.data.map(item => {
              const queuedDelta = queue.pending.filter(entry => entry.itemId === item.id).reduce((sum, entry) => sum + entry.delta, 0);
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
                        <span className="font-semibold text-[var(--text-primary)] block">{item.name}</span>
                        <span className="text-[11px] text-[var(--text-secondary)] font-mono">Unité: {item.unit}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell align="right">
                    <span className="font-bold text-[var(--text-primary)] text-base font-mono tabular-nums">
                      {estimate}
                    </span>
                    <span className="text-xs text-[var(--text-secondary)] ml-1 font-sans">{item.unit}</span>
                    {queuedDelta !== 0 && (
                      <span className="text-[11px] text-amber-300 block font-mono">
                        ({queuedDelta > 0 ? '+' : ''}{queuedDelta} en attente)
                      </span>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <span className="font-mono tabular-nums text-[var(--text-secondary)] text-xs">
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
                        className="w-24 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border-strong)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-indigo-500 font-mono text-center"
                        aria-invalid={fieldErrors[item.id] ? true : undefined}
                        aria-describedby={fieldErrors[item.id] ? `adjust-error-${item.id}` : undefined}
                        type="number"
                        min={-maxStock}
                        max={maxStock}
                        step="1"
                        value={adjustments[item.id] ?? ''}
                        onChange={event => setAdjustments(previous => ({ ...previous, [item.id]: event.target.value }))}
                        placeholder="+ / −"
                      />
                      <button
                        type="button"
                        disabled={busy || items.loading}
                        className={buttonStyles({ variant: 'secondary', size: 'sm' })}
                        onClick={() => void adjust(item)}
                      >
                        <ArrowUpDown className="w-3.5 h-3.5 mr-1 text-[var(--text-secondary)]" />
                        Ajuster
                      </button>
                    </div>
                    {fieldErrors[item.id] && (
                      <p id={`adjust-error-${item.id}`} role="alert" className="mt-1 text-[11px] text-rose-400 text-right">
                        {fieldErrors[item.id]}
                      </p>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <EmptyState
          icon={<Boxes className="w-6 h-6 text-[var(--text-secondary)]" />}
          title="Aucun article enregistré"
          description="Gérez les stocks de shampoings, cires, chiffons et pièces d'usure avec alertes de réapprovisionnement."
          action={
            <button
              type="button"
              className={buttonStyles({ variant: 'primary', size: 'sm' })}
              onClick={() => { setModalOpen(true); setFormError(''); setFieldErrors({}); setMessage(''); }}
              disabled={!online}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Ajouter un premier produit
            </button>
          }
        />
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Ajouter un article en stock"
        description="Créez une référence pour le suivi des consommables de la station."
      >
        <form onSubmit={event => void createItem(event)} className="space-y-4">
          <FormField
            label="Nom du produit ou consommable"
            required
            htmlFor="inventory-name"
            error={fieldErrors.name}
          >
            <input
              id="inventory-name"
              className={formControlStyles.input}
              maxLength={120}
              required
              aria-invalid={fieldErrors.name ? true : undefined}
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="Ex: Shampoing Mousse Actif Pro"
              autoFocus
            />
          </FormField>

          <FormField
            label="Unité de mesure"
            required
            hint="Ex: bidon de 5L, litre, rouleau, flacon"
            htmlFor="inventory-unit"
            error={fieldErrors.unit}
          >
            <input
              id="inventory-unit"
              className={formControlStyles.input}
              maxLength={30}
              required
              aria-invalid={fieldErrors.unit ? true : undefined}
              value={unit}
              onChange={event => setUnit(event.target.value)}
              placeholder="Ex: Litres"
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="Quantité initiale en réserve"
              required
              htmlFor="inventory-quantity"
              error={fieldErrors.quantity}
            >
              <input
                id="inventory-quantity"
                className={formControlStyles.input}
                aria-invalid={fieldErrors.quantity ? true : undefined}
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

            <FormField
              label="Seuil d'alerte de réapprovisionnement"
              required
              hint="Déclenche l'alerte Stock bas"
              htmlFor="inventory-threshold"
              error={fieldErrors.minThreshold}
            >
              <input
                id="inventory-threshold"
                className={formControlStyles.input}
                aria-invalid={fieldErrors.minThreshold ? true : undefined}
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

          {formError && <Alert variant="error">{formError}</Alert>}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              disabled={busy}
              className={buttonStyles({ variant: 'ghost', size: 'md' })}
              onClick={() => { setModalOpen(false); setFieldErrors({}); }}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={busy || items.loading || !online}
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
