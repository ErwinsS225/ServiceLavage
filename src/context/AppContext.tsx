import { formatXof } from '../lib/money';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { featureConfig, FeatureKey, SubscriptionPlan as AppSubscriptionPlan } from '../config/features';
import {
  StationTenant,
  WashOrder,
  BayStation,
  Employee,
  WashService,
  Customer,
  RecentEvent,
  SubscriptionPlan,
  InventoryItem,
  ExpenseItem,
  CashSession,
  UserRole,
  WashStatus,
  PaymentStatus,
  PaymentMethod
} from '../types';
import {
  INITIAL_TENANTS,
  INITIAL_SERVICES,
  INITIAL_BAYS,
  INITIAL_ORDERS,
  INITIAL_EVENTS,
  INITIAL_EMPLOYEES,
  INITIAL_CUSTOMERS,
  INITIAL_INVENTORY,
  INITIAL_EXPENSES,
  SUBSCRIPTION_PLANS,
} from '../data/mockData';

interface AppContextType {
  tenants: StationTenant[];
  currentTenant: StationTenant;
  setCurrentTenantId: (id: string) => void;
  updateCurrentTenant: (updates: Partial<StationTenant>) => void;

  currentUserRole: UserRole;
  setCurrentUserRole: (role: UserRole) => void;

  currentUserPlan: AppSubscriptionPlan;
  hasAccess: (feature: FeatureKey) => boolean;

  isDarkMode: boolean;
  toggleDarkMode: () => void;

  currency: 'USD' | 'XOF';
  setCurrency: (c: 'USD' | 'XOF') => void;
  formatCurrency: (amount: number) => string;

  activeTab: string;
  setActiveTab: (tab: string) => void;

  searchQuery: string;
  setSearchQuery: (q: string) => void;

  orders: WashOrder[];
  addOrder: (order: Omit<WashOrder, 'id' | 'ticketNumber' | 'createdAt'>) => WashOrder;
  updateOrderStatus: (id: string, status: WashStatus) => void;
  updatePaymentStatus: (id: string, paymentStatus: PaymentStatus, method?: PaymentMethod) => void;

  bays: BayStation[];
  refreshBay: (bayId: number) => void;
  updateBayStatus: (bayId: number, status: 'operational' | 'out_of_service' | 'maintenance') => void;

  services: WashService[];
  addService: (service: Omit<WashService, 'id'>) => void;
  updateService: (id: string, updates: Partial<WashService>) => void;

  employees: Employee[];
  addEmployee: (emp: Omit<Employee, 'id' | 'totalWashesCompleted' | 'totalCommissionsEarned'>) => void;

  customers: Customer[];
  addCustomer: (cust: Omit<Customer, 'id' | 'totalVisits' | 'totalSpent' | 'createdAt'>) => void;

  inventory: InventoryItem[];
  addInventoryItem: (item: Omit<InventoryItem, 'id' | 'lastRestocked'>) => void;
  updateInventoryStock: (id: string, newQuantity: number) => void;

  expenses: ExpenseItem[];
  addExpense: (expense: Omit<ExpenseItem, 'id' | 'date'>) => void;

  recentEvents: RecentEvent[];
  addRecentEvent: (event: Omit<RecentEvent, 'id' | 'timeAgo'>) => void;

  subscriptionPlans: SubscriptionPlan[];
  upgradePlan: (planId: 'starter' | 'pro' | 'business') => void;

  cashSession: CashSession;
  closeCashSession: (actualCash: number, notes?: string) => void;
  openCashSession: (openingBalance: number) => void;

  // Offline resilience
  isOfflineMode: boolean;
  toggleOfflineMode: () => void;
  offlineQueueCount: number;
  syncOfflineQueue: () => void;

  // Modals
  isNewOrderModalOpen: boolean;
  setIsNewOrderModalOpen: (open: boolean) => void;
  selectedOrderForTicket: WashOrder | null;
  setSelectedOrderForTicket: (order: WashOrder | null) => void;
  selectedOrderForDetail: WashOrder | null;
  setSelectedOrderForDetail: (order: WashOrder | null) => void;
  isOnboardingOpen: boolean;
  setIsOnboardingOpen: (open: boolean) => void;

  // Notification banner
  bannerMessage: { type: 'success' | 'info' | 'warning'; text: string } | null;
  showBanner: (text: string, type?: 'success' | 'info' | 'warning') => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);


