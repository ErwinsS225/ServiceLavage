# Validation et erreurs

Ce document décrit la couche ajoutée le 10 novembre 2026, et surtout **la règle**
qu'elle fait respecter. Sans la règle, la couche devient une formalité que le
prochain formulaire contournera.

## Le problème d'origine

Chaque écran décidait seul :

- de ses bornes (`name.trim()`, `Number.isSafeInteger`, un `maxLength` sur
  l'input, parfois les trois) ;
- du texte d'erreur, en français, réécrit à la main à chaque fois ;
- de ce qu'il fallait montrer quand le serveur répondait. Plusieurs écrans
  affichaient `failure.message` brut : « Invalid login credentials » dans une
  interface française, ou le nom d'une contrainte PostgreSQL à l'écran.

Résultat : le même refus s'exprimait de quatre façons, et une erreur de droits
ressemblait à une panne réseau.

## La règle

**Le serveur décide de ce qui est permis ; le client décide seulement de ce
qu'il faut dire pour l'éviter.**

Concrètement :

1. Une borne affichée doit exister dans `supabase/migrations/`. Le commentaire
   du schéma cite la migration et la contrainte. Si la base change, le schéma
   change — pas l'inverse.
2. Un message serveur n'est **jamais** remplacé par un texte inventé. Les 32
   `raise exception` des migrations sont traduits dans `src/lib/errorMessages.ts`
   avec, en plus du libellé, **la consigne** que le serveur ne donne pas.
3. Une erreur inconnue n'affiche pas son texte brut : il peut contenir un nom
   de table, une contrainte, un fragment SQL. Le détail reste dans la console,
   et uniquement en développement.
4. Une erreur de champ s'affiche sous **son** champ (`FormField error`), pas
   dans une alerte en haut du formulaire. Un toast signale le résultat d'une
   action, jamais une saisie invalide.

## Ce qui a été ajouté, et ce qui ne l'a pas été

| Outil demandé | Décision | Raison |
| --- | --- | --- |
| Zod | **ajouté** (`zod@4`) | seul outil qui apporte une capacité absente : des bornes déclaratives, testables hors DOM |
| React Hook Form | **non** | les 9 formulaires ont 2 à 5 champs `useState` ; RHF déplacerait la validation dans une seconde couche sans rien simplifier |
| sonner | **non** | `src/context/ToastContext.tsx` couvre le besoin en ~200 lignes testées ; sonner apporte les actions dans les toasts, qu'on n'utilise pas |
| Modales d'erreur | **non** | une modale par-dessus un formulaire qui a échoué empêche de corriger le champ ; l'alerte en ligne et le toast suffisent |

Ces trois refus sont réversibles et sans conséquence : RHF s'ajoute formulaire
par formulaire, et `useToastActions` a la même signature que `toast()` de
sonner (`success`, `error`, `info`, `warning`). Si un besoin apparaît — annuler
une action depuis un toast, par exemple —, c'est le moment de rouvrir la
question, pas avant.

## Où chaque chose vit

| Fichier | Rôle |
| --- | --- |
| `src/lib/schemas.ts` | bornes alignées sur les `check` de la base, + `parseForm` (une erreur par champ) |
| `src/lib/errorMessages.ts` | `describeError` (code → catégorie, message, consigne, `retryable`) et `errorText` |
| `src/context/ToastContext.tsx` | toasts, deux régions `aria-live` (`polite` / `assertive`) |
| `src/lib/queryClient.ts` | signalement global des **lectures** qui échouent |
| `src/components/ui/Input.tsx` | `FormField` : `htmlFor`, `error` en `role="alert"` |

## Les deux garanties automatiques

`tests/schemas.test.ts` vérifie chaque borne à la limite exacte (`120` passe,
`121` échoue). `tests/errorMessages.test.ts` **relit le SQL des migrations** et
échoue si un `raise exception` n'a pas de traduction, ou si sa traduction n'a
pas de consigne.

C'est ce second test qui protège dans le temps : ajouter une RPC avec un
nouveau message casse la suite tôt, et le message est forcément vérifié par
quelqu'un, puisque c'est quelqu'un qui doit écrire la consigne.

```bash
npx tsx --test tests/schemas.test.ts tests/errorMessages.test.ts
```

## Ajouter un formulaire : la marche à suivre

1. Trouver le `check` correspondant dans `supabase/migrations/`. S'il n'existe
   pas, il n'y a rien à valider côté client.
2. Écrire (ou réutiliser) le schéma dans `src/lib/schemas.ts`, avec le
   commentaire qui cite la migration.
3. Dans le composant : `const parsed = parseForm(schema, { … })`, puis
   `setFieldErrors(parsed.errors)` et `setFormError(Object.values(parsed.errors)[0])`.
4. Relier chaque champ : `id`, `htmlFor` sur le `FormField`, `aria-invalid`
   quand `fieldErrors.x` existe.
5. Dans le `catch` : `setFormError(errorText(cause))`. Jamais `cause.message`.
6. Un toast à la réussite, avec le nom de ce qui a été créé ou modifié.

## Limites connues

- **Pas d'internationalisation.** Une seule langue, le français, comme le reste
  de l'application. Les textes de `errorMessages.ts` sont centralisés mais pas
  externalisés.
- **Détail technique visible en développement seulement.** En production,
  `describeError` ne renvoie pas le texte serveur pour une erreur inconnue. Le
  corollaire : un utilisateur qui signale un bug doit préciser l'heure, faute
  de message exploitable.
- **Trois messages restent écrits dans leur composant**, volontairement, parce
  qu'ils décrivent un état local et non un refus du serveur :
  inventaire hors ligne, stock estimé devenu négatif, copie du presse-papiers
  impossible.
- **Le minuteur des toasts n'est pas testé en temps réel.** Attendre la fin
  d'un minuteur dans ce lanceur de tests fait tuer le processus (`SIGKILL`)
  avant l'assertion ; la fermeture manuelle, elle, est testée.
- **Pas de modale d'erreur globale.** Le seul cas qui la justifierait — un
  `ErrorBoundary` qui tombe — est déjà couvert par `ErrorBoundary`.

## Dépendance à la base

Les bornes de ce document sont celles du 10 novembre 2026, relevées par
`grep "check (" supabase/migrations/*.sql`. `tests/productionSchemaDrift.test.ts`
compare le schéma en production aux fichiers ; si une migration ajoute une
contrainte, ajouter sa borne ici et son cas limite dans `tests/schemas.test.ts`.
