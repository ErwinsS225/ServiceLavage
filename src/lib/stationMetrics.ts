/**
 * Dashboard and report figures, derived from data and nothing else.
 *
 * Every number shown on the dashboard, in the reports or in a receipt comes
 * from one of the pure functions below. Keeping them out of the components is
 * what makes them testable: a component test can only check "a number is
 * displayed", whereas these functions can be checked against a fixture for
 * exact equality, including the empty case.
 *
 * Vocabulary used everywhere in the UI:
 *   - prestation terminée : the wash is done (`status = 'termine'`);
 *   - montant facturé     : the snapshot price of a *terminée* wash — the
 *                           service was delivered, so the amount is owed;
 *   - recette encaissée   : money actually received.
 *
 * ⚠️ There is no payment model yet: `station_orders` stores no payment and no
 * amount received. Nothing here may therefore be called "encaissé". The helpers
 * expose `billableXof` (billed) and deliberately do not invent a collected
 * amount; `RECEIPTS_NOT_TRACKED_COPY` is the wording the UI must use.
 */

export type OrderStatus = 'en_attente' | 'en_cours' | 'termine' | 'annule';

/** Minimum shape needed by every metric; the server returns exactly these fields. */
export interface MetricOrder {
  id: string;
  status: string;
  total_xof: number;
  created_at: string;
}

/** A row of `station_orders` as the dashboard and reports display it. */
export interface StationOrderRow extends MetricOrder {
  vehicle_info: string;
  plate_number: string | null;
}

/** Order prepared offline: no server price and no server id yet. */
export interface LocalQueuedOrder {
  requestId: string;
  vehicle: string;
  plate: string | null;
  createdAt: string;
}

export const STATUS_LABELS: Record<string, string> = {
  en_attente: 'En attente',
  en_cours: 'En cours',
  termine: 'Terminé',
  annule: 'Annulé',
};

export const STATUS_COLORS: Record<string, string> = {
  termine: '#10b981',
  en_cours: '#38bdf8',
  en_attente: '#f59e0b',
  annule: '#64748b',
};

/** Statuses that count as activity on the station right now. */
const ACTIVE_STATUSES: readonly string[] = ['en_attente', 'en_cours'];

/**
 * Only a completed wash can be billed: a wash still waiting or in progress has
 * a quoted price, not an amount owed, and a cancelled one owes nothing even
 * though its snapshot price is stored.
 */
export function isDelivered(order: { status: string }): boolean {
  return order.status === 'termine';
}

export function safeXof(value: number | null | undefined): number {
  return Number.isFinite(value) && (value as number) > 0 ? Math.trunc(value as number) : 0;
}

/** Local-time start of the day containing `reference` (midnight, not UTC). */
export function startOfDay(reference: Date): number {
  const d = new Date(reference);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** ISO week start: Monday. `getDay()` returns 0 for Sunday, which is not ISO. */
export function startOfWeek(reference: Date): number {
  const offset = (reference.getDay() + 6) % 7;
  return startOfDay(new Date(reference.getFullYear(), reference.getMonth(), reference.getDate() - offset));
}

export function startOfMonth(reference: Date): number {
  return new Date(reference.getFullYear(), reference.getMonth(), 1).getTime();
}

export function startOfYear(reference: Date): number {
  return new Date(reference.getFullYear(), 0, 1).getTime();
}

export function isSameLocalDay(iso: string, reference: Date): boolean {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  return t >= startOfDay(reference) && t < startOfDay(reference) + 86_400_000;
}

/**
 * Billed amount of one order: its snapshot price, but only once the wash is
 * completed. A queued offline order has no price at all: 0, never a guess.
 */
export function orderBilledXof(order: { status: string; total_xof?: number }): number {
  return isDelivered(order) ? safeXof(order.total_xof) : 0;
}

export interface DashboardMetrics {
  /** Billed amount of the washes completed today (not "collected": see the header). */
  billedTodayXof: number;
  /** Sum of the non-cancelled washes created today, whatever their status. */
  createdTodayCount: number;
  completedTodayCount: number;
  activeCount: number;
  queuedCount: number;
  customersCount: number;
  totalOrders: number;
}

export function dashboardMetrics(
  orders: readonly MetricOrder[],
  reference: Date,
  options: { customersCount?: number; queuedCount?: number } = {},
): DashboardMetrics {
  const today = orders.filter(order => isSameLocalDay(order.created_at, reference));
  const completedToday = today.filter(order => order.status === 'termine');
  return {
    billedTodayXof: completedToday.reduce((sum, order) => sum + orderBilledXof(order), 0),
    createdTodayCount: today.filter(order => order.status !== 'annule').length,
    completedTodayCount: completedToday.length,
    activeCount: orders.filter(order => ACTIVE_STATUSES.includes(order.status)).length,
    queuedCount: options.queuedCount ?? 0,
    customersCount: options.customersCount ?? 0,
    totalOrders: orders.length,
  };
}

export interface DayPoint {
  /** `yyyy-mm-dd` in local time; stable for keys and tests. */
  iso: string;
  label: string;
  /** Billed amount of the washes completed that day. */
  billedXof: number;
  count: number;
}

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

/** Last seven days, oldest first, with real values (0 when nothing happened). */
export function dailyBilledSeries(orders: readonly MetricOrder[], reference: Date, days = 7): DayPoint[] {
  const points: DayPoint[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate() - offset);
    const start = startOfDay(day);
    const end = start + 86_400_000;
    const completed = orders.filter(order => {
      const t = Date.parse(order.created_at);
      return Number.isFinite(t) && t >= start && t < end && order.status === 'termine';
    });
    points.push({
      iso: `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`,
      label: DAY_LABELS[day.getDay()],
      billedXof: completed.reduce((sum, order) => sum + orderBilledXof(order), 0),
      count: completed.length,
    });
  }
  return points;
}

