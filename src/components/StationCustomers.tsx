import { useState } from 'react';
import { describeError } from '../lib/queryResult';
import { type CustomerRow, type StationClient } from '../lib/stationApi';
import { useCreateCustomer, useCustomers, useUpdateCustomer } from '../hooks/useStationQueries';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
  buttonStyles, formControlStyles, FormField, Modal, Alert, EmptyState
} from './ui/designSystem';
import { Plus, User, Phone, Edit2, RotateCw } from 'lucide-react';

/**
 * Répertoire clients de la station.
 *
 * Les requêtes (liste, création, mise à jour) vivent dans `lib/stationApi.ts`,
 * leur cache dans TanStack Query via `hooks/useStationQueries`, et ce fichier
 * ne garde que le formulaire et le rendu. Concrètement : revenir sur l'onglet
 * ne relance pas la requête avant 30 s, et une création invalide la clé plutôt
 * que de rafistoler la liste en mémoire.
 *
 * L'isolation multitenant n'est pas assurée ici : elle l'est par RLS sur
 * `station_customers` (le `station_id` passé à PostgREST ne fait que filtrer
 * ce que la politique autorise déjà).
 */
export function StationCustomers({ stationId, client }: { stationId: string; client?: StationClient | null }) {
  const customersQuery = useCustomers(stationId, client);
  const createMutation = useCreateCustomer(stationId, client);
  const updateMutation = useUpdateCustomer(stationId, client);

  // Même contrat qu'avant pour le rendu : `data`, `loading`, `error`, `reload`.
  const customers = {
    data: customersQuery.data ?? [],
    loading: customersQuery.isPending,
    error: customersQuery.error ? describeError(customersQuery.error, 'Impossible de charger les clients.') : '',
    reload: () => { void customersQuery.refetch(); },
  };

  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [message, setMessage] = useState('');

  function startAdd() {
    setEditing(null);
    setName('');
    setPhone('');
    setFormError('');
    setMessage('');
    setModalOpen(true);
  }

  function startEdit(customer: CustomerRow) {
    setEditing(customer.id);
    setName(customer.name);
    setPhone(customer.phone);
    setFormError('');
    setMessage('');
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setName('');
    setPhone('');
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    if (!cleanName || !cleanPhone) {
      setFormError('Le nom et le téléphone sont obligatoires.');
      return;
    }
    setBusy(true);
    setFormError('');
    setMessage('');
    try {
      // La mutation invalide la clé `customers` : la liste relue est celle du
      // serveur, pas une copie locale supposée identique.
      if (editing) {
        await updateMutation.mutateAsync({ customerId: editing, changes: { name: cleanName, phone: cleanPhone } });
      } else {
        await createMutation.mutateAsync({ name: cleanName, phone: cleanPhone });
      }
      closeModal();
      setMessage(editing ? 'Client modifié avec succès.' : 'Nouveau client enregistré.');
    } catch (cause) {
      setFormError(describeError(cause, 'Enregistrement impossible. Vérifiez votre connexion et réessayez.'));
    } finally {
      setBusy(false);
    }
  }

  const error = formError || customers.error;

  return (
    <section className="space-y-5 border-t border-[#232834] pt-6" aria-label="Clients de la station">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Répertoire Clients</h2>
          <p className="text-xs text-slate-400 mt-0.5">Clients enregistrés dans la station active (isolation multitenant Supabase)</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={buttonStyles({ variant: 'outline', size: 'sm' })}
            onClick={() => { setFormError(''); customers.reload(); }}
            disabled={customers.loading || busy}
          >
            <RotateCw className={`w-3.5 h-3.5 mr-1.5 ${customers.loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
          <button
            type="button"
            className={buttonStyles({ variant: 'primary', size: 'sm' })}
            onClick={startAdd}
            disabled={customers.loading || busy}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Nouveau client
          </button>
        </div>
      </div>

      {error && (
        <Alert variant="error" action={
          <button
            type="button"
            className="underline text-xs font-semibold text-rose-300"
            onClick={() => { setFormError(''); customers.reload(); }}
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

      {customers.loading ? (
        <div className="p-8 text-center text-sm text-slate-400 rounded-xl bg-[#141720] border border-[#232834]">
          Chargement des clients…
        </div>
      ) : customers.data.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead align="right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.data.map(customer => (
              <TableRow key={customer.id}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-xs uppercase">
                      {customer.name.slice(0, 2)}
                    </div>
                    <div>
                      <span className="font-semibold text-white block">{customer.name}</span>
                      <span className="text-[11px] text-slate-400 font-mono">ID: {customer.id.slice(0, 8)}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-slate-300 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    {customer.phone}
                  </span>
                </TableCell>
                <TableCell align="right">
                  <button
                    type="button"
                    disabled={busy}
                    className={buttonStyles({ variant: 'ghost', size: 'sm' })}
                    onClick={() => startEdit(customer)}
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
          icon={<User className="w-6 h-6 text-slate-400" />}
          title="Aucun client enregistré"
          description="Enregistrez les coordonnées de vos clients réguliers pour faciliter la création des prestations."
          action={
            <button
              type="button"
              className={buttonStyles({ variant: 'primary', size: 'sm' })}
              onClick={startAdd}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Ajouter un premier client
            </button>
          }
        />
      )}

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editing ? 'Modifier le client' : 'Ajouter un nouveau client'}
        description="Les coordonnées sont protégées et isolées par station."
      >
        <form onSubmit={save} className="space-y-4">
          <FormField label="Nom complet ou raison sociale" required>
            <input
              className={formControlStyles.input}
              required
              maxLength={120}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Jean Kouassi"
              autoFocus
            />
          </FormField>

          <FormField label="Numéro de téléphone" required hint="Format recommandé : +225 07..." >
            <input
              className={formControlStyles.input}
              type="tel"
              required
              maxLength={40}
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="Ex: +225 07 00 00 00 00"
            />
          </FormField>

          {formError && <Alert variant="error">{formError}</Alert>}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#232834]">
            <button
              type="button"
              disabled={busy}
              className={buttonStyles({ variant: 'ghost', size: 'md' })}
              onClick={closeModal}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={busy || customers.loading}
              className={buttonStyles({ variant: 'primary', size: 'md' })}
            >
              {busy ? 'Enregistrement…' : editing ? 'Enregistrer les modifications' : 'Créer la fiche client'}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
