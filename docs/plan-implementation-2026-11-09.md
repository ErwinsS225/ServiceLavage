# Plan d'implémentation — ServiceLavage / Clean It CI

**Date :** 9 novembre 2026
**Référence :** [`rapport-audit-complet-2026-11-09.md`](./rapport-audit-complet-2026-11-09.md)
**Branche de travail :** `arena/5a866d29-servicelavage`
**Base cible :** projet Supabase LavAuto `avvkzliysacpyavmetsx` (eu-west-2, ACTIVE_HEALTHY)

---

## 1. Objectif et critère de succès

### 1.1 Objectif

Rendre l'application **conforme à ce qu'elle affiche** : que chacun des 6 onglets du portail fonctionne réellement en production, que les quotas commerciaux soient appliqués par la base, et que la CI protège durablement contre les régressions.

### 1.2 Critères de succès (definition of done globale)

| # | Critère | Mesure objective |
| --- | --- | --- |
| **C1** | Les 10 migrations sont déployées et l'historique est aligné | `list_migrations` → 10 entrées ; `supabase migration list` sans dérive |
| **C2** | Un compte employé (gérant/caissier/laveur) peut se connecter et accéder à ses modules | Test manuel des 4 rôles + test d'intégration automatisé |
| **C3** | Les 6 onglets du portail sont opérationnels | Aucune erreur « relation/function does not exist » en console |
| **C4** | Les quotas Starter/Pro/Business sont refusés par PostgreSQL | Insertion d'une 2ᵉ station en Starter → erreur serveur |
| **C5** | Un utilisateur peut réinitialiser son mot de passe | Parcours complet testé de bout en bout |
| **C6** | La CI est verte et **bloquante** | Run `verify` vert sur la branche protégée |
| **C7** | Le code mort ne représente plus > 10 % de `src/` | `wc -l` : legacy archivé |
| **C8** | Les parcours critiques sont couverts par des tests de composant | ≥ 4 tests de parcours, exécutés en CI |
| **C9** | Aucun document interne n'est servi publiquement | `curl /assets/aistudio/*` → 404 |

---

## 2. Principes directeurs

Ces règles s'appliquent à **toutes** les tâches du plan et sont non négociables.

| # | Règle | Raison |
| --- | --- | --- |
| **P1** | **Toute migration est testée sur un projet jetable avant la production.** | Les branches Supabase sont indisponibles (plan gratuit) et `db reset` détruirait les données. |
| **P2** | **Jamais de `service_role` dans le navigateur, ni dans une variable `VITE_`.** | Clé à privilèges totaux ; contournerait toute la RLS. |
| **P3** | **Aucune migration existante n'est modifiée.** On ajoute une nouvelle migration. | L'historique distant est immuable ; modifier un fichier déjà appliqué crée une dérive silencieuse. |
| **P4** | **Une tâche = un commit ciblé = une PR courte.** | Revue effective ; retour arrière chirurgical. |
| **P5** | **Les tests précèdent ou accompagnent le correctif, jamais l'inverse.** | La CI doit rester le filet de sécurité au sens plein. |
| **P6** | **Aucune suppression de données utilisateur sans sauvegarde préalable.** | `pg_dump` avant tout changement de schéma en production. |
| **P7** | **Le code legacy n'est jamais supprimé, il est archivé.** | Il reste la référence de spécification produit (`docs/`). |

---

## 3. Vue d'ensemble

### 3.1 Cinq lots

| Lot | Intitulé | Objectif | Tâches | Charge | Priorité |
| --- | --- | --- | :---: | :---: | :---: |
| **L1** | Déploiement des migrations | Faire fonctionner les 4 modules inertes | 6 | 2,5 j | 🔴 P0 |
| **L2** | Mise en service sécurisée | Auth, récupération de compte, hygiène publique | 5 | 1,5 j | 🔴 P0/P1 |
| **L3** | Dette structurelle | Réduire `src/` de 88 %, durcir le typage | 8 | 3 j | 🟠 P2 |
| **L4** | Durcissement des tests | Couvrir les parcours réels, activer l'intégration | 5 | 3,5 j | 🟠 P2 |
| **L5** | Finitions produit | Performance, PWA, exploitation | 4 | 1,5 j | 🔵 P3 |
| | **Total** | | **28** | **≈ 12 j** | |

### 3.2 Séquencement

```
Semaine 1  ┃ L1 (migrations)  ┃ L2 (auth)          ┃ L3-T1 (strict)
Semaine 2  ┃ L3 (legacy)       ┃ L4-T1..T3 (tests composants)
Semaine 3  ┃ L4-T4 (intégration CI)                    ┃ L5
```

**Chemin critique :** `L1-T1 → L1-T2 → L1-T3 → L1-T4 → L4-T4 → C2`.
Tant que L1 n'est pas fait, **L4-T4 est impossible** (le test d'intégration échouerait sur les tables manquantes).

### 3.3 Ce qui peut démarrer en parallèle

- L2 (Auth) est **indépendant** de L1 → peut être traité le premier jour, car il ne touche pas au schéma.
- L3-T1 (`strict`) est indépendant de tout → gain immédiat, coût nul.
- L3-T2 (archivage legacy) est indépendant de L1 et L2 → mais doit être **une PR isolée** (gros diff).

---

## 4. Lot L1 — Déploiement des migrations 🔴 P0

> **C'est le lot qui débloque le produit.** Aucune autre tâche n'a d'impact utilisateur comparable.

### L1-T1 — Créer un environnement de test jetable · `0,5 j`

**Constat :** les branches Supabase sont indisponibles (`list_branches` → vide) sur le plan actuel. Il faut donc un projet dédié.

**Procédure recommandée (option A — recommandée) :**

