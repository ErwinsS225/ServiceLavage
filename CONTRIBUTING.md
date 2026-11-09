# Contribuer

- Travailler sur la branche de la session et ouvrir une pull request vers la branche principale ; ne pas committer de secrets ou de fichiers `.env`.
- Utiliser des commits ciblés, par exemple `fix: ...`, `feat: ...`, `test: ...` ou `docs: ...`.
- Avant revue : `npm ci`, `npm run lint`, `npm run check:reachability`, `npm test` et `npm run build` avec une configuration Supabase de test non secrète.
- Ne pas laisser de fichier inatteignable dans `src/` : la vérification de reachability échoue en CI. Archiver dans `archive/` plutôt que supprimer, et documenter pourquoi.
- Ajouter des tests pour les règles métier et les changements RLS ; appliquer et tester les migrations sur une base jetable avant toute base distante. Documenter tout impact sur les données et la marche arrière.
- Faire relire les modifications sensibles, notamment permissions, données personnelles, paiements et synchronisation hors ligne.
