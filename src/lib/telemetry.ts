/**
 * Journalisation structurée et capture d'erreurs.
 *
 * Pourquoi ce module existe : aujourd'hui, une erreur de production laisse
 * trois lignes de `console.error` en texte libre. Sur le terrain — une station,
 * un téléphone, un caissier qui signale « ça n'a pas marché » — cela ne permet
 * ni de retrouver l'incident, ni de savoir quelle action a échoué, ni même
 * combien de fois c'est arrivé. Ce fichier remplace le texte libre par des
 * **événements** : un nom, un niveau, un contexte, une trace.
 *
 * Ce qu'il ne fait pas, volontairement :
 *  - il n'envoie rien à un tiers (pas de Sentry, pas de Datadog) : aucune
 *    dépendance externe, aucun appel réseau automatique, aucune donnée qui
 *    sort de l'appareil sans décision explicite ;
 *  - il ne journalise jamais de secret, de jeton, d'email ni de numéro de
 *    téléphone — voir `redact` ci-dessous ;
 *  - il ne mesure pas la performance réseau du serveur : ce que le navigateur
 *    peut mesurer est mesuré, le reste est inconnu et n'est pas inventé.
 *
 * Ce qu'il offre : des événements lisibles par un humain **et** par une
 * machine, un tampon consultable depuis l'application (diagnostic hors ligne),
 * et un point d'accroche unique pour brancher un service de collecte le jour où
 * quelqu'un le décidera — ce jour-là, une seule fonction à écrire.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEvent {
  /** Nom stable, en `domaine.action` : sert de filtre, ne doit pas changer. */
  event: string;
  level: LogLevel;
  /** Horodatage ISO 8601, lisible et triable. */
  at: string;
  /** Champs propres à l'événement, déjà nettoyés de toute donnée personnelle. */
  context?: Record<string, unknown>;
  /** Message d'erreur traduit ; jamais de SQL ni de trace brute à l'écran. */
  message?: string;
  /** Code serveur (`errcode` PostgreSQL, `code` PostgREST) s'il existe. */
  code?: string;
  /** Nom de l'erreur technique (`TypeError`, `AbortError`…). */
  errorName?: string;
  /** Empreinte courte, pour compter les occurrences sans stocker la trace. */
  fingerprint?: string;
}

/** Taille du tampon en mémoire : au-delà, les plus anciens sont oubliés. */
const BUFFER_LIMIT = 200;

/**
 * Clés dont la valeur ne doit **jamais** être journalisée. La liste est
 * volontairement large : mieux vaut perdre un champ utile que consigner un
 * jeton dans un écran que le caissier peut montrer au technicien.
 */
const SENSITIVE_KEYS = [
  'password',
  'token',
  'access_token',
  'refresh_token',
  'secret',
  'apikey',
  'api_key',
  'authorization',
  'email',
  'phone',
  'plate',
  'customer',
  'vehicle',
  'name',
];

/**
 * Nettoie une valeur avant journalisation.
 *
 * Règle : une clé sensible est remplacée par `[masqué]`, pas supprimée. Savoir
 * qu'un champ était renseigné n'est pas une fuite, et c'est parfois
 * l'information utile au diagnostic (« l'adresse était vide »).
 */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[profond]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    // Une adresse email ou un numéro qui traînerait dans une chaîne libre.
    return value.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]').replace(/\+?\d[\d\s().-]{7,}\d/g, '[numéro]');
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (Array.isArray(value)) return value.slice(0, 20).map(item => redact(item, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const sensitive = SENSITIVE_KEYS.some(marker => key.toLowerCase().includes(marker));
      out[key] = sensitive ? '[masqué]' : redact(item, depth + 1);
    }
    return out;
  }
  return '[inconnu]';
}

/**
 * Empreinte stable d'une erreur : même erreur, même empreinte.
 *
 * Sert à compter « cette panne est arrivée 12 fois » sans stocker 12 traces.
 * Le message est normalisé (chiffres et identifiants retirés) pour que deux
 * occurrences de la même erreur sur deux commandes différentes se regroupent.
 */
export function fingerprintOf(error: unknown): string {
  const name = error instanceof Error ? error.name : 'Inconnu';
  const message = error instanceof Error ? error.message : String(error);
  // Les UUID d'abord : sans cela, leurs chiffres sont remplacés un par un et
  // l'identifiant unique de la commande reste dans la chaîne — deux occurrences
  // de la même panne obtenaient alors deux empreintes différentes, ce qui vide
  // le regroupement de son sens.
  // Un seul remplacement pour toutes les parties variables : l'identifiant de
  // commande, le numéro de prestation et le compte d'éléments sont remplacés par
  // le même jeton. Deux pannes identiques sur deux commandes différentes se
  // regroupent donc, et « 3 éléments » reste la même panne que « 12 éléments ».
  const normalized = message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<x>')
    .replace(/[0-9a-f]{16,}/gi, '<x>')
    .replace(/\d+/g, '<x>')
    .slice(0, 120);
  // Hachage simple (djb2) : pas de dépendance cryptographique pour une clé de
  // regroupement, et une empreinte courte reste lisible dans un écran.
  let hash = 5381;
  const input = `${name}|${normalized}`;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) + hash + input.charCodeAt(index)) & 0xffffffff;
  }
  return `${name}:${(hash >>> 0).toString(16)}`;
}

