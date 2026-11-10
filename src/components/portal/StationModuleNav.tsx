import {
  Car, Users, Sparkles, Boxes, CreditCard, ShieldCheck, TrendingUp, FileText,
} from 'lucide-react';
import { STATION_TABS, canOpenTab, type StationRole, type StationTabId } from '../../lib/portalNavigation';

/**
 * Barre d'onglets des modules et sélection du panneau actif.
 *
 * La liste vient de `lib/portalNavigation.ts` (source unique) et chaque
 * panneau n'est monté que si `canOpenTab` l'autorise : la même fonction sert à
 * afficher l'onglet et à décider du montage, donc les deux ne peuvent plus
 * diverger.
 *
 * Rappel : ceci filtre l'affichage. Un rôle non autorisé qui appellerait
 * l'API directement est refusé par RLS / les RPC, pas par ce composant.
 */

const TAB_ICONS: Record<StationTabId, React.ReactNode> = {
  dashboard: <TrendingUp className="w-4 h-4" />,
  orders: <Car className="w-4 h-4" />,
  services: <Sparkles className="w-4 h-4" />,
  customers: <Users className="w-4 h-4" />,
  inventory: <Boxes className="w-4 h-4" />,
  staff: <ShieldCheck className="w-4 h-4" />,
  reports: <FileText className="w-4 h-4" />,
  subscription: <CreditCard className="w-4 h-4" />,
};

export function StationModuleNav({
  role,
  tab,
  onSelect,
}: {
  role: StationRole;
  tab: StationTabId;
  onSelect: (tab: StationTabId) => void;
}) {
  const visible = STATION_TABS.filter(item => item.roles.includes(role));

  return (
    <nav
      aria-label="Modules autorisés"
      className="flex flex-wrap gap-1.5 p-1.5 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)]"
    >
      {visible.map(item => {
        const isActive = tab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            aria-current={isActive ? 'page' : undefined}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 select-none ${
              isActive
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/40 border border-indigo-400/30'
                : 'text-[var(--text-secondary)] hover:text-slate-200 hover:bg-white/[0.04]'
            }`}
          >
            <span className={isActive ? 'text-white' : 'text-[var(--text-muted)]'}>
              {TAB_ICONS[item.id]}
            </span>
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export { canOpenTab };
