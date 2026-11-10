# Audit général — ServiceLavage, 10 novembre 2026

**Périmètre :** code source actif (`src/`), schéma PostgreSQL et RLS du projet Supabase
`avvkzliysacpyavmetsx` (LavAuto), configuration Auth, tests, build, PWA, documentation.
**Méthode :** lecture intégrale du code actif, exécution réelle des contrôles
(`npm ci`, `tsc`, `npm test`, `vite build`, `node --check`), inspection de la base
déployée (migrations, catalogue, privilèges, politiques RLS, données), revue de la
configuration Auth et du dernier run CI.

---

## 1. Verdict en une page

| Domaine | Note | Commentaire |
| --- | :---: | --- |
| Sécurité (RLS / RPC / privilèges) | **A−** | Aucune faille détectée ; écritures exclusivement serveur, `SECURITY DEFINER`, `search_path = ''`. |
| Modèle de données | **A−** | Contraintes fortes, index corrects, idempotence transactionnelle, prix figés. |
| Qualité du code actif | **B** | Typé, défensif, mais quatre écrans affichaient des chiffres inventés. |
| Fiabilité / tests | **B+** | 75 tests verts (dont 6 nouveaux) ; 1 test d'intégration toujours ignoré ; aucun test de bout en bout. |
| Performance | **C+** | `jsPDF + html2canvas` (600 kB) étaient chargés pour tous ; correctif appliqué → −68 % sur le bundle initial. |
| Produit livré vs promis | **C** | Quotas, rôles et invitations sont réellement appliqués ; caisse, paiements, dépenses et exports Excel manquent. |
| Documentation | **B+** | Riche et honnête, mais plusieurs affirmations étaient périmées (corrigées). |

**Le socle technique est solide. Le produit, lui, n'affichait pas toujours la vérité :**
tableau de bord et rapports présentaient des recettes simulées, une marge inventée et
une répartition des paiements fictive comme s'il s'agissait de mesures. C'est le défaut
le plus grave trouvé dans cette session — plus grave qu'un bug, parce qu'un propriétaire
prend des décisions commerciales sur ces chiffres.

### Corrections appliquées pendant l'audit

