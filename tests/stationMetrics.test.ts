import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyBilledSeries,
  dashboardMetrics,
  isSeriesEmpty,
  orderBilledXof,
  reportMetrics,
  safeXof,
  startOfWeek,
  statusDistribution,
  type MetricOrder,
} from '../src/lib/stationMetrics';

/**
 * These tests pin the arithmetic, not the rendering: every figure the
 * dashboard and the reports display is produced here, so an exact assertion
 * on this module is an exact assertion on the screen.
 *
 * The fixture deliberately contains the cases that used to be faked:
 *  - a cancelled wash with a stored price that must never be billed;
 *  - a queued offline order with no price at all;
 *  - an empty station.
 */

/** All timestamps are built from one local reference so the tests are TZ-independent. */
const REFERENCE = new Date(2026, 10, 10, 15, 30, 0); // 10 November 2026, 15:30 local

function at(dayOffset: number, hour = 10, minute = 0): string {
  return new Date(2026, 10, 10 + dayOffset, hour, minute, 0).toISOString();
}

const FIXTURE: MetricOrder[] = [
  // today, completed: billed 5 000
  { id: 'o1', status: 'termine', total_xof: 5000, created_at: at(0, 8) },
  // today, completed: billed 3 500
  { id: 'o2', status: 'termine', total_xof: 3500, created_at: at(0, 12) },
  // today, in progress: never billed
  { id: 'o3', status: 'en_cours', total_xof: 7000, created_at: at(0, 14) },
  // today, waiting: never billed
  { id: 'o4', status: 'en_attente', total_xof: 2000, created_at: at(0, 15) },
  // today, cancelled: its price must be ignored everywhere
  { id: 'o5', status: 'annule', total_xof: 9000, created_at: at(0, 9) },
  // yesterday, completed: billed 12 000
  { id: 'o6', status: 'termine', total_xof: 12000, created_at: at(-1, 11) },
  // six days ago (Wednesday 4 Nov), completed: billed 4 000 (first point of the series)
  { id: 'o7', status: 'termine', total_xof: 4000, created_at: at(-6, 9) },
  // eight days ago: outside the 7-day series, inside the month
  { id: 'o8', status: 'termine', total_xof: 15000, created_at: at(-8, 9) },
  // previous month: outside every period except the year
  { id: 'o9', status: 'termine', total_xof: 20000, created_at: new Date(2026, 9, 20, 10).toISOString() },
];

const EMPTY: MetricOrder[] = [];

test('the daily KPI equals the sum of the completed washes of that day only', () => {
  const metrics = dashboardMetrics(FIXTURE, REFERENCE);
  assert.equal(metrics.billedTodayXof, 8500, '5 000 + 3 500 terminés aujourd’hui');
  assert.equal(metrics.completedTodayCount, 2);
  assert.equal(metrics.createdTodayCount, 4, '4 prestations non annulées créées aujourd’hui');
  assert.equal(metrics.activeCount, 2, '1 en cours + 1 en attente sur toute la station');
  assert.equal(metrics.totalOrders, FIXTURE.length);
});

test('a cancelled wash is never billed, even though its price is stored', () => {
  const cancelled = FIXTURE.filter(order => order.status === 'annule');
  assert.equal(cancelled.length, 1);
  assert.equal(orderBilledXof(cancelled[0]), 0);
  assert.equal(dashboardMetrics(FIXTURE, REFERENCE).billedTodayXof, 8500, '9 000 annulés exclus');
});

test('a wash that is only quoted is not billed until it is completed', () => {
  // o3 (en cours, 7 000) and o4 (en attente, 2 000) exist today but are not owed.
  assert.equal(orderBilledXof({ status: 'en_cours', total_xof: 7000 }), 0);
  assert.equal(orderBilledXof({ status: 'en_attente', total_xof: 2000 }), 0);
  assert.equal(orderBilledXof({ status: 'termine', total_xof: 7000 }), 7000);
});

test('the seven-day series contains exactly the real per-day amounts, oldest first', () => {
  const series = dailyBilledSeries(FIXTURE, REFERENCE);
  assert.equal(series.length, 7);
  assert.deepEqual(series.map(point => point.iso), [
    '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10',
  ]);
  assert.deepEqual(series.map(point => point.billedXof), [4000, 0, 0, 0, 0, 12000, 8500]);
  assert.deepEqual(series.map(point => point.count), [1, 0, 0, 0, 0, 1, 2]);
  assert.equal(series.at(-1)?.label, 'Mar', '10 novembre 2026 est un mardi');
  assert.equal(isSeriesEmpty(series), false);
});