/** True when the seven-day series carries no activity at all (empty state). */
export function isSeriesEmpty(series: readonly DayPoint[]): boolean {
  return series.every(point => point.billedXof === 0 && point.count === 0);
}

export interface StatusSlice {
  status: string;
  name: string;
  value: number;
  color: string;
}

/** Distribution of the four real statuses; zero-count statuses are kept for the legend. */
export function statusDistribution(orders: readonly MetricOrder[]): StatusSlice[] {
  return (['termine', 'en_cours', 'en_attente', 'annule'] as const).map(status => ({
    status,
    name: STATUS_LABELS[status],
    value: orders.filter(order => order.status === status).length,
    color: STATUS_COLORS[status],
  }));
}

export type ReportPeriod = 'today' | 'week' | 'month' | 'year';

export function periodStart(period: ReportPeriod, reference: Date): number {
  switch (period) {
    case 'today':
      return startOfDay(reference);
    case 'week':
      return startOfWeek(reference);
    case 'month':
      return startOfMonth(reference);
    case 'year':
      return startOfYear(reference);
    default:
      return startOfMonth(reference);
  }
}

export function periodLabel(period: ReportPeriod): string {
  return { today: "Aujourd'hui", week: 'Cette semaine', month: 'Ce mois-ci', year: 'Cette année' }[period];
}

export interface ReportMetrics {
  period: ReportPeriod;
  /** Every row of the period, cancelled washes included. */
  totalCount: number;
  /** Non-cancelled washes created in the period. */
  createdCount: number;
  /** Washes whose status is `termine` (the wash is done, not necessarily paid). */
  completedCount: number;
  cancelledCount: number;
  /** Sum of the snapshot prices of the completed washes only. */
  billedXof: number;
  /** Average billed amount per completed wash, rounded to the franc. */
  averageBilledXof: number;
}

export function reportMetrics(
  orders: readonly MetricOrder[],
  period: ReportPeriod,
  reference: Date,
): ReportMetrics {
  const start = periodStart(period, reference);
  const end = reference.getTime();
  const inPeriod = orders.filter(order => {
    const t = Date.parse(order.created_at);
    return Number.isFinite(t) && t >= start && t <= end;
  });
  const completed = inPeriod.filter(isDelivered);
  const cancelled = inPeriod.filter(order => order.status === 'annule');
  const billedXof = completed.reduce((sum, order) => sum + orderBilledXof(order), 0);
  return {
    period,
    totalCount: inPeriod.length,
    createdCount: inPeriod.length - cancelled.length,
    completedCount: completed.length,
    cancelledCount: cancelled.length,
    billedXof,
    averageBilledXof: completed.length === 0 ? 0 : Math.round(billedXof / completed.length),
  };
}

/**
 * Wording the receipt must use about payment. The database has no payment
 * column, so `status = 'termine'` means "the wash is finished", not "the
 * customer has paid": saying otherwise on a printed document is a false
 * statement handed to the customer.
 */
export function receiptPaymentLabel(status: string): string {
  if (status === 'termine') return 'LAVAGE TERMINÉ';
  if (status === 'annule') return 'PRESTATION ANNULÉE';
  if (status === 'en_cours') return 'LAVAGE EN COURS';
  return 'EN ATTENTE';
}

/** One short line explaining that payments are not recorded anywhere yet. */
export const RECEIPTS_NOT_TRACKED_COPY =
  'Les paiements ne sont pas enregistrés par l’application : les montants affichés sont des montants facturés, pas des recettes encaissées.';
