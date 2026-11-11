import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Alert } from './ui/designSystem';
import { AuthGate, type AuthScreen } from './portal/AuthGate';
import { PortalHeader } from './portal/PortalHeader';
import { StationPicker } from './portal/StationPicker';
import { StationModuleNav } from './portal/StationModuleNav';
import { StationModulePanel } from './portal/StationModulePanel';
import { DiagnosticPanel } from './DiagnosticPanel';
import { usePortalSession } from '../hooks/usePortalSession';
import { useStations } from '../hooks/useStations';
import { useStationRole } from '../hooks/useStationRole';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { acceptInvitation, resolvePortalClient } from '../lib/portalApi';
import { invitationReferenceSchema, parseForm, stationNameFormSchema } from '../lib/schemas';
import { errorText } from '../lib/errorMessages';
import { describeError } from '../lib/queryResult';
import { resolveTab, type StationTabId } from '../lib/portalNavigation';

/**
 * Portail propriétaire / gérant / caissier / laveur.
 *
 * Ce fichier ne contient plus que l'orchestration : il choisit la vue
 * (authentification ou espace de travail), garde deux états de formulaire et
 * connecte session, stations, rôle, onglet.
 *
 * Découpé lors de la P1 (il approchait 620 lignes) :
 *  - `hooks/usePortalSession` — abonnement Supabase, lien de récupération ;
 *  - `hooks/useStations` + `hooks/useStationRole` — données et rôle ;
 *  - `hooks/useOnlineStatus` — état réseau ;
 *  - `lib/portalApi` — requêtes et cache des stations ;
 *  - `lib/portalNavigation` — matrice d'onglets (source unique) ;
 *  - `components/portal/*` — en-tête, sélecteur de station, navigation, panneau,
 *    écrans d'authentification.
 *
 * Les droits restent ceux de PostgreSQL : RLS sur les tables, RPC
 * `SECURITY DEFINER` pour tout ce qui décide quelque chose. La matrice
 * d'onglets ne fait que masquer des entrées dont l'accès serait de toute façon
 * refusé côté serveur.
 */