| # | Correction | Fichiers |
| --- | --- | --- |
| 1 | Suppression de **toutes** les données inventées des écrans (courbe simulée, `|| 12` de remplissage, `total_xof: 5000`, marges `+14 %`, dépenses `22 %`, ventilation 52/26/12 %, `meta.total_xof` d'une file hors ligne) | `StationDashboard`, `StationReports` |
| 2 | `jsPDF` + `html2canvas` sortis du bundle initial : `ReceiptModal` est chargé à la demande | `StationOrders` |
| 3 | Rattachement des onglets à **une seule matrice** de rôles + réinitialisation de l'onglet au changement de station (un caissier pouvait atterrir sur un panneau vide) | `OwnerPortal` |
| 4 | `OwnerPortal` n'expose plus « Rejoindre une équipe » à un laveur (le serveur le refuse de toute façon) | `OwnerPortal` |
| 5 | `window.confirm` (2 occurrences) remplacé par de vraies boîtes de dialogue accessibles | `StationOrders`, `StationStaff` |
| 6 | Rapport : semaine ISO (lundi), exclusion des prestations annulées du CA, garde `error` affichée, requête bornée à l'année en cours, nom de station réel sur le reçu | `StationReports`, `StationOrders` |
| 7 | Export CSV : protection contre l'injection de formules (`=`, `+`, `-`, `@`) et guillemets doublés | `StationReports` |
| 8 | `npm ci` **échouait** : `package-lock.json` désynchronisé de `package.json` → lockfile régénéré (CI réparée) | `package-lock.json` |
| 9 | Dépendances mortes retirées : `motion`, `canvas-confetti`, `@types/canvas-confetti` (0 import) | `package.json` |
| 10 | `metadata.json` ne déclare plus une capacité Gemini inutilisée ; `React.StrictMode` activé ; `.env.example` documenté | `metadata.json`, `main.tsx`, `.env.example` |
| 11 | Documentation remise à jour (11 migrations, état réel des rapports) + cet audit | `README.md`, `docs/` |
| 12 | Configuration Auth : `site_url` ne pointait plus sur une session morte, liste blanche limitée à localhost et aux aperçus `e2b.app` | projet Supabase |

**Contrôles après corrections**

```
npm ci                    → 166 paquets, lockfile cohérent
npm run lint (tsc)        → 0 erreur
npm run check:reachability→ 40 fichiers atteignables, 0 inutilisé
npm test                  → 76 tests : 75 passés, 0 échec, 1 ignoré (opt-in Supabase local)
npm run build             → OK ; chunk initial 531 kB (149 kB gzip) au lieu de 1 142 kB (330 kB)
node --check dist/sw.js   → OK
npm audit                 → 0 vulnérabilité
Vite dev                  → / :200, /docs/… et /tests/… :404, images et manifeste :200
```

---

## 2. Ce que l'application fait réellement

```
index.html → main.tsx → App → OwnerPortal (auth + routage par rôle)
                               ├─ StationDashboard (lazy, recharts)
                               ├─ StationOrders    (+ ReceiptModal lazy, jsPDF)
                               ├─ StationServices
                               ├─ StationCustomers
                               ├─ StationInventory (lazy)
                               ├─ StationStaff     (lazy)
                               ├─ StationReports   (lazy)
                               └─ SubscriptionPlans
```

| Module | État réel | Ce qui manque |
| --- | --- | --- |
| Stations | ✅ Création, sélection, cache local | Renommage/suppression depuis l'UI, transfert de propriété |
| Prestations | ✅ Création (RPC idempotente), transitions, file hors ligne | Modification, recherche, pagination, affectation en lot |
| Catalogue | ✅ CRUD services, activation | Suppression, duplication, tarifs par type de véhicule |
| Clients | ✅ Création/édition, compteur | **Suppression**, historique client, véhicules rattachés, recherche |
| Inventaire | ✅ Pro/Business, ajustements, file hors ligne | Sortie automatique liée aux prestations (consommation réelle) |
| Personnel | ✅ Invitations, rôles, révocation | Renvoi d'invitation, changement de rôle d'un membre existant |
| Rapports | ⚠️ **Partiel** : totaux réels et détail des prestations | Dépenses, moyens de paiement, marge, export Excel, consolidation multi-stations |
| Abonnements | ✅ Lecture du plan et des quotas appliqués | Paiement, changement de plan self-service |
| Caisse / paiements | ❌ Absent | Journal de caisse, encaissement, remboursement, clôture |
| Vitrine / marketplace | ❌ Absent | Pages publiques, galerie, réservation WhatsApp |

**État des données en production :** 2 comptes, 2 stations (1 par propriétaire), 0 service,
0 client, 0 prestation, 1 abonnement `pro`. Les quotas ne sont donc pas encore éprouvés
par des données réelles.

---

## 3. Limites techniques, par gravité

### 3.1 🔴 Critiques (à traiter avant tout pilote réel)

| # | Limite | Preuve | Recommandation |
| --- | --- | --- | --- |
| **L1** | **Aucun moyen de paiement n'existe.** Le cycle s'arrête à « terminé » : impossible d'encaisser, de tracer un règlement ou de rapprocher une caisse. C'est la fonction n°1 attendue par un gérant de station. | `station_orders` n'a pas de colonne de règlement ; `planFeatures` → `cash: planned` | Migration `payments` (table + RPC `record_payment` idempotente + contrainte somme payée ≤ total), puis écran caisse |
| **L2** | **Aucune dépense enregistrée** → le bénéfice net ne peut pas être calculé. Depuis le correctif, l'écran l'annonce explicitement au lieu de l'inventer. | `StationReports` : carte « Dépenses & Bénéfice : Non suivis » | Table `station_expenses` + catégories, puis marge réelle |
| **L3** | **Aucun test de bout en bout** (aucun navigateur). Les 75 tests valident la logique, le SQL et 3 formulaires d'auth ; personne ne vérifie qu'un propriétaire peut créer une prestation puis la clôturer. | `tests/` : 0 test sur `OwnerPortal` | Playwright + un projet Supabase de test, 4 scénarios (connexion, prestation, invitation, quota) |
| **L4** | **La CI ne peut pas protéger le produit** : `main` est rouge depuis le commit courant. Cause exacte : `npm ci` échoue (`Missing: html2canvas@1.4.1 from lock file`). Les 5 étapes suivantes étaient `skipped`. | Run `42862364680`, étape « Install locked dependencies » | **Corrigé** : lockfile régénéré ; à confirmer au prochain push |

### 3.2 🟠 Élevées

| # | Limite | Détail | Recommandation |
| --- | --- | --- | --- |
| **L5** | **`html2canvas` est non maintenu** | Le PDF passe par une capture d'image du DOM : texte non sélectionnable, poids élevé, 600 kB, et la bibliothèque est abandonnée depuis 2023. | Passer à `doc.text()`/`autoTable` (jsPDF seul, ~150 kB) pour le rapport ; garder l'image seulement pour le ticket 80 mm |
| **L6** | **Le reçu affiche des données approximatives** | `TicketModal`/`ReceiptModal` reçoit `TICK-<6 car.>` et aucun moyen de paiement (non stocké). | Après L1 : numéro séquentiel serveur + moyen de règlement réel |
| **L7** | **Quotas non pilotés par l'UI** | `enforce_monthly_order_limit` refuse la prestation n°501 en erreur SQL brute (`P0001`), non traduite ; l'interface affiche le message PostgreSQL. | RPC `my_subscription` en amont + message dédié quand le quota est atteint |
| **L8** | **Aucune pagination nulle part** | 5 écrans chargent l'historique complet (`station_orders`, `station_customers`…). À 5 000 prestations, un téléphone en 3G télécharge plusieurs Mo. | `.range()` + compteur `count`, ou curseur `created_at` |
| **L9** | **Recherche absente** | Retrouver un client par téléphone dans une liste non paginée n'est pas possible. | Champ de recherche (index `pg_trgm` sur `name`, `phone`) |
| **L10** | **Un `owner` sans ligne `owner_subscriptions` est bloqué à la 2ᵉ station** | Cas réel présent en base (1 propriétaire sans abonnement → Starter, 1 station). C'est voulu, mais l'erreur remontée est un message SQL brut. | Message « Plan Starter : 1 station. Contactez l'administrateur. » |

### 3.3 🟡 Moyennes

| # | Limite | Détail |
| --- | --- | --- |
| **M1** | Données personnelles en clair dans `localStorage` | Nom, téléphone et identifiants de station, non chiffrés, sur des appareils parfois partagés. Documenté, mais aucune politique de confidentialité ni purge à la déconnexion. |
| **M2** | Pas de nettoyage du cache à la déconnexion | `servicelavage:stations:v2:<userId>`, `:order-data:`, `:inventory:` restent après `signOut`. Un autre utilisateur du même appareil ne les lit pas (clé par `userId`) mais l'appareil les conserve indéfiniment. |
| **M3** | Concurrence multi-onglets | La file hors ligne est protégée par clé unique et verrou de réentrance en mémoire, pas par un verrou inter-onglets (`BroadcastChannel` / Web Locks). |
| **M4** | `rate_limit_email_sent = 2/h` | Une inscription sur deux échoue silencieusement en volume. À relever et à couvrir par un SMTP dédié. |
| **M5** | Mot de passe : 6 caractères côté Supabase | L'interface impose 8 (`MIN_PASSWORD_LENGTH`), le serveur 6 : un appel direct à l'API contourne la règle UI. |
| **M6** | HIBP désactivé, pas de MFA imposée pour `owner` | `password_hibp_enabled = false`, `mfa_totp_enroll_enabled = true` mais facultatif. |
| **M7** | `ErrorBoundary` + `StrictMode` | `ErrorBoundary` présent (bien) ; `StrictMode` ajouté cette session. Aucun reporting d'erreur (Sentry ou équivalent). |
| **M8** | Thème : moitié des écrans en dur | ~40 fonds `bg-[#1…]` et 96 `text-slate-*` figés dans les modules alors que `Card`/`Button` utilisent les variables CSS : le mode clair est incohérent. |
| **M9** | PWA sans mise à jour contrôlée | Pas de `SKIP_WAITING` : après un déploiement, un onglet ouvert reste sur l'ancienne version jusqu'à fermeture complète. |
| **M10** | Aucun indicateur de synchronisation global | La file hors ligne est visible seulement dans Prestations/Inventaire ; aucune bannière « 3 opérations en attente » au niveau du portail. |
| **M11** | Messages d'erreur SQL bruts (15 occurrences) | `${error.message}` affiche l'anglais PostgreSQL. Fonctionnel mais peu utilisable par un gérant. |
| **M12** | Deux lockfiles (`bun.lock`, `package-lock.json`) | La CI et le README imposent npm ; `bun.lock` n'est plus à jour et n'est utilisé par rien. |

### 3.4 🔵 Mineures / dette

- `src/components/ui/designSystem.tsx` est un simple ré-export de compatibilité : à supprimer et importer `./ui` directement (5 fichiers).
- `docs/archive/strategie-produit-initiale.md` (1 692 lignes) et `docs/archive/illustration-produit.png` (1,4 Mo) : utiles, mais 1,5 Mo versionnés dans un dépôt de 4,2 Mo.
- `archive/legacy-2026-11/` (9 919 lignes) est exclu de `tsconfig` et n'est plus compilé : sain, mais son `README` doit rester le seul point d'entrée.
- `roleFeaturesReady` : le repli propriétaire de `OwnerPortal` (si `current_station_role` échoue) rend `Personnel` inaccessible même au propriétaire, avec un message « migrations non déployées » désormais faux.
- Aucun `aria-live` sur les messages asynchrones de certains modules ; `Alert` gère `role`, ce qui suffit pour l'essentiel.
- Pas de `maskable` icon dans le manifeste : icône rognée sur Android.
- Polices Google chargées en externe : rendu dégradé hors ligne, latence ivoirienne.

---

## 4. Sécurité — revue détaillée

### 4.1 Points forts (vérifiés en base)

1. **RLS sur 12/12 tables** `public`, aucune exception ; `station_order_requests` a 0 politique (invisible du client, usage interne).
2. **Écritures exclusivement serveur** : `authenticated` n'a `INSERT`/`UPDATE` que sur `stations`, `station_services`, `station_customers`, colonne par colonne ; aucune mutation d'order, de stock, de rôle ni d'invitation n'est permise en direct.
3. **13 fonctions `SECURITY DEFINER`** avec `SET search_path = ''`, `REVOKE` de `public`/`anon`, `GRANT` à `authenticated` uniquement. `create_station_order` (variante non idempotente) n'est **plus** exécutable par `authenticated` depuis la migration `revoke_legacy_order_rpc`.
4. **Idempotence** par `pg_advisory_xact_lock` + journal de requêtes : rejeu sûr après réponse perdue, refus d'un UUID réutilisé avec une charge différente.
5. **Prix figés** (`station_order_items`) avec verrou `FOR SHARE` sur les services ; le tarif serveur s'applique même si le tarif affiché hors ligne diffère.
6. **Rôles vérifiés en base** (`current_station_role`) dans chaque RPC et chaque politique : un laveur ne peut que démarrer/terminer une prestation **qui lui est affectée**.
7. **Invitations** : e-mail normalisé, expiration 7 jours, e-mail confirmé obligatoire, pas de double adhésion, révocation immédiate.
8. **Quotas appliqués côté PostgreSQL** (stations et prestations mensuelles), y compris en cas de concurrence.
9. **Aucun secret versionné** ; `.env*` ignoré ; la CI utilise des valeurs factices ; CSP en `meta` injectée au build (aucune référence de projet en dur) ; service worker qui ne cache jamais de réponse API.
10. **`npm audit` : 0 vulnérabilité** sur 166 paquets après nettoyage.

### 4.2 Réserves

| # | Réserve | Gravité |
| --- | --- | :---: |
| S1 | Clé `anon` **héritée** (JWT legacy) toujours active en plus de la clé publiable. À révoquer une fois le client migré, pour réduire la surface. | 🟡 |
| S2 | Les clés `anon`/`publishable` sont publiques par nature : aucune donnée sensible ne doit jamais être exposée sans RLS. Vérifié conforme aujourd'hui. | 🟡 |
| S3 | Pas d'en-têtes de sécurité serveur (CSP en `meta` uniquement, pas de `Strict-Transport-Security`, `X-Content-Type-Options`, `Permissions-Policy`). Dépend de l'hébergeur. | 🟡 |
| S4 | `security_refresh_token_reuse_interval = 10 s` : à garder court ; non modifiable via le connecteur, à vérifier dans le dashboard. | 🔵 |
| S5 | Aucun audit log des changements de rôle/invitation côté applicatif (seuls les logs PostgreSQL existent et `audit_log_disable_postgres = true`). | 🟡 |
| S6 | Pas de limitation de débit applicative sur `resetPasswordForEmail` autre que celle de Supabase. | 🔵 |

---

## 5. Performance

| Métrique | Avant | Après correctif |
| --- | --- | --- |
| Chunk initial | 1 142 kB (330 kB gzip) | **531 kB (150 kB gzip)** |
| `jsPDF` + `html2canvas` | dans le chunk initial | 601 kB, chargé **seulement** à l'ouverture d'un reçu |
| Recharts (tableau de bord) | 394 kB, déjà différé | inchangé |
| CSS | 111 kB (17 kB gzip) | inchangé |

Gains restants possibles : sortir `recharts` du tableau de bord (graphiques en SVG maison
ou `chart.js/auto` plus léger), remplacer `html2canvas` (L5), et différer `SubscriptionPlans`.

Requêtes : 18 `select` sans `limit`, dont 5 non bornés sur l'historique (L8). Aucun N+1
détecté (les agrégats sont faits côté client à partir d'une requête unique).

---

## 6. Tests et fiabilité

| Suite | Contenu | État |
| --- | --- | --- |
| `tenantIsolation`, `migrationUpgradePath` | 11 migrations sur PGlite + 5 scripts SQL | ✅ |
| `station_role_permissions`, `subscription_limits`, `station_inventory`, `station_memberships` | matrice des rôles, quotas, stock, invitations | ✅ |
| `authForms`, `authFormsDom` | 3 formulaires d'auth montés dans un vrai DOM | ✅ |
| `orderSyncIntegration`, `offlineOrders`, `offlineInventory` | files immuables, réponse perdue, rejeu idempotent | ✅ |
| **`tabPermissions`** (nouveau) | matrice des onglets, non-régression du changement de station | ✅ 5 tests |
| **`noInventedFigures`** (nouveau) | interdit les chiffres inventés des écrans, verrouille le lazy-loading du reçu et la protection CSV | ✅ 6 tests |
| `supabaseLocalIntegration` | Auth/PostgREST réels, concurrence | ⏭️ ignoré (Docker absent) |

**Manquent toujours :** parcours navigateur de bout en bout (L3), test de charge sur les
quotas, test d'accessibilité automatisé, test du rendu mobile.

---

## 7. Produit — ce qui manque pour être vendable

1. **Encaisser** (L1) : c'est le cœur du métier. Sans caisse, l'application est un
   registre de véhicules, pas un ERP.
2. **Suivre les dépenses** (L2) : eau, produits, salaires, électricité — sans elles,
   aucune marge.
3. **Imprimer un ticket fiable** (L6) : numéro séquentiel serveur, moyen de paiement,
   duplicata.
4. **Retrouver une information** (L8/L9) : recherche client par téléphone, pagination.
5. **Piloter le quota** (L7/L10) : message clair à l'approche de la limite mensuelle.
6. **Vitrine / marketplace** : deux des trois offres payantes (Pro « visibilité »,
   Business « vitrines par site ») ne sont adossées à rien.
7. **Onboarding** : aucun guide de première utilisation ; un nouveau propriétaire voit
   « Créer une station » puis un catalogue vide.
8. **Support** : `Assistance 24/7` est annoncée dans l'offre Business sans processus
   (déjà signalé honnêtement dans `planFeatures`, mais l'offre reste vendue ainsi).

---

## 8. Plan d'action proposé

### Sprint A — Sécuriser la livraison (1 jour)
1. Pousser le lockfile corrigé, vérifier que la CI repasse **verte** (L4).
2. Vérifier `Auth → URL Configuration` pour chaque environnement (fait pour l'aperçu).
3. Désactiver la clé `anon` héritée une fois le client migré (S1).
4. Relever `rate_limit_email_sent` et brancher un SMTP (M4).

### Sprint B — Fiabiliser les chiffres (2-3 jours)
5. Migrer `StationReports` de `html2canvas` vers du texte jsPDF (L5) — le PDF devient
   lisible, cherchable et 4 fois plus léger.
6. Tests de bout en bout Playwright sur 4 parcours (L3), exécutés en CI.
7. Pagination + recherche clients/prestations (L8/L9).
8. Purge du cache local à la déconnexion (M2) + bannière globale de synchronisation (M10).

### Sprint C — Compléter le métier (1-2 semaines)
9. **Paiements** : `station_payments` (moyens, montant, référence, idempotence),
   RPC `record_payment`, contrainte `somme payée ≤ total`, écran caisse, clôture
   journalière, ventilation réelle dans les rapports (L1, L6).
10. **Dépenses** : `station_expenses`, catégories, marge réelle (L2).
11. Quotas : message dédié + compteur visible (L7/L10).

### Sprint D — Produit et exploitation
12. Vitrine publique par station (URL stable, galerie, WhatsApp) — rend les offres
    Pro/Business cohérentes.
13. Onboarding guidé, thème clair cohérent (M8), `maskable` icon, polices auto-hébergées.
14. Journal d'audit applicatif des rôles/invitations (S5), monitoring d'erreurs (M7).

---

## 9. Annexes

### 9.1 Reproduction des contrôles

```bash
npm ci                                             # lockfile cohérent (corrigé)
npm run lint                                       # tsc --noEmit
npm run check:reachability                         # 40 fichiers, 0 inutilisé
npm test                                           # 76 tests
VITE_SUPABASE_URL=https://example.supabase.co \
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_example \
npm run build && node --check dist/sw.js
npm audit
```

### 9.2 Vérifications SQL utilisées sur la base déployée

```sql
-- migrations déployées (11)
select version, name from supabase_migrations.schema_migrations order by version;

-- RLS et politiques par table
select c.relname, c.relrowsecurity, count(p.*) from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_policies p on p.tablename = c.relname
 where n.nspname = 'public' and c.relkind = 'r' group by 1,2 order by 1;

-- privilèges réels de anon / authenticated (aucune écriture métier)
select table_name, grantee, privilege_type, string_agg(column_name, ',') 
  from information_schema.column_privileges
 where table_schema = 'public' and grantee in ('anon','authenticated')
 group by 1,2,3 order by 1;

-- fonctions SECURITY DEFINER et leurs ACL
select proname, prosecdef, proacl from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' order by 1;
```

### 9.3 Fichiers touchés dans cette session

```
package.json / package-lock.json   dépendances mortes retirées, lockfile réparé (CI)
metadata.json                      capacité Gemini inutilisée retirée
.env.example                       documenté
src/main.tsx                       React.StrictMode
src/components/OwnerPortal.tsx     matrice d'onglets unique, reset au changement de station, invitation masquée au laveur
src/components/StationDashboard.tsx chiffres inventés supprimés
src/components/StationReports.tsx  marges/ventilation inventées supprimées, semaine ISO, annulations exclues,
                                   requête bornée, erreurs affichées, CSV sécurisé, reçu lazy
src/components/StationOrders.tsx   reçu chargé à la demande, dialogue d'annulation, nom de station réel
src/components/StationStaff.tsx    dialogue de révocation accessible
tests/tabPermissions.test.ts       nouveau (5 tests)
tests/noInventedFigures.test.ts    nouveau (6 tests)
docs/audit-general-2026-11-10.md   ce document
README.md, docs/rapport-audit…     mise à jour
```
