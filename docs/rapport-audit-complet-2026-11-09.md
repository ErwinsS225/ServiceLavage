# Rapport d'audit complet — ServiceLavage / Clean It CI

**Date :** 9 novembre 2026

> ⚠️ **Document historique.** Les quatre migrations alors manquantes sont
> désormais déployées et la configuration Auth a été corrigée. Pour l'état
> actuel, lire [l'audit général du 10 novembre 2026](audit-general-2026-11-10.md).
**Branche auditée :** `arena/5a866d29-servicelavage` (HEAD `dc7f314`, identique à `main`)
**Périmètre :** code source, schéma PostgreSQL/RLS, configuration Supabase déployée (projet LavAuto `avvkzliysacpyavmetsx`), build, tests, PWA, documentation.

---

## 1. Synthèse exécutive

### Verdict global

| Domaine | Note | Commentaire |
| --- | :---: | --- |
| Sécurité (RLS/RPC) | **A−** | Modèle de sécurité remarquablement mature et testé. Aucune faille critique détectée. |
| Qualité du code actif | **B+** | Code actif propre, typé, défensif. Une dépendance fantôme et l'absence de `strict`. |
| Architecture | **B** | Séparation réelle↔démo documentée, mais 88 % du code source est du code mort. |
| Fiabilité / tests | **B+** | 19 tests verts (dont migrations SQL réelles), mais une étape CI rouge et zéro test de composant. |
| Performance / bundle | **B** | 134 KB gzip, tree-shaking correct, mais lazy-loading partiel. |
| État de déploiement | **D** | **4 migrations sur 10 du dépôt ne sont pas déployées : 5 modules sur 6 de l'interface sont inertes en production.** |
| Documentation | **B+** | Très riche et honnête, avec quelques affirmations périmées. |

**Le code est bon. Le produit livré n'est pas fonctionnel à 60 %.**

C'est le constat central de cet audit : le dépôt contient un socle technique solide et sérieusement testé, mais l'application réellement joignable en production n'expose que **Prestations, Catalogue, Clients et Abonnements (lecture)**. Les onglets **Personnel, Inventaire** et l'acceptation d'invitation échouent à l'exécution, non par bug de code, mais parce que le schéma correspondant n'existe pas dans la base cible.

### Top 5 des risques

| # | Risque | Gravité | Preuve |
| --- | --- | :---: | --- |
| **R1** | 4 migrations non déployées → 2 onglets cassés, invitations impossibles, quotas d'abonnement **non appliqués** | 🔴 Critique | `list_migrations` : 6 versions sur 10 |
| **R2** | CI rouge sur `main` (type-check) → aucune protection automatique des prochaines régressions | 🔴 Critique | Run #42669884299, étape « Type check » |
| **R3** | Quotas Starter/Pro/Business (1/2/10 stations, 500/2 500/10 000 prestations) **inactifs** en production | 🟠 Élevé | Trigger absent de la base ; `my_subscription` non déployée |
| **R4** | Document stratégique interne (prix, offres) servi publiquement sur `/assets/aistudio/…` | 🟠 Élevé | HTTP 200, 47 514 octets, aucun référencement dans le code |
| **R5** | `Unauthenticated` / `anon` : aucun risque détecté, mais **aucun test d'intégration n'a jamais tourné** (smoke test toujours `skipped`) | 🟠 Élevé | `tests/supabaseLocalIntegration.test.ts` → SKIP |

### Ce qui a été corrigé pendant l'audit

**R2 corrigé** : `npm run lint` échouait (`Cannot find module '@/components/ui/button'`). Voir § 12.

---

## 2. Méthode et outillage

| Contrôle | Outil | Résultat |
| --- | --- | --- |
| Types | `tsc --noEmit` (config projet) | ✅ OK *(après correction)* |
| Types stricts | `tsc --noEmit --strict` | ✅ OK *(après correction)* |
| Tests | `npm test` (node:test + PGlite) | ✅ 19 passés, 1 ignoré, 0 échec |
| Build | `vite build` | ✅ OK, 523 ms |
| Service worker | `node --check dist/sw.js` | ✅ OK |
| Dépendances | `npm ci` + `npm audit` | ✅ 0 vulnérabilité, installation reproductible |
| Rendu composants | SSR `renderToStaticMarkup` des 7 composants actifs | ✅ 7/7 sans exception |
| Base distante | Connecteur Supabase (métadonnées, catalogue, privilèges) | ⚠️ 4 migrations manquantes |
| Exécution | Serveur Vite + requêtes HTTP | ✅ 200 sur `/`, manifeste, icônes |
| Historique CI | GitHub Actions API | ❌ Run courant en échec |

---

## 3. Architecture réelle

### 3.1 Ce qui est réellement exécuté

```
index.html → src/main.tsx → App.tsx (App = <OwnerPortal />)
                              └─ src/components/OwnerPortal.tsx   (authentification + routage par rôle)
                                   ├─ StationOrders.tsx        (prestations)
                                   ├─ StationServices.tsx      (catalogue)
                                   ├─ StationCustomers.tsx     (clients)
                                   ├─ StationInventory.tsx     (lazy, inventaire)
                                   ├─ StationStaff.tsx         (lazy, personnel)
                                   └─ SubscriptionPlans.tsx    (abonnements)
```

**12 fichiers actifs, 1 195 lignes.** Le bundle de production le confirme : aucune trace de `CashAndPayments`, `QueueManagement`, `MarketplaceView`, `mockData`, `framer-motion` ni `lucide-react`. Le tree-shaking de Vite élimine correctement tout le reste.

### 3.2 Ce qui dort dans le dépôt

`App.tsx` contient encore un `MainLayout` complet important **24 composants** (`Dashboard`, `PosScreen`, `QueueManagement`, `CashAndPayments`, `SaaSAdminAndSubscriptions`, `OnboardingWizard`…), plus `AppContext.tsx` (595 l.) et `mockData.ts` (895 l.).

- **Code mort : 9 336 lignes sur 10 531, soit 88 % du répertoire `src/`.**
- Ces fichiers ne sont ni montés, ni livrés au navigateur (vérifié dans le bundle), mais ils sont **compilés par `tsc`** et **versionnés**.
- `App.tsx` est le point de friction principal : il conserve le câblage de la démo supprimée. Tout le reste du code mort n'est importé que par lui.

> **Recommandation A1** — Réduire `App.tsx` à `<OwnerPortal />` et déplacer le dossier legacy (`src/context`, `src/data/mockData.ts`, `src/config/features.ts`, `src/types`, 24 composants, `src/components/{dashboard,ui}`) vers une branche `legacy/reference` ou une archive. Bénéfice : −88 % de surface à maintenir, suppression de 6 dépendances inutiles, suppression de la dépendance fantôme (§ 7.1).

### 3.3 Architecture de sécurité (excellente)

Le modèle repose sur un principe correct et rarement aussi bien appliqué : **aucune écriture métier n'est faite par le client**.

- Toutes les tables métier sont en `REVOKE ALL` puis `GRANT` colonne par colonne (27 privilèges colonne exactement accordés à `authenticated` sur les 6 tables déployées).
- Toute mutation passe par des RPC `SECURITY DEFINER` avec `SET search_path = ''` (protection contre le détournement de `search_path`), `REVOKE ... FROM public, anon` et habilitation `authenticated` uniquement.
- Vérifié en production : `create_station_order`, `create_station_order_idempotent`, `transition_station_order` sont bien `SECURITY DEFINER` avec ACL restreinte.
- **Aucun privilège `TRUNCATE`** sur `anon`/`authenticated` (le piège classique « RLS ne couvre pas TRUNCATE » est explicitement traité par la migration `…130602`).
- Idempotence par `advisory_xact_lock` + table de requêtes : le rejeu après réponse perdue ne duplique pas la prestation, et la réutilisation d'un UUID avec une charge différente est refusée.
- `station_order_requests` est en RLS avec **0 politique** → totalement invisible du client, ce qui est l'intention correcte.
- Le contrôle du plan d'abonnement est fait **côté PostgreSQL**, pas dans l'interface — c'est la bonne approche (malheureusement non déployé, cf. R3).

**Aucune injection SQL, aucun `eval`, aucun `dangerouslySetInnerHTML`, aucun secret en dur** (`grep` exhaustif : seulement des mentions documentaires de `service_role` et une habilitation légitime dans une migration).

---

## 4. État de la base Supabase déployée (projet LavAuto)

### 4.1 Migrations : 6 déployées / 10 dans le dépôt

| Version | Migration | Déployée |
| --- | --- | :---: |
| `20261109121406` | owner_stations | ✅ |
| `20261109122729` | station_customers | ✅ |
| `20261109122929` | station_services | ✅ |
| `20261109123327` | station_orders | ✅ |
| `20261109130303` | order_idempotency | ✅ |
| `20261109130602` | restrict_station_privileges | ✅ |
| `20261109140000` | station_memberships | ❌ |
| `20261109141000` | subscription_limits | ❌ |
| `20261109142000` | station_inventory | ❌ |
| `20261109150000` | station_role_permissions | ❌ |

Contrôle croisé du catalogue PostgreSQL : **aucune** des tables `station_memberships`, `station_invitations`, `owner_subscriptions`, `station_inventory`, `station_inventory_operations`, `station_order_assignments` n'existe. Aucune fonction `my_subscription`, `current_station_role`, `apply_inventory_operation`, `create_station_invitation`, `assign_station_order` n'existe.

### 4.2 Conséquence fonctionnelle (impact utilisateur réel)

| Écran / action utilisateur | Ce qui se passe en production | Cause |
| --- | --- | --- |
| **Personnel** | Bloqué par un garde-fou : « Le module Personnel nécessite le déploiement préalable des migrations de rôles. » | Table + RPC absentes |
| **Inventaire** | `Impossible de charger l'inventaire` (relation inexistante) | Table + RPC absentes |
| **Accepter une invitation** | `Invitation non acceptée : …function does not exist` | RPC absente |
| **Abonnements** | `Impossible de charger le plan` | `my_subscription` absente |
| **Affecter un laveur** | La liste des laveurs reste vide (erreur silencieuse en console) | Tables absentes |
| **Rôles employés** | Aucun employé ne peut se connecter : le seul rôle résolu est `owner` par repli côté client | `current_station_role` absente |
| **Prestations / Catalogue / Clients** | ✅ **Fonctionnels** | Tables déployées |

Le repli `resolveOwnerFallback` de `OwnerPortal` masque partiellement R1 : un propriétaire voit ses modules fonctionner (via `stations.owner_id`), ce qui donne l'illusion que tout va bien. **Un compte employé, lui, ne peut jamais accéder à rien.**

### 4.3 Quotas d'abonnement : totalement inactifs

`docs/abonnements.md` et `data/planFeatures.ts` annoncent Starter = 1 station / 500 prestations, Pro = 2 / 2 500, Business = 10 / 10 000. En production :

- aucun trigger `enforce_station_limit` ni `enforce_monthly_order_limit` ;
- aucune table `owner_subscriptions` ;
- un propriétaire peut donc créer **un nombre illimité de stations et de prestations**.

Ce n'est pas une faille de sécurité (rien n'est ouvert indûment), mais **la promesse commerciale n'est pas protégée techniquement**. Si les migrations sont appliquées sans précaution, les stations déjà créées au-delà du quota Starter resteront en base mais bloqueront toute création ultérieure — comportement documenté, mais à valider avec les données existantes.

