import type { Session, SupabaseClient, User } from '@supabase/supabase-js';

const DEMO_USER_ID = '11111111-2222-3333-4444-555555555555';
const DEMO_EMAIL = 'owner@servicelavage.ci';

interface MockUser {
  id: string;
  email: string;
  password?: string;
  created_at: string;
  email_confirmed_at?: string | null;
}

interface MockRecord {
  id?: string;
  [key: string]: any;
}

function getStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

function initDefaultData() {
  const users = getStorage<MockUser[]>('servicelavage:mock:users', []);
  if (users.length === 0) {
    users.push({
      id: DEMO_USER_ID,
      email: DEMO_EMAIL,
      password: 'password123',
      created_at: new Date().toISOString(),
      email_confirmed_at: new Date().toISOString(),
    });
    setStorage('servicelavage:mock:users', users);
  }

  const stations = getStorage<MockRecord[]>('servicelavage:mock:stations', []);
  if (stations.length === 0) {
    const demoStationId = 'demo-station-abidjan';
    stations.push({
      id: demoStationId,
      name: 'Station Riviera 2 - Abidjan',
      owner_id: DEMO_USER_ID,
      created_at: new Date().toISOString(),
    });
    setStorage('servicelavage:mock:stations', stations);

    setStorage('servicelavage:mock:station_services', [
      {
        id: 'svc-1',
        station_id: demoStationId,
        name: 'Lavage Complet + Mousse Active',
        price_xof: 3500,
        duration_minutes: 25,
        is_active: true,
        created_at: new Date().toISOString(),
      },
      {
        id: 'svc-2',
        station_id: demoStationId,
        name: 'Lavage Express Extérieur',
        price_xof: 2000,
        duration_minutes: 15,
        is_active: true,
        created_at: new Date().toISOString(),
      },
      {
        id: 'svc-3',
        station_id: demoStationId,
        name: 'Formule VIP Cire & Lustrage',
        price_xof: 6000,
        duration_minutes: 45,
        is_active: true,
        created_at: new Date().toISOString(),
      },
      {
        id: 'svc-4',
        station_id: demoStationId,
        name: 'Nettoyage Moteur & Châssis',
        price_xof: 4000,
        duration_minutes: 30,
        is_active: true,
        created_at: new Date().toISOString(),
      },
    ]);

    setStorage('servicelavage:mock:station_customers', [
      {
        id: 'cust-1',
        station_id: demoStationId,
        name: 'Awa Koné',
        phone: '0701020304',
        created_at: new Date().toISOString(),
      },
      {
        id: 'cust-2',
        station_id: demoStationId,
        name: 'Jean-Marc Kouamé',
        phone: '0506070809',
        created_at: new Date().toISOString(),
      },
      {
        id: 'cust-3',
        station_id: demoStationId,
        name: 'Ibrahim Touré',
        phone: '0102030405',
        created_at: new Date().toISOString(),
      },
    ]);

    setStorage('servicelavage:mock:station_inventory', [
      {
        id: 'inv-1',
        station_id: demoStationId,
        name: 'Shampoing Mousse Active Hyper Concentré',
        unit: 'Bidon 20L',
        quantity: 12,
        min_threshold: 3,
        created_at: new Date().toISOString(),
      },
      {
        id: 'inv-2',
        station_id: demoStationId,
        name: 'Cire de Finition & Lustrage Céramique',
        unit: 'Flacon 1L',
        quantity: 8,
        min_threshold: 2,
        created_at: new Date().toISOString(),
      },
      {
        id: 'inv-3',
        station_id: demoStationId,
        name: 'Microfibres de Séchage 40x40',
        unit: 'Pièce',
        quantity: 45,
        min_threshold: 15,
        created_at: new Date().toISOString(),
      },
      {
        id: 'inv-4',
        station_id: demoStationId,
        name: 'Dégraissant Jantes et Bas de Caisse',
        unit: 'Bidon 5L',
        quantity: 6,
        min_threshold: 2,
        created_at: new Date().toISOString(),
      },
    ]);

    setStorage('servicelavage:mock:station_memberships', [
      {
        user_id: DEMO_USER_ID,
        station_id: demoStationId,
        role: 'owner',
        created_at: new Date().toISOString(),
        revoked_at: null,
      },
    ]);

    const orderId1 = 'ord-1';
    setStorage('servicelavage:mock:station_orders', [
      {
        id: orderId1,
        station_id: demoStationId,
        customer_id: 'cust-1',
        vehicle_info: 'Toyota RAV4 Blanc',
        plate_number: '1234 AB 01',
        total_xof: 3500,
        status: 'termine',
        created_at: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 'ord-2',
        station_id: demoStationId,
        customer_id: 'cust-2',
        vehicle_info: 'Peugeot 3008 Noir',
        plate_number: '5678 CD 01',
        total_xof: 6000,
        status: 'en_cours',
        created_at: new Date(Date.now() - 1800000).toISOString(),
      },
    ]);

    setStorage('servicelavage:mock:station_order_items', [
      {
        id: 'item-1',
        order_id: orderId1,
        service_name: 'Lavage Complet + Mousse Active',
        price_xof: 3500,
      },
    ]);
  }
}

