export type UserRole = 'proprietaire' | 'gerant' | 'caissier' | 'laveur' | 'super_admin';

export type VehicleCategory = 
  | 'moto'
  | 'taxi_communal'   // Wôrô-wôrô
  | 'taxi_classique'   // Taxi compteur
  | 'particulier'      // Véhicule personnel
  | 'berline'
  | 'suv_4x4'
  | 'pickup'
  | 'minibus'          // Gbaka
  | 'gros_camion'
  | 'autre';

export type WashStatus = 'en_attente' | 'affecte' | 'en_cours' | 'termine' | 'annule';

export type PaymentStatus = 'non_paye' | 'partiellement_paye' | 'paye' | 'rembourse';

export type PaymentMethod = 'especes' | 'wave' | 'orange_money' | 'mtn_momo' | 'moov_money' | 'carte' | 'virement';

export interface StationTenant {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  phone: string;
  email?: string;
  city: string;
  commune: string;
  quarter: string;
  address: string;
  gpsCoordinates?: { lat: number; lng: number };
  description: string;
  openingHours: string;
  subscriptionPlanId: 'starter' | 'pro' | 'business';
  subscriptionStatus: 'active' | 'trial' | 'past_due' | 'expired';
  trialEndsAt: string;
  currency: 'XOF' | 'USD';
  baysCount: number;
}

export interface Customer {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  totalVisits: number;
  totalSpent: number;
  createdAt: string;
}

export interface Vehicle {
  id: string;
  tenantId: string;
  customerId?: string;
  plateNumber: string; // Immatriculation (ex: 2841-HJ-01 ou Reg. CLA-132)
  category: VehicleCategory;
  brand: string;       // ex: Nissan, Toyota, Mazda, Volvo
  model: string;       // ex: Patrol, Rav4, CX-5, XC90
  color: string;
}

export interface WashService {
  id: string;
  tenantId: string;
  code: string;        // ex: 'shine', 'gloss', 'glint', 'complet', 'moteur'
  name: string;
  category: 'Shine' | 'Gloss' | 'Glint' | 'VIP' | 'Special';
  description: string;
  durationMinutes: number;
  basePrice: number;   // en FCFA / XOF
  categoryPrices?: Partial<Record<VehicleCategory, number>>;
  isPublic: boolean;
  isActive: boolean;
}

export interface Employee {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  role: UserRole;
  avatarUrl?: string;
  commissionRate: number; // e.g. 15 for 15%
  status: 'active' | 'inactive' | 'on_break';
  totalWashesCompleted: number;
  totalCommissionsEarned: number;
}

export interface BayStation {
  id: number;
  name: string;
  tenantId: string;
  status: 'operational' | 'out_of_service' | 'maintenance';
  currentOrderId?: string;
  currentVehicleInfo?: string;
  currentVehiclePlate?: string;
  washCategory?: 'Shine' | 'Gloss' | 'Glint' | 'VIP';
  inQueueCount: number;
  avgTimeMinutes: number;
  assignedStaffCount: number;
  washerIds: string[];
  equipmentStatus: 'optimal' | 'low_pressure' | 'service_due';
}

export interface WashOrder {
  id: string;
  tenantId: string;
  ticketNumber: string; // ex: CMD-2026-0842
  vehicleInfo: string;  // ex: WQ1-Mazda
  plateNumber: string;  // ex: Reg. CLA-132
  vehicleCategory: VehicleCategory;
  customerName?: string;
  customerPhone?: string;
  washCategory: 'Shine' | 'Gloss' | 'Glint' | 'VIP' | 'Special';
  serviceIds: string[];
  serviceNames: string[];
  bayArea: number;
  status: WashStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  amount: number;       // total en FCFA (ou $ selon mode)
  discount: number;
  paidAmount: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  assignedStaffIds: string[];
  notes?: string;
  isDelayed?: boolean;
}

export interface CashSession {
  id: string;
  tenantId: string;
  openedAt: string;
  closedAt?: string;
  openedBy: string;
  openingBalance: number;
  cashReceived: number;
  waveReceived: number;
  orangeReceived: number;
  mtnReceived: number;
  moovReceived: number;
  cardReceived: number;
  expensesTotal: number;
  expectedClosingBalance: number;
  actualClosingBalance?: number;
  discrepancy?: number;
  status: 'open' | 'closed';
  notes?: string;
}

export interface ExpenseItem {
  id: string;
  tenantId: string;
  date: string;
  category: 'produits' | 'detergents' | 'eau_electricite' | 'carburant' | 'maintenance' | 'salaire_prime' | 'autre';
  description: string;
  amount: number;
  paymentMethod: PaymentMethod;
  recordedBy: string;
}

export interface InventoryItem {
  id: string;
  tenantId: string;
  name: string;
  category: string;
  quantity: number;
  unit: string; // Litres, Flacons, Pièces, Cartons
  minThreshold: number;
  costPrice: number;
  supplier?: string;
  lastRestocked: string;
}

export interface RecentEvent {
  id: string;
  type: 'bay_service' | 'review' | 'delay' | 'complaint' | 'system';
  title: string;
  description: string;
  timeAgo: string;
  bayArea?: number;
  rating?: number;
}

export interface SubscriptionPlan {
  id: 'starter' | 'pro' | 'business';
  name: string;
  priceMonthXOF: number;
  features: string[];
  maxUsers: number;
  maxBranches: number;
  maxMonthlyOrders: number;
  maxGalleryImages: number;
  hasInventory: boolean;
  hasAdvancedReports: boolean;
  hasMultiBranch: boolean;
  hasPriorityMarketplace: boolean;
}
