import { supabase } from './supabase';

type PaymentMethod = 'wave' | 'carte' | 'orange_money' | 'mtn_momo' | 'moov_money' | 'virement' | 'especes';

type PaymentStatus = 'pending' | 'completed' | 'refunded';

export interface PaymentRow {
  id: string;
  station_id: string;
  order_id: string | null;
  amount_xof: number;
  payment_method: PaymentMethod;
  status: PaymentStatus;
  reference: string | null;
  created_at: string;
  request_id: string;
}

export interface RecordPaymentInput {
  stationId: string;
  orderId?: string;
  amountXof: number;
  paymentMethod: PaymentMethod;
  reference?: string;
  requestId: string;
}

export async function recordPayment(input: RecordPaymentInput): Promise<PaymentRow> {
  const { data, error } = await supabase.rpc<PaymentRow>('record_payment', {
    p_station_id: input.stationId,
    p_order_id: input.orderId ?? null,
    p_amount_xof: input.amountXof,
    p_payment_method: input.paymentMethod,
    p_reference: input.reference ?? null,
    p_request_id: input.requestId,
  });
  if (error) throw new Error(`Enregistrement paiement impossible: ${error.message}`);
  return data;
}

export async function listPayments(stationId: string, limit: number = 100): Promise<PaymentRow[]> {
  const { data, error } = await supabase
    .from('station_payments')
    .eq('station_id', stationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Liste des paiements impossible: ${error.message}`);
  return data as PaymentRow[];
}

export async function getPayment(paymentId: string): Promise<PaymentRow | null> {
  const { data, error } = await supabase
    .from('station_payments')
    .eq('id', paymentId)
    .single();
  if (error || !data) return null;
  return data as PaymentRow;
}

export async function listPaymentsByOrder(stationId: string, orderId: string): Promise<PaymentRow[]> {
  const { data, error } = await supabase
    .from('station_payments')
    .eq('station_id', stationId)
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Liste des paiements par ordre impossible: ${error.message}`);
  return data as PaymentRow[];
}

export async function calculateStationTotal(
  stationId: string,
  sinceDate?: Date
): Promise<{ totalXof: number; count: number }> {
  let query = supabase.from('station_payments').select('amount_xof', { count: 'exact', head: true }).eq('station_id', stationId).eq('status', 'completed');
  if (sinceDate) {
    query = query.gte('created_at', sinceDate.toISOString());
  }
  const { data, error, count } = await query;
  if (error) throw new Error(`Calcul total station impossible: ${error.message}`);
  const amounts = (data as { amount_xof: number }[] ?? []);
  const totalXof = amounts.reduce((sum, p) => sum + p.amount_xof, 0);
  return { totalXof, count: count ?? 0 };
}

export function exportPaymentsCsv(payments: PaymentRow[]): string {
  const headers = ['ID', 'Station ID', 'Order ID', 'Montant (XOF)', 'Méthode', 'Statut', 'Référence', 'Date'];
  const rows = payments.map(p => [
    p.id,
    p.station_id,
    p.order_id || '',
    p.amount_xof,
    p.payment_method,
    p.status,
    p.reference || '',
    p.created_at,
  ]);
  return [headers, ...rows].map(row => row.join(',')).join('\n');
}
