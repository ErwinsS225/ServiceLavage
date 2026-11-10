import { useCallback, useState } from 'react';
import { formatXof } from '../lib/money';
import { describeError } from '../lib/queryResult';
import { parseForm, serviceSchema } from '../lib/schemas';
import { errorText } from '../lib/errorMessages';
import { useToastActions } from '../context/ToastContext';
import { type ServiceInput, type ServiceRow, type StationClient } from '../lib/stationApi';
import { useCreateService, useServices, useUpdateService } from '../hooks/useStationQueries';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
  StatusBadge, buttonStyles, formControlStyles, FormField, Modal, Alert, EmptyState
} from './ui/designSystem';
import { Plus, Sparkles, Clock, Edit2, RotateCw } from 'lucide-react';

/**
 * Catalogue de la station.
 *
 * Trois choses seulement : tenir le formulaire, déclencher les mutations et
 * rendre. Les requêtes vivent dans `lib/stationApi.ts`, leur cache dans
 * `hooks/useStationQueries.ts`, la validation numérique dans
 * `lib/serviceValidation.ts` — donc testables sans DOM.
 *
 * Les droits ne sont pas décidés ici : `station_services` est protégée par RLS
 * (propriétaire et gérant en écriture) et le panneau n'est monté que pour ces
 * rôles. Un appel direct hors rôle est refusé par PostgreSQL, pas par React.
 */
export function StationServices({ stationId, client }: { stationId: string; client?: StationClient | null }) {
  const servicesQuery = useServices(stationId, client);
  const createMutation = useCreateService(stationId, client);
  const updateMutation = useUpdateService(stationId, client);

  // Même contrat de rendu qu'avant : `data`, `loading`, `error`, `reload`.
  const services = {
    data: servicesQuery.data ?? [],
    loading: servicesQuery.isPending,
    error: servicesQuery.error ? describeError(servicesQuery.error, 'Impossible de charger le catalogue.') : '',
    reload: () => { void servicesQuery.refetch(); },
  };

  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');
  const [active, setActive] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const toast = useToastActions();

  const resetForm = useCallback(() => {
    setEditing(null);
    setName('');
    setPrice('');
    setDuration('');
    setActive(true);
    setFieldErrors({});
    setModalOpen(false);
  }, []);

  function startAdd() {
    setEditing(null);
    setName('');
    setPrice('');
    setDuration('30');
    setActive(true);
    setFormError('');
    setFieldErrors({});
    setMessage('');
    setModalOpen(true);
  }

  function startEdit(service: ServiceRow) {
    setEditing(service.id);
    setName(service.name);
    setPrice(String(service.price_xof));
    setDuration(String(service.duration_minutes));
    setActive(service.is_active);
    setFormError('');
    setFieldErrors({});
    setMessage('');
    setModalOpen(true);
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Bornes de `station_services` : nom 1..120, prix 0..100 000 000,
    // durée 1..1440. Le message nomme désormais le champ fautif.
    const parsed = parseForm(serviceSchema, {
      name,
      price_xof: price,
      duration_minutes: duration,
      is_active: active,
    });
    if (!parsed.ok) {
      setFieldErrors(parsed.errors);
      setFormError(Object.values(parsed.errors)[0] ?? '');
      return;
    }
    const input: ServiceInput = parsed.data;
    setBusy(true);
    setFormError('');
    setFieldErrors({});
    setMessage('');
    try {
      // La mutation invalide la clé `services` : la liste relue vient du
      // serveur, pas d'une copie locale supposée identique.
      if (editing) {
        await updateMutation.mutateAsync({ serviceId: editing, changes: input });
      } else {
        await createMutation.mutateAsync(input);
      }
      const wasEditing = editing !== null;
      setMessage(wasEditing ? 'Prestation modifiée avec succès.' : 'Nouvelle prestation ajoutée au catalogue.');
      toast.success(wasEditing ? 'Prestation modifiée.' : 'Prestation ajoutée au catalogue.', input.name);
      resetForm();
    } catch (cause) {
      setFormError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  const error = formError || services.error;

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
            onClick={() => { setFormError(''); services.reload(); }}
            disabled={services.loading || busy}
          >
            <RotateCw className={`w-3.5 h-3.5 mr-1.5 ${services.loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
          <button
            type="button"
            className={buttonStyles({ variant: 'primary', size: 'sm' })}
            onClick={startAdd}
            disabled={services.loading || busy}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Nouveau service
          </button>
        </div>
      </div>

      {error && (
        <Alert variant="error" action={
          <button
            type="button"
            className="underline text-xs font-semibold text-rose-300"
            onClick={() => { setFormError(''); services.reload(); }}
          >
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

      {services.loading ? (
        <div className="p-8 text-center text-sm text-slate-400 rounded-xl bg-[#141720] border border-[#232834]">
          Chargement du catalogue…
        </div>
      ) : services.data.length ? (
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
            {services.data.map(service => (
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
                  <StatusBadge status={service.is_active ? 'active' : 'inactive'} size="sm" />
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
          description="Ajoutez vos prestations (lavage simple, intérieur, cire…) pour pouvoir les proposer lors de la création d’une prestation."
          action={
            <button
              type="button"
              className={buttonStyles({ variant: 'primary', size: 'sm' })}
              onClick={startAdd}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Ajouter une première prestation
            </button>
          }
        />
      )}

      <Modal
        isOpen={modalOpen}
        onClose={resetForm}
        title={editing ? 'Modifier la prestation' : 'Ajouter une prestation'}
        description="Le tarif est figé au moment de la création d’une prestation : le modifier ici ne change pas les prestations déjà enregistrées."
      >
        <form onSubmit={save} className="space-y-4">
          <FormField
            label="Nom de la prestation"
            required
            htmlFor="service-name"
            error={fieldErrors.name}
          >
            <input
              id="service-name"
              className={formControlStyles.input}
              aria-invalid={fieldErrors.name ? true : undefined}
              required
              maxLength={120}
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="Ex: Lavage extérieur + intérieur"
              autoFocus
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="Tarif (FCFA)"
              required
              hint="Nombre entier, sans espace"
              htmlFor="service-price"
              error={fieldErrors.price_xof}
            >
              <input
                id="service-price"
                className={formControlStyles.input}
                aria-invalid={fieldErrors.price_xof ? true : undefined}
                required
                inputMode="numeric"
                value={price}
                onChange={event => setPrice(event.target.value)}
                placeholder="Ex: 5000"
              />
            </FormField>
            <FormField
              label="Durée indicative (minutes)"
              required
              htmlFor="service-duration"
              error={fieldErrors.duration_minutes}
            >
              <input
                id="service-duration"
                className={formControlStyles.input}
                aria-invalid={fieldErrors.duration_minutes ? true : undefined}
                required
                inputMode="numeric"
                value={duration}
                onChange={event => setDuration(event.target.value)}
                placeholder="Ex: 30"
              />
            </FormField>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-[#12151c] border-[#32394a]"
              checked={active}
              onChange={event => setActive(event.target.checked)}
            />
            Prestation active (proposée à la création d’une prestation)
          </label>

          {formError && <Alert variant="error">{formError}</Alert>}

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
              disabled={busy || services.loading}
              className={buttonStyles({ variant: 'primary', size: 'md' })}
            >
              {busy ? 'Enregistrement…' : editing ? 'Enregistrer les modifications' : 'Créer la prestation'}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