test('an empty station yields zeros, never a baseline curve', () => {
  const metrics = dashboardMetrics(EMPTY, REFERENCE, { customersCount: 0, queuedCount: 0 });
  assert.deepEqual(metrics, {
    billedTodayXof: 0,
    createdTodayCount: 0,
    completedTodayCount: 0,
    activeCount: 0,
    queuedCount: 0,
    customersCount: 0,
    totalOrders: 0,
  });
  const series = dailyBilledSeries(EMPTY, REFERENCE);
  assert.equal(series.length, 7);
  assert.ok(series.every(point => point.billedXof === 0 && point.count === 0));
  assert.equal(isSeriesEmpty(series), true, 'l’interface doit afficher un état vide');
  assert.ok(statusDistribution(EMPTY).every(slice => slice.value === 0));
});

test('the status distribution counts the four real statuses', () => {
  // 6 terminés: o1, o2, o6, o7, o8, o9
  assert.deepEqual(
    statusDistribution(FIXTURE).map(slice => [slice.status, slice.value]),
    [['termine', 6], ['en_cours', 1], ['en_attente', 1], ['annule', 1]],
  );
});

test('the monthly report bills what was billed and never a cancelled price', () => {
  const report = reportMetrics(FIXTURE, 'month', REFERENCE);
  // November, cancelled o5 excluded: 8 500 + 12 000 + 4 000 + 15 000 = 39 500
  assert.equal(report.billedXof, 39500);
  assert.equal(report.totalCount, 8, 'toutes les lignes de novembre, annulée comprise');
  assert.equal(report.createdCount, 7, '8 prestations de novembre moins 1 annulée');
  assert.equal(report.cancelledCount, 1);
  // Terminés de novembre: o1, o2, o6, o7, o8 (o7 = 4 nov, dans le mois).
  assert.equal(report.completedCount, 5);
  assert.equal(report.averageBilledXof, Math.round(39500 / 5));
});

test('the yearly report includes the previous month, the monthly one does not', () => {
  const year = reportMetrics(FIXTURE, 'year', REFERENCE);
  assert.equal(year.billedXof, 39500 + 20000, 'le mois en cours plus octobre');
  assert.equal(year.totalCount, 9, 'toute l’année, annulée comprise');
  assert.equal(reportMetrics(FIXTURE, 'month', REFERENCE).billedXof, 39500);
});

test('today and week periods are bounded to the right days', () => {
  const today = reportMetrics(FIXTURE, 'today', REFERENCE);
  assert.equal(today.billedXof, 8500, 'seules les 2 prestations terminées aujourd’hui');
  assert.equal(today.createdCount, 4, 'les 4 prestations non annulées créées aujourd’hui');
  assert.equal(today.totalCount, 5);
  assert.equal(today.completedCount, 2);
  assert.equal(today.cancelledCount, 1);

  // Monday of the week containing 10 Nov 2026 (a Tuesday) is 9 Nov.
  assert.equal(startOfWeek(REFERENCE), new Date(2026, 10, 9).getTime());
  const week = reportMetrics(FIXTURE, 'week', REFERENCE);
  assert.equal(week.billedXof, 8500 + 12000, 'lundi 9 + mardi 10 seulement');
  assert.equal(week.completedCount, 3, '2 terminées aujourd’hui + 1 hier');
  assert.equal(week.createdCount, 5, '4 non annulées aujourd’hui + 1 hier');
});

test('an empty report period is all zeros and its average is not NaN', () => {
  const report = reportMetrics(EMPTY, 'month', REFERENCE);
  assert.deepEqual(report, {
    period: 'month',
    totalCount: 0,
    createdCount: 0,
    completedCount: 0,
    cancelledCount: 0,
    billedXof: 0,
    averageBilledXof: 0,
  });
  assert.ok(Number.isFinite(report.averageBilledXof));
});

test('a queued offline order contributes a count but never an amount', () => {
  const queuedAsRow: MetricOrder = { id: 'local-1', status: 'en_attente', total_xof: 0, created_at: at(0, 16) };
  const metrics = dashboardMetrics([...FIXTURE, queuedAsRow], REFERENCE, { queuedCount: 1 });
  assert.equal(metrics.billedTodayXof, 8500, 'aucun montant inventé pour la file locale');
  assert.equal(metrics.queuedCount, 1);
  assert.equal(metrics.totalOrders, FIXTURE.length + 1);
});

test('invalid amounts are coerced to zero instead of leaking into a total', () => {
  assert.equal(safeXof(undefined), 0);
  assert.equal(safeXof(Number.NaN), 0);
  assert.equal(safeXof(-500), 0);
  assert.equal(safeXof(12.9), 12);
});
