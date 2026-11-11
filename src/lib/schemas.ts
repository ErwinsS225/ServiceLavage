import { z } from 'zod';

/**
 * Schémas de validation, alignés sur les contraintes de la base.
 *
 * Principe : chaque borne de ce fichier recopie une contrainte réellement
 * présente dans `supabase/migrations/`, et le commentaire cite laquelle. Un
 * schéma plus permissif laisse passer une saisie que PostgreSQL refusera
 * (erreur brute à l'écran) ; un schéma plus strict bloque une saisie que le
 * serveur accepterait. Les deux sont des bugs, et `tests/schemas.test.ts`
 * vérifie que les valeurs limites passent exactement là où le `check` passe.
 *
 * Ceci ne remplace aucune règle de sécurité : RLS et les RPC `SECURITY DEFINER`
 * restent l'autorité. Ces schémas servent à donner un message précis avant
 * l'appel, pas à empêcher un appel direct.
 */

/** Texte requis, bornes de `length(trim(x)) between 1 and max`. */
function trimmedText(label: string, max: number) {
  return z
    .string()
    .trim()
    .min(1, `${label} : champ obligatoire.`)
    .max(max, `${label} : ${max} caractères maximum.`);
}

/** Entier dans un intervalle, saisie d'un `<input>` (donc chaîne). */
function integerField(label: string, min: number, max: number) {
  return z
    .string()
    .trim()
    .min(1, `${label} : champ obligatoire.`)
    .refine(value => /^\d+$/.test(value), {
      message: `${label} : nombre entier attendu, sans signe, sans virgule ni exposant.`,
    })
    .transform(Number)
    .refine(value => Number.isSafeInteger(value) && value >= min && value <= max, {
      message: `${label} : entre ${min.toLocaleString('fr-FR')} et ${max.toLocaleString('fr-FR')}.`,
    });
}

/* ------------------------------------------------------------------ */
/* Station et catalogue                                                */
/* ------------------------------------------------------------------ */

/** `stations.name` : `length(trim(name)) between 1 and 120`. */
export const stationNameSchema = trimmedText('Nom de la station', 120);

/**
 * Enveloppe un champ texte seul dans un objet, pour que `parseForm` renvoie
 * une erreur sous une clé nommée (`_form` quand le champ n'a pas de nom).
 * Sans cela, un formulaire à un seul champ ne saurait pas à qui rattacher son
 * message.
 */
export const stationNameFormSchema = z.object({ name: stationNameSchema });

/**
 * `station_services` : nom 1..120, prix 0..100 000 000, durée 1..1440.
 * Les trois `check` sont dans `20261109122929_station_services.sql`.
 */
export const serviceSchema = z.object({
  name: trimmedText('Nom du service', 120),
  price_xof: integerField('Prix', 0, 100_000_000),
  duration_minutes: integerField('Durée', 1, 1440),
  is_active: z.boolean(),
});

/** `station_customers` : nom 1..120, téléphone 1..40 (trim). */
export const customerSchema = z.object({
  name: trimmedText('Nom du client', 120),
  phone: z
    .string()
    .trim()
    .min(1, 'Téléphone : champ obligatoire.')
    .max(40, 'Téléphone : 40 caractères maximum.')
    // Un numéro ivoirien s'écrit avec des espaces, des points ou un +225 :
    // on n'impose pas de format, on refuse seulement les caractères qui ne
    // peuvent pas figurer dans un numéro.
    .refine(value => /^[+0-9][0-9 ().-]*$/.test(value), {
      message: 'Téléphone : chiffres, espaces, parenthèses, point, tiret ou + attendus.',
    }),
});

/* ------------------------------------------------------------------ */
/* Prestations                                                         */
/* ------------------------------------------------------------------ */

/**
 * `create_station_order` : véhicule 1..120, plaque ≤ 40 (facultative),
 * 1 à 20 services, **sans doublon** et sans valeur nulle.
 * Voir `20261109123327_station_orders.sql` et sa garde :
 * `count(distinct x) <> cardinality(p_service_ids)`.
 */
export const orderSchema = z.object({
  vehicle: trimmedText('Véhicule', 120),
  plate: z.string().trim().max(40, 'Immatriculation : 40 caractères maximum.').nullable(),
  customerId: z.string().nullable(),
  serviceIds: z
    .array(z.string().min(1))
    .min(1, 'Sélectionnez au moins un service.')
    .max(20, 'Sélectionnez au plus 20 services.')
    .refine(ids => new Set(ids).size === ids.length, {
      message: 'Un service est sélectionné deux fois.',
    }),
});

/* ------------------------------------------------------------------ */
/* Inventaire                                                          */
/* ------------------------------------------------------------------ */

const QUANTITY_MAX = 1_000_000_000;

/**
 * `station_inventory` : nom 1..120, unité 1..30, quantité et seuil
 * 0..1 000 000 000. Voir `20261109182509_station_inventory.sql`.
 */
