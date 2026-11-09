# ServiceLavage

Application React / TypeScript pour la gestion de stations de lavage, avec Supabase Auth et PostgreSQL. L'interface active couvre actuellement l'espace propriétaire, les stations, le catalogue, les clients et les prestations. La caisse, les paiements, les rôles employés et les anciens écrans ne sont pas encore opérationnels dans ce parcours. Les anciens composants et données fictives restent dans le dépôt comme référence : ne pas les utiliser comme données de production.

## Prérequis

- Node.js 22.12 ou plus récent (la CI utilise Node 22) et npm ; `package-lock.json` est la référence pour l'installation et la CI.
- Un projet Supabase **de test** pour les parcours authentifiés. Les tests unitaires et SQL avec PGlite fonctionnent sans Supabase ni Docker.
- Pour les migrations via la CLI Supabase : CLI installée, Docker pour une base locale et projet de test distinct pour les essais distants.

## Installation et configuration

```sh
npm ci
cp .env.example .env.local
# Modifier .env.local avec l'URL du projet et sa clé publiable Supabase.
npm run dev
```

L'application écoute sur le port 3000. `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` sont intégrées au code navigateur : utiliser **uniquement** la clé publiable ou anon, jamais `service_role`, une clé secrète, un mot de passe de base ou une clé Gemini. Les fichiers `.env*`, sauf `.env.example`, sont ignorés par Git. Les variables Vite sont lues au démarrage du serveur ou au build ; reconstruire après changement. Une configuration absente affiche un écran explicite, sans connecter Supabase.

Pour la confirmation des inscriptions, configurer la Site URL et les URL de redirection autorisées dans Supabase Auth pour chaque environnement. Ne pas désactiver la confirmation simplement pour faire passer des tests. Aucune fonctionnalité Gemini n'est actuellement utilisée par l'interface active.

## Commandes

```sh
npm ci             # installation reproductible depuis package-lock.json
npm run dev        # serveur Vite de développement
npm run lint       # contrôle TypeScript, pas un lint ESLint
npm test           # tests unitaires et SQL sur base PGlite jetable
npm run build      # build et service worker dans dist/
npm run preview    # prévisualisation locale du build
npm run clean      # supprime uniquement dist/
```

Pour que le build contienne le parcours Supabase complet, les deux variables Vite doivent être renseignées. La CI utilise des valeurs d'exemple non fonctionnelles ; elle ne contacte ni ne modifie un projet Supabase. La PWA nécessite HTTPS ou localhost et une première visite en ligne ; voir [PWA et hors ligne](docs/pwa-hors-ligne.md). La file locale expérimentale ne couvre que la création de prestations, pas les paiements ni tous les autres modules.

## Migrations et sécurité

Les migrations versionnées sont dans `supabase/migrations/`. Leurs versions correspondent à l'historique du projet LavAuto au moment du lot 1. Avant toute application sur un autre projet, **comparer les historiques**, sauvegarder les données et examiner le SQL. Les anciens numéros de version locaux ont changé : ne pas rejouer aveuglément sur une base où ces migrations sont déjà appliquées. Les migrations doivent d'abord être validées sur une base jetable. Voir [sécurité et réconciliation](docs/securite-lot-1.md).

Avec la CLI Supabase, initialiser si nécessaire sa configuration locale (`supabase init`), démarrer une instance de test (`supabase start`) et examiner les migrations avant de les appliquer à cette instance (`supabase db reset`). Ces commandes nécessitent Docker ; `db reset` détruit les données de l'instance ciblée. Pour un projet distant, utiliser la procédure officielle de liaison et vérifier le projet et le résultat de `supabase migration list` et `supabase db push --dry-run` avant toute application. Ne jamais lancer `db reset` contre une base contenant des données à conserver.

Les tests PGlite appliquent les migrations sur une base en mémoire et émulent `auth.uid()` ainsi que les rôles Supabase. Ils ne remplacent pas les tests avec de vrais jetons, PostgREST et la configuration d'un projet Supabase de test.

## Organisation

- `src/components/OwnerPortal.tsx` : authentification et accès aux modules réels.
- `src/components/Station*.tsx` : prestations, clients et services.
- `src/lib/` : client Supabase, logique monétaire et file locale expérimentale.
- `supabase/migrations/` et `supabase/tests/` : schéma, règles et tests SQL.
- `src/context/AppContext.tsx` et `src/data/mockData.ts` : ancien prototype, non monté par l'application actuelle.
- `docs/` : audit, sécurité et fonctionnement hors ligne.
