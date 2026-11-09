# Documentation archivée

Ces documents ne sont **pas** servis par l'application. Ils étaient auparavant dans `public/assets/aistudio/`, donc accessibles publiquement sur `/assets/aistudio/*` alors qu'aucun code ne les référençait.

| Fichier | Origine | Contenu |
| --- | --- | --- |
| `strategie-produit-initiale.md` | `public/assets/aistudio/Paste_November_09__2026_-_11_18AM_b69dc675` | Spécification stratégique initiale : architecture fonctionnelle, modèle d'abonnement (5 000 / 15 000 / 35 000 FCFA), workflow opérationnel, catégories de véhicules. Référence produit, **non contractuelle**. |
| `illustration-produit.png` | `public/assets/aistudio/image_a81d1a79.png` | Illustration produit, sans usage dans le code. |

## Pourquoi ce déplacement

- Ces fichiers étaient copiés dans `dist/` à chaque build (+1,5 Mo).
- Le document de stratégie révélait publiquement le modèle économique et les tarifs prévus, sans qu'aucune page ne le justifie.
- Aucun code ne les référençait (vérifié par `grep`).

## Règle

**Ne rien placer dans `public/` qui ne soit pas destiné à être public.** Le dossier `public/` est copié tel quel à la racine du site.

Un document destiné à l'équipe va dans `docs/`, jamais dans `public/`.
