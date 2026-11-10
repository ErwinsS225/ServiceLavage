import './domEnvironment';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { render, screen, cleanup, within, waitFor } from '@testing-library/react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { StationDashboard } from '../src/components/StationDashboard';
import { StationReports } from '../src/components/StationReports';
import { formatXof } from '../src/lib/money';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '../src/lib/queryClient';

/**
 * The dashboard and the reports used to display figures that no row in the
 * database backed (a simulated curve, fallback counts, fixed trends, an
 * invented payment split). These tests render the real components against a
 * deterministic fixture and assert that **every** number on screen is the
 * fixture's number — including the case where there is no order at all.
 *
 * The fixture matches `stationMetrics.test.ts`, so a change in the arithmetic
 * breaks both the unit level and the screen level instead of only one.
 */

afterEach(cleanup);

function at(dayOffset: number, hour = 10): string {
  return new Date(2026, 10, 10 + dayOffset, hour, 0, 0).toISOString();
}

const ORDERS = [
  { id: 'o1', status: 'termine', total_xof: 5000, created_at: at(0, 8), vehicle_info: 'Toyota RAV4 Blanc', plate_number: '1234 AB 01' },
  { id: 'o2', status: 'termine', total_xof: 3500, created_at: at(0, 12), vehicle_info: 'Peugeot 308 Grise', plate_number: null },
  { id: 'o3', status: 'en_cours', total_xof: 7000, created_at: at(0, 14), vehicle_info: 'Hyundai Tucson', plate_number: '5678 CD 01' },
  { id: 'o4', status: 'en_attente', total_xof: 2000, created_at: at(0, 15), vehicle_info: 'Kia Picanto', plate_number: null },
  { id: 'o5', status: 'annule', total_xof: 9000, created_at: at(0, 9), vehicle_info: 'Renault Duster', plate_number: '9999 ZZ 01' },
  { id: 'o6', status: 'termine', total_xof: 12000, created_at: at(-1, 11), vehicle_info: 'Nissan Qashqai', plate_number: null },
];

/**
 * Fake Supabase client: answers `station_orders` with the fixture and
 * `station_customers` with a count, ignoring the filters (the components pass
 * them, but the arithmetic under test happens in `stationMetrics`).
 */