export const inventoryItemSchema = z.object({
  name: trimmedText('Nom de l’article', 120),
  unit: trimmedText('Unité', 30),
  quantity: integerField('Quantité', 0, QUANTITY_MAX),
  minThreshold: integerField('Seuil minimum', 0, QUANTITY_MAX),
});

/**
 * Ajustement de stock : entier non nul, dans les bornes du serveur.
 * Le signe est accepté ici (c'est un delta), contrairement aux quantités.
 */
export const inventoryAdjustmentSchema = z
  .string()
  .trim()
  .min(1, 'Ajustement : valeur obligatoire.')
  .refine(value => /^[+-]?\d+$/.test(value), {
    message: 'Ajustement : nombre entier attendu.',
  })
  .transform(Number)
  .refine(value => Number.isSafeInteger(value) && value !== 0, {
    message: 'Ajustement : entier non nul attendu.',
  })
  .refine(value => Math.abs(value) <= QUANTITY_MAX, {
    message: `Ajustement : entre −${QUANTITY_MAX.toLocaleString('fr-FR')} et ${QUANTITY_MAX.toLocaleString('fr-FR')}.`,
  });

/* ------------------------------------------------------------------ */
/* Personnel                                                           */
/* ------------------------------------------------------------------ */

/**
 * `station_invitations.email` : `email = lower(btrim(email))` et longueur
 * 3..254 ; la RPC exige de plus une forme `x@y` sans espace
 * (`20261109182442_station_memberships.sql`).
 */
export const invitationSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Adresse email : trop courte.')
    .max(254, 'Adresse email : 254 caractères maximum.')
    .refine(value => /^[^\s@]+@[^\s@]+$/.test(value), {
      message: 'Adresse email invalide.',
    }),
  role: z.enum(['gerant', 'caissier', 'laveur'], {
    message: 'Rôle : gérant, caissier ou laveur.',
  }),
});

/** Référence d'invitation : UUID v1–v8, seule forme acceptée par la RPC. */
export const invitationReferenceSchema = z
  .string()
  .trim()
  .refine(value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value), {
    message: 'Référence d’invitation invalide : 36 caractères au format UUID attendus.',
  });

/* ------------------------------------------------------------------ */
/* Authentification                                                    */
/* ------------------------------------------------------------------ */

/**
 * Connexion : aucune longueur minimale n'est imposée ici.
 *
 * Le projet Supabase exige 6 caractères à l'inscription, l'application en
 * demande 8 (`MIN_PASSWORD_LENGTH`). Appliquer le minimum local à la connexion
 * empêcherait un compte plus ancien de se connecter — un contrôle de saisie
 * n'a pas à décider qui a le droit d'entrer : c'est le rôle du serveur.
 */
export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Adresse email : champ obligatoire.')
    .max(254, 'Adresse email : 254 caractères maximum.')
    .refine(value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
      message: 'Cette adresse email ne semble pas valide (exemple : nom@domaine.ci).',
    }),
  password: z
    .string()
    .min(1, 'Mot de passe : champ obligatoire.')
    .max(72, 'Mot de passe : 72 caractères maximum.'),
});

/**
 * Inscription : le minimum est celui que l'application annonce, et il doit
 * correspondre à `MIN_PASSWORD_LENGTH` (vérifié par `tests/schemas.test.ts`).
 * Le maximum de 72 vient de bcrypt, qui ignore les octets au-delà : accepter
 * plus long donnerait un mot de passe tronqué sans le dire.
 */
export const signUpSchema = z.object({
  email: signInSchema.shape.email,
  password: z
    .string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères.')
    .max(72, 'Mot de passe : 72 caractères maximum.')
    .refine(value => value.trim().length > 0, {
      message: 'Le mot de passe ne peut pas être composé uniquement d’espaces.',
    }),
});

/**
 * Nouveau mot de passe : mêmes bornes que l'inscription, plus une confirmation
 * vérifiée ici (le serveur ne la voit jamais).
 */
export const newPasswordSchema = z
  .object({
    password: signUpSchema.shape.password,
    confirmation: z.string(),
  })
  .refine(values => values.password === values.confirmation, {
    message: 'Les deux mots de passe ne correspondent pas.',
    path: ['confirmation'],
  });

/* ------------------------------------------------------------------ */
/* Aides d'usage                                                       */
/* ------------------------------------------------------------------ */

/**
 * Première erreur d'un schéma, sous la forme `{ champ: message }` : c'est le
 * format attendu par `FormField` (prop `error`) et par les formulaires.
 * Renvoie `null` quand la saisie est valide, avec la valeur transformée.
 */
export function parseForm<T extends z.ZodType>(
  schema: T,
  input: unknown,
): { ok: true; data: z.output<T> } | { ok: false; errors: Record<string, string> } {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const field = issue.path.length > 0 ? String(issue.path[0]) : '_form';
    // Une seule erreur par champ : trois messages empilés sous un input
    // n'aident personne.
    if (!errors[field]) errors[field] = issue.message;
  }
  return { ok: false, errors };
}
