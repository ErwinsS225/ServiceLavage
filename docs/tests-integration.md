# Validation d’intégration locale Supabase

## Contrat et sécurité

Les tests PGlite restent la suite rapide de CI : ils appliquent les migrations SQL et émulent les rôles Supabase/`auth.uid()`, mais ne prétendent pas tester Auth, PostgREST, le navigateur ou un vrai pool de connexions.

Le test opt-in `tests/supabaseLocalIntegration.test.ts` utilise de vrais clients Auth/PostgREST et lance plusieurs comptes en parallèle. Il vérifie les lectures RLS owner/gérant/caissier/laveur, l'affectation d'un laveur, des mutations interdites et deux RPC d'inventaire simultanées avec le même UUID pour confirmer l'idempotence serveur. Il ne modifie la base que pour appliquer une fois un ajustement `+1` sur l'article de test dédié ; la clé UUID fixe évite de le répéter aux exécutions suivantes. Utiliser une base **jetable locale uniquement**.

Une garde technique refuse toute URL qui n'est pas `localhost`, `127.0.0.1` ou `::1`. Ne jamais contourner cette garde ni remplacer la configuration par LavAuto ou un projet de production.

## Prérequis et lancement

1. Installer Supabase CLI et Docker localement, démarrer une stack locale, puis appliquer les migrations au projet local (`supabase start`, `supabase db reset`). Les migrations de memberships, abonnements, inventaire et permissions doivent être présentes.
2. Dans Auth local, créer cinq utilisateurs de test e-mail confirmés : propriétaire Pro de la station fixture, gérant, caissier, laveur affecté à une prestation et compte étranger sans accès. Préparer un client, un service actif, une prestation affectée, une autre non affectée, et un article inventaire **dédié à ce test**.
3. Dans le shell seulement, définir `RUN_LOCAL_SUPABASE_INTEGRATION=1`, `SUPABASE_LOCAL_URL`, `SUPABASE_LOCAL_ANON_KEY`, puis les paires `SUPABASE_LOCAL_OWNER_EMAIL/PASSWORD`, `MANAGER`, `CASHIER`, `WASHER`, `OUTSIDER`. Fournir aussi `SUPABASE_LOCAL_STATION_ID`, `SUPABASE_LOCAL_ASSIGNED_ORDER_ID`, `SUPABASE_LOCAL_UNASSIGNED_ORDER_ID` et `SUPABASE_LOCAL_INVENTORY_ITEM_ID`. Ne pas inscrire ces valeurs dans Git ni dans une variable `VITE_`.
4. Lancer `npm run test:integration` pour le smoke Auth/PostgREST. `npm test` exécute PGlite et marque le smoke test opt-in comme ignoré.

Sans `RUN_LOCAL_SUPABASE_INTEGRATION=1`, ce test est explicitement marqué **skipped**. Cette omission ne signifie pas que l'intégration a été validée.

## État dans cet environnement

Lors du contrôle, Docker, Supabase CLI, `psql` et Chromium/Chrome ne sont pas installés. Le test Auth/PostgREST n'a donc pas pu être exécuté ici ; seuls les tests PGlite peuvent tourner. Aucun projet distant n'a été utilisé.

Il reste également à valider manuellement dans un navigateur réel : installation et reprise du service worker, premier chargement qui peuple le cache stock, coupure réseau, ajustements simultanés sur deux appareils, retour réseau, refus serveur après révocation/changement de plan, perte de réponse et rechargement de page. Les données Supabase ne sont jamais mises en cache par le service worker ; l'inventaire local utilise localStorage non chiffré.
