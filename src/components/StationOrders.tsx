import { lazy, Suspense, useState } from 'react';
import { formatXof } from '../lib/money';
import { orderCounts, selectedServicesTotal, toReceiptData } from '../lib/orderPresentation';
import { describeError } from '../lib/queryResult';
import { useStationOrders, type NewOrderInput } from '../hooks/useStationOrders';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
  StatusBadge, buttonStyles, formControlStyles, FormField, Modal, Alert, EmptyState, StatCard
} from './ui/designSystem';
import { Plus, Car, Clock, CheckCircle2, RotateCw, Sparkles } from 'lucide-react';
import { OrderActions } from './orders/OrderActions';
import type { OrderReceiptData } from './ReceiptModal';
const ReceiptModal = lazy(() => import('./ReceiptModal').then(m => ({ default: m.ReceiptModal })));

const EMPTY_FORM: NewOrderInput = { vehicle: '', plate: '', customerId: '', serviceIds: [] };

/**
 * Module Prestations : l'interface seule.
 *
 * Requêtes, cache hors ligne, file d'envoi et mutations vivent dans
 * `hooks/useStationOrders.ts` (elles-mêmes appuyées sur `lib/stationApi.ts`) ;
 * la préparation du reçu et le total du panier dans `lib/orderPresentation.ts`.
 * Ce fichier ne contient plus que les formulaires, les modales et le rendu —
 * c'est ce qui permet de tester les chemins qui créent des doublons ou
 * attribuent une prestation au mauvais laveur sans monter un DOM.
 *
 * Les droits restent l'affaire du serveur : les RPC `SECURITY DEFINER`
 * vérifient rôle, quota et propriété. `canManageOrders` ne fait que masquer des
 * boutons qui seraient de toute façon refusés.
 */
