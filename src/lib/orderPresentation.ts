import type { OrderReceiptData } from '../components/ReceiptModal';
import type { OrderRow, OrderStatus } from './stationApi';

/**
 * Transformation d'une ligne `station_orders` en données de reçu.
 *
 * Pourquoi c'est ici et pas dans `StationOrders` : la référence du ticket et le
 * montant total sont des règles, pas du rendu. Les sortir permet de les tester
 * sans rendu et empêche qu'elles divergent entre l'écran, le PDF et le QR.
 *
 * Deux points volontairement explicites :
 *  - la référence n'est **pas** un numéro fiscal séquentiel ; c'est un dérivé
 *    de l'UUID, tronqué et mis en majuscules, faute de séquence serveur ;
 *  - le montant transmis est le `total_xof` figé au moment de la création,
 *    jamais recalculé à partir du catalogue courant.
 */

/** Référence lisible affichée sur le reçu. Dérivée de l'UUID, donc stable. */
export function ticketNumberFor(orderId: string): string {
  return `TICK-${orderId.slice(0, 6).toUpperCase()}`;
}

export function toReceiptData(order: OrderRow): OrderReceiptData {
  return {
    id: order.id,
    ticketNumber: ticketNumberFor(order.id),
    vehicleInfo: order.vehicle_info,
    plateNumber: order.plate_number,
    totalXof: order.total_xof,
    status: order.status,
    createdAt: order.created_at,
    items: (order.station_order_items ?? []).map(item => ({ name: item.service_name, price: item.price_xof })),
  };
}

/** Compteurs de l'en-tête : de simples comptages, aucun taux ni tendance. */
export function orderCounts(orders: readonly OrderRow[]): Record<OrderStatus | 'total', number> {
  return {
    total: orders.length,
    en_attente: orders.filter(order => order.status === 'en_attente').length,
    en_cours: orders.filter(order => order.status === 'en_cours').length,
    termine: orders.filter(order => order.status === 'termine').length,
    annule: orders.filter(order => order.status === 'annule').length,
  };
}

/** Total **estimé** du panier de services sélectionnés, avant enregistrement. */
export function selectedServicesTotal(
  services: ReadonlyArray<{ id: string; price_xof: number }>,
  selectedIds: readonly string[],
): number {
  return services
    .filter(service => selectedIds.includes(service.id))
    .reduce((sum, service) => sum + service.price_xof, 0);
}