### 4.4 Configuration Auth : à corriger avant mise en service

| Paramètre | Valeur actuelle | Risque |
| --- | --- | --- |
| `site_url` | `http://localhost:3000` | 🔴 Les liens de confirmation/recovery renvoient vers **localhost** : un utilisateur réel ne peut pas confirmer son compte |
| `uri_allow_list` | *(vide)* | 🔴 Aucune URL de redirection autorisée pour l'application déployée |
| `mailer_autoconfirm` | `false` | ✅ Correct (pas de contournement de la confirmation e-mail) |
| `password_min_length` | `6` | 🟠 Faible ; l'interface impose déjà `minLength=6` |
| `rate_limit_email_sent` | `2` / heure | 🟠 Très bas — les inscriptions échoueront silencieusement en volume |
| `password_hibp_enabled` | `false` | 🟡 Recommandé de l'activer |
| `refresh_token_rotation_enabled` | `true` | ✅ Correct |
| SMTP | non configuré | 🟠 E-mails via le service par défaut (délivrabilité limitée) |

> **R4 détail** — Aucun flux de réinitialisation de mot de passe n'existe dans `OwnerPortal` (`resetPasswordForEmail` absent). Un utilisateur qui oublie son mot de passe est **définitivement bloqué**, sans même un formulaire de renvoi de confirmation.

