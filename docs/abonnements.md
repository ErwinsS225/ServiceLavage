# Abonnements — fondation à déployer

## État

La migration `20261109141000_subscription_limits.sql` et l'écran d'abonnements sont préparés et testés localement, mais la migration n'a **pas été appliquée à LavAuto**. Les limites ne sont donc pas actives sur le projet distant. Avant déploiement, tester sur un projet Supabase jetable avec les migrations en attente (dont les adhésions), examiner les stations déjà créées et les historiques, puis vérifier les versions des migrations distantes. L'écran affiche une erreur si la fonction serveur n'est pas disponible.

## Fonctionnalités Starter déclarées

Le périmètre fourni pour Starter comprend : gestion des prestations et tickets, catalogue personnalisable, clients et véhicules, caisse/paiements, rapports essentiels, personnel basique et vitrine simple. État vérifié dans le parcours Supabase actif :

| Fonction | État réel |
| --- | --- |
| Création et suivi des prestations | Disponible dans le portail propriétaire ; synchronisation hors ligne limitée. |
| Tickets | À développer : aucune génération/impression de ticket n'est reliée au parcours actif. |
| Catalogue personnalisable | Disponible pour les services propres à une station. |
| Clients | Disponible ; les véhicules ne sont pas encore des fiches liées au client. |
| Gestion des véhicules | Partielle : véhicule et plaque sont stockés sur une prestation, sans registre véhicule ni historique dédié. |
| Caisse journalière et paiements | À développer. |
| Rapports essentiels | À développer. |
| Personnel basique | À développer dans l'interface métier ; le modèle de rôles préparé n'est pas déployé. |
| Vitrine commerciale | À développer dans le parcours actif. |

L'interface affiche la matrice Starter/Pro/Business et l'état de livraison afin de ne pas présenter comme activées les fonctions non opérationnelles. Les niveaux Pro/Business reprennent les avantages de l'ancien catalogue de démonstration ; ce catalogue est une spécification produit, jamais une source d'autorisation. Les quotas d'utilisateurs et de photos (Starter 2/5, Pro 8/20, Business 50/100) proviennent de cette offre historique et restent des cibles non appliquées ; seul le nombre de stations confirmé par le propriétaire (1/2/10) et le quota mensuel de prestations sont traités côté serveur dans les migrations préparées.

## Matrice Pro et Business héritée de l'offre

| Fonction | Pro | Business | État réel |
| --- | :---: | :---: | --- |
| Fonctionnalités Starter | Oui | Oui | Prestations, catalogue et clients opérationnels ; tickets, caisse, rapports, personnel et vitrine restent partiels ou à développer (voir ci-dessus). |
| Personnel avancé et commissions | Oui | Oui | À développer. |
| Inventaire et alertes de stock | Oui | Oui | RPC et interface préparées, restriction Pro/Business côté PostgreSQL ; migration non déployée sur LavAuto. |
| Rapports détaillés, export PDF/Excel | Oui | Oui | À développer. |
| Suivi temps réel des pistes | Oui | Oui | À développer. |
| Vitrine enrichie / galerie photo | Oui | Oui | À développer dans le portail actif ; quota photos historique non appliqué. |
| Demandes de rendez-vous WhatsApp | Oui | Oui | À développer. |
| Stations | 2 | 10 | Limites présentes dans la migration d'abonnement non déployée ; Business est plafonné à 10, pas illimité. |
| Rapports consolidés multi-stations | Non | Oui | À développer. |
| Permissions avancées et rôles stricts | Non | Oui | Schéma local préparé, migration non déployée et aucun parcours métier connecté. |
| Vitrines personnalisées par station | Non | Oui | À développer. |
| Visibilité prioritaire marketplace | Priorité Pro annoncée dans le catalogue historique | Oui | Marketplace et classement à développer ; règle Pro historique à clarifier. |
| Synchronisation hors ligne résiliente | Non | Oui | Partielle : seule la création des prestations est mise en file, sans synchronisation arrière-plan. Aucun paiement hors ligne. |
| Assistance 24/7 et sauvegarde cloud dédiée | Non | Oui | Nécessite une exploitation et une organisation de service hors du seul code applicatif. |

Les niveaux d'utilisateurs (2/8/50) et photos (5/20/100) sont affichés comme cibles historiques, et ne sont ni garantis ni appliqués tant qu'une règle confirmée et un contrôle serveur correspondant ne sont pas livrés. La ligne Business « multi-sites illimités » de l'ancien mock est remplacée par la limite explicitement choisie de 10 stations.

## Politique cible mise en place par la migration

| Plan | Stations par propriétaire | Prestations mensuelles par propriétaire |
| --- | ---: | ---: |
| Starter | 1 | 500 |
| Pro | 2 | 2 500 |
| Business | 10 | 10 000 |

Les propriétaires sans ligne d'abonnement reçoivent Starter par défaut. Le plan appartient au propriétaire et s'applique à l'ensemble de ses stations. Les prestations sont comptabilisées selon leur date de création côté serveur, dans le mois calendaire UTC, quel que soit leur statut (y compris annulées). Lors d'une synchronisation hors ligne, le mois et le plan au moment de l'insertion serveur déterminent l'admission. Une requête déjà acquittée et rejouée ne consomme pas une seconde unité. Si un quota est atteint, l'entrée locale demeure en attente et une erreur est affichée.

Les contraintes sont vérifiées côté PostgreSQL à l'insertion des stations et prestations, y compris en cas d'accès direct : elles ne reposent pas sur l'interface. Des verrous transactionnels par propriétaire sont prévus pour sérialiser les créations et changements de plan. Le client authentifié ne peut ni créer ni modifier son abonnement ; un administrateur disposant d'un accès privilégié doit attribuer le plan. Ne jamais exposer une clé `service_role` au navigateur. Aucune interface d'administration, preuve de paiement, date d'expiration, suspension automatique ou piste d'audit des changements n'est encore implémentée.

Un changement vers un plan inférieur ne supprime aucune donnée : les stations et prestations existantes sont conservées, mais la création est bloquée si le nouveau quota est déjà atteint. Les quotas d'utilisateurs et de photos et les fonctionnalités réservées aux plans supérieurs ne sont pas appliqués, car les modules correspondants ne sont pas opérationnels. Les tarifs dans l'interface sont indicatifs ; aucune facturation n'est effectuée. Les plafonds ci-dessus correspondent au choix explicite : Pro 2 stations, Business 10.

Les tests SQL dans PGlite vérifient les limites Starter, l'affectation privilégiée, le refus d'une modification par le propriétaire, le quota Pro et les paramètres Business, l'isolation de lecture et l'idempotence à la limite mensuelle. Les tests de concurrence multi-connexion, les jetons Supabase réels, les flux d'administration et les comportements d'abonnement ne sont pas encore validés de bout en bout.
