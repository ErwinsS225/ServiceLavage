# Lot 6 — inventaire par station

## Livré dans le dépôt

- Inventaire persistant isolé par station (article, unité, quantité et seuil d'alerte).
- Création et ajustements relatifs (+ réception / − retrait) via une seule RPC PostgreSQL contrôlée ; les quantités négatives et hors limites sont refusées.
- Idempotence par identifiant de requête : un retry identique renvoie le même résultat sans rejouer l'ajustement ; la réutilisation de l'identifiant pour une charge différente est refusée.
- RLS en lecture par propriétaire ; pas de droits client d'écriture directe sur les tables. La RPC vérifie la station et le plan depuis le serveur.
- Lecture permise sur Starter pour consulter le stock existant ; écritures réservées à Pro et Business. Un retry déjà acquitté reste reconnu après rétrogradation, mais aucune nouvelle mutation n'est permise.
- État d'alerte quand le stock est inférieur ou égal au seuil. Les articles ne peuvent pas être supprimés dans cette première version afin de préserver l'historique des opérations.

## Limites / déploiement

La migration `20261109142000_station_inventory.sql` n'a pas été appliquée à LavAuto. Le nouvel onglet ne sera opérationnel qu'après vérification et application de la migration dans un environnement Supabase de test puis dans l'environnement ciblé. Une absence de migration provoque des erreurs de lecture/écriture visibles ; aucune donnée de démonstration n'est utilisée.

Les ajustements de stock des articles déjà chargés peuvent être mis en attente hors ligne dans le localStorage (non chiffré), puis vérifiés côté serveur lors de la synchronisation ; création d’article hors ligne non prise en charge. Les opérations ne sont pas intégrées automatiquement aux prestations ou à la caisse et il n'y a pas de journal détaillé consultable, de coût d'achat, de valorisation, de fournisseur, ni de transfert entre stations. Le quota de places d'inventaire n'étant pas confirmé par le propriétaire, aucun quota numérique d'articles n'est inventé. Tests PGlite locaux (auth et rôles émulés), mais pas de validation avec PostgREST/Auth hébergés, connexions simultanées de production ou navigateur.
