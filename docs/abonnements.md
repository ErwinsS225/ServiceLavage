# Abonnements — fondation à déployer

## État

La migration `20261109141000_subscription_limits.sql` et l'écran d'abonnements sont préparés et testés localement, mais la migration n'a **pas été appliquée à LavAuto**. Les limites ne sont donc pas actives sur le projet distant. Avant déploiement, tester sur un projet Supabase jetable avec les migrations en attente (dont les adhésions), examiner les stations déjà créées et les historiques, puis vérifier les versions des migrations distantes. L'écran affiche une erreur si la fonction serveur n'est pas disponible.

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