### 4.5 Données en production

`auth.users` : 1 compte (confirmé). `stations` : 1. `station_services`, `station_customers`, `station_orders`, `station_order_items` : **0**.

L'application est donc **en état de pré-production réelle**, sans données métier. C'est un point positif : les migrations manquantes peuvent être appliquées **sans risque de rupture de données**.

---

## 5. Revue de sécurité détaillée

### 5.1 Points forts à conserver

1. **RLS sur 100 % des tables** (`tables_without_rls = 0`, vérifié). Un event trigger `rls_auto_enable` force même la RLS sur toute nouvelle table du schéma `public` — excellente défense en profondeur.
2. **Isolation multi-tenant** testée à trois niveaux : SQL PGlite, script `tenant_isolation.sql`, et test d'intégration opt-in avec 5 comptes réels.
3. **Services non exposés à `anon`** : `anon_sel = false` sur les 6 tables.
4. **Idempotence transactionnelle** par `pg_advisory_xact_lock` : couvre la réponse perdue et le rejeu concurrent (test de concurrence réel présent dans `supabaseLocalIntegration.test.ts`).
5. **Snapshot de prix** : le prix est figé au moment de la création, verrou `FOR SHARE` posé sur les services pour empêcher une modification concurrente du tarif entre la lecture et l'écriture.
6. **Refus de l'injection d'identité** : `enforce_station_limit` vérifie `auth.uid() <> new.owner_id`, et `stations` n'accorde `INSERT` que sur `(owner_id, name)`.
7. **Invitations** : e-mail normalisé en base par contrainte, expiration 7 jours, vérification de `email_confirmed_at`, interdiction de double adhésion, et impossibilité de faire changer un rôle par une invitation périmée.

### 5.2 Faiblesses et réserves

