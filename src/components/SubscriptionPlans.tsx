import { featureDeliveryLabels, planFeatures, SERVER_LIMITS, UNCONTROLLED_LIMITS, type FeatureDelivery } from '../data/planFeatures';
import { useSubscription } from '../hooks/useSubscription';
import { quotaUsage } from '../lib/stationApi';
import { formatXof } from '../lib/money';
import { Alert } from './ui/designSystem';

const deliveryColors: Record<FeatureDelivery, string> = {
  operational: 'text-emerald-300',
  prepared: 'text-cyan-300',
  partial: 'text-amber-300',
  planned: 'text-gray-400',
  service: 'text-purple-300',
};

const PLAN_LABELS = { starter: 'Starter', pro: 'Pro', business: 'Business' } as const;

/**
 * Formules et abonnements — lecture seule.
 *
 * Aucun paiement, aucun changement de formule : un administrateur attribue le
 * plan, cette page l'affiche. Les montants sont des tarifs indicatifs, jamais
 * une facturation — l'application n'encaisse rien.
 *
 * Les compteurs (stations, prestations du mois) viennent de la RPC
 * `my_subscription()`, qui les calcule côté serveur. Rien n'est additionné
 * depuis les données déjà chargées dans le navigateur : un quota affiché faux
 * ferait croire à une marge de manœuvre qui n'existe pas.
 */
export function SubscriptionPlans() {
  const { subscription, loading, error, reload } = useSubscription();

  return (
    <section className="space-y-5 border-t border-[#232834] pt-6" aria-label="Abonnements">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Formules et abonnements</h2>
          <p className="text-xs text-slate-400 mt-0.5">Offres SaaS et plafonds réellement appliqués par le serveur</p>
        </div>
        {subscription && (
          <span className="shrink-0 text-xs px-3 py-1 font-mono uppercase tracking-wider rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/25">
            Plan actif : {PLAN_LABELS[subscription.plan] ?? subscription.plan}
          </span>
        )}
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-slate-400 rounded-xl bg-[#141720] border border-[#232834]">
          Chargement de la formule…
        </div>
      ) : error ? (
        <Alert
          variant="error"
          action={
            <button type="button" className="underline text-xs font-semibold text-rose-300" onClick={reload}>
              Réessayer
            </button>
          }
        >
          {error}
        </Alert>
      ) : subscription ? (
        <div role="status" className="space-y-4 p-4 rounded-xl border border-[#262c3a] bg-[#141720]">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <p className="text-xs text-slate-400">Formule actuelle</p>
              <p className="text-lg font-bold uppercase text-white font-mono">{subscription.plan}</p>
            </div>
            <QuotaGauge
              label="Stations autorisées"
              used={subscription.station_count}
              limit={subscription.max_stations}
              mechanism={SERVER_LIMITS.stations.mechanism}
            />
            <QuotaGauge
              label="Prestations ce mois"
              used={subscription.monthly_orders}
              limit={subscription.max_monthly_orders}
              mechanism={SERVER_LIMITS.monthlyOrders.mechanism}
            />
          </div>
          <p className="text-[11px] text-slate-500 border-t border-[#232834] pt-3">
            Compteurs calculés par la fonction <code className="font-mono">my_subscription()</code> : stations rattachées à votre compte
            (toutes formules) et prestations créées depuis le 1<sup>er</sup> du mois en cours (UTC). Aucune valeur n’est estimée.
          </p>
        </div>
      ) : null}

      <Alert variant="info" title="Ce que l’application ne fait pas">
        Aucun paiement, aucun changement de formule et aucune facturation depuis cette page. Les tarifs ci-dessous sont indicatifs :
        un administrateur attribue la formule, l’application ne prélève rien.
      </Alert>

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
                    {formatXof(plan.monthlyPriceXof)}
                  </span>
                  <span className="text-xs text-slate-400 ml-1.5 font-sans">/ mois, indicatif</span>
                </div>

                {/* Only the limits the database actually enforces are stated
                    as limits. Everything else is labelled as a target. */}
                <ul className="space-y-1 text-xs text-slate-300 border-t border-[#1f2430] pt-3">
                  <li className="flex justify-between gap-2">
                    <span>{SERVER_LIMITS.stations.label}</span>
                    <span className="font-mono tabular-nums text-white">{plan.stationLimit}</span>
                  </li>
                  <li className="flex justify-between gap-2">
                    <span>{SERVER_LIMITS.monthlyOrders.label}</span>
                    <span className="font-mono tabular-nums text-white">{plan.monthlyOrderLimit.toLocaleString('fr-FR')}</span>
                  </li>
                </ul>
                <p className="text-[11px] text-slate-500">
                  Cible non contrôlée par le serveur : {plan.userTarget} utilisateurs · {plan.galleryTarget} photos.
                  Ces deux chiffres sont un objectif commercial, pas un plafond appliqué.
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

      <div className="text-xs text-amber-300/90 leading-relaxed border-t border-[#232834] pt-4 space-y-1.5">
        <p>
          Plafonds appliqués aujourd’hui par la base de données : {SERVER_LIMITS.stations.label.toLowerCase()},
          {' '}{SERVER_LIMITS.monthlyOrders.label.toLowerCase()} et {SERVER_LIMITS.inventory.label.toLowerCase()}
          {' '}({SERVER_LIMITS.inventory.mechanism}).
        </p>
        <p>
          Aucun contrôle serveur pour : {UNCONTROLLED_LIMITS.join(', ').toLowerCase()}.
        </p>
        <p>
          Cette matrice décrit la cible des offres et l’état de livraison, pas un contrôle d’accès complet. Les plafonds cités sont
          ceux du schéma déployé sur la base connectée ; l’écran n’en vérifie pas la version à l’exécution.
        </p>
      </div>
    </section>
  );
}

/** Compteur de quota : une barre et deux nombres mesurés, jamais un pourcentage inventé. */
function QuotaGauge({
  label,
  used,
  limit,
  mechanism,
}: {
  label: string;
  used: number;
  limit: number;
  mechanism: string;
}) {
  const usage = quotaUsage(used, limit);
  const saturated = usage !== null && usage >= 100;

  return (
    <div className="space-y-1">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-lg font-bold font-mono tabular-nums text-white">
        {used} <span className="text-xs text-slate-500 font-normal">/ {limit}</span>
      </p>
      {usage !== null && (
        <div
          className="h-1.5 rounded-full bg-slate-800 overflow-hidden"
          role="img"
          aria-label={`${used} sur ${limit} utilisés (${usage} %)`}
        >
          <div
            className={`h-full rounded-full ${saturated ? 'bg-rose-500' : 'bg-indigo-500'}`}
            style={{ width: `${usage}%` }}
          />
        </div>
      )}
      <p className="text-[10px] text-slate-500">{saturated ? 'Plafond atteint : toute création sera refusée par le serveur.' : mechanism}</p>
    </div>
  );
}