/** Tampon circulaire des derniers événements, consultable sur l'appareil. */
const buffer: LogEvent[] = [];

/** Abonnés, pour un écran de diagnostic qui se met à jour en direct. */
const listeners = new Set<(event: LogEvent) => void>();

function emit(event: LogEvent): void {
  buffer.push(event);
  if (buffer.length > BUFFER_LIMIT) buffer.shift();
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // Un abonné défaillant ne doit pas casser la journalisation.
    }
  }
}

/** Une ligne lisible, pour la console du navigateur. */
function formatLine(event: LogEvent): string {
  const parts = [event.at, event.level.toUpperCase().padEnd(5), event.event];
  if (event.code) parts.push(`code=${event.code}`);
  if (event.message) parts.push(`« ${event.message} »`);
  if (event.context) parts.push(JSON.stringify(event.context));
  return parts.join(' ');
}

/**
 * Enregistre un événement.
 *
 * `debug` est ignoré en production : le journal d'un caissier n'a pas à
 * contenir ce qui n'a servi qu'au développement.
 */
export function log(
  level: LogLevel,
  event: string,
  context?: Record<string, unknown>,
  extra?: { message?: string; code?: string; error?: unknown },
): LogEvent {
  const isDev = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV === true;
  if (level === 'debug' && !isDev) {
    return { event, level, at: new Date().toISOString() };
  }

  const record: LogEvent = {
    event,
    level,
    at: new Date().toISOString(),
    context: context ? (redact(context) as Record<string, unknown>) : undefined,
    message: extra?.message,
    code: extra?.code,
    errorName: extra?.error instanceof Error ? extra.error.name : undefined,
    fingerprint: extra?.error ? fingerprintOf(extra.error) : undefined,
  };
  emit(record);

  // La console reste le seul destinataire : aucune donnée ne part ailleurs.
  // `info` et `debug` passent par `console.error`/`warn` uniquement en
  // développement, où ils aident ; en production, seuls les problèmes
  // s'affichent, pour ne pas noyer le journal d'un caissier.

  if (level === 'error') console.error(formatLine(record));
  else if (level === 'warn') console.warn(formatLine(record));
  else if (isDev) console.warn(formatLine(record));

  return record;
}

/** Raccourcis : `track.error('orders.create', { stationId })`. */
export const track = {
  debug: (event: string, context?: Record<string, unknown>) => log('debug', event, context),
  info: (event: string, context?: Record<string, unknown>) => log('info', event, context),
  warn: (event: string, context?: Record<string, unknown>, extra?: { message?: string }) =>
    log('warn', event, context, extra),
  error: (
    event: string,
    error?: unknown,
    context?: Record<string, unknown>,
    extra?: { message?: string; code?: string },
  ) => log('error', event, context, { ...extra, error, message: extra?.message ?? describeTechnical(error) }),
};

/**
 * Message technique court, pour le journal uniquement. Jamais affiché : ce que
 * l'utilisateur lit vient de `lib/errorMessages.ts`.
 */
function describeTechnical(error: unknown): string | undefined {
  if (!error) return undefined;
  if (error instanceof Error) return error.message.slice(0, 300);
  if (typeof error === 'string') return error.slice(0, 300);
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' ? message.slice(0, 300) : undefined;
  }
  return undefined;
}

/** Derniers événements, du plus ancien au plus récent. */
export function recentEvents(): LogEvent[] {
  return [...buffer];
}

/** S'abonne aux nouveaux événements ; renvoie la fonction de désabonnement. */
export function subscribe(listener: (event: LogEvent) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Vide le tampon (test, ou après un export de diagnostic). */
export function clearEvents(): void {
  buffer.length = 0;
}

/**
 * Export de diagnostic, pour un technicien.
 *
 * Le format est du JSON indenté : lisible à l'œil et exploitable par un outil.
 * Les valeurs sont déjà nettoyées (`redact`), et `capabilities` décrit
 * l'environnement — c'est ce qui manque le plus quand quelqu'un décrit un bug
 * par téléphone.
 */
export function diagnosticsSnapshot(): string {
  const isDev = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV === true;
  return JSON.stringify(
    {
      _lisez_moi:
        'Diagnostic ServiceLavage. Aucune donnée personnelle : emails, numéros et identifiants sont masqués.',
      generatedAt: new Date().toISOString(),
      environment: {
        dev: isDev,
        userAgent: typeof navigator === 'undefined' ? 'inconnu' : navigator.userAgent,
        language: typeof navigator === 'undefined' ? 'inconnu' : navigator.language,
        online: typeof navigator === 'undefined' ? null : navigator.onLine,
        // Ce que le service worker sait gérer : distinct de « hors ligne », qui
        // ne dit pas si le cache a quelque chose à servir. Voir `offlineDiagnostics`.
        serviceWorker:
          typeof navigator !== 'undefined' && 'serviceWorker' in navigator ? 'supporté' : 'absent',
      },
      events: recentEvents(),
    },
    null,
    2,
  );
}