| # | Constat | Gravité | Détail |
| --- | --- | :---: | --- |
| **S1** | `OwnerPortal` cache la liste des stations **et l'`owner_id`** en `localStorage` | 🟡 Moyen | `servicelavage:stations:v2:<userId>` contient les identifiants de station et le propriétaire. Non chiffré, accessible à tout script de la page. Lorsque R3 sera déployé, un `owner_id` local périmé pourrait faire afficher le repli propriétaire hors ligne. |
| **S2** | Catalogue et clients mis en cache en clair | 🟡 Moyen | Données personnelles (nom, téléphone) stockées en `localStorage` non chiffré. Documenté honnêtement (`docs/pwa-hors-ligne.md`), mais à mentionner dans une politique de confidentialité. |
| **S3** | Politique RLS `Managers and cashiers update customers` **sans restriction de colonne côté RLS** | 🟡 Faible | Protégé par le `GRANT UPDATE (name, phone)` ; une évolution future des colonnes pourrait élargir silencieusement l'écriture. |
| **S4** | `staff-commissions` / `reports-export` / `showcase-*` déclarés « planned » mais **`featureConfig` est inutilisé** par le portail actif | 🟡 Faible | `src/config/features.ts` n'est importé que par le code mort. Deux matrices de fonctionnalités coexistent (`features.ts` et `planFeatures.ts`) avec des plans différents (`free/premium/enterprise` vs `starter/pro/business`) : source de confusion. |
| **S5** | `create_station_order` reste `GRANT EXECUTE` à `authenticated` **en plus** de la variante idempotente | 🟡 Faible | La variante non idempotente contourne la protection anti-doublon. L'interface n'y fait pas appel, mais un client peut l'invoquer directement. Envisager un `REVOKE` de la version simple après migration des appels. |
| **S6** | Mots de passe : minimum 6 caractères, pas de vérification HIBP | 🟠 | Côté Auth Supabase, pas côté code. |
| **S7** | Aucun en-tête de sécurité applicatif (CSP, `Referrer-Policy`, `Permissions-Policy`) | 🟠 | Aucun `<meta http-equiv>` de CSP dans `index.html` et aucun serveur qui les pose. Le service worker limite déjà la portée, mais une CSP réduirait la surface XSS. |
| **S8** | Clé Gemini / `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API` déclarée dans `metadata.json` | 🟡 Info | Aucun usage de `@google/genai` (0 import). Capacité déclarée inutilement : à retirer pour éviter une future exposition de clé. |

### 5.3 Secrets

✅ **Aucun secret versionné.** `npm audit` : 0 vulnérabilité sur 197 paquets. `.gitignore` couvre `.env*` sauf `.env.example`. La CI utilise des valeurs factices explicitement non fonctionnelles.

---

## 6. Tests et fiabilité

### 6.1 Ce qui est couvert (bien)

| Suite | Contenu | État |
| --- | --- | --- |
| `tenantIsolation.test.ts` | Applique **les 10 migrations** sur PGlite + 5 scripts SQL de test | ✅ |
| `supabase/tests/station_role_permissions.sql` | Matrice complète gérant/caissier/laveur/propriétaire, refus attendus | ✅ |
| `supabase/tests/subscription_limits.sql` | Quotas Starter, refus de modification du plan, idempotence à la limite | ✅ |
| `supabase/tests/station_inventory.sql` | Stock négatif, limites, idempotence | ✅ |
| `supabase/tests/station_memberships.sql` | Invitations, expiration, e-mail non confirmé, révocation | ✅ |
| `supabase/tests/tenant_isolation.sql` | Deux propriétaires, deux stations, privilèges colonne | ✅ |
| `orderSyncIntegration.test.ts` | File hors ligne contre **la vraie fonction** sur PGlite | ✅ |
| `offlineOrders` / `offlineInventory` | File immuable, entrées corrompues conservées, arrêt sur échec | ✅ |
| `money` / `serviceValidation` / `planFeatures` | XOF entiers, bornes, matrice de plans | ✅ |

**La couverture SQL est d'un niveau nettement supérieur à la moyenne** pour ce type de projet : les règles métier sont testées sur un vrai PostgreSQL, pas sur des mocks.

### 6.2 Ce qui n'est pas couvert

| Lacune | Impact |
| --- | --- |
| ❌ **Aucun test de composant ou de parcours navigateur** (0 fichier testant `src/components/`) | Les 7 composants actifs ne sont validés que par mon test SSR ad hoc. Aucun test de clic, de formulaire, ni de flux d'authentification. |
| ❌ **Test d'intégration toujours `skipped`** | `supabaseLocalIntegration.test.ts` n'a jamais tourné (Docker/CLI absents). Aucune preuve que PostgREST + JWT réels se comportent comme PGlite. |
| ❌ **`npm test` ne teste pas le module `Personnel`/`Inventaire` en conditions déployées** | Les tests passent parce que PGlite applique les 10 migrations — la base réelle n'en a que 6. **Le vert des tests masque le rouge de la production.** |
| ❌ Pas de test de charge / quota en concurrence multi-connexions | Documenté comme limite. |
| ❌ Pas de test d'accessibilité automatisé | — |

