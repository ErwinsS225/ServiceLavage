import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell, 
  buttonStyles, formControlStyles, FormField, Modal, Alert, EmptyState 
} from './ui/designSystem';
import { Plus, User, Phone, Edit2, RotateCw } from 'lucide-react';

type Customer = { id: string; name: string; phone: string };

/** The server and RLS, not this component's station filter, enforce access. */
export function StationCustomers({ stationId }: { stationId: string }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
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

  function startAdd() {
    setEditing(null);
    setName('');
    setPhone('');
    setError('');
    setMessage('');
    setModalOpen(true);
  }

  function startEdit(customer: Customer) {
    setEditing(customer.id);
    setName(customer.name);
    setPhone(customer.phone);
    setError('');
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
    if (!cleanName || !cleanPhone) { setError('Le nom et le téléphone sont obligatoires.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      const request = editing
        ? supabase!.from('station_customers').update({ name: cleanName, phone: cleanPhone }).eq('id', editing).eq('station_id', stationId)
        : supabase!.from('station_customers').insert({ station_id: stationId, name: cleanName, phone: cleanPhone });
      const { data, error } = await request.select('id,name,phone').single();
      if (error) { setError(`Enregistrement impossible : ${error.message}`); return; }
      setCustomers(prev => editing ? prev.map(c => c.id === editing ? data : c) : [data, ...prev]);
      closeModal();
      setMessage(editing ? 'Client modifié avec succès.' : 'Nouveau client enregistré.');
    } catch {
      setError('Enregistrement impossible. Vérifiez votre connexion et réessayez.');
    } finally { setBusy(false); }
  }

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
            Nouveau client
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
          Chargement des clients…
        </div>
      ) : customers.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead align="right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map(customer => (
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

      {/* Customer Modal Dialog */}
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
              disabled={busy || loading}
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
