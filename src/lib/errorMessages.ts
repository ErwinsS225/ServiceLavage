/**
 * Traduction d'une erreur serveur en message utilisable.
 *
 * Les RPC et contraintes de la base lèvent déjà des messages en français
 * (`raise exception 'Stock insuffisant ou limite dépassée' using errcode =
 * '22023'`). Recopier ces textes à la main dans dix composants les a rendus
 * divergents : chacun décidait quoi afficher, et certains affichaient une
 * phrase inventée pour un échec réseau.
 *
 * Ici, une seule grille :
 *   - le code (`errcode` PostgreSQL / `code` PostgREST) donne la catégorie ;
 *   - le message du serveur n'est repris **que** s'il provient d'un `raise`
 *     de nos migrations (donc en français et vérifié) ;
 *   - une erreur inconnue ne dévoile jamais son texte brut à l'écran.
 *
 * `tests/errorMessages.test.ts` vérifie que chaque `raise exception` présent
 * dans `supabase/migrations/` est couvert ou volontairement ignoré.
 */

/**
 * `import.meta.env` n'existe pas hors de Vite (le lanceur de tests importe ce
 * module), d'où l'accès défensif — même motif que `src/lib/supabase.ts`.
 */
const isDev = ((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV ?? false) === true;

export interface ServerError {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
}

export type ErrorKind =
  | 'permission'
  | 'validation'
  | 'limit'
  | 'conflict'
  | 'foreign_key'
  | 'network'
  | 'auth'
  | 'unknown';

export interface UserFacingError {
  kind: ErrorKind;
  /** Titre court, affichable dans une alerte ou un toast. */
  title: string;
  /** Ce qui s'est passé, en une phrase. */
  message: string;
  /** Ce que l'utilisateur peut faire. Omis quand il n'y a rien à faire. */
  action?: string;
  /** Vrai si relancer l'opération a une chance d'aboutir. */
  retryable: boolean;
  /** Texte serveur, repris seulement s'il est fiable. */
  detail?: string;
}

/**
 * Messages levés par nos propres RPC (relevé par
 * `grep "raise exception" supabase/migrations/*.sql`). Pour chacun : la
 * consigne ajoutée, que le serveur ne donne pas.
 */
const SERVER_MESSAGES: Record<string, Pick<UserFacingError, 'kind' | 'title' | 'action' | 'retryable'>> = {
  'Station non autorisée': {
    kind: 'permission',
    title: 'Station non autorisée',
    action: 'Votre compte n’a pas accès à cette station. Demandez au propriétaire de vérifier votre rôle.',
    retryable: false,
  },
  'Station non autorisée ou identifiant manquant': {
    kind: 'permission',
    title: 'Station non autorisée',
    action: 'Rechargez la page ; si le problème persiste, demandez au propriétaire de vérifier votre accès.',
    retryable: false,
  },
  'Prestation introuvable ou non autorisée': {
    kind: 'permission',
    title: 'Prestation introuvable',
    action: 'Elle a peut-être été supprimée ou appartient à une autre station. Actualisez la liste.',
    retryable: false,
  },
  'Article introuvable': {
    kind: 'permission',
    title: 'Article introuvable',
    action: 'Il a peut-être été supprimé entre-temps. Actualisez l’inventaire.',
    retryable: false,
  },
  'Invitation invalide ou expirée': {
    kind: 'permission',
    title: 'Invitation invalide ou expirée',
    action: 'Demandez une nouvelle invitation au propriétaire de la station.',
    retryable: false,
  },
  'Adresse e-mail confirmée requise': {
    kind: 'permission',
    title: 'Adresse email non confirmée',
    action: 'Confirmez votre adresse depuis l’email reçu à l’inscription, puis réessayez.',
    retryable: false,
  },
  'La modification du stock nécessite le plan Pro ou Business': {
    kind: 'permission',
    title: 'Inventaire non inclus dans votre plan',
    action: 'L’inventaire fait partie des plans Pro et Business. Il n’est pas accessible avec le plan actuel.',
    retryable: false,
  },
  'Limite mensuelle de prestations atteinte pour votre abonnement': {
    kind: 'limit',
    title: 'Limite mensuelle atteinte',
    action: 'Le quota de prestations du mois est épuisé. Il se réinitialise au premier jour du mois suivant.',
    retryable: false,
  },
  'Limite de stations atteinte pour votre abonnement': {
    kind: 'limit',
    title: 'Limite de stations atteinte',
    action: 'Votre abonnement ne permet pas d’ouvrir une station de plus.',
    retryable: false,
  },
  'Stock insuffisant ou limite dépassée': {
    kind: 'validation',
    title: 'Stock insuffisant',
    action: 'La quantité resterait entre 0 et 1 000 000 000. Actualisez le stock avant de réessayer.',
    retryable: false,
  },
  'Transition de statut invalide': {
    kind: 'validation',
    title: 'Changement de statut refusé',
    action: 'Ce passage n’est pas permis depuis l’état actuel de la prestation. Actualisez la liste : quelqu’un l’a peut-être déjà modifiée.',
    retryable: false,
  },
  'Transition non autorisée pour le laveur': {
    kind: 'permission',
    title: 'Changement de statut non autorisé',
    action: 'Un laveur ne peut pas effectuer cette transition. Demandez à un gérant ou au propriétaire.',
    retryable: false,
  },
  'Rôle non autorisé pour modifier cette prestation': {
    kind: 'permission',
    title: 'Modification non autorisée',
    action: 'Votre rôle ne permet pas de modifier cette prestation.',
    retryable: false,
  },
  'Une adhésion existe déjà pour cette station': {
    kind: 'conflict',
    title: 'Membre déjà rattaché',
    action: 'Cette personne a déjà un rôle sur la station. Modifiez son rôle au lieu de l’inviter à nouveau.',
    retryable: false,
  },
  'Modification du propriétaire interdite': {
    kind: 'permission',
    title: 'Propriétaire non modifiable',
    action: 'Le rôle du propriétaire ne peut pas être changé depuis cette écran.',
    retryable: false,
  },
  'Le propriétaire ne peut pas accepter cette invitation': {
    kind: 'validation',
    title: 'Invitation impossible',
    action: 'Vous êtes déjà propriétaire de cette station, l’invitation ne s’applique pas à votre compte.',
    retryable: false,
  },
  'Laveur introuvable ou révoqué': {
    kind: 'validation',
    title: 'Laveur indisponible',
    action: 'Ce laveur a été révoqué ou ne fait plus partie de la station. Actualisez l’équipe.',
    retryable: false,
  },
  'Seul un laveur actif de cette station peut être affecté': {
    kind: 'validation',
    title: 'Affectation impossible',
    action: 'Choisissez un laveur actif de cette station.',
    retryable: false,
  },
  'Client invalide pour cette station': {
    kind: 'validation',
    title: 'Client invalide',
    action: 'Ce client appartient à une autre station. Choisissez-en un de la liste.',
    retryable: false,
  },
  'Véhicule ou immatriculation invalide': {
    kind: 'validation',
    title: 'Véhicule invalide',
    action: 'Renseignez le véhicule (1 à 120 caractères) et une immatriculation de 40 caractères au plus.',
    retryable: false,
  },
  'Sélection de services invalide': {
    kind: 'validation',
    title: 'Sélection de services invalide',
    action: 'Choisissez entre 1 et 20 services, sans doublon.',
    retryable: false,
  },
  'Un service est inactif ou ne relève pas de cette station': {
    kind: 'validation',
    title: 'Service indisponible',
    action: 'Un des services choisis a été désactivé. Actualisez la liste et recommencez.',
    retryable: false,
  },
  'Article invalide': {
    kind: 'validation',
    title: 'Article invalide',
    action: 'Renseignez un nom, une unité et une quantité dans les limites autorisées.',
    retryable: false,
  },
  'Ajustement invalide': {
    kind: 'validation',
    title: 'Ajustement invalide',
    action: 'Saisissez un entier non nul ; le stock doit rester entre 0 et 1 000 000 000.',
    retryable: false,
  },
  'Quantité invalide': {
    kind: 'validation',
    title: 'Quantité invalide',
    action: 'Saisissez un nombre entier positif.',
    retryable: false,
  },
  'Adresse ou rôle invalide': {
    kind: 'validation',
    title: 'Invitation refusée',
    action: 'Vérifiez l’adresse email et le rôle (gérant, caissier ou laveur).',
    retryable: false,
  },
  'Identifiant déjà utilisé': {
    kind: 'conflict',
    title: 'Opération déjà enregistrée',
    action: 'Cette opération a déjà été traitée. Rechargez la page avant de la relancer.',
    retryable: false,
  },
  'Identifiant déjà utilisé pour une autre opération': {
    kind: 'conflict',
    title: 'Opération en conflit',
    action: 'Le même identifiant a servi à une autre opération. Rechargez la page avant de réessayer.',
    retryable: false,
  },
  'Connexion requise': {
    kind: 'auth',
    title: 'Connexion requise',
    action: 'Cette action demande une session active : reconnectez-vous pour continuer.',
    retryable: false,
  },
  'Invitation introuvable ou non autorisée': {
    kind: 'permission',
    title: 'Invitation introuvable',
    action: 'Elle a peut-être été acceptée, annulée ou expirée. Demandez-en une nouvelle.',
    retryable: false,
  },
  'Adhésion introuvable ou déjà révoquée': {
    kind: 'conflict',
    title: 'Membre introuvable',
    action: 'Ce membre a déjà été retiré de la station. Actualisez l’équipe.',
    retryable: false,
  },
  'Station introuvable': {
    kind: 'permission',
    title: 'Station introuvable',
    action: 'Elle a peut-être été supprimée, ou votre accès a été retiré.',
    retryable: false,
  },
};

/**
 * Classification par code, quand le message n'est pas un de ceux ci-dessus —
 * typiquement une contrainte de table violée par un chemin détourné.
 */
const BY_CODE: Record<string, Pick<UserFacingError, 'kind' | 'title' | 'action' | 'retryable'>> = {
  '42501': {
    kind: 'permission',
    title: 'Action non autorisée',
    action: 'Votre rôle ne permet pas cette action sur cette station.',
    retryable: false,
  },
  '22023': {
    kind: 'validation',
    title: 'Données refusées',
    action: 'Une valeur ne respecte pas les règles du serveur. Vérifiez la saisie.',
    retryable: false,
  },
  'P0001': {
    kind: 'limit',
    title: 'Limite atteinte',
    action: 'Votre abonnement ne couvre pas cette opération.',
    retryable: false,
  },
  '23505': {
    kind: 'conflict',
    title: 'Élément déjà existant',
    action: 'Un enregistrement identique existe déjà. Actualisez la liste.',
    retryable: false,
  },
  '23503': {
    kind: 'foreign_key',
    title: 'Élément utilisé ailleurs',
    action: 'Cet élément est référencé par d’autres données : il ne peut pas être supprimé.',
    retryable: false,
  },
  '23514': {
    kind: 'validation',
    title: 'Valeur hors limites',
    action: 'Une valeur sort des bornes autorisées. Corrigez la saisie.',
    retryable: false,
  },
  'PGRST116': {
    kind: 'permission',
    title: 'Élément introuvable',
    action: 'Il a peut-être été supprimé, ou il n’est pas accessible avec votre rôle.',
    retryable: false,
  },
  // Jetons : PostgREST (PGRST301/302) et GoTrue (401/403 sur session expirée).
  PGRST301: {
    kind: 'auth',
    title: 'Session expirée',
    action: 'Reconnectez-vous pour continuer.',
    retryable: false,
  },
  PGRST302: {
    kind: 'auth',
    title: 'Session expirée',
    action: 'Reconnectez-vous pour continuer.',
    retryable: false,
  },
};

/** Fragments de messages d'authentification renvoyés par GoTrue. */
function describeAuthMessage(message: string): UserFacingError | null {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) {
    return {
      kind: 'auth',
      title: 'Identifiants refusés',
      message: 'L’adresse email et le mot de passe ne correspondent à aucun compte.',
      action: 'Vérifiez la saisie. Après cinq échecs, attendez une minute avant de réessayer.',
      retryable: false,
    };
  }
  if (lower.includes('email not confirmed')) {
    return {
      kind: 'auth',
      title: 'Adresse email non confirmée',
      message: 'Ce compte existe mais son adresse n’a pas été confirmée.',
      action: 'Ouvrez l’email d’inscription et cliquez sur le lien de confirmation.',
      retryable: false,
    };
  }
  if (lower.includes('user already registered')) {
    return {
      kind: 'conflict',
      title: 'Compte déjà existant',
      message: 'Une inscription existe déjà avec cette adresse email.',
      action: 'Connectez-vous, ou utilisez la réinitialisation si vous avez oublié le mot de passe.',
      retryable: false,
    };
  }
  if (lower.includes('jwt expired') || lower.includes('token has expired') || lower.includes('invalid claim')) {
    return { kind: 'auth', title: 'Session expirée', message: 'Votre session n’est plus valide.', action: 'Reconnectez-vous.', retryable: false };
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return {
      kind: 'limit',
      title: 'Trop de tentatives',
      message: 'Le service d’authentification limite les essais.',
      action: 'Patientez une minute avant de réessayer.',
      retryable: true,
    };
  }
  return null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Point d'entrée unique : `describeError(erreur)` renvoie toujours un objet
 * affichable, jamais une exception.
 */
export function describeError(error: unknown): UserFacingError {
  // Échec réseau : `fetch` lève un TypeError, sans code ni message utile.
  if (error instanceof TypeError || (isObject(error) && error.name === 'TypeError')) {
    return {
      kind: 'network',
      title: 'Serveur injoignable',
      message: 'La requête n’a pas abouti : la connexion a été interrompue ou le serveur ne répond pas.',
      action: 'Vérifiez votre connexion, puis réessayez.',
      retryable: true,
    };
  }

  if (!isObject(error)) {
    return {
      kind: 'unknown',
      title: 'Erreur inattendue',
      message: 'L’opération a échoué sans explication exploitable.',
      action: 'Réessayez ; si cela se reproduit, signalez-le avec l’heure de l’opération.',
      retryable: true,
    };
  }

  const server = error as ServerError;
  const rawMessage = typeof server.message === 'string' ? server.message.trim() : '';
  const code = typeof server.code === 'string' ? server.code : null;

  // 1. Message connu d'une RPC : on ajoute la consigne, on garde le libellé.
  const known = rawMessage ? SERVER_MESSAGES[rawMessage] : undefined;
  if (known) {
    return {
      kind: known.kind,
      title: known.title,
      message: rawMessage,
      action: known.action,
      retryable: known.retryable,
      detail: rawMessage,
    };
  }

  // 2. Message d'authentification reconnu.
  if (rawMessage) {
    const auth = describeAuthMessage(rawMessage);
    if (auth) return auth;
  }

  // 3. Code connu : catégorie sûre, sans reprendre le texte brut.
  const byCode = code ? BY_CODE[code] : undefined;
  if (byCode) {
    return {
      kind: byCode.kind,
      title: byCode.title,
      message: rawMessage && isFrenchSentence(rawMessage) ? rawMessage : byCode.title + '.',
      action: byCode.action,
      retryable: byCode.retryable,
    };
  }

  // 4. Inconnu : le texte brut peut contenir du SQL, un nom de table ou une
  //    clé ; il reste dans la console, pas à l'écran.
  if (isDev && rawMessage) {
    console.error('Erreur serveur non répertoriée :', rawMessage, code);
  }
  return {
    kind: 'unknown',
    title: 'Erreur inattendue',
    message: 'L’opération n’a pas abouti.',
    action: 'Réessayez. Si l’échec se répète, signalez-le avec l’heure de l’opération.',
    retryable: true,
    detail: isDev ? rawMessage || undefined : undefined,
  };
}

/**
 * Une phrase en français, donc probablement écrite par nous — pas la sortie
 * d'une contrainte PostgreSQL (`new row for relation "…" violates check…`).
 */
function isFrenchSentence(message: string): boolean {
  return /[àâçéèêëîïôûùüÿœ]/.test(message) || /^(Le |La |Les |Un |Une |Aucun|Seul|Identifiant|Station|Prestation|Stock)/.test(message);
}

/** Raccourci pour un toast ou une alerte : le texte à afficher, concaténé. */
export function errorText(error: unknown): string {
  const described = describeError(error);
  if (!described.action) return described.message;
  // Le message serveur n'a pas toujours de ponctuation finale
  // (« Station non autorisée ») : sans ce point, les deux phrases fusionnent.
  const sentence = /[.!?]$/.test(described.message) ? described.message : `${described.message}.`;
  return `${sentence} ${described.action}`;
}
