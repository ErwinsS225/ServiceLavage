export type FeatureDelivery = 'operational' | 'prepared' | 'partial' | 'planned' | 'service';

export type PlanFeature = {
  id: string;
  label: string;
  delivery: FeatureDelivery;
  detail?: string;
};

export type PlanFeatureSet = {
  id: 'starter' | 'pro' | 'business';
  title: string;
  stationLimit: number;
  monthlyOrderLimit: number;
  userTarget: number;
  galleryTarget: number;
  features: readonly PlanFeature[];
};

const starter: readonly PlanFeature[] = [
  { id: 'orders', label: 'Gestion des prestations', delivery: 'operational' },
  { id: 'tickets', label: 'Tickets imprimables', delivery: 'planned', detail: 'Les anciennes maquettes ne sont pas reliées au portail actif.' },
  { id: 'catalogue', label: 'Catalogue de services personnalisable', delivery: 'operational' },
  { id: 'customers', label: 'Gestion des clients', delivery: 'operational' },
  { id: 'vehicles', label: 'Fiches véhicules et historique client', delivery: 'partial', detail: 'Véhicule et plaque sont rattachés aux prestations, sans registre véhicule.' },
  { id: 'cash', label: 'Caisse journalière et paiements', delivery: 'planned' },
  { id: 'reports-basic', label: 'Rapports essentiels', delivery: 'planned' },
  { id: 'staff-basic', label: 'Gestion basique du personnel', delivery: 'planned' },
  { id: 'showcase-basic', label: 'Vitrine commerciale simple', delivery: 'planned' },
];

const proAdditions: readonly PlanFeature[] = [
  { id: 'staff-commissions', label: 'Personnel avancé et commissions', delivery: 'planned' },
  { id: 'inventory-alerts', label: 'Stocks, inventaire et seuils d’alerte', delivery: 'prepared', detail: 'Interface et RPC côté code ; migration non déployée sur LavAuto.' },
  { id: 'reports-export', label: 'Rapports détaillés avec export PDF / Excel', delivery: 'planned' },
  { id: 'bays-live', label: 'Suivi en temps réel des pistes', delivery: 'planned' },
  { id: 'showcase-gallery', label: 'Vitrine enrichie avec galerie photo', delivery: 'planned' },
  { id: 'whatsapp-booking', label: 'Lien WhatsApp pour demandes de rendez-vous', delivery: 'planned' },
];

const businessAdditions: readonly PlanFeature[] = [
  { id: 'reports-consolidated', label: 'Consolidation des rapports multi-stations', delivery: 'planned' },
  { id: 'roles-advanced', label: 'Permissions avancées et rôles stricts', delivery: 'prepared', detail: 'Modèle SQL local uniquement ; migration non déployée et aucun écran métier.' },
  { id: 'showcase-per-site', label: 'Vitrines personnalisées par station', delivery: 'planned' },
  { id: 'marketplace-priority', label: 'Visibilité prioritaire sur la Marketplace CI', delivery: 'planned' },
  { id: 'offline-resilient', label: 'Synchronisation hors ligne automatique et résiliente', delivery: 'partial', detail: 'Seules les prestations sont mises en file ; reprise à l’ouverture du module/retour réseau, pas de replay arrière-plan. Aucun paiement hors ligne.' },
  { id: 'support-backup', label: 'Assistance 24/7 et sauvegarde cloud dédiées', delivery: 'service', detail: 'Nécessite une organisation de support et une politique d’exploitation/sauvegarde, pas uniquement du code client.' },
];

export const planFeatures: readonly PlanFeatureSet[] = [
  {
    id: 'starter', title: 'Starter', stationLimit: 1, monthlyOrderLimit: 500,
    userTarget: 2, galleryTarget: 5, features: starter,
  },
  {
    id: 'pro', title: 'Pro', stationLimit: 2, monthlyOrderLimit: 2500,
    userTarget: 8, galleryTarget: 20, features: [...starter, ...proAdditions],
  },
  {
    id: 'business', title: 'Business', stationLimit: 10, monthlyOrderLimit: 10000,
    userTarget: 50, galleryTarget: 100, features: [...starter, ...proAdditions, ...businessAdditions],
  },
];

export const featureDeliveryLabels: Record<FeatureDelivery, string> = {
  operational: 'Opérationnel dans le portail',
  prepared: 'Code prêt, migration non déployée',
  partial: 'Partiel',
  planned: 'À développer',
  service: 'Service opérationnel à organiser',
};