### 6.3 Évaluation de la robustesse du code actif

Le code des composants actifs est **nettement au-dessus de la moyenne** :

- garde-fou explicite sur `supabase === null` (écran « Configuration Supabase manquante ») ;
- validation stricte des entrées (`parseServiceInteger` refuse flottants, signes, exposants) ;
- files locales **immuables** avec validation d'intégrité complète (recalcul de la clé, vérification de chaque champ) ;
- entrées corrompues **conservées et signalées** plutôt que silencieusement supprimées ;
- protection contre la synchronisation sur un compte différent (`session.user.id !== userId`) ;
- verrou de réentrance (`syncing.current` / `syncAgain.current`) pour éviter les doubles synchronisations ;
- messages d'erreur en français, `role="alert"` / `role="status"` pour l'accessibilité ;
- boutons de désactivation pendant les opérations asynchrones.

Trois **boutons sans `type`** subsistent dans des `<form>` (`StationCustomers`, `StationServices`, `StationOrders`, `StationInventory`, `StationStaff`) : ils sont actuellement les seuls boutons soumis, donc sans effet observable, mais un futur bouton ajouté déclencherait une soumission involontaire. C'est un défaut de robustesse, pas un bug actuel.

---

## 7. Qualité technique et maintenabilité

### 7.1 🔴 Dépendance fantôme — `framer-motion`

`5 fichiers` importent `from 'framer-motion'` (tous legacy), mais **`framer-motion` n'est pas déclaré** dans `package.json`. Le build fonctionne parce que `motion@12` est installé et que npm hisse `framer-motion` à la racine.

Vérifié sur un `npm ci` propre : cela fonctionne **aujourd'hui** grâce au hasard du hoisting npm. Cela casse si :
- le gestionnaire de paquets passe à Bun ou pnpm (`bun.lock` est présent !) ;
- `motion` cesse de réexporter `framer-motion` ;
- `motion` est retiré des dépendances — ce qui **casserait le type-check** en réactivant l'erreur CI actuelle.

> **Recommandation A2** — Si le legacy est conservé : déclarer `framer-motion` explicitement. Si le legacy est supprimé (§ 3.2) : retirer `motion`, `framer-motion`, `lucide-react`, `canvas-confetti`.

### 7.2 Dépendances inutiles (6 sur 13)

| Paquet | Import réel | Verdict |
| --- | --- | :--- |
| `@google/genai` | 0 | ❌ Supprimer |
| `express` | 0 | ❌ Supprimer (aucun serveur dans ce dépôt) |
| `dotenv` | 0 | ❌ Supprimer (Vite gère `.env` nativement) |
| `autoprefixer` | 0 | ❌ Supprimer (Tailwind v4 + Lightning CSS) |
| `motion` / `framer-motion` | legacy uniquement | ❌ Supprimer avec le legacy |
| `lucide-react` | legacy uniquement | ❌ Supprimer avec le legacy |
| `canvas-confetti` | legacy uniquement | ❌ Supprimer avec le legacy |

Aucun n'est présent dans le bundle livré — c'est du poids mort d'installation et de surface d'attaque supply-chain.

### 7.3 Configuration TypeScript

`tsconfig.json` **n'a pas de `"strict": true`**. `noImplicitAny`, `strictNullChecks` et `strictPropertyInitialization` sont donc désactivés. Bonne nouvelle : le code actif passe déjà `--strict` sans erreur (vérifié). Seul le code mort utilisait des `as any` (6 occurrences).

> **Recommandation A3** — Ajouter `"strict": true` dès maintenant : coût nul sur le code actif, protection immédiate des futures modifications.

### 7.4 Autres

| Constat | Détail |
| --- | --- |
| `package.json` → `"name": "react-example"`, `"version": "0.0.0"` | Métadonnées de template jamais mises à jour. |
| `metadata.json` déclare une capacité Gemini | Aucun usage. |
| **Deux lockfiles** (`bun.lock` + `package-lock.json`) | La CI et le README imposent npm. Risque de divergence silencieuse. Choisir et supprimer l'autre. |
| `tsconfig` : `paths "@/*": ["./*"]` mais **aucun import `@/`** hors legacy cassé | Alias à conserver ou retirer, mais cohérent. |
| Pas de `ErrorBoundary` | Une exception dans un composant actif blanchit toute la page. |
| Pas de `React.StrictMode` | Les effets dupliqués en dev ne sont pas détectés. |
| `Autoprefixer` dans `devDependencies` mais non branché à Vite | Sans effet. |

---

## 8. Performance, PWA et déploiement

### 8.1 Bundle

