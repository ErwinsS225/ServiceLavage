# Runbook — migrations Supabase

## Règle absolue

**Aucune migration existante n'est modifiée après application.** L'historique distant est immuable : éditer un fichier déjà appliqué crée une dérive silencieuse entre le dépôt et la base. Tout correctif passe par une **nouvelle** migration.

## Prérequis d'environnement

Les scripts supposent un environnement Supabase, c'est-à-dire :

- les rôles `anon`, `authenticated`, `service_role` ;
- le schéma `auth` avec `auth.users(id, email, email_confirmed_at)` et `auth.uid()` ;
- des privilèges par défaut accordés aux rôles sur `public`.

Ces objets sont fournis par Supabase. Les tests PGlite les **émulent** (`tests/tenantIsolation.test.ts`, `tests/migrationUpgradePath.test.ts`) : un échec sur une base vierge non-Supabase vient de l'absence de ces prérequis, pas des migrations.

## État vérifié (10 novembre 2026)

> **Ce paragraphe fait foi.** L'état ci-dessous a été relu **directement sur la base**,
> pas déduit du dépôt : `list_migrations` + lecture du catalogue `public`. Il remplace
> les constats du rapport du 9 novembre, désormais marqué historique.

| Contrôle | Résultat vérifié le 10/11/2026 |
| --- | --- |
| Projet | LavAuto, ref `avvkzliysacpyavmetsx`, région `eu-west-2`, PostgreSQL 17.11 |
| Historique distant | **11 migrations**, de `20261109121406` à `20261109184205` |
| Catalogue `public` | 12 tables (toutes en RLS), 69 colonnes, 29 politiques, 16 fonctions, 3 déclencheurs, 21 index, 53 contraintes nommées, 11 privilèges `authenticated` |
| Schéma dépôt ↔ production | **identique**, objet par objet (voir `docs/sauvegardes/prod-schema-2026-11-10.json`) |
| Quotas | `enforce_station_limit`, `enforce_monthly_order_limit`, `owner_subscription_lock` présents |
| Écritures `authenticated` | `SELECT` partout + `INSERT`/`UPDATE` sur `station_customers` et `INSERT` sur `station_services` uniquement ; les prestations passent par des fonctions `SECURITY DEFINER` |
| Volumétrie | 2 stations, 2 comptes, 1 abonnement `pro`, **0 prestation** |

### Pourquoi il n'y a donc rien à déployer

Le seul écart restant est un **écart de versions**, pas de schéma : les cinq
dernières migrations ont été appliquées par le connecteur, qui horodate à
l'exécution. Les fichiers locaux portent donc d'autres numéros que l'historique
distant. `supabase db push` les croit « en attente » et tenterait de les rejouer
— sur un schéma qui les contient déjà. C'est la seule raison de ne pas le lancer.

### Vérifier soi-même, sans rien modifier

```bash
# 1. Le schéma produit par les migrations est-il toujours celui de la production ?
npx tsx --test tests/productionSchemaDrift.test.ts
```

Ce test rejoue les 11 migrations dans PGlite, puis compare le catalogue obtenu
(tables, colonnes, politiques, fonctions, déclencheurs, index, contraintes,
privilèges) à l'instantané `docs/sauvegardes/prod-schema-2026-11-10.json` capturé
sur le projet réel. Il échoue si quelqu'un modifie une migration déjà appliquée
ou si le dépôt ajoute une migration sans que la production la reçoive.

Pour rafraîchir l'instantané après une application **volontaire** de migration,
relancer la requête de capture (voir § Annexe) puis mettre à jour le JSON et la
date dans le test.

## Historique de déploiement (9 novembre 2026)

| Version | Nom | État |
| --- | --- | :---: |
| `20261109121406` | owner_stations | ✅ |
| `20261109122729` | station_customers | ✅ |
| `20261109122929` | station_services | ✅ |
| `20261109123327` | station_orders | ✅ |
| `20261109130303` | order_idempotency | ✅ |
| `20261109130602` | restrict_station_privileges | ✅ |
| `20261109182442` | station_memberships | ✅ |
| `20261109182456` | subscription_limits | ✅ |
| `20261109182509` | station_inventory | ✅ |
| `20261109182534` | station_role_permissions | ✅ |
| `20261109184205` | revoke_legacy_order_rpc | ✅ |

> ⚠️ **Les cinq dernières ont été appliquées via le connecteur Supabase** (`create_migration`), qui horodate au moment de l'exécution. Leurs numéros de version diffèrent donc des noms de fichiers locaux. **L'historique distant fait foi** : ne pas rejouer les fichiers locaux, ce qui les appliquerait une seconde fois.