export function StationOrders({
  stationId,
  userId,
  role,
  roleFeaturesReady,
  stationName,
}: {
  stationId: string;
  userId: string;
  role: 'owner' | 'gerant' | 'caissier' | 'laveur';
  roleFeaturesReady: boolean;
  /** Printed on the receipt; falls back to the product name only if absent. */
  stationName?: string;
}) {
  const data = useStationOrders({ stationId, userId, role, roleFeaturesReady });
  const {
    services, customers, orders, loading, cached, loadError, queue,
    assignments, washers, reload, createOrder, transition, assign, unassign,
    canManageOrders, actionError, actionMessage, setActionError, setActionMessage,
  } = data;

  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<NewOrderInput>(EMPTY_FORM);
  const [assignTarget, setAssignTarget] = useState<Record<string, string>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<OrderReceiptData | null>(null);
  /** Id of the order awaiting cancellation confirmation (replaces window.confirm). */
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);

  const counts = orderCounts(orders);
  const selectedPriceTotal = selectedServicesTotal(services, form.serviceIds);
  const error = loadError || actionError || queue.error;
  const message = actionMessage || queue.message;

  function openCreate() {
    setModalOpen(true);
    setActionError('');
    setActionMessage('');
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setModalOpen(false);
  }

  async function runAction(action: () => Promise<void>, success: string) {
    setBusy(true);
    setActionError('');
    setActionMessage('');
    try {
      await action();
      setActionMessage(success);
    } catch (cause) {
      setActionError(describeError(cause, 'Action impossible.'));
    } finally {
      setBusy(false);
    }
  }

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.vehicle.trim() || form.serviceIds.length < 1 || form.serviceIds.length > 20) {
      setActionError('Renseignez le véhicule et sélectionnez entre 1 et 20 services.');
      return;
    }
    setBusy(true);
    setActionError('');
    setActionMessage('');
    try {
      await createOrder(form);
      resetForm();
      setActionMessage('Prestation enregistrée sur cet appareil, en attente de synchronisation.');
    } catch (cause) {
      setActionError(describeError(cause, 'Enregistrement local impossible.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-6 border-t border-[#232834] pt-6" aria-label="Prestations de la station">
      {/* Title & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Suivi des Prestations & File</h2>
          <p className="text-xs text-slate-400 mt-0.5">Enregistrement des véhicules, ordres de lavage et gestion du flux</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={buttonStyles({ variant: 'outline', size: 'sm' })}
            onClick={() => { setActionError(''); reload(); }}
            disabled={loading || busy}
          >
            <RotateCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
          {canManageOrders && (
            <button
              type="button"
              className={buttonStyles({ variant: 'primary', size: 'sm' })}
              onClick={openCreate}
              disabled={loading || busy || !services.length}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Nouvelle prestation
            </button>
          )}
        </div>
      </div>

      {/* KPI Overview — plain counts of the rows below, no rate, no trend */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          title="Total prestations"
          value={counts.total}
          subtext="Enregistrées sur le serveur"
          icon={<Car className="w-4 h-4" />}
        />
        <StatCard
          title="En attente"
          value={counts.en_attente}
          subtext="En file de lavage"
          icon={<Clock className="w-4 h-4 text-amber-400" />}
        />
        <StatCard
          title="En cours"
          value={counts.en_cours}
          subtext="En baie de lavage"
          icon={<Sparkles className="w-4 h-4 text-sky-400" />}
        />
        <StatCard
          title="Terminées"
          value={counts.termine}
          subtext="Prêtes à livrer"
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
        />
      </div>

      {/* Banners & Messages */}
      {canManageOrders && queue.pending.length > 0 && (
        <Alert
          variant="warning"
          title={`${queue.pending.length} prestation(s) en attente sur cet appareil`}
          action={
            <button
              type="button"
              className="underline text-xs font-semibold text-amber-200 hover:text-white"
              onClick={() => void queue.sync()}
            >
              Synchroniser
            </button>
          }
        >
          <p className="text-xs">
            La synchronisation est tentée automatiquement au retour du réseau. Tarif serveur appliqué au moment de l’envoi.
          </p>
          <ul className="text-xs mt-1 space-y-0.5 font-mono">
            {queue.pending.map(item => (
              <li key={item.requestId}>{item.vehicle} · {item.plate || 'Sans immat'}</li>
            ))}
          </ul>
        </Alert>
      )}

      {cached && (
        <Alert variant="info">
          Catalogue et clients locaux affichés depuis la mémoire cache : les tarifs serveur définitifs s’appliqueront lors de la synchronisation.
        </Alert>
      )}

      {error && (
        <Alert variant="error" action={
          <button type="button" className="underline text-xs font-semibold text-rose-300" onClick={() => { setActionError(''); reload(); }}>
            Actualiser
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

      {!canManageOrders && (
        <Alert variant="info">
          Mode Opérateur : Vous visualisez uniquement les prestations qui vous sont affectées.
        </Alert>
      )}

      {/* Orders Table */}
      {loading ? (
        <div className="p-8 text-center text-sm text-slate-400 rounded-xl bg-[#141720] border border-[#232834]">
          Chargement des prestations…
        </div>
      ) : !orders.length ? (
        <EmptyState
          icon={<Car className="w-6 h-6 text-slate-400" />}
          title={cached ? "Historique indisponible hors ligne" : "Aucune prestation enregistrée"}
          description="Créez votre première prestation de lavage pour assigner des laveurs et suivre l'avancement."
          action={
            canManageOrders && services.length > 0 && (
              <button
                type="button"
                className={buttonStyles({ variant: 'primary', size: 'sm' })}
                onClick={openCreate}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Créer une prestation
              </button>
            )
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Véhicule & Immat</TableHead>
              <TableHead>Services demandés</TableHead>
              <TableHead align="right">Montant (FCFA)</TableHead>
              <TableHead align="center">Statut</TableHead>
              <TableHead>Date / Heure</TableHead>
              {canManageOrders && roleFeaturesReady && <TableHead>Affectations</TableHead>}
              <TableHead align="right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map(order => {
              const orderAssignments = assignments.filter(item => item.order_id === order.id);
              const availableWashers = washers.filter(washer => !orderAssignments.some(item => item.user_id === washer.user_id));

              return (
                <TableRow key={order.id}>
                  <TableCell>
                    <div className="font-semibold text-white block">{order.vehicle_info}</div>
                    {order.plate_number ? (
                      <span className="inline-block mt-0.5 font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
                        {order.plate_number}
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-500 italic">Sans immatriculation</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <ul className="text-xs space-y-0.5 text-slate-300">
                      {order.station_order_items.map(item => (
                        <li key={item.id} className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                          <span>{item.service_name}</span>
                        </li>
                      ))}
                    </ul>
                  </TableCell>
                  <TableCell align="right">
                    <span className="font-bold text-white text-sm font-mono tabular-nums">
                      {formatXof(order.total_xof)}
                    </span>
                  </TableCell>
                  <TableCell align="center">
                    <StatusBadge status={order.status} size="sm" />
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-slate-400 block tabular-nums">
                      {new Date(order.created_at).toLocaleDateString('fr-FR')}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500 block tabular-nums">
                      {new Date(order.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </TableCell>
                  {canManageOrders && roleFeaturesReady && (
                    <TableCell>
                      <div className="space-y-1.5 min-w-[140px]">
                        {orderAssignments.map(item => (
                          <div key={item.user_id} className="flex items-center justify-between text-xs bg-slate-900/60 px-2 py-1 rounded border border-slate-800">
                            <span className="font-mono text-[11px] text-slate-300">
                              Laveur {item.user_id.slice(0, 6)}
                            </span>
                            <button
                              type="button"
                              disabled={busy}
                              className="text-[10px] text-rose-400 hover:underline ml-1"
                              onClick={() => void runAction(() => unassign(order.id, item.user_id), 'Affectation retirée.')}
                            >
                              Retirer
                            </button>
                          </div>
                        ))}
                        {availableWashers.length > 0 && (
                          <div className="flex gap-1 items-center mt-1">
                            <label className="sr-only" htmlFor={`washer-${order.id}`}>Laveur à affecter</label>
                            <select
                              id={`washer-${order.id}`}
                              className="w-full text-xs rounded bg-[#181c25] border border-[#2d3444] px-1.5 py-1 text-slate-200 outline-none"
                              value={assignTarget[order.id] ?? ''}
                              onChange={event => setAssignTarget(previous => ({ ...previous, [order.id]: event.target.value }))}
                            >
                              <option value="">+ Affecter</option>
                              {availableWashers.map(washer => (
                                <option key={washer.user_id} value={washer.user_id}>
                                  Laveur {washer.user_id.slice(0, 6)}
                                </option>
                              ))}
                            </select>
                            {assignTarget[order.id] && (
                              <button
                                type="button"
                                disabled={busy}
                                className={buttonStyles({ variant: 'primary', size: 'sm', className: 'h-7 px-2 text-xs' })}
                                onClick={() => void runAction(async () => {
                                  await assign(order.id, assignTarget[order.id]);
                                  setAssignTarget(previous => ({ ...previous, [order.id]: '' }));
                                }, 'Prestation affectée.')}
                              >
                                OK
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </TableCell>
                  )}
                  <TableCell align="right">
                    <OrderActions
                      status={order.status}
                      busy={busy}
                      canCancel={canManageOrders}
                      onStart={() => void runAction(() => transition(order.id, 'en_cours'), 'Statut mis à jour.')}
                      onFinish={() => void runAction(() => transition(order.id, 'termine'), 'Statut mis à jour.')}
                      onCancel={() => setCancelTarget(order.id)}
                      onReceipt={() => setReceiptOrder(toReceiptData(order))}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* New Order Modal Dialog */}
      <Modal
        isOpen={modalOpen}
        onClose={resetForm}
        title="Nouvelle prestation de lavage"
        description="Enregistrez le véhicule et cochez les services demandés."
        size="lg"
      >
        <form onSubmit={create} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Véhicule (Marque & Modèle)" required>
              <input
                className={formControlStyles.input}
                required
                maxLength={120}
                value={form.vehicle}
                onChange={event => setForm({ ...form, vehicle: event.target.value })}
                placeholder="Ex: Toyota RAV4 Blanc"
                autoFocus
              />
            </FormField>

            <FormField label="Plaque d'immatriculation" hint="Facultatif">
              <input
                className={formControlStyles.input}
                maxLength={40}
                value={form.plate}
                onChange={event => setForm({ ...form, plate: event.target.value })}
                placeholder="Ex: 1234 AB 01"
              />
            </FormField>
          </div>

          <FormField label="Client rattaché" hint="Facultatif — laissez vide pour un client de passage">
            <select
              className={formControlStyles.select}
              value={form.customerId}
              onChange={event => setForm({ ...form, customerId: event.target.value })}
            >
              <option value="">Client de passage</option>
              {customers.map(customer => (
                <option key={customer.id} value={customer.id}>{customer.name} · {customer.phone}</option>
              ))}
            </select>
          </FormField>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300">
              Services à réaliser <span className="text-rose-400">*</span>
            </label>
            {!services.length ? (
              <p className="text-xs text-amber-300">
                Aucun service actif configuré dans le catalogue.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto p-1">
                {services.map(service => {
                  const isChecked = form.serviceIds.includes(service.id);
                  return (
                    <label
                      key={service.id}
                      className={`flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        isChecked
                          ? 'border-indigo-500 bg-indigo-500/10 text-white shadow-sm'
                          : 'border-[#2d3444] bg-[#181c25] text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-[#12151c] border-[#32394a]"
                          checked={isChecked}
                          onChange={event => setForm({
                            ...form,
                            serviceIds: event.target.checked
                              ? [...form.serviceIds, service.id]
                              : form.serviceIds.filter(id => id !== service.id),
                          })}
                        />
                        <span className="font-medium">{service.name}</span>
                      </div>
                      <span className="font-bold font-mono tabular-nums text-sky-400">
                        {formatXof(service.price_xof)}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-3.5 rounded-xl bg-[#181c25] border border-[#2d3444] flex items-center justify-between">
            <span className="text-xs text-slate-300">Total estimé ({form.serviceIds.length} service{form.serviceIds.length > 1 ? 's' : ''}) :</span>
            <span className="text-base font-bold font-mono tabular-nums text-white">
              {formatXof(selectedPriceTotal)}
            </span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#232834]">
            <button
              type="button"
              disabled={busy}
              className={buttonStyles({ variant: 'ghost', size: 'md' })}
              onClick={resetForm}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={busy || !services.length || !form.serviceIds.length}
              className={buttonStyles({ variant: 'primary', size: 'md' })}
            >
              {busy ? 'Enregistrement…' : 'Créer la prestation'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Cancellation is irreversible on the server, so it is confirmed in a
          real dialog: window.confirm is blocked in some embedded browsers and
          cannot be read by a screen reader. */}
      <Modal
        isOpen={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        title="Annuler cette prestation ?"
        description="Le statut passera à « Annulé ». Cette action est définitive et le montant ne comptera plus dans le chiffre d'affaires."
        size="sm"
        footer={
          <>
            <button type="button" className={buttonStyles({ variant: 'ghost', size: 'sm' })} onClick={() => setCancelTarget(null)}>Conserver</button>
            <button
              type="button"
              disabled={busy}
              className={buttonStyles({ variant: 'danger', size: 'sm' })}
              onClick={() => {
                const id = cancelTarget;
                setCancelTarget(null);
                if (id) void runAction(() => transition(id, 'annule'), 'Prestation annulée.');
              }}
            >
              Annuler la prestation
            </button>
          </>
        }
      >
        <p className="text-xs text-slate-400">Vérifiez qu'aucun lavage n'est en cours sur ce véhicule avant de continuer.</p>
      </Modal>

      {receiptOrder && (
        <Suspense fallback={null}>
          <ReceiptModal
            order={receiptOrder}
            stationName={stationName ?? 'Station ServiceLavage'}
            onClose={() => setReceiptOrder(null)}
          />
        </Suspense>
      )}
    </section>
  );
}
