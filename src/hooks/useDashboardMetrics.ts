import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { countCustomers, fetchOrders } from '../lib/stationApi';
import { listQueuedOrders } from '../lib/offlineOrders';
import {
  dailyBilledSeries,
  dashboardMetrics,
  isSeriesEmpty,
  statusDistribution,
  type StationOrderRow,
} from '../lib/stationMetrics';

/**
 * Données du tableau de bord : prestations, comptage clients, file locale, et
 * les trois séries qui en découlent.
 *
 * Extrait de `StationDashboard`, qui portait l'appel PostgREST, le comptage, la
 * lecture de la file, la référence temporelle et les `useMemo` dans le même
 * composant que deux graphiques.
 *
 * Aucun calcul ici : `stationMetrics` reste la seule source des chiffres, et la
 * file hors ligne n'entre que dans un comptage — elle n'a pas de prix (voir
 * `StationMetrics`), donc elle ne peut pas gonfler un montant.
 */
export type QueuedSummary = {
  requestId: string;
  vehicle: string;
  plate: string | null;
  createdAt: string;
};

export function useDashboardMetrics(
  client: SupabaseClient | null,
  stationId: string,
  userId: string,
  /**
   * Instant de référence, injecté uniquement par les tests. En production il
   * reste `undefined` et l'instant est celui du rendu : c'est ce qui permet à
   * « aujourd'hui » de désigner le jour de l'utilisateur, pas celui du build.
   */
  referenceNow?: Date,
) {
  const [orders, setOrders] = useState<StationOrderRow[]>([]);
  const [queued, setQueued] = useState<QueuedSummary[]>([]);
  const [customerCount, setCustomerCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    if (!client || !stationId) return;
    setError('');
    try {
      // (1) Prestations de la station. RLS les restreint déjà au tenant ; le
      // filtre `.eq('station_id')` est un garde-fou contre une erreur d'appel.
      await fetchOrders(client, stationId)
        .then(rows => setOrders(rows as StationOrderRow[]))
        .catch((cause: unknown) => {
          setError(cause instanceof Error ? cause.message : 'Chargement des prestations impossible.');
        });

      // (2) Comptage côté serveur, sans rapatrier la table des clients.
      await countCustomers(client, stationId)
        .then(setCustomerCount)
        .catch((cause: unknown) => {
          const message = cause instanceof Error ? cause.message : 'Comptage des clients impossible.';
          setError(previous => previous || message);
        });

      // (3) File locale : comptée, jamais valorisée (voir stationMetrics).
      try {
        setQueued(
          listQueuedOrders(localStorage, userId, stationId).map(item => ({
            requestId: item.requestId,
            vehicle: item.vehicle,
            plate: item.plate,
            createdAt: item.createdAt,
          })),
        );
      } catch {
        setError('La file locale est illisible ; elle a été conservée sur cet appareil.');
      }
    } finally {
      setLoaded(true);
      setRefreshing(false);
    }
  }, [client, stationId, userId]);

  useEffect(() => {
    setLoaded(false);
    void loadData();
  }, [loadData]);

  // One reference instant for the whole render, so every panel describes the
  // same day even if the render straddles midnight.
  // Instant de référence figé pendant le rendu, recalculé quand les données
  // changent (voir `StationReports`, même motif).
  // eslint-disable-next-line react-hooks/exhaustive-deps -- volontaire : l'instant suit les données
  const reference = useMemo(() => referenceNow ?? new Date(), [orders, customerCount, queued, referenceNow]);

  const metrics = useMemo(
    () => dashboardMetrics(orders, reference, { customersCount: customerCount, queuedCount: queued.length }),
    [orders, reference, customerCount, queued.length],
  );
  const series = useMemo(() => dailyBilledSeries(orders, reference), [orders, reference]);
  const distribution = useMemo(() => statusDistribution(orders), [orders]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    void loadData();
  }, [loadData]);

  return {
    orders,
    queued,
    loaded,
    refreshing,
    error,
    metrics,
    series,
    seriesEmpty: isSeriesEmpty(series),
    distribution,
    distributionEmpty: distribution.every(slice => slice.value === 0),
    recentOrders: orders.slice(0, 5),
    refresh,
  };
}
