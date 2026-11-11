# Observabilité et monitoring

Ce document décrit ce que l'application sait d'elle-même en production, ce
qu'elle ne sait pas, et comment un incident remonte jusqu'à quelqu'un capable de
le corriger. Il remplace l'absence totale de journalisation : avant ce travail,
une erreur de production laissait trois lignes de `console.error` en texte libre,
sur l'appareil d'un caissier, derrière une console que personne n'ouvre.

Le point de départ était une liste de sept manques. Chacun est traité ou
explicitement écarté, avec sa raison — un manque assumé vaut mieux qu'un manque
masqué par un tableau de bord.

| Attendu | État | Où |
| --- | --- | --- |
| Logs structurés | **fait** | `src/lib/telemetry.ts` |
| Capture d'erreurs globale | **fait** | `src/lib/globalErrors.ts`, `src/components/ErrorBoundary.tsx` |
| Télémétrie | **fait, locale uniquement** | `src/lib/telemetry.ts` (aucun émetteur tiers) |
| Monitoring de performance | **fait, côté navigateur** | `src/lib/performance.ts` |
| Tracking d'usage | **fait, jeu d'événements minimal** | `ui.module_ouvert`, `metier.prestation_enregistree`, `offline.*` |
| Alertes prod | **non : impossible sans collecteur** | voir « Alertes » ci-dessous |
| Diagnostics hors ligne | **fait, visibles à l'écran** | `src/lib/offlineDiagnostics.ts`, `src/components/DiagnosticPanel.tsx` |

---

## 1. Journalisation structurée

Un événement est un **nom stable**, un niveau, un horodatage et un contexte :

```ts
track.warn('perf.appel_lent', { operation: 'prestations.chargement', durationMs: 1800 });
track.error('offline.synchronisation_echouee', cause, { restants: 3 });
```

Convention de nommage : `domaine.action`, en `snake_case`, jamais renommé —
l'empreinte et le regroupement du diagnostic reposent sur ce nom.

| Domaine | Événements |
| --- | --- |
| `app` | `demarrage` |
| `ui` | `module_ouvert`, `erreur_rendu`, `erreur_non_capturee`, `promesse_rejetee`, `ressource_non_chargee`, `module_non_charge`, `requete_annulee` |
| `data` | `lecture_echouee`, `lecture_signalee` |
| `metier` | `prestation_enregistree` |
| `offline` | `synchronise`, `synchronisation_echouee`, `file_illisible` |
| `perf` | `appel_lent`, `appel_tres_lent`, `affichage_lent`, `premier_affichage`, `plus_grand_element` |

Trois propriétés sont tenues par construction et vérifiées par
`tests/telemetry.test.ts` :

1. **Rien de personnel ne sort.** `redact` remplace par `[masqué]` toute clé
   contenant `password`, `token`, `secret`, `apikey`, `authorization`, `email`,
   `phone`, `plate`, `customer`, `vehicle`, `name`, et nettoie les adresses
   e-mail et les numéros qui traîneraient dans une chaîne libre. Une clé
   sensible est **remplacée, pas supprimée** : savoir qu'un champ était renseigné
   fait partie du diagnostic.
2. **Le tampon est borné** à 200 événements, en mémoire seulement. Rien n'est
   écrit dans `localStorage` : un journal persistant finirait par contenir, sur
   un téléphone partagé, l'historique de plusieurs comptes.
3. **Aucune sortie réseau.** Aucun SDK tiers, aucune balise, aucun `fetch`.
   La console est le seul destinataire, et `debug` y est filtré en production.

`fingerprintOf` regroupe les occurrences d'une même panne en normalisant tout ce
qui varie — identifiant de commande, numéro de prestation, compteur — vers un
jeton unique. C'est ce qui permet d'écrire « 12 fois la même erreur » plutôt que
« 12 erreurs », qui n'apprend rien.

## 2. Capture d'erreurs globale

`ErrorBoundary` couvre les erreurs de **rendu**. Trois familles lui échappent
structurellement, et sont couvertes par `installGlobalErrorHandlers()` :

- une exception dans un gestionnaire d'événement (pas de rendu, donc rien à
  capturer) → `ui.erreur_non_capturee` ;
- une promesse rejetée sans `catch` → `ui.promesse_rejetee` ;
- une ressource ou un module découpé qui ne charge pas → `ui.ressource_non_chargee`.

Deux détails qui n'en sont pas :

- les écouteurs `error` sont posés en **phase de capture**. Un échec de
  chargement de ressource ne bulle pas : un écouteur en bouillonnement ne le
  voyait jamais, et c'est précisément le cas fréquent en mobilité (module
  `lazy` demandé hors ligne) ;
