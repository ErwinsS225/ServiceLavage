import { forwardRef } from 'react';
import { formatXof } from '../../lib/money';
import { receiptPaymentLabel } from '../../lib/stationMetrics';
import { receiptDateLabel, receiptTicketCode, type OrderReceiptData } from '../../lib/receiptDocument';
import { ReceiptQrCode } from './ReceiptQrCode';

/**
 * Ticket 80 mm tel qu'il est imprimé et capturé pour le PDF.
 *
 * Extrait de `ReceiptModal` : c'est le seul bloc que html2canvas lit, donc le
 * seul dont la mise en page doit rester stable. Il ne calcule presque rien —
 * référence, date et libellé d'état viennent de `lib/receiptDocument`.
 *
 * Contrainte de fond, visible à deux endroits : aucune colonne de paiement.
 * La base n'enregistre ni moyen de paiement ni encaissement, donc le ticket
 * affiche « montant facturé » et « état du lavage », jamais « réglé ».
 */
export const ReceiptPaper = forwardRef<HTMLDivElement, {
  order: OrderReceiptData;
  stationName: string;
  qrPayload: string;
}>(function ReceiptPaper({ order, stationName, qrPayload }, ref) {
  const code = receiptTicketCode(order);
  const date = receiptDateLabel(order.createdAt);

  return (
    <div
      ref={ref}
      className="p-5 bg-white text-gray-900 font-mono text-xs select-text printable-ticket"
    >
      <div className="text-center pb-3 border-b-2 border-dashed border-gray-400 space-y-1">
        <div className="font-sans font-black text-lg text-cyan-700 tracking-tight flex items-center justify-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-full bg-cyan-600 inline-block" />
          SERVICELAVAGE
        </div>
        <p className="font-bold text-[11px] uppercase text-gray-800">{stationName || 'Station Auto'}</p>
        <p className="text-[10px] text-gray-600">Abidjan • Côte d’Ivoire</p>
      </div>

      <div className="py-2.5 border-b border-dashed border-gray-300 space-y-1 text-[11px]">
        <Row label="N° TICKET :" value={code} valueClassName="font-bold text-gray-900" />
        <Row label="DATE :" value={date} valueClassName="text-gray-800" />
      </div>

      <div className="py-2.5 border-b border-dashed border-gray-300 space-y-1 text-[11px]">
        <span className="text-gray-500 text-[10px] uppercase font-bold block">Véhicule</span>
        <div className="flex justify-between font-bold text-xs text-gray-900">
          <span>{order.vehicleInfo}</span>
          <span className="font-mono">{order.plateNumber || 'N/A'}</span>
        </div>
      </div>

      <div className="py-2.5 border-b border-dashed border-gray-300 space-y-1.5 text-[11px]">
        <span className="text-gray-500 text-[10px] uppercase font-bold block">Prestations</span>
        {order.items && order.items.length > 0 ? (
          order.items.map((item, index) => (
            <div key={`${item.name}-${index}`} className="flex justify-between text-gray-800">
              <span className="truncate pr-2">{item.name}</span>
              <span className="font-semibold">{formatXof(item.price)}</span>
            </div>
          ))
        ) : (
          <div className="flex justify-between text-gray-800">
            <span>Lavage véhicule</span>
            <span className="font-semibold">{formatXof(order.totalXof)}</span>
          </div>
        )}
      </div>

      <div className="py-3 border-b-2 border-dashed border-gray-400 space-y-1.5 text-[11px]">
        <div className="flex justify-between text-sm font-black text-gray-900">
          <span>MONTANT FACTURÉ :</span>
          <span>{formatXof(order.totalXof)}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-gray-600">ÉTAT DU LAVAGE :</span>
          <span className={`font-bold ${order.status === 'termine' ? 'text-emerald-700' : 'text-amber-700'}`}>
            {receiptPaymentLabel(order.status)}
          </span>
        </div>
        <p className="text-[9px] text-gray-500 leading-snug">
          Paiement non enregistré par l’application : ce document atteste de la prestation, pas du règlement.
        </p>
      </div>

      <div className="pt-3 text-center space-y-1.5">
        <div className="flex justify-center">
          <div className="p-1.5 border border-gray-300 rounded bg-white">
            <ReceiptQrCode payload={qrPayload} />
          </div>
        </div>
        <p className="text-[9px] text-gray-500">
          Scanner ce code affiche la référence, le véhicule, le montant et la date du ticket.
        </p>
        <p className="text-[9px] text-gray-500">
          ServiceLavage CI • Reçu de prestation, document interne
        </p>
      </div>
    </div>
  );
});

function Row({ label, value, valueClassName }: { label: string; value: string; valueClassName: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-600">{label}</span>
      <span className={valueClassName}>{value}</span>
    </div>
  );
}
