// src/config/features.ts

export type SubscriptionPlan = "free" | "premium" | "enterprise";

// Définition étendue des clés de fonctionnalités pour couvrir toute l'application
export type FeatureKey =
  | "dashboard"
  | "pos"
  | "queue"
  | "customers"
  | "bays"
  | "payments"
  | "inventory"
  | "catalogue"
  | "staff"
  | "reports"
  | "notifications"
  | "showcase"
  | "subscriptions"
  | "marketplace"
  | "superadmin"
  | "settings"
  | "help"
  | "export_data";

// Matrice de configuration des fonctionnalités par plan
export const featureConfig: Record<
  SubscriptionPlan,
  Record<FeatureKey, boolean>
> = {
  // Plan gratuit avec fonctionnalités de base
  free: {
    dashboard: true,
    pos: true,
    queue: true,
    customers: true,
    bays: true,
    payments: false, // Limité
    inventory: false, // Limité
    catalogue: true,
    staff: false, // Limité
    reports: false, // Limité
    notifications: true,
    showcase: false, // Non inclus
    subscriptions: true, // Accès pour mise à niveau
    marketplace: false, // Non inclus
    superadmin: false, // Non inclus
    settings: true,
    help: true,
    export_data: false, // Non inclus
  },
  // Plan Premium avec fonctionnalités étendues pour les entreprises en croissance
  premium: {
    dashboard: true,
    pos: true,
    queue: true,
    customers: true,
    bays: true,
    payments: true,
    inventory: true,
    catalogue: true,
    staff: true,
    reports: true,
    notifications: true,
    showcase: true,
    subscriptions: true,
    marketplace: false, // Potentiellement un add-on
    superadmin: false, // Reste une fonction interne
    settings: true,
    help: true,
    export_data: true,
  },
  // Plan Enterprise pour les grandes opérations avec toutes les fonctionnalités
  enterprise: {
    dashboard: true,
    pos: true,
    queue: true,
    customers: true,
    bays: true,
    payments: true,
    inventory: true,
    catalogue: true,
    staff: true,
    reports: true,
    notifications: true,
    showcase: true,
    subscriptions: true,
    marketplace: true,
    superadmin: false, // Sécurisé, jamais exposé au client
    settings: true,
    help: true,
    export_data: true,
  },
};
