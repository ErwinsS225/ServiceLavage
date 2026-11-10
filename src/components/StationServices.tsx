import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatXof } from '../lib/money';
import { parseServiceInteger } from '../lib/serviceValidation';
import { 
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell, 
  StatusBadge, buttonStyles, formControlStyles, FormField, Modal, Alert, EmptyState 
} from './ui/designSystem';
import { Plus, Sparkles, Clock, Edit2, RotateCw } from 'lucide-react';

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
  const [modalOpen, setModalOpen] = useState(false);
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

  function resetForm() {
    setEditing(null);
    setName('');
    setPrice('');
    setDuration('');
    setActive(true);
    setModalOpen(false);
  }

  function startAdd() {
    setEditing(null);
    setName('');
    setPrice('');
    setDuration('30');
    setActive(true);
    setError('');
    setMessage('');
    setModalOpen(true);
  }

  function startEdit(service: Service) {
    setEditing(service.id);
    setName(service.name);
    setPrice(String(service.price_xof));
    setDuration(String(service.duration_minutes));
    setActive(service.is_active);
    setError('');
    setMessage('');
    setModalOpen(true);
  }

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
      setMessage(editing ? 'Prestation modifiée avec succès.' : 'Nouvelle prestation ajoutée au catalogue.');
      resetForm();
    } catch { setError('Enregistrement impossible. Vérifiez votre connexion et réessayez.'); }
    finally { setBusy(false); }
  }

  return (
    <section className="space-y-5 border-t border-[#232834] pt-6" aria-label="Catalogue de la station">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Catalogue des Prestations</h2>
          <p className="text-xs text-slate-400 mt-0.5">Grille tarifaire et durées paramétrées pour la station active (en FCFA entiers)</p>
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
            onClick={startAdd}
            disabled={loading || busy}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Nouveau service
          </button>
        </div>
      </div>

      {error && (
        <Alert variant="error" action={
          <button type="button" className="underline text-xs font-semibold text-rose-300" onClick={() => setReload(v => v + 1)}>
            Réessayer
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
          Chargement du catalogue…
        </div>
      ) : services.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Prestation</TableHead>
              <TableHead align="right">Tarif (FCFA)</TableHead>
              <TableHead>Durée indicative</TableHead>
              <TableHead align="center">Statut</TableHead>
              <TableHead align="right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.map(service => (
              <TableRow key={service.id}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-xs">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-semibold text-white block">{service.name}</span>
                      <span className="text-[11px] text-slate-400 font-mono">ID: {service.id.slice(0, 8)}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell align="right">
                  <span className="font-bold text-white text-sm font-mono tabular-nums">
                    {formatXof(service.price_xof)}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-300 font-mono">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {service.duration_minutes} min
                  </span>
                </TableCell>
                <TableCell align="center">
                  <StatusBadge
                    status={service.is_active ? 'active' : 'inactive'}
                    size="sm"
                  />
                </TableCell>
                <TableCell align="right">
                  <button
                    type="button"
                    disabled={busy}
                    className={buttonStyles({ variant: 'ghost', size: 'sm' })}
                    onClick={() => startEdit(service)}
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1 text-sky-400" />
                    Modifier
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState
          icon={<Sparkles className="w-6 h-6 text-slate-400" />}
          title="Catalogue vide"
          description="Créez vos prestations de lavage (extérieur, complet, lustrage...) pour alimenter les bons de commande."
          action={
            <button
              type="button"
              className={buttonStyles({ variant: 'primary', size: 'sm' })}
              onClick={startAdd}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Ajouter une prestation
            </button>
          }
        />
      )}

      {/* Service Modal Dialog */}
      <Modal
        isOpen={modalOpen}
        onClose={resetForm}
        title={editing ? 'Modifier la prestation' : 'Ajouter une prestation au catalogue'}
        description="Le tarif en FCFA et la durée seront pris en compte lors de la commande."
      >
        <form onSubmit={save} className="space-y-4">
          <FormField label="Nom du service ou forfait" required>
            <input
              className={formControlStyles.input}
              required
              maxLength={120}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Lavage Complet VIP Berline"
              autoFocus
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Tarif (FCFA)" required hint="Montant entier entre 0 et 100M">
              <input
                className={formControlStyles.input}
                type="number"
                min="0"
                max="100000000"
                step="1"
                required
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="Ex: 5000"
              />
            </FormField>

            <FormField label="Durée estimée (minutes)" required hint="De 1 à 1 440 minutes">
              <input
                className={formControlStyles.input}
                type="number"
                min="1"
                max="1440"
                step="1"
                required
                value={duration}
                onChange={e => setDuration(e.target.value)}
                placeholder="Ex: 35"
              />
            </FormField>
          </div>

          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#181c25] border border-[#2d3444] cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-[#12151c] border-[#32394a]"
              checked={active}
              onChange={e => setActive(e.target.checked)}
            />
            <div>
              <span className="text-xs font-semibold text-white block">Prestation disponible à la commande</span>
              <span className="text-[11px] text-slate-400">Si décoché, le service sera archivé sans supprimer l'historique</span>
            </div>
          </label>

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
              disabled={busy || loading}
              className={buttonStyles({ variant: 'primary', size: 'md' })}
            >
              {busy ? 'Enregistrement…' : editing ? 'Enregistrer les modifications' : 'Ajouter au catalogue'}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