| Métrique | Valeur | Évaluation |
| --- | --- | --- |
| JS principal | 476 KB / **134 KB gzip** | ✅ Raisonnable (React 19 + Supabase) |
| CSS | 85 KB / 12,8 KB gzip | ✅ Correct |
| Chunks différés | `StationInventory` (10,9 KB), `StationStaff` (5,8 KB) | ✅ Bon |
| Code legacy dans le bundle | **0** | ✅ Tree-shaking efficace |
| `framer-motion` / `lucide` dans le bundle | **0** | ✅ |

**Correction de l'hypothèse initiale** : le poids du bundle n'est **pas** dû au code mort. La suppression du legacy n'apporterait que ~0,7 KB. La seule amélioration réelle serait de différer `SubscriptionPlans` (11,7 KB de HTML rendu) et `StationOrders`.

### 8.2 Service worker — bien conçu

Le plugin `offlineShell` de `vite.config.ts` est de bonne facture :

- ✅ précache **uniquement** la coque (HTML, manifeste, icônes, JS/CSS hachés) ;
- ✅ **jamais** de réponse API ni de donnée utilisateur ;
- ✅ filtrage par `url.origin === self.location.origin` → aucune fuite vers un autre domaine ;
- ✅ version de cache calculée par SHA-256 du contenu → invalidation automatique ;
- ✅ nettoyage des anciens caches à l'activation ;
- ✅ enregistrement uniquement en `PROD` ;
- ✅ `node --check` passe.

**Réserves :**

| Constat | Gravité |
| --- | --- |
| Le service worker ne prend en main ni ne rafraîchit la page : après un déploiement, l'utilisateur peut rester sur l'ancienne version jusqu'à fermeture complète | 🟡 |
| Aucun gestionnaire `message`/`SKIP_WAITING` → pas de mécanisme de mise à jour contrôlée | 🟡 |
| `public/assets/aistudio/*` **copié dans `dist/`** (1,5 MB) sans être référencé par le code | 🟠 Voir R4 |
| Le précache n'inclut pas les polices Google → rendu dégradé hors ligne (dépendance réseau externe) | 🟡 |
| `manifest.webmanifest` : icônes 192/512 ✅, `display: standalone` ✅, mais pas de `maskable` icon | 🟡 |

### 8.3 Environnement de démonstration

✅ Le serveur Vite est correctement configuré pour l'aperçu Arena (`host: 0.0.0.0`, `allowedHosts: ['.e2b.app']`), ce qui évite l'erreur classique de rejet d'hôte.

⚠️ Sans `.env.local`, l'application affiche « Configuration Supabase manquante » — comportement **voulu et correct**, pas un bug.

---

## 9. Documentation — analyse critique

### 9.1 Points remarquables

La documentation (7 fichiers, 241 lignes) est **d'une honnêteté rare** : elle distingue explicitement « opérationnel », « préparé mais non déployé », « partiel », « à développer » et « service à organiser ». `data/planFeatures.ts` encode ces états dans le produit lui-même. C'est une pratique exemplaire.

### 9.2 Affirmations périmées ou inexactes

| Fichier | Affirmation | Réalité constatée |
| --- | --- | --- |
| `docs/audit-et-migration-supabase.md` § État réel | « `npm install` standard a échoué sur un conflit peer esbuild/Vite ; installation par `--legacy-peer-deps` » | ✅ **Périmé** : `npm ci` réussit proprement, 0 conflit |
| idem | « Le build avertit d'un bundle > 500 Ko » | ❌ **Périmé** : plus aucun avertissement (476 KB) |
| idem | « Le build avertit de l'utilisation de `__dirname` dans la configuration Vite » | ❌ **Périmé** : la config utilise `import.meta.dirname` |
| `docs/lot-6-inventaire.md` | « Le nouvel onglet ne sera opérationnel qu'après application » | ✅ Exact |
| `README.md` | « l'inventaire par station (migration encore à déployer) » | ✅ Exact, mais **sous-estimé** : ce sont 4 migrations, pas 1 |
| `README.md` | « les rôles employés […] ne sont pas encore opérationnels » | ✅ Exact |
| `SubscriptionPlans.tsx` (texte UI) | « Les migrations d'abonnement, d'inventaire et de rôles ne sont pas déployées **sur LavAuto** » | ✅ Exact et bien visible pour l'utilisateur |

**Seul vrai décalage** : le document fondateur `public/assets/aistudio/Paste_…b69dc675` est une **spécification stratégique** (modèle économique, prix 5 000 / 15 000 / 35 000 FCFA, workflow, catégories de véhicules). Il est servi **publiquement** et **intégralement en clair** alors qu'il n'est référencé nulle part dans le code.

---

## 10. Tableau consolidé des anomalies