export function OwnerPortal({ client }: { client?: SupabaseClient | null }) {
  const supabase = resolvePortalClient(client);
  const {
    session,
    loading: sessionLoading,
    error: sessionError,
    recovery,
    leaveRecovery,
  } = usePortalSession(supabase);
  const online = useOnlineStatus();
  const userId = session?.user.id ?? null;
  const {
    stations,
    stationId,
    selectStation,
    refresh: refreshStations,
    create: createStation,
    error: stationsError,
    clearError: clearStationsError,
  } = useStations(supabase, userId);
  const {
    role: stationRole,
    roleLoading,
    roleFromServer,
  } = useStationRole(supabase, userId, stationId, stations, online);

  const [screen, setScreen] = useState<AuthScreen>('signin');
  const [message, setMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [diagnosticOpen, setDiagnosticOpen] = useState(false);
  const [newStationName, setNewStationName] = useState('');
  const [invitationCode, setInvitationCode] = useState('');
  const [tab, setTab] = useState<StationTabId>('dashboard');

  /* ---------------- authentification ---------------- */

  if (!supabase) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-slate-950">
        <Alert variant="error" title="Backend non configuré">
          Les variables d’environnement Supabase sont absentes. Définissez
          <code className="mx-1">VITE_SUPABASE_URL</code> et
          <code className="mx-1">VITE_SUPABASE_ANON_KEY</code>, puis rechargez la page.
        </Alert>
      </main>
    );
  }

  if (sessionLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950">
        <p className="text-sm text-[var(--text-secondary)]">Vérification de la session…</p>
      </main>
    );
  }

  if (!session) {
    return (
      <AuthGate
        client={supabase}
        screen={recovery ? 'reset' : screen}
        onScreenChange={next => {
          setScreen(next);
          if (next !== 'reset') leaveRecovery();
        }}
        onMessage={value => {
          setMessage(value);
          setActionError('');
        }}
        onRecoveryLeft={() => {
          leaveRecovery();
          setScreen('signin');
        }}
        banner={
          <>
            {sessionError && <Alert variant="error">{sessionError}</Alert>}
            {message && <Alert variant="success">{message}</Alert>}
          </>
        }
      />
    );
  }

  /* ---------------- espace de travail ---------------- */

  const activeStation = stations.find(station => station.id === stationId);
  const visibleTab = stationRole ? resolveTab(stationRole, tab) : null;
  const canManageStation = stationRole === 'owner' || stationRole === 'gerant';

  async function handleSignOut() {
    setBusy(true);
    try {
      await supabase!.auth.signOut();
      setScreen('signin');
      setMessage('');
    } catch (cause) {
      setActionError(describeError(cause, 'Déconnexion impossible.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateStation(event: React.FormEvent) {
    event.preventDefault();
    // Auparavant un nom vide provoquait un `return` muet : le bouton semblait
    // inerte. La borne est celle de `stations.name` (1..120 après trim).
    const parsed = parseForm(stationNameFormSchema, { name: newStationName });
    if (!parsed.ok) {
      setActionError(parsed.errors.name ?? 'Nom de la station invalide.');
      return;
    }
    setBusy(true);
    setActionError('');
    try {
      await createStation(parsed.data.name);
      setNewStationName('');
      setTab('dashboard');
    } catch (cause) {
      setActionError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  async function handleAcceptInvitation(event: React.FormEvent) {
    event.preventDefault();
    // Validée localement pour éviter un aller-retour inutile ; la RPC revalide.
    // Le message vient du schéma, donc il dit ce qui est attendu (format UUID)
    // au lieu de se contenter d'une longueur.
    const parsed = parseForm(invitationReferenceSchema, invitationCode);
    if (!parsed.ok) {
      setActionError(parsed.errors._form ?? 'Référence d’invitation invalide.');
      return;
    }
    const reference = parsed.data;
    setBusy(true);
    setActionError('');
    try {
      await acceptInvitation(supabase!, reference);
      setInvitationCode('');
      setMessage('Invitation acceptée. La station apparaît dans votre liste.');
      refreshStations();
    } catch (cause) {
      setActionError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--surface-page)] text-[var(--text-primary)] p-4 sm:p-6">
      {/*
        Lien d'évitement : premier élément focusable de la page. Sans lui, un
        utilisateur clavier doit traverser le logo, le compte, le thème et la
        déconnexion avant chaque module. Visible seulement quand il a le focus
        (voir `.skip-link` dans index.css).
      */}
      <a href="#contenu-principal" className="skip-link">
        Aller au contenu principal
      </a>
      <div className="max-w-6xl mx-auto space-y-5">
        <PortalHeader email={session.user.email ?? ''} onSignOut={() => void handleSignOut()} />

        {!online && (
          <Alert variant="warning" title="Hors ligne">
            Les prestations déjà enregistrées sur cet appareil seront envoyées au retour du réseau. Les autres
            modules nécessitent une connexion.
          </Alert>
        )}

        {(actionError || stationsError) && (
          <Alert
            variant="error"
            action={
              <button
                type="button"
                className="underline text-xs font-semibold text-rose-300"
                onClick={() => {
                  setActionError('');
                  clearStationsError();
                }}
              >
                Masquer
              </button>
            }
          >
            {actionError || stationsError}
          </Alert>
        )}

        {message && <Alert variant="success">{message}</Alert>}

        <div id="contenu-principal" tabIndex={-1}>
          <StationPicker
            stations={stations}
            stationId={stationId}
            stationRole={stationRole}
            userId={session.user.id}
            online={online}
            busy={busy}
            newStationName={newStationName}
            invitationCode={invitationCode}
            onSelectStation={id => {
              selectStation(id);
              setTab('dashboard');
              setActionError('');
            }}
            onCreateStation={event => void handleCreateStation(event)}
            onChangeNewStationName={setNewStationName}
            onChangeInvitationCode={setInvitationCode}
            onAcceptInvitation={event => void handleAcceptInvitation(event)}
          />

          {stationId && activeStation && (
            <>
              {roleLoading ? (
                <p className="text-sm text-[var(--text-secondary)]">
                  Vérification de votre rôle sur {activeStation.name}…
                </p>
              ) : stationRole && visibleTab ? (
                <>
                  <StationModuleNav role={stationRole} tab={visibleTab} onSelect={setTab} />
                  <StationModulePanel
                    tab={visibleTab}
                    role={stationRole}
                    roleFromServer={roleFromServer}
                    stationId={stationId}
                    stationName={activeStation.name}
                    userId={session.user.id}
                  />
                </>
              ) : (
                <Alert variant="warning" title="Accès non accordé">
                  Votre compte n’a pas de rôle actif sur {activeStation.name}. Demandez une invitation au
                  propriétaire.
                </Alert>
              )}
            </>
          )}

          {!stationId && stations.length === 0 && canManageStation && (
            <p className="text-xs text-[var(--text-secondary)]">
              Créez votre première station ci-dessus pour accéder au tableau de bord, aux prestations et au
              catalogue.
            </p>
          )}
        </div>

        <footer className="relative flex flex-col items-center gap-2 pt-2 text-center text-[11px] text-[var(--text-muted)]">
          <button
            type="button"
            onClick={() => setDiagnosticOpen(true)}
            className="cursor-pointer underline decoration-dotted underline-offset-2 hover:text-[var(--text-secondary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] rounded-[var(--radius-sm)] px-1"
          >
            Diagnostic de cet appareil
          </button>
          <span>
            ServiceLavage · Les compteurs affichés proviennent des prestations enregistrées sur le serveur,
            jamais d’une estimation.
          </span>
        </footer>

        <DiagnosticPanel
          isOpen={diagnosticOpen}
          onClose={() => setDiagnosticOpen(false)}
          perimeter={
            stationId && session
              ? {
                  userId: session.user.id,
                  stationId,
                  stationName: activeStation?.name ?? stationId,
                }
              : null
          }
          appVersion={import.meta.env.VITE_APP_VERSION ?? 'développement'}
        />
      </div>
    </div>
  );
}
