# Lot 1 — Sécurité et migrations Supabase

## Privilèges des stations

La migration `20261109130602_restrict_station_privileges.sql` retire tous les droits de table à `PUBLIC`, `anon` et `authenticated`, puis accorde au rôle `authenticated` uniquement SELECT, INSERT sur `owner_id` et `name`, et UPDATE sur `name`. Les politiques RLS existantes continuent de limiter ces opérations au propriétaire. En particulier, TRUNCATE n'est plus accordé aux rôles exposés ; RLS ne s'applique pas à cette commande. Aucun droit DELETE n'est accordé. Le rôle privilégié `service_role` n'est pas modifié et ne doit jamais être exposé au navigateur.

Cette migration a été appliquée au projet LavAuto. Les privilèges ont été vérifiés via `has_table_privilege` et `has_column_privilege`, sans modifier de données métier. La sélection des stations et la création via les colonnes utilisées par le frontend restent autorisées par les privilèges SQL ; leur fonctionnement via l'API doit encore être testé de bout en bout.

## Versions des migrations

Les six noms et versions locaux ont été alignés sur les versions effectivement enregistrées dans l'historique du projet LavAuto. Aucun historique distant n'a été modifié et aucune migration historique n'a été rejouée. Avant d'appliquer des migrations dans un autre environnement, comparer son historique avec les fichiers locaux : s'il contient les anciennes versions locales `2026110900000*`, ne pas lancer aveuglément `db push` et procéder à une réconciliation vérifiée avec les outils Supabase après sauvegarde. L'alignement a été vérifié par liste des versions, pas par exécution de la CLI Supabase sur une base vierge.

## Test d'isolation

`supabase/tests/tenant_isolation.sql` crée deux utilisateurs et deux stations temporaires, puis vérifie les privilèges, la visibilité RLS, les insertions et mises à jour inter-stations, les RPC et une reprise idempotente. Le script utilise un rôle `authenticated`, des identifiants générés dans la transaction et un `ROLLBACK`. Il doit être lancé **uniquement sur une base de test jetable**, avec un utilisateur disposant des droits nécessaires pour créer les fixtures et changer de rôle :

```sh
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/tenant_isolation.sql
```

Aucune base de test locale ni branche de base de données n'était disponible dans cet environnement ; ce script n'a donc **pas été exécuté** et ne constitue pas encore une preuve d'isolation. Des essais additionnels doivent couvrir notamment un véritable accès anonyme, des jetons authentifiés distincts, les cas de concurrence et le frontend. Ne pas utiliser une clé ou une URL de base de production pour ce test.