| ID | Priorité | Anomalie | Preuve | Correctif |
| --- | :---: | --- | --- | --- |
| **A1** | 🔴 P0 | 4 migrations non déployées (memberships, subscription_limits, inventory, role_permissions) | `list_migrations` | Appliquer après test sur branche Supabase jetable |
| **A2** | 🔴 P0 | CI rouge sur `main` : module `@/components/ui/button` absent | Run #42669884299 | **Corrigé** (voir § 12) |
| **A3** | 🟠 P1 | `site_url = http://localhost:3000`, `uri_allow_list` vide | `get_auth_config` | Configurer l'URL réelle du déploiement |
| **A4** | 🟠 P1 | Aucun flux de réinitialisation de mot de passe | `grep resetPasswordForEmail` = 0 | Ajouter `resetPasswordForEmail` + écran de saisie du nouveau mot de passe |
| **A5** | 🟠 P1 | Document stratégique interne exposé sur `/assets/aistudio/` | HTTP 200, 47 514 o, 0 référence | Déplacer hors de `public/` |
| **A6** | 🟠 P1 | `image_a81d1a79.png` (1,4 MB) copiée dans `dist/` sans usage | `du` | Idem A5 |
| **A7** | 🟠 P1 | Quotas d'abonnement non appliqués en production | triggers absents | Bloqué par A1 |
| **A8** | 🟡 P2 | `framer-motion` importé sans être déclaré | `npm ls framer-motion` | Déclarer ou supprimer le legacy |
| **A9** | 🟡 P2 | 6 dépendances inutilisées sur 13 | `grep` imports = 0 | Nettoyer `package.json` |
| **A10** | 🟡 P2 | `"strict": true` absent de `tsconfig.json` | Fichier config | Ajouter (coût nul) |
| **A11** | 🟡 P2 | 9 336 lignes de code mort (88 % de `src/`) | `wc -l` | Archiver le legacy |
| **A12** | 🟡 P2 | Aucun test de composant / parcours | `grep components/ tests/` = 0 | Ajouter Testing Library |
| **A13** | 🟡 P2 | Test d'intégration toujours `skipped` | `npm test` | Exécuter l'opt-in sur Supabase local |
| **A14** | 🟡 P2 | Pas d'`ErrorBoundary` | `grep componentDidCatch` = 0 | Ajouter un boundary racine |
| **A15** | 🟡 P2 | Boutons sans `type` dans des `<form>` (×3) | `grep <button` | `type="submit"` explicite |
| **A16** | 🟡 P2 | Pas de CSP / en-têtes de sécurité | `index.html` | Définir une CSP |
| **A17** | 🔵 P3 | `package.json` nommé `react-example` v`0.0.0` | Fichier | Renommer |
| **A18** | 🔵 P3 | Deux lockfiles (`bun.lock` + `package-lock.json`) | `ls` | En garder un |
| **A19** | 🔵 P3 | Deux matrices de plans contradictoires (`features.ts` free/premium/enterprise vs `planFeatures.ts` starter/pro/business) | Lecture | Supprimer `features.ts` avec le legacy |
| **A20** | 🔵 P3 | `metadata.json` déclare une capacité Gemini inutilisée | Fichier | Retirer |
| **A21** | 🔵 P3 | `rate_limit_email_sent = 2`/h | `get_auth_config` | Augmenter avant lancement |
| **A22** | 🔵 P3 | Mot de passe 6 caractères, HIBP désactivé | `get_auth_config` | Durcir |
| **A23** | 🔵 P3 | Les migrations SQL s'appliquent avant `auth.users` sur PGlite : elles ne peuvent pas être rejouées sur une base vierge sans privilèges superutilisateur | Observation | Documenter |
| **A24** | 🔵 P3 | `create_station_order` (non idempotente) reste exposée en plus de la variante idempotente | `pg_proc` ACL | `REVOKE` après migration des appels |
| **A25** | 🔵 P3 | `.aistudio/artifacts/…/media_….jpg` (280 KB) versionné | `git ls-files` | Retirer du suivi Git |

---

## 11. Plan d'action priorisé

### Sprint 1 — Rendre l'application conforme à ce qu'elle affiche (P0/P1)

1. **Créer une branche Supabase jetable** (`create_branch`), y appliquer les 4 migrations manquantes, rejouer `npm test` et le smoke test d'intégration, vérifier les 5 scripts SQL, puis seulement après décider de la fusion sur la branche par défaut.
2. **Configurer Auth** : `site_url` = URL réelle du déploiement, `uri_allow_list` correspondante. Sans cela, aucune inscription ne peut aboutir en production.
3. **Déployer la CI** — déjà verte après A2 ; vérifier le run suivant.
4. **Ajouter la réinitialisation de mot de passe** (A4) : c'est le seul moyen de récupération pour un utilisateur.
5. **Retirer `public/assets/aistudio/`** du dossier public (A5/A6).

### Sprint 2 — Réduire la dette structurelle (P2)

6. Archiver le legacy (A11) et, dans la foulée, corriger A8, A9, A19 et le poids des dépendances.
7. Activer `"strict": true` (A10) — coût nul aujourd'hui.
8. Ajouter un `ErrorBoundary` racine (A14) et les `type="submit"` manquants (A15).
9. Mettre en place la CSP et les en-têtes de sécurité (A16).