export function createMockSupabaseClient(): SupabaseClient {
  initDefaultData();

  type AuthListener = (event: string, session: Session | null) => void;
  const authListeners = new Set<AuthListener>();

  const getActiveSession = (): Session | null => {
    return getStorage<Session | null>('servicelavage:mock:session', null);
  };

  const setActiveSession = (session: Session | null, event: string) => {
    setStorage('servicelavage:mock:session', session);
    authListeners.forEach(listener => {
      try {
        listener(event, session);
      } catch {
        // Ignore subscriber errors
      }
    });
  };

  const auth = {
    async getSession(): Promise<{ data: { session: Session | null }; error: null }> {
      return { data: { session: getActiveSession() }, error: null };
    },

    onAuthStateChange(callback: AuthListener) {
      authListeners.add(callback);
      // Immediately notify with current session on subscribe
      setTimeout(() => {
        callback('INITIAL_SESSION', getActiveSession());
      }, 0);
      return {
        data: {
          subscription: {
            unsubscribe() {
              authListeners.delete(callback);
            },
          },
        },
      };
    },

    async signInWithPassword({
      email,
      password,
    }: {
      email: string;
      password?: string;
    }): Promise<{ data: { user: User | null; session: Session | null }; error: { message: string } | null }> {
      const normalizedEmail = email.trim().toLowerCase();
      const users = getStorage<MockUser[]>('servicelavage:mock:users', []);
      const found = users.find(u => u.email.toLowerCase() === normalizedEmail);

      if (!found || (password && found.password && found.password !== password)) {
        return {
          data: { user: null, session: null },
          error: { message: 'Invalid login credentials' },
        };
      }

      // Check if email has been confirmed
      if (!found.email_confirmed_at) {
        return {
          data: { user: null, session: null },
          error: { message: 'Email not confirmed' },
        };
      }

      const user: User = {
        id: found.id,
        email: found.email,
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: found.created_at,
        email_confirmed_at: found.email_confirmed_at,
      };

      const session: Session = {
        access_token: `mock-jwt-${found.id}`,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: `mock-refresh-${found.id}`,
        user,
      };

      setActiveSession(session, 'SIGNED_IN');
      return { data: { user, session }, error: null };
    },

    async signUp({
      email,
      password,
    }: {
      email: string;
      password?: string;
      options?: { emailRedirectTo?: string };
    }): Promise<{ data: { user: User | null; session: Session | null }; error: { message: string } | null }> {
      const normalizedEmail = email.trim().toLowerCase();
      const users = getStorage<MockUser[]>('servicelavage:mock:users', []);

      let userRecord = users.find(u => u.email.toLowerCase() === normalizedEmail);
      if (!userRecord) {
        userRecord = {
          id: crypto.randomUUID(),
          email: email.trim(),
          password,
          created_at: new Date().toISOString(),
          email_confirmed_at: null, // Require email verification for account security
        };
        users.push(userRecord);
        setStorage('servicelavage:mock:users', users);
      } else if (password) {
        userRecord.password = password;
        setStorage('servicelavage:mock:users', users);
      }

      const user: User = {
        id: userRecord.id,
        email: userRecord.email,
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: userRecord.created_at,
        email_confirmed_at: userRecord.email_confirmed_at ?? undefined,
      };

      // Email verification step: new account does not have an active session until verified
      return { data: { user, session: null }, error: null };
    },

    confirmEmail(email: string): boolean {
      const normalizedEmail = email.trim().toLowerCase();
      const users = getStorage<MockUser[]>('servicelavage:mock:users', []);
      const found = users.find(u => u.email.toLowerCase() === normalizedEmail);
      if (found) {
        found.email_confirmed_at = new Date().toISOString();
        setStorage('servicelavage:mock:users', users);
        return true;
      }
      return false;
    },

    async verifyOtp({
      email,
    }: {
      email: string;
      token?: string;
      type?: string;
    }): Promise<{ data: { user: User | null; session: Session | null }; error: { message: string } | null }> {
      const normalizedEmail = email.trim().toLowerCase();
      const users = getStorage<MockUser[]>('servicelavage:mock:users', []);
      const found = users.find(u => u.email.toLowerCase() === normalizedEmail);
      if (found) {
        found.email_confirmed_at = new Date().toISOString();
        setStorage('servicelavage:mock:users', users);
        const user: User = {
          id: found.id,
          email: found.email,
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated',
          created_at: found.created_at,
          email_confirmed_at: found.email_confirmed_at,
        };
        return { data: { user, session: null }, error: null };
      }
      return { data: { user: null, session: null }, error: { message: 'Token has expired' } };
    },

    async signOut(): Promise<{ error: null }> {
      setActiveSession(null, 'SIGNED_OUT');
      return { error: null };
    },

    async resetPasswordForEmail(_email: string): Promise<{ data: Record<string, never>; error: null }> {
      return { data: {}, error: null };
    },

    async updateUser({ password }: { password?: string }): Promise<{ data: { user: User | null }; error: null }> {
      const session = getActiveSession();
      if (session?.user && password) {
        const users = getStorage<MockUser[]>('servicelavage:mock:users', []);
        const target = users.find(u => u.id === session.user.id);
        if (target) {
          target.password = password;
          setStorage('servicelavage:mock:users', users);
        }
      }
      return { data: { user: session?.user ?? null }, error: null };
    },

    async resend(_options: any): Promise<{ data: Record<string, never>; error: null }> {
      return { data: {}, error: null };
    },
  };

  const getTableData = (table: string): MockRecord[] => {
    return getStorage<MockRecord[]>(`servicelavage:mock:${table}`, []);
  };

  const setTableData = (table: string, data: MockRecord[]) => {
    setStorage(`servicelavage:mock:${table}`, data);
  };

  function createTableBuilder(table: string) {
    let filters: Array<(row: MockRecord) => boolean> = [];
    let orderColumn: string | null = null;
    let orderAsc = true;
    let limitCount: number | null = null;
    let isSingle = false;
    let isMaybeSingle = false;
    let countExact = false;
    let isHead = false;

    const execute = async () => {
      let rows = getTableData(table);
      for (const filter of filters) {
        rows = rows.filter(filter);
      }

      const totalCount = rows.length;

      if (orderColumn) {
        rows = [...rows].sort((a, b) => {
          const valA = a[orderColumn!];
          const valB = b[orderColumn!];
          if (valA === valB) return 0;
          if (valA == null) return orderAsc ? -1 : 1;
          if (valB == null) return orderAsc ? 1 : -1;
          return orderAsc ? (valA > valB ? 1 : -1) : valA > valB ? -1 : 1;
        });
      }

      if (limitCount != null) {
        rows = rows.slice(0, limitCount);
      }

      // If querying station_orders, join station_order_items if requested
      if (table === 'station_orders') {
        const allItems = getTableData('station_order_items');
        rows = rows.map(order => ({
          ...order,
          station_order_items: allItems.filter(item => item.order_id === order.id),
        }));
      }

      if (isHead) {
        return { data: null, error: null, count: totalCount };
      }

      if (isSingle) {
        if (rows.length === 0) {
          return { data: null, error: { message: 'Row not found' }, count: 0 };
        }
        return { data: rows[0], error: null, count: countExact ? totalCount : null };
      }

      if (isMaybeSingle) {
        return { data: rows[0] ?? null, error: null, count: countExact ? totalCount : null };
      }

      return { data: rows, error: null, count: countExact ? totalCount : null };
    };

    const builder: any = {
      select(_fields?: string, options?: { count?: string; head?: boolean }) {
        if (options?.count === 'exact') countExact = true;
        if (options?.head) isHead = true;
        return builder;
      },

      eq(column: string, value: any) {
        filters.push(row => row[column] === value);
        return builder;
      },

      is(column: string, value: any) {
        filters.push(row => row[column] === value);
        return builder;
      },

      gte(column: string, value: any) {
        filters.push(row => row[column] >= value);
        return builder;
      },

      order(column: string, options?: { ascending?: boolean }) {
        orderColumn = column;
        orderAsc = options?.ascending !== false;
        return builder;
      },

      limit(count: number) {
        limitCount = count;
        return builder;
      },

      single() {
        isSingle = true;
        return builder;
      },

      maybeSingle() {
        isMaybeSingle = true;
        return builder;
      },

      insert(values: any) {
        const rows = getTableData(table);
        const toInsert = Array.isArray(values) ? values : [values];
        const inserted = toInsert.map(val => ({
          id: val.id ?? crypto.randomUUID(),
          created_at: val.created_at ?? new Date().toISOString(),
          ...val,
        }));
        rows.push(...inserted);
        setTableData(table, rows);

        return {
          select() {
            return {
              single: async () => ({ data: inserted[0], error: null }),
              then: (res: any, rej: any) => Promise.resolve({ data: inserted, error: null }).then(res, rej),
            };
          },
          then: (res: any, rej: any) => Promise.resolve({ data: inserted, error: null }).then(res, rej),
        };
      },

      update(values: any) {
        return {
          eq(column: string, value: any) {
            filters.push(row => row[column] === value);
            return {
              eq(col2: string, val2: any) {
                filters.push(row => row[col2] === val2);
                return this;
              },
              select() {
                return {
                  single: async () => {
                    const rows = getTableData(table);
                    let target: any = null;
                    const updatedRows = rows.map(r => {
                      if (filters.every(f => f(r))) {
                        target = { ...r, ...values };
                        return target;
                      }
                      return r;
                    });
                    setTableData(table, updatedRows);
                    return { data: target, error: null };
                  },
                };
              },
              then: async (res: any, rej: any) => {
                const rows = getTableData(table);
                const updatedRows = rows.map(r => {
                  if (filters.every(f => f(r))) {
                    return { ...r, ...values };
                  }
                  return r;
                });
                setTableData(table, updatedRows);
                return Promise.resolve({ data: values, error: null }).then(res, rej);
              },
            };
          },
        };
      },

      then(resolve: any, reject: any) {
        return execute().then(resolve, reject);
      },

      catch(reject: any) {
        return execute().catch(reject);
      },
    };

    return builder;
  }

  const rpc = async (name: string, args: any = {}): Promise<{ data: any; error: any }> => {
    const session = getActiveSession();
    const userId = session?.user?.id ?? DEMO_USER_ID;

    switch (name) {
      case 'current_station_role': {
        const memberships = getTableData('station_memberships');
        const m = memberships.find(
          row => row.station_id === args.p_station_id && row.user_id === userId && !row.revoked_at,
        );
        if (m) return { data: m.role, error: null };
        const stations = getTableData('stations');
        const st = stations.find(s => s.id === args.p_station_id);
        if (st && st.owner_id === userId) return { data: 'owner', error: null };
        return { data: 'owner', error: null }; // Default to owner in mock mode
      }

      case 'my_subscription': {
        const stations = getTableData('stations');
        const orders = getTableData('station_orders');
        return {
          data: [
            {
              plan: 'pro',
              max_stations: 2,
              max_monthly_orders: 2500,
              station_count: stations.length || 1,
              monthly_orders: orders.length,
            },
          ],
          error: null,
        };
      }

      case 'create_station_order_idempotent': {
        const orders = getTableData('station_orders');
        const services = getTableData('station_services');
        const items = getTableData('station_order_items');

        const selectedServices = services.filter(s => (args.p_service_ids ?? []).includes(s.id));
        const totalXof = selectedServices.reduce((sum, s) => sum + (s.price_xof || 0), 0);
        const newOrderId = crypto.randomUUID();

        orders.unshift({
          id: newOrderId,
          station_id: args.p_station_id,
          customer_id: args.p_customer_id ?? null,
          vehicle_info: args.p_vehicle_info,
          plate_number: args.p_plate_number ?? null,
          total_xof: totalXof,
          status: 'en_attente',
          created_at: new Date().toISOString(),
        });
        setTableData('station_orders', orders);

        for (const s of selectedServices) {
          items.push({
            id: crypto.randomUUID(),
            order_id: newOrderId,
            service_name: s.name,
            price_xof: s.price_xof,
          });
        }
        setTableData('station_order_items', items);

        return { data: [{ id: newOrderId }], error: null };
      }

      case 'transition_station_order': {
        const orders = getTableData('station_orders');
        const order = orders.find(o => o.id === args.p_order_id);
        if (order) {
          order.status = args.p_status;
          setTableData('station_orders', orders);
        }
        return { data: null, error: null };
      }

      case 'assign_station_order': {
        const assignments = getTableData('station_order_assignments');
        assignments.push({
          order_id: args.p_order_id,
          user_id: args.p_user_id,
        });
        setTableData('station_order_assignments', assignments);
        return { data: null, error: null };
      }

      case 'unassign_station_order': {
        const assignments = getTableData('station_order_assignments');
        setTableData(
          'station_order_assignments',
          assignments.filter(a => !(a.order_id === args.p_order_id && a.user_id === args.p_user_id)),
        );
        return { data: null, error: null };
      }

      case 'apply_inventory_operation': {
        const inventory = getTableData('station_inventory');
        if (!args.p_item_id) {
          const newItemId = crypto.randomUUID();
          inventory.push({
            id: newItemId,
            station_id: args.p_station_id,
            name: args.p_name,
            unit: args.p_unit,
            quantity: args.p_quantity ?? 0,
            min_threshold: args.p_min_threshold ?? 0,
            created_at: new Date().toISOString(),
          });
          setTableData('station_inventory', inventory);
          return { data: [{ item_id: newItemId, resulting_quantity: args.p_quantity ?? 0 }], error: null };
        } else {
          const item = inventory.find(i => i.id === args.p_item_id);
          if (!item) return { data: null, error: { message: 'Article introuvable' } };
          item.quantity = Math.max(0, (item.quantity ?? 0) + (args.p_quantity ?? 0));
          setTableData('station_inventory', inventory);
          return { data: [{ item_id: item.id, resulting_quantity: item.quantity }], error: null };
        }
      }

      case 'create_station_invitation': {
        const invitations = getTableData('station_invitations');
        const invId = crypto.randomUUID();
        invitations.push({
          id: invId,
          station_id: args.p_station_id,
          email: args.p_email,
          role: args.p_role,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
          accepted_at: null,
          cancelled_at: null,
        });
        setTableData('station_invitations', invitations);
        return { data: invId, error: null };
      }

      case 'cancel_station_invitation': {
        const invitations = getTableData('station_invitations');
        const inv = invitations.find(i => i.id === args.p_invitation_id);
        if (inv) inv.cancelled_at = new Date().toISOString();
        setTableData('station_invitations', invitations);
        return { data: null, error: null };
      }

      case 'accept_station_invitation': {
        const invitations = getTableData('station_invitations');
        const inv = invitations.find(i => i.id === args.p_invitation_id);
        if (inv) {
          inv.accepted_at = new Date().toISOString();
          const memberships = getTableData('station_memberships');
          memberships.push({
            user_id: userId,
            station_id: inv.station_id,
            role: inv.role,
            created_at: new Date().toISOString(),
            revoked_at: null,
          });
          setTableData('station_memberships', memberships);
          setTableData('station_invitations', invitations);
        }
        return { data: null, error: null };
      }

      case 'revoke_station_membership': {
        const memberships = getTableData('station_memberships');
        const m = memberships.find(row => row.station_id === args.p_station_id && row.user_id === args.p_user_id);
        if (m) m.revoked_at = new Date().toISOString();
        setTableData('station_memberships', memberships);
        return { data: null, error: null };
      }

      default:
        return { data: null, error: null };
    }
  };

  return {
    auth,
    from: (table: string) => createTableBuilder(table),
    rpc,
  } as unknown as SupabaseClient;
}
