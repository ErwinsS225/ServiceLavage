import { CheckCircle2, FileText, Play, XCircle } from 'lucide-react';
import { buttonStyles } from '../ui/designSystem';
import type { OrderStatus } from '../../lib/stationApi';

/**
 * Boutons d'action d'une ligne de prestation.
 *
 * Extrait de `StationOrders` : les transitions autorisées dépendaient d'un
 * enchaînement de conditions dans la cellule, et le reçu était monté juste à
 * côté. Ici la règle est lisible d'un coup d'œil :
 *
 *   en_attente → Démarrer · Annuler (gérant) · Reçu
 *   en_cours   → Terminer  · Annuler (gérant) · Reçu
 *   termine    → Reçu
 *   annule     → Reçu
 *
 * Ces conditions ne sont qu'un confort : `transition_station_order` vérifie de
 * son côté la transition et les droits, et refuse le reste.
 */
export function OrderActions({
  status,
  busy,
  canCancel,
  onStart,
  onFinish,
  onCancel,
  onReceipt,
}: {
  status: OrderStatus;
  busy: boolean;
  /** Annulation réservée à qui gère la station (le serveur tranche aussi). */
  canCancel: boolean;
  onStart: () => void;
  onFinish: () => void;
  onCancel: () => void;
  onReceipt: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      {status === 'en_attente' && (
        <button type="button" disabled={busy} className={buttonStyles({ variant: 'primary', size: 'sm' })} onClick={onStart}>
          <Play className="w-3.5 h-3.5 mr-1" />
          Démarrer
        </button>
      )}
      {status === 'en_cours' && (
        <button type="button" disabled={busy} className={buttonStyles({ variant: 'success', size: 'sm' })} onClick={onFinish}>
          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
          Terminer
        </button>
      )}
      {canCancel && (status === 'en_attente' || status === 'en_cours') && (
        <button type="button" disabled={busy} className={buttonStyles({ variant: 'danger', size: 'sm' })} onClick={onCancel}>
          <XCircle className="w-3.5 h-3.5 mr-1" />
          Annuler
        </button>
      )}
      <button
        type="button"
        className={buttonStyles({ variant: 'outline', size: 'sm' })}
        onClick={onReceipt}
        title="Imprimer le reçu ou l’envoyer par WhatsApp (PDF)"
      >
        <FileText className="w-3.5 h-3.5 mr-1 text-cyan-400" />
        Reçu
      </button>
    </div>
  );
}
