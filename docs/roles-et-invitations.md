# Rôles et invitations — fondation locale

## Périmètre de cette étape

Les migrations `20261109140000_station_memberships.sql` et `20261109150000_station_role_permissions.sql` sont préparées dans le dépôt et testées localement. **Elles n'ont pas été appliquées au projet Supabase distant.** La seconde rend les rôles effectifs pour les opérations métier décrites ci-dessous via RLS/RPC. Le portail possède maintenant une première interface pour le roster et les invitations, l'acceptation par référence, et l'affectation d'un laveur. Aucun e-mail automatique n'est envoyé ; la référence doit être transmise manuellement. Sur LavAuto, les permissions employés ne sont pas actives avant déploiement contrôlé des migrations.

Les invitations sont créées et annulées par le propriétaire ; elles expirent après sept jours. Une personne connectée ne peut accepter que l'invitation associée à son adresse confirmée dans `auth.users`. Une ancienne invitation ne peut pas changer un rôle existant. Le propriétaire peut révoquer une adhésion. Une adhésion révoquée ne peut pas encore être réactivée : cette opération devra faire l'objet d'un parcours explicite et sécurisé. Seuls les rôles `gerant`, `caissier` et `laveur` sont acceptés ; aucun rôle super-admin n'est attribué par ce mécanisme.

## Matrice sécurité préparée côté PostgreSQL

| Rôle | Accès préparé | Refusé / pas encore disponible |
| --- | --- | --- |
| **Propriétaire** | Stations, rôles/invitations, clients, catalogue, prestations, inventaire selon plan. | La caisse et les paiements ne sont pas encore développés. |
| **Gérant** | Lecture station et roster ; clients, catalogue, création/transition des prestations, affectation des laveurs ; inventaire Pro/Business. | Ne peut pas changer identité de station, inviter/révoquer/modifier des rôles. |
| **Caissier** | Lecture/création/modification des clients. | Aucun encaissement n'est encore implémenté ; pas d'accès au catalogue ou aux prestations par les RPC actuelles. |
| **Laveur** | Lecture des prestations et détails qui lui sont affectés ; transitions `en_attente → en_cours → termine`. | Aucun client, catalogue, opération non affectée ou annulation. |

Ces contrôles sont ajoutés dans la migration locale `20261109150000_station_role_permissions.sql`. Les affectations sont enregistrées en base et une révocation coupe l'accès même si des affectations historiques demeurent. Les changements de rôle/invitation restent propriétaires seulement. Le cas de paiement du caissier attend le lot caisse/paiements ; aucune permission fictive n'est accordée.

## Vérifications et suite

`npm test` applique toutes les migrations à une base PGlite jetable. Les tests d'invitations contrôlent notamment l'isolation, les e-mails non confirmés ou incorrects, l'annulation, les rôles autorisés, la double invitation et la révocation. Un test d'intégration de file locale utilise la vraie fonction PostgreSQL idempotente dans PGlite et simule une réponse perdue après commit, puis vérifie qu'une reprise ne crée pas de doublon et applique le prix serveur.

PGlite émule les rôles et `auth.uid()` ; il ne reproduit pas Auth et PostgREST de Supabase, ni les coupures d'un vrai navigateur. Il faut encore un projet Supabase jetable et des tests navigateur pour les vrais jetons, e-mails, accès simultanés et reconnexions. Avant tout déploiement distant, comparer l'historique des migrations (y compris les migrations d'abonnement et d'inventaire), vérifier l'ordre des dépendances et effectuer une revue sécurité. Les permissions restent une fondation de la première étape : aucun accès aux paiements n'est accordé au caissier tant que la caisse n'existe pas.
