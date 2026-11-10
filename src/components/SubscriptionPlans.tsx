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
  return <section className="space-y-5 border-t border-[#232834] pt-6" aria-label="Abonnements">
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-lg font-bold text-white tracking-tight">Formules et abonnements</h2>
        <p className="text-xs text-slate-400 mt-0.5">Offres SaaS pour les stations du réseau ServiceLavage CI</p>
      </div>
      {subscription && (
        <span className="text-xs px-3 py-1 font-mono uppercase tracking-wider rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/25">
          Plan actif : {subscription.plan}
        </span>
      )}
    </div>

    {loading ? (
      <div className="p-8 text-center text-sm text-slate-400 rounded-xl bg-[#141720] border border-[#232834]">
        Chargement du plan…
      </div>
    ) : error ? (
      <div role="alert" className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-sm text-amber-300 flex items-center justify-between gap-3">
        <span>{error}</span>
        <button type="button" className="text-xs underline font-semibold text-amber-200 hover:text-white" onClick={() => setReload(v => v + 1)}>
          Réessayer
        </button>
      </div>
    ) : subscription && (
      <div role="status" className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl border border-[#262c3a] bg-[#141720]">
        <div className="space-y-1">
          <p className="text-xs text-slate-400">Formule actuelle</p>
          <p className="text-lg font-bold uppercase text-white font-mono">{subscription.plan}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-slate-400">Stations autorisées</p>
          <p className="text-lg font-bold font-mono tabular-nums text-white">
            {subscription.station_count} <span className="text-xs text-slate-500 font-normal">/ {subscription.max_stations}</span>
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-slate-400">Prestations ce mois</p>
          <p className="text-lg font-bold font-mono tabular-nums text-white">
            {subscription.monthly_orders} <span className="text-xs text-slate-500 font-normal">/ {subscription.max_monthly_orders}</span>
          </p>
        </div>
      </div>
    )}

    <p className="text-xs text-slate-400 leading-relaxed">
      Un administrateur attribue le plan. Aucun paiement ou changement de plan n’est effectué depuis cette page. Tarifs indicatifs non facturés par l’application.
    </p>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {planFeatures.map(plan => {
        const isCurrent = subscription?.plan === plan.id && !error;
        return (
          <article
            key={plan.id}
            className={`rounded-2xl border p-5 flex flex-col justify-between transition-all ${
              isCurrent
                ? 'border-indigo-500/50 bg-[#161a25] shadow-lg shadow-indigo-950/30'
                : 'border-[#232834] bg-[#12151c]'
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold text-white text-base">{plan.title}</h3>
                {isCurrent && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Actuel
                  </span>
                )}
              </div>
              <div>
                <span className="text-2xl font-bold font-mono tabular-nums text-white">
                  {plan.id === 'starter' ? '5 000' : plan.id === 'pro' ? '15 000' : '35 000'}
                </span>
                <span className="text-xs text-slate-400 ml-1.5 font-sans">FCFA / mois</span>
              </div>
              <p className="text-xs text-slate-300 font-medium">
                {plan.stationLimit} station(s) · {plan.monthlyOrderLimit.toLocaleString('fr-FR')} prestations / mois
              </p>
              <p className="text-[11px] text-slate-500">
                Cibles issues de l’ancienne offre, non contrôlées par le serveur : {plan.userTarget} utilisateurs · {plan.galleryTarget} photos.
              </p>
              <ul className="space-y-1.5 border-t border-[#1f2430] pt-3 text-xs">
                {plan.features.map(feature => (
                  <li key={feature.id} className="space-y-0.5">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-slate-300">{feature.label}</span>
                      <span className={`shrink-0 text-right font-medium text-[11px] ${deliveryColors[feature.delivery]}`}>
                        {featureDeliveryLabels[feature.delivery]}
                      </span>
                    </div>
                    {feature.detail && <p className="text-[10px] text-slate-500">{feature.detail}</p>}
                  </li>
                ))}
              </ul>
            </div>
          </article>
        );
      })}
    </div>

    <p className="text-xs text-amber-300/90 leading-relaxed border-t border-[#232834] pt-4">
      Cette matrice décrit la cible des offres et l’état de livraison, pas un contrôle d’accès complet. Les seules limites serveur préparées sont stations, prestations et écriture d’inventaire. Les migrations d’abonnement, d’inventaire et de rôles sont prêtes pour le déploiement sur les instances ServiceLavage.
    </p>
  </section>;
}