### Sprint 3 — Fiabiliser par les tests (P2)

10. Ajouter `@testing-library/react` + `jsdom` et couvrir les 4 parcours critiques : connexion, création de prestation (en ligne et depuis la file), saisie de catalogue, invitation.
11. Exécuter réellement le test d'intégration Supabase (A13) dans une CI avec `supabase start`.
12. Ajouter un test de non-régression `npm run lint` → déjà couvert par la CI.

### Sprint 4 — Performance et produit (P3)

13. Différer `SubscriptionPlans` (11,7 KB de HTML) et envisager `React.lazy` sur `StationOrders`.
14. Comptabiliser les quotas d'abonnement dans l'interface une fois A1/A7 en place.
15. Ajouter `SKIP_WAITING` au service worker pour une mise à jour maîtrisée.

---

## 12. Correction appliquée dans cette session

**Anomalie A2 — CI rouge depuis le commit `dc7f314`.**

```
src/components/HeroSection.tsx(4,24): error TS2307:
  Cannot find module '@/components/ui/button' or its corresponding type declarations.
```

`HeroSection.tsx` importait un composant `Button` (probablement shadcn/ui) qui **n'existe pas** dans le dépôt : `src/components/ui/` ne contient que `AnimatedPanel.tsx`.

**Impact** : `npm run lint` échouait → l'étape « Type check » de la CI échouait → **les étapes suivantes (tests, build, validation du service worker) étaient toutes `skipped`**. Aucune régression n'était donc plus détectée automatiquement sur `main`.

**Correctif choisi** (minimal, sans effet sur le code actif) : remplacement du composant `<Button>` inexistant par les boutons HTML natifs correspondants, avec conservation à l'identique des classes Tailwind, des libellés et des icônes. `HeroSection` n'est pas monté par l'application (composant legacy), donc **aucun impact fonctionnel** ; l'objectif est de rétablir le type-check et la protection CI.

```diff
-import { Button } from '@/components/ui/button';
...
-<Button size="lg" className="… group bg-gradient-to-r from-cyan-500 …">
+<button type="button" className="group inline-flex items-center bg-gradient-to-r from-cyan-500 …">
     Commencer gratuitement
     <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
-</Button>
+</button>
-<Button size="lg" variant="secondary" className="px-8 py-6 …">
+<button type="button" className="inline-flex items-center px-8 py-6 …">
     Voir la démo
-</Button>
+</button>
```

Alternative écartée : créer `src/components/ui/button.tsx`. Cela aurait réintroduit un composant inutilisé, alors que la suppression du legacy supprimera `HeroSection` de toute façon.

**Validation après correctif :**

```
npm run lint                → exit 0  ✅
npx tsc --noEmit --strict   → exit 0  ✅  (le projet passe même en mode strict)
npm test                    → 20 tests, 19 pass, 0 fail, 1 skip  ✅
npm run build               → 523 ms, 476 KB, exit 0  ✅
node --check dist/sw.js     → OK  ✅
```

---

## 13. Conclusion

**ServiceLavage est un projet dont l'ingénierie dépasse largement le niveau de maturité de son déploiement.**

Ce qui est bon est vraiment bon : un modèle RLS/RPC sans faille détectée, des écritures exclusivement serveur, une idempotence transactionnelle correcte, des prix figés avec verrou, une interface hors ligne défensive et honnête, et une couverture de tests SQL supérieure à la moyenne. La documentation distingue rigoureusement le livré du promis.

Ce qui ne va pas tient en une phrase : **le dépôt affirme quatre modules de plus que ce que la base de production contient.** Le décalage de 4 migrations ne produit pas d'erreur bruyante — l'interface dégrade proprement, avec des messages corrects — ce qui rend le problème d'autant plus insidieux : un propriétaire croit avoir un ERP complet alors que deux onglets sur six ne peuvent rien faire, qu'aucun employé ne peut se connecter, et que les quotas commerciaux ne sont pas appliqués.

**Trois actions suffisent à changer la nature du produit** : appliquer les 4 migrations sur une branche jetable puis en production, corriger la configuration Auth (`site_url`), et ajouter la réinitialisation de mot de passe. Les trois se font sans risque : la base ne contient aujourd'hui qu'une station et aucune prestation.

**Recommandation finale** : ne pas ouvrir l'application à de vrais utilisateurs avant A1, A3 et A4. À l'inverse, ne pas engager de refonte : le socle est sain, il manque essentiellement un déploiement.

---

## Annexe — Commandes de reproduction

```bash
npm ci
npm run lint
npx tsc --noEmit --strict
npm test
VITE_SUPABASE_URL=https://example.supabase.co \
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_example \
npm run build
node --check dist/sw.js
npm audit

# Vérifier le décalage de déploiement
# → connecteur Supabase : list_migrations (project_ref = avvkzliysacpyavmetsx)
# attendu : 10 versions ; constaté : 6
```