| Fichier local | Version distante réelle |
| --- | --- |
| `20261109140000_station_memberships.sql` | `20261109182442` |
| `20261109141000_subscription_limits.sql` | `20261109182456` |
| `20261109142000_station_inventory.sql` | `20261109182509` |
| `20261109150000_station_role_permissions.sql` | `20261109182534` |
| `20261109160000_revoke_legacy_order_rpc.sql` | `20261109184205` |

Cette correspondance est figée dans `docs/sauvegardes/prod-schema-2026-11-10.json`
et vérifiée par `tests/productionSchemaDrift.test.ts` : elle ne peut pas dériver
silencieusement.

### Conséquence sur `supabase db push`

Un `supabase db push` détecterait les **cinq** fichiers locaux comme non appliqués (versions différentes) et tenterait de les rejouer. **Ne pas le lancer en l'état.** Pour aligner le dépôt sur le distant :

```bash
supabase link --project-ref avvkzliysacpyavmetsx
supabase migration list        # confirmer le décalage de versions
# 1) prouver d'abord que le schéma est identique :
npx tsx --test tests/productionSchemaDrift.test.ts
# 2) seulement ensuite, aligner l'historique (aucun SQL exécuté) :
supabase migration repair --status applied 20261109140000 20261109141000 \
                                      --status applied 20261109142000 20261109150000 \
                                      --status applied 20261109160000
```

> ⚠️ **Ne jamais lancer `migration repair` avant l'étape 1.** Inscrire une version
> comme appliquée sans avoir prouvé que le schéma correspond masquerait une vraie
> dérive au lieu de la corriger.

`migration repair` n'exécute aucun SQL : il ne fait qu'inscrire les versions locales comme déjà appliquées. À faire **après** avoir confirmé que le schéma distant correspond bien au contenu des fichiers.

## Ordre imposé par les dépendances

```
1. station_memberships        (tables seules, dépend de stations + auth.users)
2. subscription_limits        (triggers sur stations et station_orders)
3. station_inventory          (utilise subscription_limits)          ⚠️
4. station_role_permissions   (utilise les 3 précédentes)            ⚠️
```

**L'étape 3 doit précéder la 4** : les politiques créées à l'étape 4 référencent `public.station_inventory`. Inverser provoque `relation does not exist` en cours de DDL.

## Procédure d'application

### Voie A — CLI Supabase (préférée quand Docker est disponible)

```bash
supabase login
supabase link --project-ref <ref>
supabase migration list          # 4 versions locales absentes
supabase db push --dry-run       # vérifier les statements prévus
supabase db push
supabase migration list          # aligné
```

### Voie B — Connecteur Supabase (utilisée le 9 novembre 2026)

Contrainte : le quota de projets gratuits de l'organisation était atteint, et les branches de base ne sont pas disponibles sur ce plan. Aucun projet jetable n'a donc pu être créé.

