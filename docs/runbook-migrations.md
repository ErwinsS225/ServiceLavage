# Runbook — migrations Supabase

## Règle absolue

**Aucune migration existante n'est modifiée après application.** L'historique distant est immuable : éditer un fichier déjà appliqué crée une dérive silencieuse entre le dépôt et la base. Tout correctif passe par une **nouvelle** migration.

## Prérequis d'environnement

Les scripts supposent un environnement Supabase, c'est-à-dire :

- les rôles `anon`, `authenticated`, `service_role` ;
- le schéma `auth` avec `auth.users(id, email, email_confirmed_at)` et `auth.uid()` ;
- des privilèges par défaut accordés aux rôles sur `public`.

Ces objets sont fournis par Supabase. Les tests PGlite les **émulent** (`tests/tenantIsolation.test.ts`, `tests/migrationUpgradePath.test.ts`) : un échec sur une base vierge non-Supabase vient de l'absence de ces prérequis, pas des migrations.

## État déployé (9 novembre 2026)

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

> ⚠️ **Les cinq dernières ont été appliquées via le connecteur Supabase** (`create_migration`), qui horodate au moment de l'exécution. Leurs numéros de version diffèrent donc des noms de fichiers locaux (`20261109140000`, `…141000`, `…142000`, `…150000`, `…160000`). **L'historique distant fait foi** : ne pas rejouer les fichiers locaux, ce qui les appliquerait une seconde fois.

### Conséquence sur `supabase db push`

Un `supabase db push` détecterait les **cinq** fichiers locaux comme non appliqués (versions différentes) et tenterait de les rejouer. **Ne pas le lancer en l'état.** Pour aligner le dépôt sur le distant :

```bash
supabase link --project-ref avvkzliysacpyavmetsx
supabase migration list        # confirmer le décalage de versions
supabase migration repair --status applied 20261109140000 20261109141000 \
                                      --status applied 20261109142000 20261109150000 \
                                      --status applied 20261109160000
```

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

## Marche arrière

| Scénario | Action |
| --- | --- |
| Échec pendant l'étape 1 ou 2 | Échec transactionnel : vérifier l'absence de table résiduelle avant de retenter |
| Échec après l'étape 3 | Ne pas retenter à l'aveugle (les tables existent peut-être). Inspecter puis corriger par une migration additive |
| Régression fonctionnelle après déploiement | **Ne pas supprimer les tables** (perte de données). Désactiver l'usage côté client, corriger par une migration additive |
| Perte de données avérée | Restaurer depuis `docs/sauvegardes/` (une station, aucune prestation au 9 novembre 2026) |

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

`tests/migrationUpgradePath.test.ts` rejoue le scénario réel : les 6 migrations déployées, une station existante, puis chaque migration en attente avec une assertion de frontière — c'est le test qui aurait détecté le décalage de production.
