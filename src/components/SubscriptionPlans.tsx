import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { featureDeliveryLabels, planFeatures, type FeatureDelivery } from '../data/planFeatures';

type Subscription = { plan: 'starter' | 'pro' | 'business'; max_stations: number; max_monthly_orders: number; station_count: number; monthly_orders: number };

const deliveryColors: Record<FeatureDelivery, string> = {
  operational: 'text-emerald-300',
  prepared: 'text-cyan-300',
  partial: 'text-amber-300',
  planned: 'text-gray-400',
  service: 'text-purple-300',
};

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
    <p className="text-sm text-gray-400">Un administrateur attribue le plan. Aucun paiement ou changement de plan n’est effectué depuis cette page. Tarifs indicatifs non facturés par l’application.</p>
    <div className="space-y-4">{planFeatures.map(plan => <article key={plan.id} className="rounded-xl border border-[#343b48] bg-[#20242e] p-4 text-sm space-y-2">
      <h3 className="font-bold">{plan.title} {subscription?.plan === plan.id && !error ? '· Actuel' : ''}</h3>
      <p>{plan.id === 'starter' ? '5 000' : plan.id === 'pro' ? '15 000' : '35 000'} FCFA / mois · indicatif</p>
      <p>{plan.stationLimit} station(s) · {plan.monthlyOrderLimit.toLocaleString('fr-FR')} prestations / mois</p>
      <p className="text-gray-400">Cibles issues de l’ancienne offre, non contrôlées par le serveur : {plan.userTarget} utilisateurs · {plan.galleryTarget} photos.</p>
      <ul className="space-y-1 border-t border-[#343b48] pt-2">
        {plan.features.map(feature => <li key={feature.id} className="space-y-0.5">
          <div className="flex justify-between gap-3"><span>{feature.label}</span><span className={`shrink-0 text-right ${deliveryColors[feature.delivery]}`}>{featureDeliveryLabels[feature.delivery]}</span></div>
          {feature.detail && <p className="text-xs text-gray-400">{feature.detail}</p>}
        </li>)}
      </ul>
    </article>)}</div>
    <p className="text-xs text-amber-300">Cette matrice décrit la cible des offres et l’état de livraison, pas un contrôle d’accès complet. Les seules limites serveur préparées sont stations, prestations et écriture d’inventaire. Les migrations d’abonnement, d’inventaire et de rôles ne sont pas déployées sur LavAuto.</p>
  </section>;
}
