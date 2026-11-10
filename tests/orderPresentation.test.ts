import test from 'node:test';
import assert from 'node:assert/strict';
import {
  orderCounts,
  selectedServicesTotal,
  ticketNumberFor,
  toReceiptData,
} from '../src/lib/orderPresentation';
import type { OrderRow } from '../src/lib/stationApi';

/**
 * Ces règles étaient dans le JSX de StationOrders : la référence du ticket et
 * le total du panier ne pouvaient être vérifiés qu'en rendant l'écran. Un faux
 * numéro séquentiel ou un montant recalculé depuis un catalogue modifié
 * seraient passés inaperçus.
 */

const ORDER: OrderRow = {
  id: 'ab12cd34-1111-2222-3333-444455556666',
  vehicle_info: 'Toyota RAV4 Blanc',
  plate_number: '1234 AB 01',
  total_xof: 8500,
  status: 'termine',
  created_at: '2026-11-10T10:00:00.000Z',
  station_order_items: [
    { id: 'item-1', service_name: 'Lavage extérieur', price_xof: 5000 },
    { id: 'item-2', service_name: 'Aspiration', price_xof: 3500 },
  ],
};

test('the ticket reference is a stable derivation of the uuid', () => {
  assert.equal(ticketNumberFor(ORDER.id), 'TICK-AB12CD');
  assert.equal(ticketNumberFor(ORDER.id), ticketNumberFor(ORDER.id), 'deux appels donnent la même référence');
  // It is not a sequence: two orders created in a row do not share a prefix
  // by construction, and nothing claims to be fiscal.
  assert.doesNotMatch(ticketNumberFor(ORDER.id), /^(FAC|REC)-?\d/);
});

test('the receipt keeps the frozen amount instead of recomputing it', () => {
  const receipt = toReceiptData(ORDER);
  assert.equal(receipt.totalXof, 8500);
  // The displayed total is the stored one, even though the items sum to it:
  // a later catalogue change must not alter a delivered ticket.
  assert.equal(
    receipt.items?.reduce((sum, item) => sum + item.price, 0),
    8500,
  );
  assert.equal(receipt.status, 'termine');
  assert.equal(receipt.plateNumber, '1234 AB 01');
});

test('an order without item lines still produces a valid receipt', () => {
  const receipt = toReceiptData({ ...ORDER, station_order_items: [] });
  assert.deepEqual(receipt.items, []);
  assert.equal(receipt.totalXof, 8500);
});

test('the header counters are plain counts of the real statuses', () => {
  const orders: OrderRow[] = [
    ORDER,
    { ...ORDER, id: 'b', status: 'en_cours' },
    { ...ORDER, id: 'c', status: 'en_attente' },
    { ...ORDER, id: 'd', status: 'annule' },
    { ...ORDER, id: 'e', status: 'termine' },
  ];
  assert.deepEqual(orderCounts(orders), { total: 5, en_attente: 1, en_cours: 1, termine: 2, annule: 1 });
  assert.deepEqual(orderCounts([]), { total: 0, en_attente: 0, en_cours: 0, termine: 0, annule: 0 });
});

test('the basket total is the sum of the selected services only', () => {
  const services = [
    { id: 's1', price_xof: 3000 },
    { id: 's2', price_xof: 2000 },
    { id: 's3', price_xof: 1500 },
  ];
  assert.equal(selectedServicesTotal(services, ['s1', 's3']), 4500);
  assert.equal(selectedServicesTotal(services, []), 0);
  // An id that is not in the list (deactivated service) contributes nothing.
  assert.equal(selectedServicesTotal(services, ['s9']), 0);
});
