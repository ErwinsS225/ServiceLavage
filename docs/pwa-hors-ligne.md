# PWA et fonctionnement hors ligne

## État actuel

Le build de production enregistre un service worker et un manifeste PWA. Après une première visite réussie en ligne, le navigateur peut conserver la page d'entrée et les fichiers JavaScript/CSS du build pour afficher la coque de l'application lors d'une coupure. Le service worker ne met pas en cache les requêtes Supabase, les réponses d'authentification ni les données métier. Il est actif uniquement sur un contexte sécurisé HTTPS (ou localhost), après installation réussie ; le navigateur peut supprimer son cache. La mise à jour du service worker attend la fermeture des anciennes pages contrôlées.

**Les données métier ne sont pas encore disponibles hors ligne. Aucune opération n'est mise en file, et aucune synchronisation automatique n'est implémentée.** La connexion peut exiger un réseau pour rafraîchir la session. L'indication `navigator.onLine` ne garantit pas que Supabase soit joignable. Ne pas utiliser ce mécanisme pour prétendre qu'une prestation ou un paiement a été enregistré.

## Étapes à implémenter avant utilisation hors ligne

1. Créer une file persistante et transactionnelle (IndexedDB recommandé pour les données et les opérations ; localStorage seul ne permet pas d'écritures atomiques sûres entre onglets). Séparer strictement chaque utilisateur et station, traiter les données personnelles et prévoir leur suppression explicite et leur protection sur l'appareil partagé.
2. Créer une clé d'idempotence et un accusé de réception côté serveur pour chaque opération ; synchroniser dans l'ordre des dépendances, avec verrouillage multi-onglets, reprise après fermeture et gestion des erreurs permanentes.
3. Commencer par clients, catalogue et prestations ; vérifier à la synchronisation les autorisations, les références et les états. Le prix serveur en vigueur au moment de la synchronisation prévaut, conformément au choix utilisateur, et doit être affiché clairement dans le résultat.
4. Ne pas permettre d'encaissements hors ligne avant conception d'un journal de paiements fiable, des règles de remboursement et des tests de concurrence et d'idempotence.
5. Tester réellement sur navigateurs : coupure au chargement et à l'envoi, expiration de session, changement d'utilisateur/station, fermeture, plusieurs onglets, stockage plein, conflit de catalogue et réseau rétabli. Afficher clairement les états en attente, synchronisé et en échec.