1. Créer un projet Supabase **gratuit** nommé `slv-migrations-sandbox` dans la même organisation.
2. Y appliquer **les 10 migrations dans l'ordre** (voir runbook § 5.1).
3. Y exécuter **les 5 scripts** de `supabase/tests/*.sql` puis les requêtes de vérification § 5.2.
4. **Détruire le projet** après validation (ou le conserver 30 j comme bac à sable permanent).

**Option B (dégradée, sans création de ressource) :** valider uniquement via PGlite (`npm test`), qui applique déjà les 10 migrations + les 5 scripts SQL. C'est **déjà fait et vert**, mais PGlite n'émule ni PostgREST, ni Auth, ni les privilèges réels de Supabase (rôles `anon`/`authenticated` créés à la main dans le harnais). Cette option ne couvre donc **pas** le risque de dérive de privilèges propre à Supabase.

> ⚠️ **Décision requise (voir § 8, D1).** Créer un projet cloud est une ressource facturable/limitée : je ne le fais pas sans votre accord explicite.

**Enregistrer l'écart constaté :** les 6 migrations déjà appliquées ont été enregistrées avec `statements` non nul et `name` renseigné. Les 4 nouvelles doivent être appliquées de la même façon pour ne pas créer de dérive au prochain `supabase db push`.

**DoD :** les 10 migrations s'appliquent **sans erreur** sur une base vierge ; les 5 scripts SQL passent ; l'écart avec l'historique local est nul.

---

### L1-T2 — Sauvegarder la production · `0,25 j`

**Avant tout changement de schéma**, même si les données sont quasi vides (1 station, 0 prestation).

1. `pg_dump` complet du schéma et des données via la connexion base (ou export depuis le tableau de bord).
2. Vérifier que le dump contient bien `auth.users`, `public.stations` et les 6 entrées de `supabase_migrations.schema_migrations`.
3. Stocker le dump **hors du dépôt** (jamais dans Git).

**DoD :** dump vérifié, restauration testée sur la sandbox L1-T1.

---

### L1-T3 — Appliquer les 4 migrations en production · `0,5 j`

**Ordre strictement imposé par les dépendances** (vérifié par analyse des références croisées) :

| Ordre | Migration | Dépend de | Crée |
| :---: | --- | --- | --- |
| 1 | `20261109140000_station_memberships` | `stations`, `auth.users` | 2 tables, 4 RPC |
| 2 | `20261109141000_subscription_limits` | `stations`, `station_orders` | 1 table, 2 triggers, 3 RPC/fonctions |
| 3 | `20261109142000_station_inventory` | `subscription_limits` ⚠️ | 2 tables, 1 RPC |
| 4 | `20261109150000_station_role_permissions` | **les 3 précédentes** ⚠️ | 3 policies, 4 RPC, 6 `CREATE OR REPLACE` |

> ⚠️ **L'ordre 3 avant 4 est obligatoire** : la migration `role_permissions` crée des policies qui référencent `public.station_inventory`, inexistante si l'étape 3 est sautée. Une inversion provoque une erreur `relation does not exist` en cours de DDL.

**Procédure :** voir runbook § 5.1 (deux voies : CLI Supabase ou connecteur).

**Effets de bord à annoncer à l'utilisateur avant déploiement :**

| Effet | Détail |
| --- | --- |
| 🔔 **Création de station bloquée au-delà du quota** | Le propriétaire actuel n'a pas de ligne `owner_subscriptions` → plan **Starter** par défaut → **1 station maximum**. Il possède déjà 1 station : toute création supplémentaire échouera jusqu'à attribution d'un plan Supérieur. |
| 🔔 **RPC remplacées** | `create_station_order` et `transition_station_order` sont redéfinies en version rôle-aware. L'ancienne variante `create_station_order` a depuis été refermée à `authenticated` (migration `20261109184205`, L1-T5). |
| 🔔 **`current_station_role` devient indispensable** | `OwnerPortal` l'appelle déjà ; en cas d'échec il retombe sur un repli propriétaire. Le déploiement supprime ce repli dégradé. |
| ✅ **Aucun impact sur les données existantes** | `enforce_station_limit` et `enforce_monthly_order_limit` sont des triggers `BEFORE INSERT` : ils ne touchent pas les lignes existantes. |

**DoD :** `list_migrations` retourne 10 entrées ; § 5.2 passe intégralement ; le portail affiche les 6 onglets sans erreur console pour un compte propriétaire.

---

### L1-T4 — Vérifier les quotas et les rôles en production · `0,5 j`

**Vérifications sûres** (lecture seule, **jamais** de `SET ROLE` sur la production) :

```sql
-- Quotas : plan par défaut du propriétaire
select * from public.subscription_limits('<owner_uuid>');
-- attendu : starter | 1 | 500

-- RPC accessibles aux bons rôles, fermées à anon
select proname,
       has_function_privilege('anon', oid, 'EXECUTE')          as anon_can,
       has_function_privilege('authenticated', oid, 'EXECUTE') as auth_can
from pg_proc
where proname in ('my_subscription','current_station_role','apply_inventory_operation',
                  'create_station_invitation','accept_station_invitation',
                  'assign_station_order','unassign_station_order',
                  'create_station_order_idempotent','transition_station_order')
order by proname;
-- attendu : anon_can = false partout, auth_can = true partout

-- Triggers présents
select tgname, tgrelid::regclass from pg_trigger
where tgname like 'enforce_%' or tgname like 'owner_subscription%';

-- RLS et politiques sur les 6 nouvelles tables
select tablename, count(*) from pg_policies
where schemaname='public' group by tablename order by tablename;
```

**Vérification des rôles (côté application, pas en SQL production) :** se connecter avec un compte gérant invité et confirmer l'accès aux onglets Prestations/Catalogue/Clients ; un laveur ne doit voir que ses prestations affectées.