export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tenants, setTenants] = useState<StationTenant[]>(() => {
    const saved = localStorage.getItem('cleanit_tenants');
    return saved ? JSON.parse(saved) : INITIAL_TENANTS;
  });

  const [currentTenantId, setCurrentTenantId] = useState<string>(() => {
    return localStorage.getItem('cleanit_current_tenant_id') || 'tenant-1';
  });

  const [currentUserRole, setCurrentUserRole] = useState<UserRole>('proprietaire');
  const [currentUserPlan, setCurrentUserPlan] = useState<AppSubscriptionPlan>('premium');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [currency, setCurrency] = useState<'USD' | 'XOF'>('XOF');
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [orders, setOrders] = useState<WashOrder[]>(() => {
    const saved = localStorage.getItem('cleanit_orders');
    return saved ? JSON.parse(saved) : INITIAL_ORDERS;
  });

  const [bays, setBays] = useState<BayStation[]>(() => {
    const saved = localStorage.getItem('cleanit_bays');
    return saved ? JSON.parse(saved) : INITIAL_BAYS;
  });

  const [services, setServices] = useState<WashService[]>(() => {
    const saved = localStorage.getItem('cleanit_services');
    return saved ? JSON.parse(saved) : INITIAL_SERVICES;
  });

  const [employees, setEmployees] = useState<Employee[]>(() => {
    const saved = localStorage.getItem('cleanit_employees');
    return saved ? JSON.parse(saved) : INITIAL_EMPLOYEES;
  });

  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem('cleanit_customers');
    return saved ? JSON.parse(saved) : INITIAL_CUSTOMERS;
  });

  const [inventory, setInventory] = useState<InventoryItem[]>(() => {
    const saved = localStorage.getItem('cleanit_inventory');
    return saved ? JSON.parse(saved) : INITIAL_INVENTORY;
  });

  const [expenses, setExpenses] = useState<ExpenseItem[]>(() => {
    const saved = localStorage.getItem('cleanit_expenses');
    return saved ? JSON.parse(saved) : INITIAL_EXPENSES;
  });

  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>(INITIAL_EVENTS);
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(0);

  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState<boolean>(false);
  const [selectedOrderForTicket, setSelectedOrderForTicket] = useState<WashOrder | null>(null);
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<WashOrder | null>(null);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);
  const [bannerMessage, setBannerMessage] = useState<{ type: 'success' | 'info' | 'warning'; text: string } | null>(null);

  // Real browser online/offline listener
  useEffect(() => {
    const handleOnline = () => {
      setIsOfflineMode(false);
      showBanner('Connexion internet rétablie. La synchronisation cloud n’est pas disponible dans la démonstration.', 'info');
    };
    const handleOffline = () => {
      setIsOfflineMode(true);
      showBanner('Coupure internet détectée : passage automatique en mode local résilient', 'warning');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const [cashSession, setCashSession] = useState<CashSession>({
    id: 'cs-01',
    tenantId: 'tenant-1',
    openedAt: '2026-11-09T06:30:00Z',
    openedBy: 'Aïcha Traoré',
    openingBalance: 50000,
    cashReceived: 65000,
    waveReceived: 120000,
    orangeReceived: 75000,
    mtnReceived: 58000,
    moovReceived: 0,
    cardReceived: 0,
    expensesTotal: 32000,
    expectedClosingBalance: 83000,
    status: 'open',
  });

  // Current tenant accessor
  const currentTenant = tenants.find(t => t.id === currentTenantId) || tenants[0];

  // Feature flag access control
  const hasAccess = (feature: FeatureKey): boolean => {
    return featureConfig[currentUserPlan]?.[feature] ?? false;
  };

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('cleanit_tenants', JSON.stringify(tenants));
  }, [tenants]);

  useEffect(() => {
    localStorage.setItem('cleanit_current_tenant_id', currentTenantId);
  }, [currentTenantId]);

  useEffect(() => {
    localStorage.setItem('cleanit_orders', JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem('cleanit_bays', JSON.stringify(bays));
  }, [bays]);

  useEffect(() => {
    localStorage.setItem('cleanit_services', JSON.stringify(services));
  }, [services]);

  useEffect(() => {
    localStorage.setItem('cleanit_employees', JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    localStorage.setItem('cleanit_customers', JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem('cleanit_inventory', JSON.stringify(inventory));
  }, [inventory]);

  useEffect(() => {
    localStorage.setItem('cleanit_expenses', JSON.stringify(expenses));
  }, [expenses]);

  // Sync dark mode with document root
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode(prev => !prev);
  };

  const showBanner = (text: string, type: 'success' | 'info' | 'warning' = 'success') => {
    setBannerMessage({ type, text });
    setTimeout(() => {
      setBannerMessage(null);
    }, 4000);
  };

  const formatCurrency = formatXof;

  const updateCurrentTenant = (updates: Partial<StationTenant>) => {
    setTenants(prev => prev.map(t => t.id === currentTenant.id ? { ...t, ...updates } : t));
    showBanner('Paramètres de la station mis à jour');
  };

  const addOrder = (orderData: Omit<WashOrder, 'id' | 'ticketNumber' | 'createdAt'>): WashOrder => {
    const nextTicketNum = `TKT-${1080 + orders.length + 1}`;
    const newOrder: WashOrder = {
      ...orderData,
      id: `ord-${Date.now()}`,
      ticketNumber: nextTicketNum,
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      tenantId: currentTenant.id,
    };

    setOrders(prev => [newOrder, ...prev]);

    // Update the chosen bay
    setBays(prev => prev.map(b => {
      if (b.id === orderData.bayArea) {
        return {
          ...b,
          currentOrderId: newOrder.id,
          currentVehicleInfo: orderData.vehicleInfo,
          currentVehiclePlate: orderData.plateNumber,
          washCategory: orderData.washCategory as any,
          inQueueCount: Math.max(0, b.inQueueCount + 1),
        };
      }
      return b;
    }));

    if (isOfflineMode) {
      setOfflineQueueCount(prev => prev + 1);
      showBanner(`Enregistré localement (Mode hors-ligne: ${nextTicketNum})`, 'warning');
    } else {
      showBanner(`Nouvelle prestation enregistrée : ${nextTicketNum}`);
    }

    return newOrder;
  };

  const updateOrderStatus = (id: string, status: WashStatus) => {
    setOrders(prev => prev.map(o => {
      if (o.id === id) {
        const completedAt = status === 'termine' ? new Date().toISOString() : o.completedAt;
        return { ...o, status, completedAt };
      }
      return o;
    }));

    // If order is completed, update employee commission and bay
    const order = orders.find(o => o.id === id);
    if (order && order.status !== 'termine' && status === 'termine') {
      if (order.assignedStaffIds.length > 0) {
        const commissionPerWasher = (order.amount * 0.15) / order.assignedStaffIds.length;
        setEmployees(prev => prev.map(emp => {
          if (order.assignedStaffIds.includes(emp.id)) {
            return {
              ...emp,
              totalWashesCompleted: emp.totalWashesCompleted + 1,
              totalCommissionsEarned: emp.totalCommissionsEarned + Math.round(commissionPerWasher),
            };
          }
          return emp;
        }));
      }

      showBanner(`Prestation ${order.ticketNumber} marquée comme terminée !`);
    }
  };

  const updatePaymentStatus = (id: string, paymentStatus: PaymentStatus, method?: PaymentMethod) => {
    setOrders(prev => prev.map(o => {
      if (o.id === id) {
        return {
          ...o,
          paymentStatus,
          paymentMethod: method || o.paymentMethod || 'especes',
          paidAmount: paymentStatus === 'paye' ? o.amount : o.paidAmount,
        };
      }
      return o;
    }));
    showBanner(`Paiement mis à jour (${paymentStatus})`);
  };

  const refreshBay = (bayId: number) => {
    setBays(prev => prev.map(b => {
      if (b.id === bayId) {
        const randomTime = Math.floor(Math.random() * 6) + 8;
        return { ...b, avgTimeMinutes: randomTime };
      }
      return b;
    }));
    showBanner(`Station Piste ${bayId} rafraîchie`);
  };

  const updateBayStatus = (bayId: number, status: 'operational' | 'out_of_service' | 'maintenance') => {
    setBays(prev => prev.map(b => b.id === bayId ? { ...b, status } : b));
    showBanner(`Piste ${bayId} passée à : ${status}`);
  };

  const addService = (serviceData: Omit<WashService, 'id'>) => {
    const newService: WashService = {
      ...serviceData,
      id: `srv-${Date.now()}`,
      tenantId: currentTenant.id,
    };
    setServices(prev => [...prev, newService]);
    showBanner(`Service "${newService.name}" ajouté`);
  };

  const updateService = (id: string, updates: Partial<WashService>) => {
    setServices(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    showBanner('Catalogue mis à jour');
  };

  const addEmployee = (empData: Omit<Employee, 'id' | 'totalWashesCompleted' | 'totalCommissionsEarned'>) => {
    const newEmp: Employee = {
      ...empData,
      id: `emp-${Date.now()}`,
      tenantId: currentTenant.id,
      totalWashesCompleted: 0,
      totalCommissionsEarned: 0,
    };
    setEmployees(prev => [...prev, newEmp]);
    showBanner(`Employé "${newEmp.name}" créé`);
  };

  const addCustomer = (custData: Omit<Customer, 'id' | 'totalVisits' | 'totalSpent' | 'createdAt'>) => {
    const newCust: Customer = {
      ...custData,
      id: `cust-${Date.now()}`,
      tenantId: currentTenant.id,
      totalVisits: 0,
      totalSpent: 0,
      createdAt: new Date().toISOString(),
    };
    setCustomers(prev => [newCust, ...prev]);
    showBanner(`Client "${newCust.name}" enregistré`);
  };

  const addInventoryItem = (itemData: Omit<InventoryItem, 'id' | 'lastRestocked'>) => {
    const newItem: InventoryItem = {
      ...itemData,
      id: `inv-${Date.now()}`,
      tenantId: currentTenant.id,
      lastRestocked: new Date().toISOString().split('T')[0],
    };
    setInventory(prev => [...prev, newItem]);
    showBanner(`Article "${newItem.name}" ajouté à l'inventaire`);
  };

  const updateInventoryStock = (id: string, newQuantity: number) => {
    setInventory(prev => prev.map(i => i.id === id ? { ...i, quantity: newQuantity } : i));
    showBanner('Stock réajusté avec succès');
  };

  const addExpense = (expenseData: Omit<ExpenseItem, 'id' | 'date'>) => {
    const newExpense: ExpenseItem = {
      ...expenseData,
      id: `exp-${Date.now()}`,
      tenantId: currentTenant.id,
      date: new Date().toISOString(),
    };
    setExpenses(prev => [newExpense, ...prev]);
    showBanner(`Dépense de ${newExpense.amount.toLocaleString('fr-FR')} FCFA enregistrée`);
  };

  const addRecentEvent = (eventData: Omit<RecentEvent, 'id' | 'timeAgo'>) => {
    const newEvent: RecentEvent = {
      ...eventData,
      id: `ev-${Date.now()}`,
      timeAgo: 'À l\'instant',
    };
    setRecentEvents(prev => [newEvent, ...prev]);
  };

  const upgradePlan = (planId: 'starter' | 'pro' | 'business') => {
    updateCurrentTenant({ subscriptionPlanId: planId, subscriptionStatus: 'active' });
    showBanner(`Abonnement mis à niveau vers : ${planId.toUpperCase()} !`);
  };

  const closeCashSession = (actualCash: number, notes?: string) => {
    const discrepancy = actualCash - cashSession.expectedClosingBalance;
    setCashSession(prev => ({
      ...prev,
      actualClosingBalance: actualCash,
      discrepancy,
      closedAt: new Date().toISOString(),
      status: 'closed',
      notes,
    }));
    showBanner(`Session de caisse fermée avec un écart de ${discrepancy} FCFA`, discrepancy === 0 ? 'success' : 'warning');
  };

  const openCashSession = (openingBalance: number) => {
    setCashSession({
      id: `cs-${Date.now()}`,
      tenantId: currentTenant.id,
      openedAt: new Date().toISOString(),
      openedBy: 'Caissier en service',
      openingBalance,
      cashReceived: 0,
      waveReceived: 0,
      orangeReceived: 0,
      mtnReceived: 0,
      moovReceived: 0,
      cardReceived: 0,
      expensesTotal: 0,
      expectedClosingBalance: openingBalance,
      status: 'open',
    });
    showBanner('Nouvelle session de caisse ouverte');
  };

  const toggleOfflineMode = () => {
    setIsOfflineMode(prev => {
      const next = !prev;
      if (next) {
        showBanner('Mode Hors-ligne activé (Opérations en cache local)', 'warning');
      } else {
        showBanner('Connexion rétablie (Prêt pour synchronisation)', 'info');
      }
      return next;
    });
  };

  const syncOfflineQueue = () => {
    if (offlineQueueCount === 0) {
      showBanner('Aucune commande en attente de synchronisation', 'info');
      return;
    }
    showBanner('Synchronisation cloud indisponible dans la démonstration : aucune donnée n’a été envoyée.', 'warning');
  };

  return (
    <AppContext.Provider
      value={{
        tenants,
        currentTenant,
        setCurrentTenantId,
        updateCurrentTenant,
        currentUserRole,
        setCurrentUserRole,
        currentUserPlan,
        hasAccess,
        isDarkMode,
        toggleDarkMode,
        currency,
        setCurrency,
        formatCurrency,
        activeTab,
        setActiveTab,
        searchQuery,
        setSearchQuery,
        orders,
        addOrder,
        updateOrderStatus,
        updatePaymentStatus,
        bays,
        refreshBay,
        updateBayStatus,
        services,
        addService,
        updateService,
        employees,
        addEmployee,
        customers,
        addCustomer,
        inventory,
        addInventoryItem,
        updateInventoryStock,
        expenses,
        addExpense,
        recentEvents,
        addRecentEvent,
        subscriptionPlans: SUBSCRIPTION_PLANS,
        upgradePlan,
        cashSession,
        closeCashSession,
        openCashSession,
        isOfflineMode,
        toggleOfflineMode,
        offlineQueueCount,
        syncOfflineQueue,
        isNewOrderModalOpen,
        setIsNewOrderModalOpen,
        selectedOrderForTicket,
        setSelectedOrderForTicket,
        selectedOrderForDetail,
        setSelectedOrderForDetail,
        isOnboardingOpen,
        setIsOnboardingOpen,
        bannerMessage,
        showBanner,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};