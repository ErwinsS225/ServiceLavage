import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type Subscription = { plan: 'starter' | 'pro' | 'business'; max_stations: number; max_monthly_orders: number; station_count: number; monthly_orders: number };
const plans = [
  { id: 'starter', name: 'Starter', price: '5 000', stations: 1, orders: '500', users: 2, photos: 5 },
  { id: 'pro', name: 'Pro', price: '15 000', stations: 2, orders: '2 500', users: 8, photos: 20 },
  { id: 'business', name: 'Business', price: '35 000', stations: 10, orders: '10 000', users: 50, photos: 100 },
] as const;

export function SubscriptionPlans() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    Promise.resolve(supabase!.rpc('my_subscription')).then(({ data, error }) => {
      if (!active) return;
      if (error || !data?.length) setError('Impossible de charger le plan. Vérifiez la connexion et la migration Supabase.');
      else setSubscription(data[0] as Subscription);
      setLoading(false);
    }).catch(() => { if (active) { setError('Impossible de charger le plan.'); setLoading(false); } });
    return () => { active = false; };
  }, [reload]);
  return <section className="space-y-4 border-t border-[#303640] pt-5" aria-label="Abonnements">
    <h2 className="font-bold">Abonnements</h2>
    {loading ? <p>Chargement du plan…</p> : error ? <p role="alert" className="text-sm text-amber-300">{error} <button type="button" className="underline" onClick={() => setReload(v => v + 1)}>Réessayer</button></p> : subscription && <div role="status" className="rounded-xl bg-[#20242e] p-4 text-sm">
      <strong>Plan actuel : {subscription.plan.toUpperCase()}</strong>
      <p>Stations : {subscription.station_count} / {subscription.max_stations}</p>
      <p>Prestations ce mois (UTC) : {subscription.monthly_orders} / {subscription.max_monthly_orders}</p>
    </div>}
    <p className="text-sm text-gray-400">Un administrateur attribue le plan. Aucun paiement ou changement de plan n’est effectué depuis cette page. Prix indicatifs, non facturés par l’application.</p>
    <div className="space-y-3">{plans.map(plan => <article key={plan.id} className="rounded-xl border border-[#343b48] bg-[#20242e] p-4 text-sm space-y-1">
      <h3 className="font-bold">{plan.name} {subscription?.plan === plan.id && !error ? '· Actuel' : ''}</h3>
      <p>{plan.price} FCFA / mois · tarif indicatif</p>
      <p>{plan.stations} station(s) · {plan.orders} prestations / mois</p>
      <p className="text-gray-400">Cible non encore appliquée : {plan.users} utilisateurs et {plan.photos} photos.</p>
    </article>)}</div>
    <p className="text-xs text-amber-300">Seules les limites de stations et prestations sont prévues dans la migration. Paiements, rôles, galerie, stocks, rapports et autres avantages ne sont pas encore activés.</p>
  </section>;
}