function fakeClient(orders: unknown[], customers = 3) {
  const calls: string[] = [];
  const client = {
    from(table: string) {
      calls.push(table);
      const builder = {
        select: () => builder,
        eq: () => builder,
        gte: () => builder,
        // The data layer bounds the list (`.limit(200)`): the fake has to
        // accept the whole chain the real client accepts.
        limit: () => builder,
        order: () => builder,
        then: (resolve: (value: unknown) => void, reject: (reason: unknown) => void) => {
          const payload = table === 'station_customers'
            ? { data: null, count: customers, error: null }
            : { data: orders, error: null };
          return Promise.resolve(payload).then(resolve, reject);
        },
      };
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

const normalize = (value: string) => value.replace(/[\u202f\u00a0]/g, ' ').trim();
const xof = (amount: number) => normalize(formatXof(amount));

/** Reads the value stacked under the first KPI card carrying this title. */
async function kpiValue(title: string): Promise<string> {
  const matches = await screen.findAllByText(title);
  const titleElement = matches[0];
  let node: HTMLElement | null = titleElement.parentElement;
  for (let depth = 0; depth < 3 && node; depth += 1) {
    const values = within(node).queryAllByText(/^[\d\s\u202f.,]+FCFA$|^\d+$/);
    if (values.length === 1) return normalize(values[0].textContent ?? '');
    node = node.parentElement;
  }
  throw new assert.AssertionError({ message: `valeur de « ${title} » introuvable` });
}

async function renderDashboard(orders: unknown[], customers = 3) {
  const { client, calls } = fakeClient(orders, customers);
  const view = render(<StationDashboard stationId="station-1" userId="user-1" client={client} />);
  await waitFor(() => assert.match(view.container.textContent ?? '', /Facturé aujourd’hui/));
  await waitFor(() => assert.doesNotMatch(view.container.textContent ?? '', /Chargement/));
  // Give the second effect (customers count) one tick to land.
  await waitFor(() => assert.ok((view.container.textContent ?? '').includes('Clients enregistrés')));
  return { ...view, calls };
}

/**
 * Les écrans lisent leurs données via TanStack Query : un client de cache est
 * donc nécessaire. Il est créé par test et purgé ensuite, sinon ses minuteries
 * (staleTime, gcTime) empêchent le processus de test de se terminer.
 */
const queryClients: QueryClient[] = [];
function withQueryClient(node: React.ReactNode) {
  const client = createQueryClient();
  queryClients.push(client);
  return <QueryClientProvider client={client}>{node}</QueryClientProvider>;
}

afterEach(() => {
  cleanup();
  for (const client of queryClients.splice(0)) client.clear();
});

async function renderReports(orders: unknown[], customers = 3) {
  const { client } = fakeClient(orders, customers);
  const view = render(withQueryClient(<StationReports stationId="station-1" stationName="Station Test" client={client} />));
  await waitFor(() => assert.match(view.container.textContent ?? '', /Rapport d’activité/));
  // La requête passe maintenant par un cache : attendre la fin du chargement,
  // sinon l'assertion lit l'écran « Chargement du rapport… ».
  await waitFor(() => assert.doesNotMatch(view.container.textContent ?? '', /Chargement du rapport/));
  return view;
}

test('the dashboard bills only the completed washes of the day', async () => {
  const { container } = await renderDashboard(ORDERS);
  assert.equal(await kpiValue('Facturé aujourd’hui'), xof(8500), '5 000 + 3 500 terminés aujourd’hui');
  assert.equal(await kpiValue('Lavages en cours'), '2');
  assert.equal(await kpiValue('Clients enregistrés'), '3');
  assert.equal(await kpiValue('Prestations créées aujourd’hui'), '4', '4 non annulées aujourd’hui');

  // The 9 000 cancelled wash and the 9 000 of quoted-but-unfinished washes
  // must not be summed anywhere.
  const text = normalize(container.textContent ?? '');
  assert.ok(!text.includes(xof(8500 + 9000)), 'la prestation annulée ne doit pas être agrégée');
  assert.ok(!text.includes(xof(8500 + 7000 + 2000)), 'les prestations non terminées ne sont pas facturées');
  assert.doesNotMatch(text, /\+14\s*%|simul|8 véhicules|\u2191/);
});

test('the dashboard shows explicit empty states when nothing exists', async () => {
  const { container } = await renderDashboard([], 0);
  const text = normalize(container.textContent ?? '');
  assert.match(text, /Aucune prestation terminée sur 7 jours/);
  assert.match(text, /Aucune valeur de démonstration n’est affichée/);
  assert.match(text, /Aucune prestation enregistrée/);
  assert.match(text, /Aucune prestation\b/);
  assert.equal(await kpiValue('Facturé aujourd’hui'), xof(0));
  assert.equal(await kpiValue('Lavages en cours'), '0');
  assert.equal(await kpiValue('Prestations créées aujourd’hui'), '0');
  assert.equal(await kpiValue('Clients enregistrés'), '0');
  assert.equal(container.querySelectorAll('.recharts-wrapper').length, 0, 'aucun graphique vide');
});

test('the dashboard never presents a billed amount as collected money', async () => {
  const { container } = await renderDashboard(ORDERS);
  const text = normalize(container.textContent ?? '');
  // The only mention of "encaissées" is the disclaimer that denies it.
  assert.match(text, /Montants facturés, pas recettes encaissées/);
  assert.match(text, /Les paiements ne sont pas enregistrés par l’application/);
  assert.doesNotMatch(text, /Montant encaissé|Recette du jour|Chiffre d’affaires/i);
  assert.doesNotMatch(text, /RÉGLÉ|Payé/i, 'un lavage terminé n’est pas un lavage payé');
});

test('the report totals are the fixture totals for the month', async () => {
  const { container } = await renderReports(ORDERS);
  // Completed in November: 5 000 + 3 500 + 12 000 = 20 500.
  assert.equal(await kpiValue('Montant facturé'), xof(20500));
  assert.equal(await kpiValue('Prestations terminées'), '3');
  assert.equal(await kpiValue('Prestations créées'), '5');
  assert.equal(await kpiValue('Panier moyen'), xof(Math.round(20500 / 3)));

  const text = normalize(container.textContent ?? '');
  // The cancelled row is listed (traceability) but never summed.
  assert.ok(text.includes('Renault Duster'));
  assert.ok(!text.includes(xof(29500)), 'annulée incluse dans un total');
  assert.match(text, /TOTAL FACTURÉ \(3 prestations terminées\)/);
});

test('the report with an empty period shows no total at all', async () => {
  const { container } = await renderReports([]);
  const text = normalize(container.textContent ?? '');
  assert.match(text, /Aucune prestation sur la période/);
  assert.match(text, /Aucune valeur n’est affichée/);
  assert.ok(!text.includes(xof(0)), 'aucun total nul présenté comme un résultat');
  for (const name of [/Télécharger en PDF/, /WhatsApp/, /Imprimer/, /CSV/]) {
    const button = screen.getByRole('button', { name }) as HTMLButtonElement;
    assert.equal(button.disabled, true, `« ${String(name)} » doit être désactivé sans données`);
  }
});

test('the report never invents a profit, a margin or a payment split', async () => {
  const { container } = await renderReports(ORDERS);
  const text = normalize(container.textContent ?? '');
  // Only the disclaimer may contain these words, and only to deny them.
  const claims = text
    .split(/(?<=[.!:])\s+/)
    .filter(sentence => !/ne peut|n’enregistre|non enregistr|pas de|aucun|ni marge|sans valeur/i.test(sentence));
  for (const forbidden of [/b[ée]n[ée]fice/i, /marge/i, /bilan financier/i, /Wave CI/i, /Orange Money/i, /MTN Mobile/i, /22\s*%/]) {
    for (const sentence of claims) assert.doesNotMatch(sentence, forbidden);
  }
  assert.match(text, /Rapport d’activité, pas de bilan financier/);
  assert.match(text, /pas des recettes encaissées/);
  assert.match(text, /aucun bénéfice ni marge ne peut être calculé/);
});
