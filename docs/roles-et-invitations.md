# Rôles et invitations — fondation locale

## Périmètre de cette étape

La migration `20261109140000_station_memberships.sql` est préparée dans le dépôt et testée localement. **Elle n'a pas été appliquée au projet Supabase distant.** Elle ajoute les adhésions et invitations, mais **ne donne pas encore d'accès métier aux employés** : les RLS et RPC des prestations, du catalogue et des clients restent réservées au propriétaire. Le portail ne contient pas encore d'interface pour créer, transmettre ou accepter une invitation et aucun e-mail d'invitation n'est envoyé.

Les invitations sont créées et annulées par le propriétaire ; elles expirent après sept jours. Une personne connectée ne peut accepter que l'invitation associée à son adresse confirmée dans `auth.users`. Une ancienne invitation ne peut pas changer un rôle existant. Le propriétaire peut révoquer une adhésion. Une adhésion révoquée ne peut pas encore être réactivée : cette opération devra faire l'objet d'un parcours explicite et sécurisé. Seuls les rôles `gerant`, `caissier` et `laveur` sont acceptés ; aucun rôle super-admin n'est attribué par ce mécanisme.

## Matrice cible à implémenter, pas encore active

- **Propriétaire** : gestion de sa station et des rôles ; accès aux opérations et finances.
- **Gérant** : opérations de la station et personnel, sans gestion des rôles ou propriété.
- **Caissier** : clients et encaissements ; pas de gestion des rôles.
- **Laveur** : accès limité aux prestations qui lui sont affectées.

Ces principes doivent être détaillés action par action lors de la création des tables de personnel, d'affectations et de paiements. Les contrôles devront être réalisés en base et non seulement dans l'interface ; les invitations ne sont pas une preuve de permission par elles-mêmes.

## Vérifications et suite

`npm test` applique toutes les migrations à une base PGlite jetable. Les tests d'invitations contrôlent notamment l'isolation, les e-mails non confirmés ou incorrects, l'annulation, les rôles autorisés, la double invitation et la révocation. Un test d'intégration de file locale utilise la vraie fonction PostgreSQL idempotente dans PGlite et simule une réponse perdue après commit, puis vérifie qu'une reprise ne crée pas de doublon et applique le prix serveur.

PGlite émule les rôles et `auth.uid()` ; il ne reproduit pas Auth et PostgREST de Supabase, ni les coupures d'un vrai navigateur. Il faut encore un projet Supabase jetable et des tests navigateur pour les vrais jetons, e-mails, accès simultanés et reconnexions. Avant tout déploiement distant, comparer l'historique des migrations, vérifier la version de cette migration et effectuer une revue sécurité. Ne pas activer d'accès employés avant l'implémentation et les tests de la matrice réelle.
