# Audit et plan de migration — ServiceLavage

Date : 9 novembre 2026. Périmètre : code du dépôt, configuration Supabase LavAuto et contrôles locaux. Pas d'API Go : React/TypeScript, Supabase Auth et PostgreSQL/RLS restent l'architecture retenue. Les opérations sensibles ou atomiques relèveront de fonctions SQL PostgreSQL ou d'Edge Functions Supabase lorsque nécessaire, jamais du seul contrôle d'interface.

## État réel

- L'application existante est une démonstration locale : `AppContext` initialise des jeux fictifs et sauvegarde plusieurs collections en `localStorage`. Les données locales ne sont ni partagées, ni protégées contre la modification, ni importées dans Supabase. Le portail propriétaire est séparé de la démonstration.
- Supabase Auth (e-mail/mot de passe avec confirmation) et `public.stations` sont en place. La RLS de stations limite lecture, insertion et modification au propriétaire. L'application métier et les invitations d'employés ne sont pas connectées. Le projet utilise encore `http://localhost:3000` comme Site URL et aucune URL de redirection autorisée n'est configurée.
- Changer le rôle dans la démonstration ne constitue pas une autorisation. Le super-administrateur et les fonctions d'abonnement sont simulés. Ne pas exposer ces fonctions comme réelles.
- Les montants des données de démonstration mélangent des valeurs décimales historiques (ex. 60,5) et des montants FCFA plus élevés. Leur unité d'origine ne peut être déduite automatiquement : ne pas les convertir ni les importer. Le formatage n'applique plus de taux arbitraire, mais les données historiques ne satisfont pas encore l'exigence de FCFA entiers.
- La caisse est fictive, en mémoire, non liée à un journal d'encaissements : clôtures, paiements partiels et remboursements ne sont pas fiables. Des valeurs et graphiques statiques restent dans plusieurs écrans, notamment rapports, dashboard et marketplace. Les filtres de période des rapports ne garantissent pas un filtrage réel.
- La synchronisation hors ligne n'envoie pas d'opérations ; les messages ne doivent pas affirmer qu'elle réussit. La file et le compteur ne sont pas persistants et le mode hors ligne n'est pas une solution de production.
- Commissions : taux fixe dans le code, arrondi et absence d'historique atomique ; la protection locale contre une validation répétée immédiate ne garantit pas l'idempotence, notamment après changement de statut ou utilisation concurrente.
- La clé publiable est destinée au navigateur ; jamais de clé `service_role` dans le frontend. Aucune validation complète des parcours d'inscription, de la RLS avec plusieurs utilisateurs ou des scénarios financiers n'a encore été effectuée.
- Contrôles disponibles : `npm run lint` (TypeScript), `npm run build`, `npm test` (tests ciblés). `npm install` standard a échoué sur un conflit peer esbuild/Vite ; installation par `--legacy-peer-deps` utilisée pour les contrôles. Le build avertit aussi d'un bundle > 500 Ko et de l'utilisation de `__dirname` dans la configuration Vite.

## Architecture et règles cibles

1. Supabase Auth gère l'identité ; les adhésions station/utilisateur et rôles sont des données serveur distinctes des métadonnées modifiables par le client. Création de station et attribution du propriétaire doivent être atomiques. Invitations, acceptation, révocation et rôles exigent des règles contrôlées côté serveur. Super-admin attribué uniquement par un processus d'administration privilégié.
2. Chaque table métier porte un `station_id` et des contraintes référentielles empêchant les références entre stations. RLS activée sur toutes les tables exposées ; lecture/écriture par rôle et appartenance active. Tester aussi les chemins RPC, Storage et Realtime ; ne jamais faire confiance aux filtres frontend.
3. Stocker tous les montants métier en XOF entiers, avec limites et contraintes explicites en base. Pas de conversion implicite. Tarifs par station et prix figés sur chaque ligne de commande. Pas de migration automatique des anciennes données locales ou des données fictives.
4. Commandes et lignes de prestation relationnelles, clients facultatifs. Transactions de paiement immuables avec références et clés d'idempotence ; remboursements sous forme de mouvements inverses. Sessions de caisse et dépenses traçables ; clôture calculée et verrouillée atomiquement, historique conservé. Utiliser des transactions/fonctions SQL pour les invariants et la concurrence.
5. Commissions calculées une seule fois lors d'une transition métier autorisée, avec taux et montant historisés ; contrainte d'unicité, corrections explicites plutôt que recalcul silencieux.
6. Pour le hors-ligne, concevoir ultérieurement file persistante par station et utilisateur, identifiants uniques, accusés serveur, reprises idempotentes, conflits, reprise après redémarrage et indication honnête de l'état. Aucune promesse de synchronisation avant validation.

## Séquence de livraison

