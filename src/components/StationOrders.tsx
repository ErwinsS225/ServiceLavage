import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatXof } from '../lib/money';
import { listQueuedOrders, saveQueuedOrder, synchronizeOrders, type QueuedOrder } from '../lib/offlineOrders';
import { 
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell, 
  StatusBadge, buttonStyles, formControlStyles, FormField, Modal, Alert, EmptyState, StatCard 
} from './ui/designSystem';
import { Plus, Car, Clock, CheckCircle2, Play, XCircle, RotateCw, Sparkles, FileText } from 'lucide-react';
import type { OrderReceiptData } from './ReceiptModal';
const ReceiptModal = lazy(() => import('./ReceiptModal').then(m => ({ default: m.ReceiptModal })));

type Service = { id: string; name: string; price_xof: number };
type Customer = { id: string; name: string; phone: string };
type Order = { 
  id: string; 
  vehicle_info: string; 
  plate_number: string | null; 
  total_xof: number; 
  status: 'en_attente' | 'en_cours' | 'termine' | 'annule'; 
  created_at: string; 
  station_order_items: { id: string; service_name: string; price_xof: number }[] 
};

type StationRole = 'owner' | 'gerant' | 'caissier' | 'laveur';
type Assignment = { order_id: string; user_id: string };
type Washer = { user_id: string };