1. **Sauvegarde logique** des lignes existantes (`docs/sauvegardes/`).
2. Appliquer **une migration à la fois** avec `create_migration` (exécute le SQL **et** enregistre l'historique).
3. `name` = suffixe exact du fichier local.
4. **Vérifier après chaque étape** (voir ci-dessous), pas seulement à la fin.

> ❌ **Ne jamais** exécuter ces migrations via `execute_query` seul : le SQL serait appliqué **sans** entrée d'historique, rendant la base impossible à réconcilier.

## Vérifications après application

```sql
-- 1. Toutes les tables ont la RLS
select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;
-- attendu : 0

-- 2. Aucune fonction exécutable par anon
select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prosecdef
  and has_function_privilege('anon', p.oid, 'EXECUTE')
  and p.proname <> 'rls_auto_enable';
-- attendu : 0 ligne (rls_auto_enable est un event trigger fourni par la plateforme)

-- 3. Triggers de quota actifs
select tgname, tgrelid::regclass::text from pg_trigger
where tgname in ('enforce_station_limit','enforce_monthly_order_limit','owner_subscription_lock');
-- attendu : 3 lignes

-- 4. Plan effectif du propriétaire
select * from public.subscription_limits('<owner_uuid>');
```

## Nouvelle migration : la seule voie autorisée

Toute évolution du schéma suit cette procédure, sans exception.

1. **Sauvegarde logique d'abord** (`docs/sauvegardes/AAAA-MM-JJ-avant-<objet>.json`) :
   lignes métier + compteurs, comme `2026-11-10-avant-nouvelle-migration.json`.
   Ne jamais y mettre de secret ni de hash de mot de passe.
2. **Nouveau fichier** dans `supabase/migrations/`, horodaté après `20261109184205`,
   **additif** : `create table if not exists`, `add column if not exists`,
   `create or replace function`, `create index if not exists`. Aucune migration
   appliquée n'est éditée, jamais.
3. **Test local obligatoire** : `npm run lint && npm test`. Les tests PGlite
   rejouent toutes les migrations sur une base vierge *et*
   `tests/productionSchemaDrift.test.ts` confronte le résultat à la production.
   Tant que la migration n'est pas déployée, ce dernier test échoue volontairement :
   c'est le rappel qu'il reste une étape.
4. **Déploiement** via `create_migration` du connecteur (exécute le SQL **et**
   enregistre l'historique) ou `supabase db push` après réparation de l'historique.
   Jamais `execute_query` seul : le SQL serait appliqué sans entrée d'historique.
5. **Vérification immédiate** avec les requêtes de la section suivante, puis
   rafraîchissement de l'instantané de référence et du test.

## Marche arrière

| Scénario | Action |
| --- | --- |
| Échec pendant l'étape 1 ou 2 | Échec transactionnel : vérifier l'absence de table résiduelle avant de retenter |
| Échec après l'étape 3 | Ne pas retenter à l'aveugle (les tables existent peut-être). Inspecter puis corriger par une migration additive |
| Régression fonctionnelle après déploiement | **Ne pas supprimer les tables** (perte de données). Désactiver l'usage côté client, corriger par une migration additive |
| Perte de données avérée | Restaurer depuis `docs/sauvegardes/2026-11-10-avant-nouvelle-migration.json` : 2 stations, 1 abonnement `pro`, 0 prestation. Les comptes `auth.users` ne sont **pas** restaurables par SQL (mots de passe gérés par Supabase Auth) : les recréer via l'interface Auth |

## Attribution des plans

Aucune interface d'administration : l'attribution se fait avec un accès privilégié (Dashboard SQL Editor), **jamais depuis le navigateur**.

```sql
insert into public.owner_subscriptions(owner_id, plan) values ('<uuid>','pro')
on conflict (owner_id) do update set plan = excluded.plan;
```

Plans : `starter` (1 station / 500), `pro` (2 / 2 500), `business` (10 / 10 000).

Un changement de plan **ne supprime aucune donnée** : les stations existantes sont conservées, mais la création est bloquée si le nouveau quota est déjà atteint.

## Tests de non-régression

```bash
npm test
```

`tests/migrationUpgradePath.test.ts` rejoue le scénario réel : les 6 migrations déployées le 9 novembre au matin, une station existante, puis chaque migration en attente avec une assertion de frontière — c'est le test qui aurait détecté le décalage de production.

`tests/productionSchemaDrift.test.ts` ferme la boucle côté **schéma** : il rejoue les 11 migrations et compare le catalogue obtenu, objet par objet, à l'instantané du projet réel (`docs/sauvegardes/prod-schema-2026-11-10.json`). Il échoue si une migration appliquée est modifiée ou si le dépôt prend de l'avance sur la base.

## Annexe — requête de capture de l'instantané

À exécuter sur le projet (connecteur Supabase ou SQL Editor) pour produire le JSON
de référence, sans rien modifier :

```sql
-- tables + RLS
select c.relname as table_name, c.relrowsecurity as rls_enabled from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' order by 1;

-- colonnes
select table_name, column_name, data_type, is_nullable from information_schema.columns
 where table_schema = 'public' order by 1, 2;

-- politiques
select tablename, policyname, cmd, roles::text from pg_policies
 where schemaname = 'public' order by 1, 2;

-- fonctions (arguments + SECURITY DEFINER)
select p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prosecdef
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' order by 1, 2;

-- déclencheurs, index, contraintes nommées, privilèges
select c.relname, t.tgname from pg_trigger t join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and not t.tgisinternal order by 1, 2;

select tablename, indexname, indexdef from pg_indexes
 where schemaname = 'public' order by 1, 2;

select conrelid::regclass::text as tbl, conname, contype, pg_get_constraintdef(oid)
  from pg_constraint where connamespace = 'public'::regnamespace
   and contype in ('p','f','u','c') order by 1, 2;

select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type)
  from information_schema.table_privileges
 where table_schema = 'public' and grantee in ('anon','authenticated')
 group by 1, 2 order by 1, 2;
```

> Les contraintes `NOT NULL` de PostgreSQL 17 apparaissent dans `pg_constraint`
> sans nom propre : elles sont exclues (`contype in ('p','f','u','c')`) pour que
> la comparaison reste stable.