- **0 — Stabilisation immédiate :** retirer les conversions implicites et chiffres ajoutés aux totaux, couvrir les limites numériques par tests ; identifier explicitement les simulations restantes. Ne pas utiliser la démo pour la comptabilité. Les chiffres locaux existants restent inchangés et ne sont pas importés.
- **1 — Identité et stations :** finaliser confirmation e-mail, URL de production/preview et récupération de compte ; modéliser les adhésions et invitations. Tests RLS à deux propriétaires et plusieurs rôles, y compris accès inter-station et tentatives d'élévation.
- **2 — Fondations métier :** migrations versionnées pour services, employés, clients, pistes, commandes et lignes ; RLS, contraintes, index et fonctions atomiques ; tests d'isolation, d'authentification et de concurrence. Démarrer à vide, sans données de démo.
- **3 — Caisse et commissions :** journal des mouvements, sessions persistées, paiement partiel/remboursement, contrôles XOF et idempotence ; scénarios de clôture, duplication et concurrence automatisés.
- **4 — Branchement progressif :** conserver les composants existants, remplacer chaque accès au contexte local par des requêtes Supabase, avec états de chargement/erreur et tenant courant. Brancher POS, file, clients, stocks, caisse et rapports seulement après validation de leurs règles serveur. Ne pas présenter les calculs locaux comme des résultats réels.
- **5 — SaaS et vitrine :** plans et quotas validés côté serveur, fournisseur et webhooks vérifiés et idempotents ; galerie Storage isolée et réservations persistées ; aucune note, certification ou activation de paiement fictive.
- **6 — Production :** tests de sécurité multitenant/RLS, métier, intégration et parcours utilisateur ; sauvegardes/restauration, journalisation, monitoring, configuration e-mail/SMTP et redirections, CI et déploiement. Offline seulement après conception et tests dédiés.

Chaque étape nécessite migration et rollback documentés, tests et revue avant activation. Les règles RLS et RPC doivent être testées avec des sessions authentifiées distinctes et non uniquement avec le rôle administrateur.

## Avancement — clients par station

La migration `20261109122729_station_customers.sql` a été appliquée au projet LavAuto. Elle crée une table séparée pour les clients réels (nom et téléphone), avec clé étrangère vers la station, index et RLS limitée au propriétaire. Les rôles authentifiés ne peuvent modifier que le nom et le téléphone ; aucune suppression n'est exposée. La liste, l'ajout et la modification sont accessibles dans le portail propriétaire après sélection d'une station. Les clients fictifs de l'ancienne interface demeurent dans la démonstration locale et n'ont pas été importés.

Les politiques déployées ont été vérifiées par inspection du catalogue ; les tests d'accès avec deux comptes authentifiés distincts et les tests de parcours navigateur restent à réaliser avant usage en production. Les employés ne disposent pas encore d'accès. La connexion du module client existant et des autres écrans métier au modèle réel reste à faire.

## Avancement — catalogue de services

La migration `20261109122929_station_services.sql` a été appliquée au projet LavAuto. Le catalogue réel commence vide et appartient à une station. La base impose un prix entier compris entre 0 et 100 000 000 FCFA, une durée entière entre 1 et 1 440 minutes et une RLS réservée au propriétaire. Le portail permet d'ajouter et modifier les services et de les rendre inactifs ; la suppression n'est pas exposée. Les contrôles de saisie disposent de tests unitaires. Les règles RLS ont été inspectées dans le catalogue PostgreSQL, mais les essais entre comptes et le parcours navigateur restent à effectuer.

Le catalogue réel n'est pas encore utilisé par le POS ou les prestations : ceux-ci restent des simulations distinctes. Aucun tarif fictif ou montant local ambigu n'a été importé.

## Avancement — prestations réelles et retrait de l'accès à la démo

L'application démarre désormais sur l'espace propriétaire réel : l'accès à l'ancienne démonstration a été retiré. Son ancien code et ses jeux fictifs restent dans le dépôt, hors du parcours actif, afin de servir de référence pour migrer les écrans ; ils n'ont pas été supprimés physiquement et aucune donnée existante du navigateur n'a été effacée. Le portail comporte les onglets prestations, catalogue et clients. Les autres onglets historiques ne sont pas encore disponibles.

La migration `20261109123327_station_orders.sql` a été appliquée : les prestations et leurs lignes sont persistées ; la fonction de création vérifie le propriétaire, le client éventuel, les services actifs de la même station et fige les prix et libellés en FCFA. La fonction de transition limite le parcours à attente → en cours → terminé, avec annulation possible avant fin. Les écritures directes sont interdites aux clients authentifiés. Aucun paiement, piste, commission ou historique d'audit n'est créé par ces fonctions.

Les règles RLS des deux tables ont été inspectées, mais il reste à tester avec plusieurs comptes authentifiés, notamment les RPC, les prix concurrents, les droits inter-stations et le parcours navigateur. La création ne dispose pas encore de clé d'idempotence : en cas d'incertitude réseau, actualiser la liste avant de réessayer. Les fonctionnalités et tous les onglets de l'ancien ERP ne sont pas encore migrés ; ne pas considérer cette version comme prête pour une utilisation financière de production.

## Lot 1 — sécurisation

Les privilèges excessifs de `stations` ont été réduits sur LavAuto, et les versions locales ont été alignées sur son historique. Voir [securite-lot-1.md](securite-lot-1.md) pour les limites et les tests d’isolation encore à exécuter.