export function StationOrders({ 
  stationId, 
  userId, 
  role, 
  roleFeaturesReady,
  stationName,
}: { 
  stationId: string; 
  userId: string; 
  role: StationRole; 
  roleFeaturesReady: boolean;
  /** Printed on the receipt; falls back to the product name only if absent. */
  stationName?: string;
}) {
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
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [washers, setWashers] = useState<Washer[]>([]);
  const [assignTarget, setAssignTarget] = useState<Record<string, string>>({});
  const [cached, setCached] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<OrderReceiptData | null>(null);
  /** Id of the order awaiting cancellation confirmation (replaces window.confirm). */
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const syncing = useRef(false);
  const syncAgain = useRef(false);
  const cacheKey = `servicelavage:order-data:v1:${userId}:${stationId}`;

  function refreshQueue() {
    const queued = listQueuedOrders(localStorage, userId, stationId);
    setPending(queued);
    return queued;
  }

  async function syncQueue() {
    if (role !== 'owner' && role !== 'gerant') return;
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
  }, [stationId, userId, role]);

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
  }, [stationId, userId, reload, role]);

  useEffect(() => {
    if (!roleFeaturesReady || (role !== 'owner' && role !== 'gerant')) {
      setAssignments([]); setWashers([]); return;
    }
    let active = true;
    Promise.all([
      supabase!.from('station_order_assignments').select('order_id,user_id').eq('station_id', stationId),
      supabase!.from('station_memberships').select('user_id').eq('station_id', stationId).eq('role', 'laveur').is('revoked_at', null),
    ]).then(([assignmentResult, washerResult]) => {
      if (!active) return;
      const queryError = assignmentResult.error || washerResult.error;
      if (queryError) setError(`Chargement des affectations impossible : ${queryError.message}`);
      else { setAssignments(assignmentResult.data ?? []); setWashers(washerResult.data ?? []); }
    });
    return () => { active = false; };
  }, [stationId, role, roleFeaturesReady, reload]);

  async function assign(orderId: string, userIdToAssign: string) {
    if (!userIdToAssign) { setError('Sélectionnez un laveur.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      const { error } = await supabase!.rpc('assign_station_order', { p_order_id: orderId, p_user_id: userIdToAssign });
      if (error) setError(`Affectation impossible : ${error.message}`);
      else { setMessage('Prestation affectée.'); setAssignTarget(prev => ({ ...prev, [orderId]: '' })); setReload(value => value + 1); }
    } catch { setError('Affectation impossible.'); }
    finally { setBusy(false); }
  }

  async function unassign(orderId: string, washerId: string) {
    setBusy(true); setError(''); setMessage('');
    try {
      const { error } = await supabase!.rpc('unassign_station_order', { p_order_id: orderId, p_user_id: washerId });
      if (error) setError(`Retrait de l’affectation impossible : ${error.message}`);
      else { setMessage('Affectation retirée.'); setReload(value => value + 1); }
    } catch { setError('Retrait de l’affectation impossible.'); }
    finally { setBusy(false); }
  }

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!vehicle.trim() || selected.length < 1 || selected.length > 20) { setError('Renseignez le véhicule et sélectionnez entre 1 et 20 services.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      const order: QueuedOrder = { version: 1, userId, stationId, requestId: crypto.randomUUID(), customerId: customer || null,
        vehicle: vehicle.trim(), plate: plate.trim() || null, serviceIds: selected, createdAt: new Date().toISOString() };
      saveQueuedOrder(localStorage, order);
      setVehicle(''); setPlate(''); setCustomer(''); setSelected([]);
      setModalOpen(false);
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

  const canManageOrders = role === 'owner' || role === 'gerant';
  const selectedPriceTotal = services.filter(s => selected.includes(s.id)).reduce((sum, s) => sum + s.price_xof, 0);

  // Quick stats summary
  const totalCount = orders.length;
  const inProgressCount = orders.filter(o => o.status === 'en_cours').length;
  const waitingCount = orders.filter(o => o.status === 'en_attente').length;
  const completedCount = orders.filter(o => o.status === 'termine').length;

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
            onClick={() => setReload(v => v + 1)}
            disabled={loading || busy}
          >
            <RotateCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
          {canManageOrders && (
            <button
              type="button"
              className={buttonStyles({ variant: 'primary', size: 'sm' })}
              onClick={() => { setModalOpen(true); setError(''); setMessage(''); }}
              disabled={loading || busy || !services.length}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Nouvelle prestation
            </button>
          )}
        </div>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          title="Total prestations"
          value={totalCount}
          subtext="Enregistrées sur le serveur"
          icon={<Car className="w-4 h-4" />}
        />
        <StatCard
          title="En attente"
          value={waitingCount}
          subtext="En file de lavage"
          icon={<Clock className="w-4 h-4 text-amber-400" />}
        />
        <StatCard
          title="En cours"
          value={inProgressCount}
          subtext="En baie de lavage"
          icon={<Sparkles className="w-4 h-4 text-sky-400" />}
        />
        <StatCard
          title="Terminées"
          value={completedCount}
          subtext="Prêtes à livrer"
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
        />
      </div>

      {/* Banners & Messages */}
      {canManageOrders && pending.length > 0 && (
        <Alert
          variant="warning"
          title={`${pending.length} prestation(s) en attente sur cet appareil`}
          action={
            <button
              type="button"
              className="underline text-xs font-semibold text-amber-200 hover:text-white"
              onClick={() => void syncQueue()}
            >
              Synchroniser
            </button>
          }
        >
          <p className="text-xs">
            La synchronisation est tentée automatiquement au retour du réseau. Tarif serveur appliqué au moment de l’envoi.
          </p>
          <ul className="text-xs mt-1 space-y-0.5 font-mono">
            {pending.map(item => (
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
          <button type="button" className="underline text-xs font-semibold text-rose-300" onClick={() => setReload(v => v + 1)}>
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
                onClick={() => setModalOpen(true)}
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
            {orders.map(o => {
              const orderAssignments = assignments.filter(item => item.order_id === o.id);
              const availableWashers = washers.filter(w => !orderAssignments.some(a => a.user_id === w.user_id));

              return (
                <TableRow key={o.id}>
                  <TableCell>
                    <div className="font-semibold text-white block">{o.vehicle_info}</div>
                    {o.plate_number ? (
                      <span className="inline-block mt-0.5 font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
                        {o.plate_number}
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-500 italic">Sans immatriculation</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <ul className="text-xs space-y-0.5 text-slate-300">
                      {o.station_order_items.map(i => (
                        <li key={i.id} className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                          <span>{i.service_name}</span>
                        </li>
                      ))}
                    </ul>
                  </TableCell>
                  <TableCell align="right">
                    <span className="font-bold text-white text-sm font-mono tabular-nums">
                      {formatXof(o.total_xof)}
                    </span>
                  </TableCell>
                  <TableCell align="center">
                    <StatusBadge status={o.status} size="sm" />
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-slate-400 block tabular-nums">
                      {new Date(o.created_at).toLocaleDateString('fr-FR')}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500 block tabular-nums">
                      {new Date(o.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
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
                              onClick={() => void unassign(o.id, item.user_id)}
                            >
                              Retirer
                            </button>
                          </div>
                        ))}
                        {availableWashers.length > 0 && (
                          <div className="flex gap-1 items-center mt-1">
                            <label className="sr-only" htmlFor={`washer-${o.id}`}>Laveur à affecter</label>
                            <select
                              id={`washer-${o.id}`}
                              className="w-full text-xs rounded bg-[#181c25] border border-[#2d3444] px-1.5 py-1 text-slate-200 outline-none"
                              value={assignTarget[o.id] ?? ''}
                              onChange={event => setAssignTarget(prev => ({ ...prev, [o.id]: event.target.value }))}
                            >
                              <option value="">+ Affecter</option>
                              {availableWashers.map(washer => (
                                <option key={washer.user_id} value={washer.user_id}>
                                  Laveur {washer.user_id.slice(0, 6)}
                                </option>
                              ))}
                            </select>
                            {assignTarget[o.id] && (
                              <button
                                type="button"
                                disabled={busy}
                                className={buttonStyles({ variant: 'primary', size: 'sm', className: 'h-7 px-2 text-xs' })}
                                onClick={() => void assign(o.id, assignTarget[o.id])}
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
                    <div className="flex items-center justify-end gap-1.5">
                      {o.status === 'en_attente' && (
                        <button
                          type="button"
                          disabled={busy}
                          className={buttonStyles({ variant: 'primary', size: 'sm' })}
                          onClick={() => transition(o.id, 'en_cours')}
                        >
                          <Play className="w-3.5 h-3.5 mr-1" />
                          Démarrer
                        </button>
                      )}
                      {o.status === 'en_cours' && (
                        <button
                          type="button"
                          disabled={busy}
                          className={buttonStyles({ variant: 'success', size: 'sm' })}
                          onClick={() => transition(o.id, 'termine')}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          Terminer
                        </button>
                      )}
                      {canManageOrders && (o.status === 'en_attente' || o.status === 'en_cours') && (
                        <button
                          type="button"
                          disabled={busy}
                          className={buttonStyles({ variant: 'danger', size: 'sm' })}
                          onClick={() => setCancelTarget(o.id)}
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" />
                          Annuler
                        </button>
                      )}
                      <button
                        type="button"
                        className={buttonStyles({ variant: 'outline', size: 'sm' })}
                        onClick={() => setReceiptOrder({
                          id: o.id,
                          ticketNumber: `TICK-${o.id.slice(0, 6).toUpperCase()}`,
                          vehicleInfo: o.vehicle_info,
                          plateNumber: o.plate_number,
                          totalXof: o.total_xof,
                          status: o.status,
                          createdAt: o.created_at,
                          items: o.station_order_items?.map(it => ({ name: it.service_name, price: it.price_xof })) || [],
                        })}
                        title="Imprimer ou envoyer le reçu par WhatsApp (PDF)"
                      >
                        <FileText className="w-3.5 h-3.5 mr-1 text-cyan-400" />
                        Reçu
                      </button>
                    </div>
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
        onClose={() => setModalOpen(false)}
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
                value={vehicle}
                onChange={e => setVehicle(e.target.value)}
                placeholder="Ex: Toyota RAV4 Blanc"
                autoFocus
              />
            </FormField>

            <FormField label="Plaque d'immatriculation" hint="Facultatif">
              <input
                className={formControlStyles.input}
                maxLength={40}
                value={plate}
                onChange={e => setPlate(e.target.value)}
                placeholder="Ex: 1234 AB 01"
              />
            </FormField>
          </div>

          <FormField label="Client rattaché" hint="Facultatif — laissez vide pour un client de passage">
            <select
              className={formControlStyles.select}
              value={customer}
              onChange={e => setCustomer(e.target.value)}
            >
              <option value="">Client de passage</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name} · {c.phone}</option>
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
                {services.map(s => {
                  const isChecked = selected.includes(s.id);
                  return (
                    <label
                      key={s.id}
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
                          onChange={e => setSelected(prev => e.target.checked ? [...prev, s.id] : prev.filter(id => id !== s.id))}
                        />
                        <span className="font-medium">{s.name}</span>
                      </div>
                      <span className="font-bold font-mono tabular-nums text-sky-400">
                        {formatXof(s.price_xof)}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-3.5 rounded-xl bg-[#181c25] border border-[#2d3444] flex items-center justify-between">
            <span className="text-xs text-slate-300">Total estimé ({selected.length} service{selected.length > 1 ? 's' : ''}) :</span>
            <span className="text-base font-bold font-mono tabular-nums text-white">
              {formatXof(selectedPriceTotal)}
            </span>
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
              disabled={busy || !services.length || !selected.length}
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
              onClick={() => { const id = cancelTarget; setCancelTarget(null); if (id) void transition(id, 'annule'); }}
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
