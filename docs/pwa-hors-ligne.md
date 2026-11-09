# PWA et fonctionnement hors ligne

## État actuel

Le build de production enregistre un service worker et un manifeste PWA. Après une première visite réussie en ligne, le navigateur peut conserver la page d'entrée et les fichiers JavaScript/CSS pour afficher la coque de l'application lors d'une coupure. Le service worker ne met pas en cache les réponses Supabase ou d'authentification. Il nécessite HTTPS (ou localhost), une installation réussie et un navigateur qui conserve son cache. Une mise à jour du service worker attend la fermeture des anciennes pages contrôlées.

### Prestations : premier périmètre expérimental

Après connexion et chargement en ligne d'une station et de l'écran Prestations, la liste des stations et le catalogue/clients nécessaires sont sauvegardés dans le localStorage de cet appareil, par utilisateur et station. On peut alors préparer une prestation hors ligne si la session est encore disponible. Une entrée locale immuable, avec identifiant unique, est enregistrée avant tout envoi ; elle est supprimée seulement après une réponse réussie de la fonction Supabase idempotente. En cas de défaillance du stockage, l'application signale l'erreur au lieu d'annoncer un succès. Si une ancienne entrée est illisible, elle est conservée et signalée.

La synchronisation est tentée à l'ouverture de l'écran Prestations, lors de l'ajout et à l'événement `online`, **uniquement pour l'utilisateur et la station affichés**. Elle n'est pas réalisée en arrière-plan lorsque l'application ou cet écran est fermé. Un bouton permet de réessayer. `navigator.onLine` ne garantit pas que Supabase est joignable. Si une validation serveur échoue (service désactivé, droits révoqués, etc.), la file est conservée et l'erreur signalée ; il n'existe pas encore d'interface de résolution ou suppression d'une entrée. Les changements de statut restent en ligne uniquement.

Le tarif appliqué est celui en vigueur sur le serveur à la synchronisation ; le tarif affiché hors ligne est indicatif. Les données locales et la file ne sont **pas chiffrées** et sont accessibles aux personnes et scripts ayant accès au navigateur de l'appareil. Éviter les appareils partagés. Effacer les données du navigateur peut entraîner la perte définitive des opérations en attente. Une session expirée peut nécessiter une reconnexion en ligne. Il ne faut pas considérer ce mécanisme comme prêt pour la production tant que les tests de sécurité et de coupure réels ne sont pas passés.

**Clients et catalogue hors ligne en écriture, paiements et autres modules ne sont pas implémentés.** Aucune garantie de synchronisation en arrière-plan ou de notification ne s'applique à ces modules.

## Suite nécessaire

1. Couvrir le parcours réel et les tests de coupure/réouverture, réponses perdues, plusieurs onglets, session expirée, changement de compte ou station, quota, conflits de service et reprise ; tester les droits RLS et RPC avec des sessions authentifiées distinctes.
2. Ajouter une supervision et une résolution explicite des entrées en erreur, la reprise globale pour toutes les stations accessibles, et évaluer un stockage IndexedDB transactionnel, des protections de données personnelles et des migrations de format.
3. Étendre les écritures hors ligne aux clients et au catalogue avec clés d'idempotence serveur et gestion des dépendances ; ne jamais dépendre d'une seule transaction localStorage sur plusieurs clés.
4. Ne pas permettre d'encaissements hors ligne avant conception d'un journal de paiements fiable, des règles de remboursement et des tests de concurrence et d'idempotence.

## Fiabilisation du lot 3

La file est rejouée dans l'ordre et seuls les éléments acquittés sont retirés. Un échec conserve l'entrée concernée et les suivantes ; les succès précédents restent acquis. Une clé de requête est réutilisée après une réponse perdue. Les enregistrements locaux invalides restent conservés et signalés, sans tentative d'envoi. Si une prestation ne peut pas être synchronisée (par exemple service devenu inactif), ne pas la ressaisir sans vérification : une interface de résolution des conflits reste à construire.

Des tests unitaires simulent une réponse perdue et un échec de synchronisation. Des tests SQL en base PGlite jetable couvrent les prix figés, l'application du prix serveur courant, les transitions et le rejet d'un service inactif. Ces tests ne remplacent ni un essai réseau en navigateur, ni des tests de concurrence avec Supabase/PostgREST et des comptes réels de test.