**DoD :** les 4 requêtes retournent les valeurs attendues ; aucune RPC exécutable par `anon`.

---

### L1-T5 — Refermer la RPC non idempotente · `0,25 j` · *A24*

`create_station_order` reste exposée à `authenticated` en plus de sa variante idempotente, ce qui permet à un client de contourner la protection anti-doublon.

**Nouvelle migration** (jamais modifier l'existante — P3) :

```sql
-- 20261109XXXXXX_revoke_legacy_order_rpc.sql
revoke execute on function public.create_station_order(uuid, uuid, text, text, uuid[])
  from authenticated;
```

> ⚠️ **Vérifier d'abord** qu'aucun appel client ne subsiste : `grep rpc('create_station_order'` dans `src/` (actuellement 0 occurrence, seule la variante `_idempotent` est appelée). La variante idempotente appelle la fonction simple en interne : un `SECURITY DEFINER` n'est pas affecté par le `REVOKE` sur le rôle appelant, le chaînage reste fonctionnel — **à confirmer par un test PGlite avant déploiement**.

**DoD :** test PGlite vert prouvant que la variante idempotente fonctionne toujours, et que l'appel direct échoue avec `insufficient_privilege`.

---

### L1-T6 — Formaliser la procédure de migration · `0,5 j`

Créer `docs/runbook-migrations.md` : ordre imposé, prérequis, sauvegarde, vérifications, marche arrière, et **règle P3**.

**DoD :** le runbook permet à un tiers de rejouer l'opération sans contexte oral.

---

## 5. Runbooks détaillés (L1)

### 5.1 Application des migrations — deux voies

#### Voie A — CLI Supabase (à privilégier dès que Docker est disponible)

```bash
supabase login
supabase link --project-ref avvkzliysacpyavmetsx
supabase migration list          # doit montrer 4 versions locales absentes en distant
supabase db push --dry-run       # obligatoire : vérifier les 4 statements prévus
supabase db push                 # applique et enregistre l'historique
supabase migration list          # doit être aligné : 10 / 10
```

#### Voie B — Connecteur Supabase (`create_migration`) — disponible immédiatement

Chaque appel exécute le SQL **et** enregistre la ligne dans `supabase_migrations.schema_migrations` (colonnes vérifiées : `version`, `statements[]`, `name`, `created_by`, `idempotency_key`, `rollback[]`), ce qui **reste compatible avec un futur `supabase db push`** — c'est le point critique de cette voie.

**Contraintes opérationnelles :**

1. Une migration à la fois, dans l'ordre 1→4, **sans les regrouper**.
2. `name` doit correspondre **exactement** au suffixe du fichier (ex. `station_memberships`) pour éviter la divergence de nommage.
3. Vérifier § 5.2 après **chaque** étape, pas seulement à la fin.
4. En cas d'échec : le connecteur annonce un rollback ; **le vérifier** (compter les tables/fonctions restantes) avant de retenter.

> ⚠️ **Ne jamais** exécuter ces migrations via `execute_query` seul : elles seraient appliquées **sans** entrée d'historique, et la production deviendrait impossible à réconcilier (`db push` les rejouerait et échouerait sur `relation already exists`).

### 5.2 Requêtes de vérification post-déploiement

```sql
-- 1. Tables attendues : 6 nouvelles, toutes avec RLS
select c.relname, c.relrowsecurity,
       (select count(*) from pg_policies p where p.tablename=c.relname) as policies
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r'
  and c.relname in ('station_memberships','station_invitations','owner_subscriptions',
                    'station_inventory','station_inventory_operations','station_order_assignments')
order by 1;
-- attendu : 6 lignes, relrowsecurity = true partout

-- 2. Fonctions attendues
select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and proname in
  ('current_station_role','create_station_invitation','accept_station_invitation',
   'cancel_station_invitation','revoke_station_membership','my_subscription',
   'subscription_limits','apply_inventory_operation','assign_station_order',
   'unassign_station_order','enforce_station_limit','enforce_monthly_order_limit')
order by 1;
-- attendu : 12 lignes

-- 3. Aucune table sans RLS
select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;
-- attendu : 0
```

### 5.3 Marche arrière

| Scénario | Action |
| --- | --- |
| Échec **pendant** l'étape 1 ou 2 | Rollback transactionnel automatique ; vérifier l'absence de table résiduelle ; corriger le test préalable |
| Échec **après** l'étape 3 (inventaire) | Ne pas retenter à l'aveugle : les 2 tables peuvent exister. Inspecter, puis appliquer uniquement les objets manquants dans une migration de correction |
| Régression fonctionnelle après déploiement complet | **Ne pas supprimer les tables** (perte de données). Désactiver côté client via un feature flag, puis corriger par une migration additive |
| Perte de données avérée | Restauration du dump L1-T2 |

---

## 6. Lot L2 — Mise en service sécurisée 🔴 P0/P1

### L2-T1 — Configurer Supabase Auth · `0,5 j` · *A3, A21, A22*

**Constat actuel :** `site_url = http://localhost:3000`, `uri_allow_list` vide, `password_min_length = 6`, `rate_limit_email_sent = 2/h`, `password_hibp_enabled = false`.

**Sans cette tâche, aucune inscription réelle ne peut aboutir : le lien de confirmation renvoie vers localhost.**

| Paramètre | Valeur cible | Justification |
| --- | --- | --- |
| `site_url` | **URL de production réelle** (voir D2) | Destination des liens e-mail |
| `uri_allow_list` | URL prod + URL de prévisualisation + `http://localhost:3000` | Autorise le développement et la production |
| `mailer_autoconfirm` | `false` (**ne pas changer**) | Ne jamais désactiver la confirmation pour « faire passer » un test |
| `password_min_length` | `8` | Standard minimal |
| `password_hibp_enabled` | `true` | Refus des mots de passe compromis |
| `rate_limit_email_sent` | `30` | 2/h bloquerait les inscriptions légitimes |
| `smtp_*` | Configurer un fournisseur dédié | Délivrabilité des e-mails transactionnels |

**DoD :** une inscription de test reçoit un e-mail dont le lien pointe vers l'URL publique, et la confirmation aboutit dans un navigateur.

---

### L2-T2 — Ajouter la récupération de mot de passe · `0,5 j` · *A4*

**Constat :** `resetPasswordForEmail` est absent du code. Un utilisateur qui oublie son mot de passe est **définitivement bloqué**.

**Implémentation dans `OwnerPortal.tsx` :**

1. Lien « Mot de passe oublié ? » sous le formulaire de connexion.
2. État `mode: 'signin' | 'signup' | 'forgot' | 'reset'`.
3. `supabase.auth.resetPasswordForEmail(email, { redirectTo: <URL prod> })`.
4. Au retour du lien (`type=recovery`), écoute de `onAuthStateChange` → affichage d'un formulaire « nouveau mot de passe » → `supabase.auth.updateUser({ password })`.
5. Messages en français, `role="status"` / `role="alert"`, bouton désactivé pendant l'appel.

**Points de vigilance :**

- La `redirectTo` doit figurer dans `uri_allow_list` (dépend de L2-T1).
- Ne jamais révéler si l'adresse existe (message neutre : « Si un compte existe, un e-mail a été envoyé »).
- Aucun `service_role` : ce flux ne nécessite que la clé publiable.

**Tests :** parcours complet sur la sandbox + 1 test de composant (L4).

**DoD :** un compte de test peut réinitialiser son mot de passe sans intervention manuelle en base.

---

### L2-T3 — Retirer les documents internes de `public/` · `0,25 j` · *A5, A6*

**Constat :** `public/assets/aistudio/Paste_…b69dc675` (47 Ko, spécification stratégique complète : prix, modèle économique, workflows) et `image_a81d1a79.png` (1,4 Mo) sont servis publiquement sur `/assets/aistudio/*` alors qu'**aucun code ne les référence**. Ils sont en plus copiés dans `dist/` à chaque build.

**Action :**

```
public/assets/aistudio/  →  docs/archive/strategie-produit.md   (le .md, renommé)
                          →  docs/archive/ (la .png, ou suppression si sans usage)
```

**Après déploiement :** vérifier que `/assets/aistudio/*` répond **404** et que `dist/` ne contient plus le dossier.

**DoD :** `curl -o /dev/null -w '%{http_code}' <prod>/assets/aistudio/Paste_...` → 404 ; `du -sh dist` réduit de ~1,5 Mo.

---

### L2-T4 — Ajouter la manifestation PWA et la stratégie de mise à jour · `0,25 j` · *A26*

Le service worker versionne son cache par SHA-256 mais n'expose ni `SKIP_WAITING` ni gestion de `updatefound` : après un déploiement, un utilisateur peut rester indéfiniment sur l'ancienne version.

**Action :** ajouter dans `sw.js` (généré par `vite.config.ts`) les handlers `skipWaiting()` / `clients.claim()`, et dans `main.tsx` un `registration.addEventListener('updatefound')` avec bannière « Nouvelle version disponible ».

**DoD :** déployer deux builds successifs ; la seconde visite propose une mise à jour sans vider le cache manuellement.

---

### L2-T5 — Documenter la politique de données locales · `0,25 j`

`localStorage` contient des **données personnelles non chiffrées** (noms, téléphones des clients) et des identifiants de station.

**Action :** ajouter une section « Données stockées sur l'appareil » dans `docs/pwa-hors-ligne.md` et un avertissement visible dans l'écran Clients, précisant la durée de conservation, l'absence de chiffrement et la conduite à tenir sur appareil partagé.

**DoD :** documentation à jour ; avertissement présent dans l'interface.

---

## 7. Lot L3 — Dette structurelle 🟠 P2

### L3-T1 — Activer TypeScript strict · `0,25 j` · *A10*

`tsconfig.json` n'a pas `"strict": true` (`noImplicitAny`, `strictNullChecks`, `strictPropertyInitialization` désactivés).

**Bonne nouvelle vérifiée :** le projet passe **déjà** `tsc --noEmit --strict` sans erreur (après L0). Coût d'activation : nul.

```json
"strict": true,
"noUnusedLocals": true,
"noUnusedParameters": true,
"noFallthroughCasesInSwitch": true,
"noUncheckedIndexedAccess": true   // ⚠️ introduire séparément, impact plus large
```

**DoD :** `npm run lint` et `npx tsc --noEmit --strict` verts ; la CI interdit toute régression future.

---

### L3-T2 — Archiver le code legacy · `1 j` · *A11, A19*

**Constat :** 9 336 lignes sur 10 531 (**88 %**) ne sont ni montées ni livrées au navigateur. `App.tsx` embarque un `MainLayout` important 24 composants, dont aucun n'atteint le bundle (vérifié).

**Périmètre à archiver :**

| Groupe | Fichiers |
| --- | --- |
| Contexte et données | `src/context/AppContext.tsx`, `src/data/mockData.ts`, `src/types/index.ts`, `src/config/features.ts` |
| Composants métier legacy | `Dashboard`, `QueueManagement`, `CustomerManagement`, `BayManagement`, `CashAndPayments`, `InventoryAndExpenses`, `ReportsAndAnalytics`, `CatalogueManagement`, `StaffManagement`, `SaaSAdminAndSubscriptions`, `MarketplaceView`, `SettingsAndHelp`, `NotificationsCenter`, `PosScreen`, `OnboardingWizard`, `HelpScreen`, `HeroSection`, `StationShowcase` |
| Sous-dossiers | `src/components/dashboard/`, `src/components/ui/` |
| Structures | `Sidebar`, `Header`, `NewWashModal`, `TicketModal`, `OrderDetailModal`, `QuickActionsFAB` |

**Procédure :**

1. Créer la branche `legacy/reference` et y figer l'état actuel.
2. Réduire `src/App.tsx` à `export default function App() { return <OwnerPortal />; }`.
3. Déplacer les fichiers vers `legacy/` **hors de `src/`**, ou les supprimer avec la branche comme archive.
4. Supprimer `featureConfig` (matrice contradictoire `free/premium/enterprise` vs `starter/pro/business` — A19).
5. Mettre à jour `README.md` § Organisation.

**Gain mesuré :** `src/` passe de 10 531 à **1 195 lignes (−88 %)** ; `tsc` accélère ; la revue de code devient possible.

**DoD :** `npm run lint`, `npm test`, `npm run build` verts ; le bundle reste à ~476 Ko (**preuve que rien d'utile n'a été supprimé**) ; `docs/` pointe vers la branche d'archive.

> 💡 **Note importante issue de l'audit :** le bundle est déjà **476 Ko / 134 Ko gzip avec 0 octet de legacy**. Le tree-shaking fait son travail. Ce lot n'apporte donc **aucun gain de performance** — uniquement de la maintenabilité. Ne pas le vendre comme une optimisation.

---

### L3-T3 — Nettoyer les dépendances · `0,25 j` · *A8, A9*

| Paquet | Action | Motif |
| --- | --- | --- |
| `@google/genai` | ❌ retirer | 0 import |
| `express` | ❌ retirer | 0 import (aucun serveur dans ce dépôt) |
| `dotenv` | ❌ retirer | 0 import (Vite charge `.env` nativement) |
| `autoprefixer` | ❌ retirer | 0 import (Tailwind v4 + Lightning CSS) |
| `framer-motion` | ❌ retirer **avec le legacy** | importé par 5 fichiers sans être **déclaré** (A8) |
| `motion` | ❌ retirer avec le legacy | dépendance de la dépréciation shadcn |
| `lucide-react` | ❌ retirer avec le legacy | legacy uniquement |
| `canvas-confetti` | ❌ retirer avec le legacy | legacy uniquement |

> ⚠️ **Ne pas retirer `framer-motion`/`motion` avant L3-T2** : le type-check casserait immédiatement (c'est exactement le défaut A2 corrigé en L0).

**DoD :** `npm ci` + `npm audit` (0 vulnérabilité) + build vert ; `package.json` ne contient que les dépendances réellement importées par le code actif (`react`, `react-dom`, `@supabase/supabase-js`, `lucide-react` **si** conservé).

---

### L3-T4 — Ajouter un ErrorBoundary racine · `0,25 j` · *A14*

Aucun `componentDidCatch` n'existe : une exception dans un composant actif blanchit toute la page, sans message ni reprise.

**Action :** composant `ErrorBoundary` (classe, `getDerivedStateFromError`) autour de `<OwnerPortal />`, avec message en français, bouton « Recharger » et remontée de l'erreur en console (jamais de détail technique exposé à l'utilisateur).

**DoD :** un composant qui lève volontairement une erreur affiche l'écran de secours, et le reste de l'application reste utilisable.

---

### L3-T5 — Corriger les boutons sans `type` · `0,25 j` · *A15*

3 boutons dans des `<form>` (`StationCustomers`, `StationServices`, `StationOrders`, `StationInventory`, `StationStaff`) n'ont pas de `type` explicite. Aujourd'hui ils sont les seuls boutons soumis : sans effet observable. Mais l'ajout futur d'un bouton « Annuler » déclencherait une soumission involontaire.

**Action :** `type="submit"` explicite sur les boutons de soumission, `type="button"` sur tous les autres. Audit systématique.

**DoD :** `grep '<button' src/components/` ne retourne plus aucun bouton sans `type`.

---

### L3-T6 — Définir une Content Security Policy · `0,5 j` · *A16*

Aucun en-tête de sécurité n'est posé. Le risque XSS est déjà faible (React échappe, aucun `dangerouslySetInnerHTML`), mais une CSP est la ceinture de sécurité.

**Action :** `<meta http-equiv="Content-Security-Policy">` dans `index.html` **et** configuration serveur (la meta suffit pour l'application, mais pas pour `frame-ancestors`).

Politique de départ à affiner :

```
default-src 'self';
connect-src 'self' https://<ref>.supabase.co wss://<ref>.supabase.co;
img-src 'self' data:;
style-src 'self' 'unsafe-inline';
font-src 'self' https://fonts.gstatic.com;
script-src 'self';
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
```

> ⚠️ `style-src 'unsafe-inline'` est requis par Tailwind/shadcn ; à documenter. `connect-src` **doit** inclure le domaine Supabase, sinon le portail cesse de fonctionner — tester en mode `Content-Security-Policy-Report-Only` avant d'appliquer.

**DoD :** le portail fonctionne intégralement (connexion, RPC, inventaire) avec la CSP active ; 0 violation en console.

---

### L3-T7 — Assainir les métadonnées projet · `0,25 j` · *A17, A18, A20*

| Élément | Action |
| --- | --- |
| `package.json` → `"name": "react-example"`, `"version": "0.0.0"` | Renommer `servicelavage` / `1.0.0` |
| `bun.lock` **et** `package-lock.json` | Supprimer `bun.lock` (la CI et le README imposent npm) |
| `metadata.json` → `majorCapabilities: [SERVER_SIDE_GEMINI_API]` | Retirer : aucune fonctionnalité Gemini, la déclaration est un risque d'exposition future de clé |
| `.env.example` → 6 variables `VITE_PAYMENT_*` | Retirer : seul le legacy les lit (`CashAndPayments`, `OnboardingWizard`) — à faire **après** L3-T2 |

**DoD :** aucun fichier de configuration ne mentionne plus une capacité ou un fournisseur inutilisé.

---

### L3-T8 — Nettoyer le suivi Git · `0,25 j` · *A25*

`.aistudio/artifacts/…/media_….jpg` (280 Ko) est versionné sans usage. Ajouter `.aistudio/` au `.gitignore` et retirer du suivi.

**DoD :** `git ls-files` ne contient plus aucun artefact d'outil.

---

## 8. Lot L4 — Durcissement des tests 🟠 P2

> **Sans ce lot, les correctifs de L1/L2 ne sont pas protégés.** C'est ici que se joue la durabilité.

### L4-T1 — Mettre en place l'outillage de test de composant · `0,5 j` · *A12*

```bash
npm i -D @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom vitest
```

**Décision d'architecture :** adopter **Vitest** plutôt que d'étendre `tsx --test`, pour disposer de `jsdom`, du mocking de modules et du watch. Conserver `node:test` pour les tests PGlite (ils dépendent de `node:test` et fonctionnent bien) → deux scripts : `test:unit` (Vitest) et `test:sql` (PGlite).

**DoD :** `npm test` lance les deux suites ; 0 test cassé.

---

### L4-T2 — Tester les parcours critiques du portail · `1 j` · *A12*

Avec un client Supabase mocké (interface typée, pas de mock ad hoc) :

| Test | Scénario |
| --- | --- |
| `OwnerPortal.login` | E-mail/mot de passe → `signInWithPassword` appelé une fois ; erreur serveur affichée en `role="alert"` |
| `OwnerPortal.reset` | Lien « Mot de passe oublié » → `resetPasswordForEmail` avec la bonne `redirectTo` |
| `StationServices.save` | Prix `12.5` refusé, `-1` refusé, `1500` accepté → `insert` avec `price_xof: 1500` |
| `StationOrders.create` | File locale alimentée avant l'appel réseau ; message « en attente » affiché |
| `StationOrders.offline` | `navigator.onLine = false` → aucune requête, entrée conservée |
| `StationInventory.adjust` | Delta > stock → refus côté client, file non alimentée |

**DoD :** 6 tests verts couvrant les chemins d'erreur, pas seulement le cas nominal.

---

### L4-T3 — Tester la file hors ligne de bout en bout · `0,5 j` · *A12*

Les tests actuels couvrent `offlineOrders`/`offlineInventory` isolément. Ajouter :

- double synchronisation concurrente (verrou `syncing.current`) ;
- entrée corrompue présente → l'interface signale et **ne supprime pas** ;
- changement d'utilisateur entre mise en file et synchronisation (`session.user.id !== userId`) → refus explicite.

**DoD :** 3 tests supplémentaires verts.

---

### L4-T4 — Exécuter le test d'intégration Supabase en CI · `1 j` · *A13*

**C'est le test qui aurait détecté R1.** Il est aujourd'hui systématiquement `skipped`.

**Action :** job GitHub Actions avec `supabase/setup-cli` + `supabase start`, `supabase db reset`, création des 5 comptes fixtures, puis `npm run test:integration`.

```yaml
  integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: supabase start
      - run: supabase db reset          # applique les 10 migrations
      - run: ./scripts/seed-fixtures.sh # 5 comptes + station + prestations + article
      - run: npm ci && npm run test:integration
```

**Dépendance :** nécessite L1 terminé (les tables doivent exister) et des fixtures scriptées.

**DoD :** le job tourne **réellement** (pas `skipped`) et passe ; il échoue volontairement si l'on retire une migration.

---

### L4-T5 — Documenter la rejouabilité des migrations · `0,25 j` · *A23*

Les scripts SQL supposent les rôles `anon`/`authenticated`/`service_role` et le schéma `auth` préexistants (fournis par Supabase, émulés dans PGlite). Documenter cette hypothèse pour éviter un futur faux diagnostic.

**DoD :** `docs/runbook-migrations.md` contient la section « Prérequis d'environnement ».

---

## 9. Lot L5 — Finitions produit 🔵 P3

### L5-T1 — Optimiser le chargement des écrans lourds · `0,5 j`

`SubscriptionPlans` produit **11 768 caractères de HTML** et n'est utile qu'à un propriétaire ; `StationOrders` est le plus gros composant actif.

**Action :** `React.lazy` + `Suspense` sur `SubscriptionPlans` et `StationOrders`, avec squelettes de chargement.

**DoD :** le bundle d'entrée baisse mesurablement ; aucune régression fonctionnelle.

---

### L5-T2 — Compléter le service worker · `0,5 j`

- icône `maskable` dans le manifeste ;
- précache des polices (ou `font-display: swap` + fallback système) pour un rendu correct hors ligne ;
- test manuel : coupure réseau, rechargement, reprise.

**DoD :** l'application s'installe et se relance hors ligne avec un rendu correct.

---

### L5-T3 — Documenter le parcours d'attribution des plans · `0,25 j`

Aucune interface d'administration n'existe : un plan s'attribue **en SQL avec un accès privilégié**. Documenter la requête exacte, les précautions (jamais depuis le navigateur) et la procédure de changement de plan.

**DoD :** procédure documentée et testée sur la sandbox.

---

### L5-T4 — Mettre à jour la documentation périmée · `0,25 j`

Trois affirmations de `docs/audit-et-migration-supabase.md` sont **périmées** (vérifié) :

| Affirmation | Réalité |
| --- | --- |
| « `npm install` échoue sur un conflit peer esbuild/Vite, `--legacy-peer-deps` requis » | `npm ci` réussit proprement, 0 conflit |
| « le build avertit d'un bundle > 500 Ko » | Plus aucun avertissement (476 Ko / 134 Ko gzip) |
| « le build avertit de `__dirname` dans la config Vite » | La config utilise `import.meta.dirname` |

**DoD :** la documentation correspond à l'état mesuré ; `README.md` reflète les 10 migrations déployées.

---

## 10. Correspondance avec l'audit

Aucune anomalie n'est orpheline.

| Anomalie | Tâche | Anomalie | Tâche | Anomalie | Tâche |
| --- | --- | --- | --- | --- | --- |
| A1 | **L1-T3** | A10 | **L3-T1** | A19 | **L3-T2** |
| A2 | ✅ *corrigé* | A11 | **L3-T2** | A20 | **L3-T7** |
| A3 | **L2-T1** | A12 | **L4-T1/T2/T3** | A21 | **L2-T1** |
| A4 | **L2-T2** | A13 | **L4-T4** | A22 | **L2-T1** |
| A5 | **L2-T3** | A14 | **L3-T4** | A23 | **L4-T5** |
| A6 | **L2-T3** | A15 | **L3-T5** | A24 | **L1-T5** |
| A7 | **L1-T3/T4** | A16 | **L3-T6** | A25 | **L3-T8** |
| A8 | **L3-T3** | A17 | **L3-T7** | A26 | **L2-T4** |
| A9 | **L3-T3** | A18 | **L3-T7** | | |

---

## 11. Risques du plan et parades

| Risque | Prob. | Impact | Parade |
| --- | :---: | :---: | --- |
| Une migration échoue en production à mi-parcours | Faible | Élevé | Sandbox L1-T1 obligatoire + vérification § 5.2 après **chaque** migration |
| Blocage de création de station pour l'utilisateur actuel (quota Starter = 1) | **Élevé** | Moyen | Annoncer avant déploiement ; attribuer un plan Pro si besoin (L5-T3) ; comportement voulu |
| Le `REVOKE` de L1-T5 casse la RPC idempotente | Moyen | Élevé | **Écarté** : test PGlite + vérification production confirment que le chaînage `SECURITY DEFINER` traverse le `REVOKE`. Marche arrière : `grant execute … to authenticated` |
| L'archivage legacy casse un import oublié | Faible | Moyen | `tsc` + build le détectent immédiatement ; PR isolée, retour arrière trivial |
| La CSP casse Supabase (realtime WebSocket) | Moyen | Élevé | Mode `Report-Only` d'abord ; inclure `wss://` dans `connect-src` |
| Le job d'intégration CI est instable (Docker) | Moyen | Moyen | Lancer en `continue-on-error` la première semaine, puis bloquant |
| Perte de données lors du déploiement | Très faible | Critique | Dump L1-T2 + restauration testée |

---

## 12. Points de décision

Ces choix m'appartiennent pas : ils requièrent votre arbitrage avant exécution.

| # | Question | Options | Recommandation |
| --- | --- | --- | --- |
| **D1** | Comment tester les migrations avant la production ? | **A.** Créer un projet Supabase gratuit jetable (~5 min, consomme un slot) · **B.** Se contenter de PGlite (déjà vert, mais ne couvre pas les privilèges réels) | **A** — le risque d'un échec à mi-parcours en production est le plus coûteux du plan |
| **D2** | Quelle URL de production pour `site_url` / `redirectTo` ? | Domaine propre · URL de prévisualisation Arena · Rester en localhost (dev uniquement) | À fournir : **sans URL stable, C5 (récupération de mot de passe) est impossible** |
| **D3** | Que faire du code legacy ? | **A.** Archiver sur branche `legacy/reference` · **B.** Supprimer définitivement · **C.** Laisser en place | **A** — conserve la référence produit sans polluer `src/` |
| **D4** | Quel plan attribuer au propriétaire actuel après L1 ? | Starter (1 station, défaut) · Pro (2 stations, 2 500 prestations) · Business | Dépend du modèle commercial ; Starter est le défaut technique |
| **D5** | Faut-il rendre le job d'intégration bloquant immédiatement ? | Bloquant dès le départ · Tolérant 1 semaine | Tolérant d'abord (Docker en CI est parfois instable) |

---

## 13. Calendrier proposé

| Semaine | Lot | Livrables | Jalon |
| --- | --- | --- | --- |
| **S1** | L1 + L2-T1/T2 | 10 migrations déployées, Auth configurée, récupération de mot de passe | 🎯 **Produit fonctionnel** (C1, C2, C3, C4, C5) |
| **S2** | L2-T3/T4/T5 + L3-T1/T2/T3 | Documents retirés, legacy archivé, strict activé, dépendances nettoyées | 🎯 **Dette réduite de 88 %** (C7, C9) |
| **S3** | L3-T4..T8 + L4-T1/T2/T3 | ErrorBoundary, CSP, 9 tests de composant | 🎯 **Parcours couverts** (C8) |
| **S4** | L4-T4/T5 + L5 | Intégration en CI, finitions, documentation | 🎯 **CI complète et documentation à jour** (C6) |

**Chemin le plus court vers un produit utilisable : S1 seule (≈ 4 jours de travail effectif).**

---

## 14. Prochaine action immédiate

Sous réserve de D1 et D2, la première action concrète est **L1-T1** : valider les 10 migrations sur la sandbox, puis **L1-T3** : appliquer les 4 migrations en production.

**Ce que je peux exécuter dès votre accord :**

1. Créer le projet sandbox et y appliquer les 10 migrations (D1 = A).
2. Exécuter les vérifications § 5.2 et vous fournir le rapport de sortie.
3. Appliquer les 4 migrations en production, une par une, avec vérification intermédiaire.
4. Enchaîner L2-T1 (configuration Auth) et L2-T2 (récupération de mot de passe) dans la même PR.

**Ce qui exige une information de votre part :** l'URL publique de production (D2). Sans elle, je peux tout déployer sauf la configuration des redirections e-mail.

---

## 15. Journal d'exécution

| Date | Tâche | Résultat |
| --- | --- | --- |
| 2026-11-09 | **A2** — CI rouge | ✅ Corrigé (`HeroSection` : composant `Button` inexistant remplacé par des boutons natifs) |
| 2026-11-09 | **L1-T1** — Environnement de test jetable | ⚠️ **Bloqué** : quota de projets gratuits atteint. Remplacé par `tests/migrationUpgradePath.test.ts` (rejoue le chemin 6 → 10 sur PGlite) |
| 2026-11-09 | **L1-T2** — Sauvegarde | ✅ Dump logique dans `docs/sauvegardes/` |
| 2026-11-09 | **L1-T3** — Application des migrations | ✅ **10/10 déployées**, une par une, vérifiées après chaque étape |
| 2026-11-09 | **L1-T4** — Vérifications | ✅ 12 tables, toutes RLS ; 0 fonction exécutable par `anon` ; 3 triggers actifs ; station intacte |
| 2026-11-09 | **D4** — Plan du propriétaire | ✅ **Pro** attribué (2 stations / 2 500 prestations) |
| 2026-11-09 | **L1-T6** — Runbook | ✅ `docs/runbook-migrations.md` |
| 2026-11-09 | **L2-T1** — Config Auth | ✅ `site_url` + `uri_allow_list` sur l'URL de prévisualisation. ⚠️ 3 paramètres (`password_min_length`, `password_hibp_enabled`, `rate_limit_email_sent`) non exposés par l'API → à faire dans le Dashboard |
| 2026-11-09 | **L2-T2** — Récupération de mot de passe | ✅ Formulaire `forgot` + `recovery`, 5 tests |
| 2026-11-09 | **L2-T3** — Documents internes | ✅ Déplacés dans `docs/archive/`. **Découverte** : `docs/`, `tests/` et `supabase/` étaient servis par le serveur de dev → bloqués par un plugin, 5 tests |
| 2026-11-09 | **L3-T1** — TypeScript strict | ✅ `strict: true` + `noFallthroughCasesInSwitch`, **0 erreur**. `noUnusedLocals` reporté après archivage du legacy (129 erreurs, toutes legacy) |
| 2026-11-09 | **L3-T3** — Dépendances | ✅ 13 → 6 de production, 190 → 62 paquets, bundle **inchangé** (489,92 Ko) |
| 2026-11-09 | **L3-T7** — Métadonnées | ✅ `servicelavage@1.0.0` (était `react-example@0.0.0`) |
| 2026-11-09 | **L3-T4** — ErrorBoundary | ✅ Écran de secours avec « Réessayer » et « Recharger » ; détail technique en console uniquement |
| 2026-11-09 | **L3-T5** — Boutons sans `type` | ✅ 38/38 explicites dans le code actif + `tests/buttonTypes.test.ts` (3 tests) |
| 2026-11-09 | **L3-T6** — Content Security Policy | ✅ 12 directives, origine Supabase injectée au build (jamais en dur) + `tests/contentSecurityPolicy.test.ts` (4 tests) |
| 2026-11-09 | **L3-T8** — `.aistudio/` hors Git | ✅ 1 fichier retiré du suivi + `.gitignore`. Toujours dans l'historique (`dc7f314`) : non réécrit |
| 2026-11-09 | **L3-T2** — Archiver le legacy | ✅ 33 fichiers / ≈ 9 200 lignes vers `archive/legacy-2026-11/`, exclus de `tsconfig`. **`noUnusedLocals` + `noUnusedParameters` activés** (129 → 0 erreur). Bundle 499,84 → 492,10 Ko |
| 2026-11-09 | **Refonte des pages d’authentification** | ✅ Cadre scindé (photo + formulaire), 4 écrans (connexion, inscription, oubli, réinitialisation), messages d'erreur en français, `aria-invalid`, `tests/authForms.test.ts` (8 tests) |
| 2026-11-09 | **Correctif `offlineShell`** | ✅ Le plugin plantait sur tout build SSR (pas d'`index.html`) ; il sort maintenant si le bundle n'en contient pas |
| 2026-11-09 | **L5** — `bun.lock` et `metadata.json` | ✅ Supprimés : lockfile Bun obsolète (nommait encore `react-example` et `@google/genai`) et manifeste déclarant une capacité Gemini sans usage |
| 2026-11-09 | **L1-T5** — Refermer la RPC non idempotente | ✅ Migration `20261109184205` déployée. `create_station_order` → `auth_can=false`, variante idempotente intacte. `supabase/tests/revoke_legacy_order_rpc.sql` |

### Reste à faire

| Tâche | Blocage |
| --- | --- |
| Tests de composant avec un DOM (React Testing Library) | Aucun test ne monte un composant dans un vrai DOM : les écrans sont vérifiés par analyse statique et rendu SSR. Nécessiterait `jsdom` + RTL, non installables hors npm. |
| Parcours authentifié réel | Jamais exécuté avec un compte de production. `CocoWash` existe, le plan `pro` est attribué, mais aucun identifiant n'a été fourni. |
| 3 réglages Auth | Dashboard uniquement : `password_min_length`, `password_hibp_enabled`, `rate_limit_email_sent`. |
| D5 — CI bloquante sur PR | La CI tourne déjà et bloque ; la question portait sur l'exigence de statut pour la fusion, à arbitrer côté dépôt GitHub. |
