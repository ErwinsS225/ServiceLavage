import { Building2, Plus, ShieldCheck } from 'lucide-react';
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
  StatusBadge, buttonStyles, formControlStyles, FormField,
} from '../ui/designSystem';
import { NO_STATION_COPY } from '../auth/authCopy';
import { ROLE_LABELS, type StationRole } from '../../lib/portalNavigation';
import type { StationRow } from '../../lib/portalApi';

/**
 * Colonne gauche du portail : stations rattachées, sélection, création et
 * acceptation d'invitation.
 *
 * Le composant ne fait aucun appel : il reçoit les stations, le rôle et les
 * gestionnaires d'événements. `OwnerPortal` décide quand créer ou accepter, et
 * `portalApi` exécute — c'est ce découpage qui rend la porte d'entrée lisible.
 */
export function StationPicker({
  stations,
  stationId,
  stationRole,
  userId,
  online,
  busy,
  newStationName,
  invitationCode,
  onSelectStation,
  onCreateStation,
  onChangeNewStationName,
  onChangeInvitationCode,
  onAcceptInvitation,
}: {
  stations: StationRow[];
  stationId: string;
  stationRole: StationRole | null;
  userId: string;
  online: boolean;
  busy: boolean;
  newStationName: string;
  invitationCode: string;
  onSelectStation: (id: string) => void;
  onCreateStation: (event: React.FormEvent) => void;
  onChangeNewStationName: (value: string) => void;
  onChangeInvitationCode: (value: string) => void;
  onAcceptInvitation: (event: React.FormEvent) => void;
}) {
  const activeStation = stations.find(station => station.id === stationId);

  return (
    <div className="grid gap-5 md:grid-cols-2">
      {/* Active Station Selector */}
      <Card>
        <CardHeader
          action={
            activeStation && stationRole && (
              <StatusBadge status="info" label={ROLE_LABELS[stationRole]} size="sm" />
            )
          }
        >
          <CardTitle as="h2" className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-400" />
            Mes stations de lavage
          </CardTitle>
          <CardDescription>
            Sélectionnez la station de travail pour charger ses données isolées
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {stations.length > 0 ? (
            <div className="space-y-3">
              <FormField label="Station en cours d'exploitation">
                <select
                  className={formControlStyles.select}
                  value={stationId}
                  onChange={event => onSelectStation(event.target.value)}
                >
                  <option value="">Sélectionner une station</option>
                  {stations.map(station => (
                    <option key={station.id} value={station.id}>
                      {station.name} {station.owner_id === userId ? '· (Propriétaire)' : ''}
                    </option>
                  ))}
                </select>
              </FormField>

              <div className="space-y-2 pt-1">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Stations rattachées ({stations.length})
                </span>
                <ul className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {stations.map(station => {
                    const isSelected = stationId === station.id;
                    // A real button, not a clickable <li>: sélectionner une
                    // station au clavier doit être possible (Tab puis Entrée).
                    return (
                      <li key={station.id}>
                        <button
                          type="button"
                          onClick={() => onSelectStation(station.id)}
                          aria-pressed={isSelected}
                          className={`w-full p-2.5 rounded-xl border text-xs cursor-pointer flex items-center justify-between transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 ${
                            isSelected
                              ? 'border-indigo-500 bg-indigo-500/10 text-white font-semibold shadow-sm'
                              : 'border-[#242936] bg-[#161a23] text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          <span className="truncate">{station.name}</span>
                          <span className="text-[10px] font-mono text-slate-500 shrink-0 ml-2">
                            {station.owner_id === userId ? 'Propriétaire' : 'Membre'}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-1 p-3 rounded-xl bg-[#161a23] border border-[#242936]">
              <p className="text-xs font-semibold text-white">{NO_STATION_COPY.title}</p>
              <p className="text-xs text-slate-400">{NO_STATION_COPY.body}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Station & Join Team */}
      <div className="space-y-5">
        {(stationRole === 'owner' || stations.length === 0) && (
          <Card>
            <CardHeader>
              <CardTitle as="h2" className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-sky-400" />
                Créer une station
              </CardTitle>
              <CardDescription>
                Crée un nouveau tenant étanche rattaché à votre compte propriétaire
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onCreateStation} className="space-y-3">
                <FormField label="Nom commercial de la station" required htmlFor="new-station-name">
                  <input
                    id="new-station-name"
                    className={formControlStyles.input}
                    value={newStationName}
                    onChange={event => onChangeNewStationName(event.target.value)}
                    placeholder="Ex: Station Express Riviera 2"
                    maxLength={120}
                    required
                  />
                </FormField>
                <button
                  type="submit"
                  className={`${buttonStyles({ variant: 'primary', size: 'md' })} w-full`}
                  disabled={busy}
                >
                  {busy ? 'Création en cours…' : 'Créer la station'}
                </button>
              </form>
            </CardContent>
          </Card>
        )}

        {stationRole !== 'laveur' && (
          <Card>
            <CardHeader>
              <CardTitle as="h2" className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Rejoindre une équipe
              </CardTitle>
              <CardDescription>
                Activez un accès collaborateur à partir d'un code d'invitation reçu
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onAcceptInvitation} className="space-y-3">
                <FormField
                  label="Référence d’invitation"
                  required
                  hint="Identifiant à 36 caractères transmis par le gérant"
                  htmlFor="invitation-reference"
                >
                  <input
                    id="invitation-reference"
                    className={formControlStyles.input}
                    value={invitationCode}
                    onChange={event => onChangeInvitationCode(event.target.value)}
                    placeholder="Ex: 12345678-abcd-1234-abcd-1234567890ab"
                  />
                </FormField>
                <button
                  type="submit"
                  className={`${buttonStyles({ variant: 'secondary', size: 'md' })} w-full`}
                  disabled={busy || !online}
                >
                  Vérifier et accepter l’invitation
                </button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