- les `AbortError` sont ignorés. Une requête annulée volontairement (changement
  d'écran, nouvelle frappe) n'est pas une panne ; la compter remplirait le
  diagnostic de bruit et masquerait les vrais incidents.

`installGlobalErrorHandlers()` est appelé dans `src/main.tsx` **avant le premier
rendu**, et une seule fois par page.

## 3. Mesure de performance

Mesuré :

- la durée des opérations que **nous** déclenchons, autour de l'appel :
  `prestations.chargement`, `offline.synchronisation` (`measure()`) ;
- le premier affichage de contenu et le plus grand élément affiché
  (`PerformanceObserver`, avec gardes — la métrique n'existe pas partout).

Seuils (`THRESHOLDS`) : 1 500 ms (lent), 5 000 ms (très lent), 3 000 ms pour le
premier affichage. Ils signalent, ils ne bloquent jamais.

Non mesuré, volontairement :

- **la latence réseau seule** — `fetch` ne la donne pas, et l'inventer serait
  pire que l'ignorer ;
- **la performance du serveur PostgreSQL** — invisible depuis le navigateur ;
- **le temps de rendu React par écran** — le profiler de production n'est pas
  embarqué, et son coût n'a pas sa place au comptoir.

L'agrégat du diagnostic donne **médiane et maximum**, par opération. La médiane
plutôt que la moyenne : un seul appel à 30 s fausse une moyenne et fait croire
que tout est lent, alors qu'un utilisateur sur deux a une réponse rapide. Le
maximum reste affiché à côté, précisément pour que ce pic ne soit pas caché.

## 4. Tracking d'usage

Volontairement minimal, et sans identifiant utilisateur :

| Événement | Contexte | Pourquoi |
| --- | --- | --- |
| `ui.module_ouvert` | module, rôle, station | savoir quels modules sont réellement utilisés |
| `metier.prestation_enregistree` | station, nombre de services | mesurer l'usage réel, pas les intentions |
| `offline.synchronise` | nombre d'éléments confirmés | savoir si la file draine réellement |

Ce qui n'est **pas** tracé, et pourquoi :

- **pas de frappe clavier, pas de contenu de champ** — une application de gestion
  de station contient des noms de clients et des plaques ; les remonter, même
  anonymisés, serait une collecte sans finalité ;
- **pas de parcours individuel** — aucun identifiant de session ou d'appareil
  n'est créé, deux caissiers sur la même station ne sont pas distinguables ;
- **pas de page vue générique** — « quel module » est utile, « combien de fois »
  ne l'est pas et coûte du bruit dans un tampon de 200 événements.

## 5. Diagnostics hors ligne

Le sujet n'est pas « suis-je en ligne ? » (`useOnlineStatus` y répond) mais
**« qu'est-ce qui n'est pas encore arrivé au serveur, et pourquoi ? »**.

`diagnose()` produit des constats classés `ok` / `attention` / `bloquant`, avec
une action associée quand il y en a une :

- hors ligne **avec une file vide** → `attention` : la consultation reste
  possible, rien n'est perdu ;
- hors ligne **avec des opérations en attente** → `bloquant`, avec la consigne
  explicite de ne pas vider les données du navigateur ;
- **file illisible** → `bloquant`, jamais « file vide ». C'est le cas dangereux :
  afficher « aucune opération en attente » alors que `localStorage` en contient
  ferait fermer la caisse et perdre la journée ;
- erreurs comptées **par empreinte**, pas en vrac ;
- version d'application servie, pour savoir si l'appareil tourne sur un build
  ancien.

Accessible depuis le pied de page du portail (« Diagnostic de cet appareil »),
dans une modale qui respecte les règles d'accessibilité existantes. Le contenu
est lisible par un caissier sur un téléphone : pas de console, pas de jargon, et
l'état de la file y est en clair (`n prestations enregistrées sur cet appareil,
pas encore confirmées par le serveur`).

Deux actions d'export, parce que la copie échoue dans des cas réels :

- **Copier le diagnostic** — échoue sans `navigator.clipboard` (application en
  `http://` sur le réseau local d'une station), échoue si la permission est
  refusée ; dans les deux cas le motif est **affiché**, jamais avalé ;
- **Télécharger le fichier** — la voie qui fonctionne toujours.

## 6. Alertes de production — ce qui n'existe pas

**Il n'y a aucune alerte en temps réel.** Il n'y a pas de collecteur : ni Sentry,
ni Datadog, ni OpenTelemetry, aucun endpoint qui reçoive les événements. Écrire
« les incidents sont remontés à l'équipe » serait faux. Concrètement :

- si une erreur survient chez un caissier, **personne n'est notifié** ;
- l'information existe, sur l'appareil, jusqu'au rechargement complet de la page ;
- elle ne remonte que si **l'utilisateur ouvre le diagnostic et transmet le JSON**
  — ce qui suppose qu'il ait un moyen de le transmettre et qu'il pense à le faire.

C'est un choix assumé pour l'instant : aucun prestataire n'est souscrit, et
brancher un SDK d'erreurs signifie faire sortir des données d'usage de l'appareil
de clients ivoiriens — une décision qui appartient au propriétaire du produit,
pas à un correctif technique.

**Le point d'accroche existe** : `log()` dans `telemetry.ts` est le seul endroit
qui reçoit tous les événements. Brancher un collecteur, c'est y ajouter un envoi
groupé, une fonction à écrire — aucun écran à modifier.

### Ce qui est disponible aujourd'hui pour investiguer

1. **Le diagnostic de l'appareil** (`Copier` / `Télécharger`) : événements,
   contexte, empreintes, durées. À demander au caissier par message.
2. **Les journaux Supabase** (tableau de bord du projet, `Logs` → API / Postgres) :
   côté serveur, ils montrent les appels PostgREST réellement reçus, leurs codes
   et leur latence. C'est la seule source **serveur** existante, et elle ne
   nécessite aucun code dans l'application.
3. **Les codes d'erreur normalisés** (`src/lib/errorMessages.ts`) : la grille
   `42501`, `22023`, `P0001`, `23505`, `23503`, `23514`, `PGRST116`,
   `PGRST301/302` transforme un code PostgreSQL en message français stable. Deux
   rapports qui citent le même code désignent la même cause.

### Ce qu'il faudrait pour de vraies alertes, et ce que cela coûte

| Option | Ce que ça donne | Ce que ça coûte |
| --- | --- | --- |
| Export manuel (état actuel) | diagnostic précis, à la demande | dépend de l'utilisateur, aveugle la nuit |
| Collecteur d'erreurs tiers (Sentry ou équivalent) | alertes, regroupement, tendance | abonnement, données d'usage hors Côte d'Ivoire, écran de consentement à revoir |
| Table `client_events` dans Supabase + vue + alerte | tout reste chez l'hébergeur déjà choisi | écriture réseau par événement, rétention à définir, coût Postgres |

Aucune de ces options n'est implémentée. La troisième est la plus cohérente avec
le reste du produit (même hébergeur, mêmes politiques d'accès), mais elle demande
une migration et une politique de rétention — donc une décision, pas un patch.

## 7. Ce que le diagnostic ne dira jamais

- **qu'un paiement est encaissé** : l'application n'encaisse rien ; les
  événements parlent de prestations et de synchronisation, jamais de recettes ;
- **qu'un incident est résolu** : un événement `error` reste présent jusqu'à
  l'expiration du tampon, même si la situation s'est rétablie. La ligne
  « erreurs » dit « enregistrées », pas « en cours » ;
- **un chiffre inventé** : quand une métrique est absente, le panneau affiche un
  état vide explicite (« Aucune opération mesurée depuis l'ouverture de la
  page ») plutôt qu'un `0` qui laisserait croire à une mesure.

## 8. Vérifications

| Contrôle | Commande |
| --- | --- |
| Journal, masquage, empreintes, tampon borné | `npx tsx --test tests/telemetry.test.ts` |
| Erreurs globales, `AbortError`, branchement unique | `npx tsx --test tests/globalErrors.test.tsx` |
| Constats hors ligne, file illisible, headline | `npx tsx --test tests/offlineDiagnostics.test.ts` |
| Médiane, maximum, seuils, bruit | `npx tsx --test tests/performance.test.ts` |
| Export, presse-papiers absent ou refusé | `npx tsx --test tests/diagnosticsExport.test.ts` |
| Panneau : file réelle, état vide, clavier | `npx tsx --test tests/diagnosticPanel.test.tsx` |

Les six fichiers font partie de `npm test`, donc de `npm run quality` et de la
CI : une régression sur le masquage ou sur l'export casse la construction, elle
ne passe pas inaperçue.

## 9. Deux défauts trouvés en écrivant les tests

Ils sont notés ici parce qu'ils étaient invisibles à la lecture du code :

1. **Les écouteurs `error` étaient posés en phase de bouillonnement.** Un échec
   de chargement de ressource ne bulle pas : `ui.ressource_non_chargee` et
   `ui.module_non_charge` n'auraient jamais été émis, c'est-à-dire précisément
   l'événement utile pour un module `lazy` demandé hors ligne. Corrigé avec
   `addEventListener('error', handler, true)`.
2. **`resetGlobalHandlersForTests()` ne retirait pas les écouteurs.** Le drapeau
   `installed` était remis à `false` mais les écouteurs restaient accrochés à
   `window`, donc un même événement était compté N fois après N installations.
   Le module garde maintenant une référence aux deux écouteurs et les retire.

Un troisième, hors observabilité : `tests/dashboardFigures.test.tsx` ne figeait
que la fixture, pas l'instant de rendu. Le test est passé le 10 novembre 2026 et
a échoué le lendemain à 00 h 05 UTC, sans aucun changement de code. Les deux
écrans acceptent désormais un `referenceNow` injecté par le test ; le calcul,
lui, n'a pas bougé.
