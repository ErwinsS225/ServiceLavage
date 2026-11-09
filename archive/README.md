# Archive — interface d'origine (novembre 2026)

Ce dossier contient l'interface React d'origine de l'application, **retirée du
build** lors de la tâche L3-T2 du plan d'implémentation.

## Pourquoi

`src/main.tsx` montait `App.tsx`, qui déclarait un `MainLayout` complet
(tableau de bord, caisse, baies, marketplace, onboarding…) mais retournait en
réalité `<OwnerPortal />`. Tout ce code était donc **jamais monté**.

Mesures avant archivage :

| Constat | Valeur |
| --- | --- |
| Fichiers jamais atteints depuis le point d'entrée | 33 |
| Lignes concernées | ≈ 9 200 |
| Icônes `lucide` importées uniquement par ce code | 41 (le code actif en utilise 1) |
| Effet réel sur le bundle | 499,84 Ko → 492,10 Ko (−7,7 Ko) |

## Pourquoi le conserver

Décision **D3** : archiver plutôt que supprimer. Ces écrans décrivent des
fonctionnalités prévues (`planFeatures.ts` les référence) et servent de
référence de conception. Ils sont aussi présents sur la branche
`legacy/reference`.

## Ce que ce dossier n'est pas

- **Pas compilé** : `tsconfig.json` exclut `archive/`.
- **Pas servi** : hors de `public/`, donc absent du site construit.
- **Pas maintenu** : les imports relatifs ne résolvent plus, c'est attendu.

## Réactiver un écran

1. Déplacer le fichier dans `src/` en restaurant ses imports relatifs.
2. Le monter depuis `OwnerPortal` — c'est le seul point d'entrée du rendu.
3. `npm run lint && npm test && npm run build`.
