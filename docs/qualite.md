# Qualité continue

État au 10 novembre 2026. Ce document dit ce qui est vérifié automatiquement,
par quoi, et **ce qui ne l'est pas** — parce qu'une pipeline qui laisse croire
qu'elle couvre tout est plus dangereuse qu'une pipeline absente.

## Ce qui tourne, et où

Trois étapes parallèles dans `.github/workflows/ci.yml`. Elles sont séparées
pour qu'une PR rouge indique **immédiatement** quelle famille de problème est en
cause, sans lire de journal.

| Étape CI | Commande locale | Ce qu'elle attrape |
| --- | --- | --- |
| Format (Prettier) | `npm run format:check` | divergences de style, diffs de bruit |
| Lint (ESLint) | `npm run lint` | hooks React mal ordonnés, motifs à risque, code mort |
| Type check | `npm run typecheck` | erreurs de types (`tsc --noEmit`, strict) |
| Tests et invariants | `npm test` | 226 tests : RLS, migrations, schémas, a11y, contraste |
| Source atteignable | `npm run check:reachability` | fichier jamais importé (code mort silencieux) |
| Contrastes WCAG | `npm run check:contrast` | 28 paires sous le seuil AA, dans les deux thèmes |
| Migrations | `npm run db:content` | SQL du dépôt ≠ SQL réellement exécuté |
| Build de production | `npm run build` | bundle cassé, service worker invalide |

`npm run quality` enchaîne tout en local, dans le même ordre.

## Les règles ESLint, et pourquoi celles-là

`eslint.config.js` ne duplique pas `tsc`. Le compilateur vérifie déjà les types,
les variables inutilisées et les imports morts ; ESLint n'ajoute de la valeur que
là où le compilateur est aveugle.

**React** — `rules-of-hooks` en erreur, `exhaustive-deps` en avertissement. Ce
sont les deux règles qui attrapent des bugs réels : dépendances incomplètes
(valeur figée dans une fermeture) et ordre des hooks (état mélangé entre rendus).

**Sécurité** — `eslint-plugin-security` : `eval` avec expression, `child_process`,
`Buffer` non initialisé, expressions régulières catastrophiques. Deux règles sont
désactivées volontairement : `detect-object-injection` (bruit massif sur du code
TypeScript où l'accès est typé) et `detect-non-literal-fs-filename` (les scripts
lisent des chemins construits, ce qui est leur métier).

**Conventions** — `eqeqeq`, `no-var`, `prefer-const`, `no-console` (avec
exception pour `error`/`warn`), préfixe `_` pour un paramètre volontairement
ignoré.

`--max-warnings=0` : un avertissement fait échouer la CI. C'est sévère, et
assumé — sinon les avertissements s'accumulent jusqu'à ce que personne ne les
lise plus.

## Ce qu'ESLint a trouvé, et qui a été corrigé

Trois erreurs réelles au premier passage :

1. `ThemeContext` affectait `resolved = 'dark'` avant de toujours l'écraser.
   Le code fonctionnait, mais la valeur initiale simulait une intention qui
   n'existait pas.
2. `useStationStaff` relançait une erreur **sans conserver la cause** : le
   message affiché était traduit, mais le code serveur d'origine disparaissait
   des journaux. Corrigé avec `{ cause }`, ce qui rend `describeError` utilisable
   en aval.
3. Une variable morte dans un test de QR code.

Deux avertissements `exhaustive-deps` ont été **conservés** avec justification
écrite en commentaire : la référence temporelle de `StationReports` et de
`useDashboardMetrics` doit se recalculer quand les données changent, ce qui est
une intention, pas un oubli.

## Décision à connaître : TypeScript 6 au lieu de 7

Le projet utilisait `typescript@7.0.2`. `typescript-eslint` refuse cette version
et lève une erreur explicite :

```
typescript-eslint does not support TS 7.0.
```

Il n'existe pas d'échappatoire (pas de variable d'environnement, pas d'option).
Trois voies possibles :

| Voie | Conséquence |
| --- | --- |
| Pas d'ESLint, garder TS 7 | on renonce à l'analyse statique |
| ESLint avec TS 6 | **retenu** |
| Attendre le support TS 7 | pas de lint d'ici là |

Le downgrade a été vérifié : `tsc --noEmit` sur `typescript@6.0.3` donne
**0 erreur**, exactement comme avec 7.0.2. Vite n'utilise pas `tsc` pour
compiler (`isolatedModules`, transpilation par esbuild/rolldown), donc la
version de TypeScript n'affecte que le typage — et le typage est identique.

**À faire quand `typescript-eslint` supportera TS 7** : remonter
`typescript`, relancer `npm run quality`, et rien d'autre ne devrait changer.

## Prettier

`.prettierrc.json` : 110 colonnes (au-delà de 80 pour ne pas casser les lignes
de JSX déjà longues), guillemets simples, virgules terminales, LF.

Le passage initial a touché 66 fichiers. Le commit `ab60b29` est
**du reformatage pur** : aucun changement de comportement, vérifié par les 226
tests, `tsc`, ESLint et le build. Il est référencé dans `.git-blame-ignore-revs`
pour que :

```bash
git config blame.ignoreRevsFile .git-blame-ignore-revs
```

`git blame` continue de montrer l'auteur réel de chaque ligne.

## Ce qui n'est **pas** couvert

- **Pas de test de bout en bout.** Aucun Playwright/Cypress : les parcours
  critiques (connexion, création de prestation, reçu) sont testés au niveau
  composant et au niveau base (PGlite), pas dans un navigateur réel.
- **Pas de mesure de couverture.** Ajouter `c8` donnerait un chiffre, mais un
  chiffre de couverture sur 226 tests ne dit rien de leur pertinence. À faire
  quand quelqu'un en aura besoin pour décider, pas pour afficher un badge.
- **Pas de `npm audit` bloquant.** L'audit est lancé à l'installation
  (`found 0 vulnerabilities`) mais une vulnérabilité transitive ne casse pas la
  CI : faux positifs fréquents, et un blocage aveugle pousse à désactiver la
  vérification.
- **Pas de lint sur les types « project-aware ».** Les règles comme
  `no-floating-promises` demandent un `parserOptions.project`, ce qui triple le
  temps d'ESLint. Le `void` explicite reste une convention non vérifiée.
- **Pas de vérification de commit** (husky / lint-staged). La CI suffit ; un
  crochet local est un confort, pas une garantie — il se contourne avec
  `--no-verify`.
- **`--legacy-peer-deps` dans la CI.** Nécessaire parce que `typescript-eslint`
  déclare `typescript <6.1` alors que le verrou contient le conflit. Dès que le
  support TS 7 arrive, retirer ce drapeau.
- **Pas de SonarCloud configuré dans ce dépôt.** Une PR antérieure en a fait
  état ; le fichier de configuration n'est pas présent ici. Ne pas le supposer
  actif.
