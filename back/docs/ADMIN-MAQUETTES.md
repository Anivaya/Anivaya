# Comparaison de l’administration aux maquettes

Vérification du 30 octobre 2026, après le retour de l’utilisateur sur les indicateurs et les fenêtres intermédiaires. Les fichiers HTML locaux font référence. L’implémentation précédente reprenait les rubriques principales, mais pas tous leurs parcours : elle ne constituait pas une reprise complète des maquettes.

## Références inspectées

Répertoire : `maquette/admin`. Les douze pages complètes contiennent le même script `admin-ui` (empreinte SHA-256 commençant par `e13667b8b57b`) : dashboard, utilisateurs, professionnels, modération, assistance, équipe, publications, historique, pilotage, notifications, profil et paramètres. Leurs fonctions de rendu et de dialogue ont été comparées aux composants React et aux routes API. Le dashboard et ses dialogues ont également été comparés dans le navigateur.

Les trois autres fichiers sont des redirections : `admin-annonces.html` vers Publications/notifications, `admin-contenus.html` vers Publications/library, `admin-reservations.html` vers Professionnels. Ils ne définissent pas trois écrans métier supplémentaires.

## Corrections apportées

| Rubrique                | Éléments repris ou corrigés                                                                                                                                                                                                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Navigation              | Barre de défilement du sidebar admin masquée à la demande de l’utilisateur ; défilement conservé. Menu du compte, accès au profil et retour au dashboard depuis les listes issues d’un indicateur.                                                                                                 |
| Dashboard               | Quatre compteurs principaux : comptes, professionnels, imports à suivre, signalements à traiter. Deux indicateurs d’état : comptes autorisés à se connecter, fiches professionnelles validées. Les compteurs supplémentaires sont conservés dans un panneau distinct.                              |
| Fenêtres intermédiaires | Clic indicateur → aperçu des cinq premiers dossiers et total → consultation ou action → retour à l’aperçu. Lien vers la liste complète avec filtre et provenance conservés. Dossier accessible directement par URL.                                                                                |
| Demandes et activité    | Groupes de dossiers en attente, liens vers chaque dossier, totaux, historique récent consultable. Compteurs et aperçus calculés à partir des mêmes requêtes autorisées.                                                                                                                            |
| Pilotage                | Activation J7, animaux activement suivis, rétention J30/M3/M6, numérateur et dénominateur, filtres zone/origine, définitions et cohortes mensuelles. Le jeu d’exemples de la maquette se sélectionne explicitement ; les mesures historiques réelles indisponibles restent indiquées comme telles. |
| Notifications           | Cloche avec nombre non lu, aperçu intermédiaire, dossier cible, lu/non lu, tout marquer comme lu, filtre par catégorie et état. État de lecture propre à chaque membre.                                                                                                                            |
| Utilisateurs            | Consultation avec historique et modification du nom/e-mail, en plus de la suspension et réactivation. Les changements sont appliqués au vrai compte par l’API.                                                                                                                                     |
| Professionnels          | Dossier → justificatif → contrôle ; applicabilité, validité, état « À corriger », note et historique par justificatif. Aucun faux fichier n’est affiché.                                                                                                                                           |
| Modération              | Tri des signalements à traiter et urgents ; échéance de première réponse de 24 h ; lien du recours vers la décision initiale.                                                                                                                                                                      |
| Assistance              | Affectation des tickets, réponse et état ; conversion d’un retour utilisateur en ticket lié, consultable dans le suivi privé du bon compte.                                                                                                                                                        |
| Publications            | Aperçu du contenu dans la confirmation, suppression d’un brouillon d’annonce, suppression d’un guide et de ses versions, version publiée visible dans la liste, lien vers la bibliothèque publique. Relecture et publication distinctes conservées.                                                |
| Profil                  | Onglets Profil/Sécurité, MFA et sessions ; les fonctions de profil préexistantes restent disponibles.                                                                                                                                                                                              |
| Listes                  | Noms cliquables, informations propres à chaque domaine, raccourcis d’action, recherche et pagination serveur, filtres restaurables.                                                                                                                                                                |

## Écarts encore présents

La parité complète n’est **pas** atteinte. Les éléments suivants sont présents dans les parcours actifs de la maquette, mais ne sont pas entièrement raccordés dans l’application :

| Élément de la maquette                            | État réel et travail restant                                                                                                                                                                                                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Imports : détail du traitement, relance, incident | La rubrique et son API de consultation existent, mais aucun pipeline de traitements ne produit ces dossiers. Les relances simulées et incidents de la maquette ne sont pas repris. Il faut relier le dépôt/extraction aux traitements persistants et à leurs états. |
| Justificatifs : fichier transmis et aperçu        | Le contrôle et ses fenêtres sont présents ; le dépôt, le stockage et la lecture du fichier justificatif restent à ajouter. Le statut de contrôle ne prouve pas qu’un fichier a été reçu.                                                                            |
| Invitation d’un membre non inscrit                | L’ajout actuel attribue un rôle à un compte déjà inscrit. Invitations en attente, acceptation, expiration et envoi d’e-mail restent à implémenter.                                                                                                                  |
| Signalements de profils utilisateurs              | L’administration traite les fiches professionnelles. Les signalements des communautés restent dans `social_reports` et ne sont pas encore réunis avec les dossiers admin ; sanctions de profil et recours associés restent à relier.                                |
| Demandes de suppression à approuver/refuser       | Le parcours préexistant de suppression personnelle immédiate reste en place, avec journal anonymisé. Il n’est pas remplacé par la file de validation de la maquette.                                                                                                |
| Type de compte Particulier/Professionnel          | Les comptes authentifiés et les fiches professionnelles restent deux modèles distincts. Le changement de type simulé dans la maquette n’est pas implémenté.                                                                                                         |
| Réinitialisation depuis un dossier utilisateur    | Le parcours public existant indique un envoi simulé. Aucune action admin d’envoi ou de simulation n’a été ajoutée.                                                                                                                                                  |
| Rétention sur les vrais comptes                   | Les taux de la maquette et leurs filtres sont vérifiables via l’API de démonstration. La collecte d’événements historiques nécessaire aux taux réels n’existe pas encore ; aucun taux réel n’est inventé.                                                           |
| Historique des notifications                      | Les alertes admin sont dérivées des dossiers en attente. Une alerte disparaît quand le dossier n’est plus en attente ; il n’existe pas encore de journal de notifications indépendant conservant les alertes résolues.                                              |

Ces écarts ne sont pas tous des problèmes de configuration externe : plusieurs demandent encore du développement métier. Le présent relevé porte sur l’administration ; il ne certifie pas la parité exhaustive des maquettes publiques et particulières.

## Éléments désactivés dans les maquettes elles-mêmes

Les fonctions `canRead` / `canAction` du script de référence excluent les messages internes/contact, les réservations et paiements côté admin, ainsi que la modération des contenus/communautés/événements. L’import du journal est également désactivé. Ils ne sont donc pas comptés comme des écrans actifs oubliés. Les fonctions particulières préexistantes de réservation et de communauté restent présentes dans l’application.

Les sélecteurs de rôle et décisions simulées de la maquette ne remplacent pas les autorisations serveur. La MFA réelle, les conflits de version, l’isolation des comptes et le journal central restent conservés.

## Preuves et périmètre

### Ajustements visuels demandés après la première comparaison

- Sidebar : ANIVAYA sous le logo, liens seuls défilants sans scrollbar, suppression des deux textes demandés, Équipe avant Publications et Pilotage avant Historique.
- Dernier ajustement du sidebar : menu du compte fixe en bas, popup vers le haut ; logo transparent avec le lettrage fourni intégré. Header : cloche seule, badge de non-lus en bas. Icône d’actualisation en arc circulaire continu avec extrémités arrondies.
- Onglets admin centrés et transition latérale de 160 ms ; explications de Pilotage animées dans les deux sens, avec respect du mouvement réduit.
- Tableaux : actions en icônes nommées, tri normal/croissant/décroissant, filtres et recherche intégrés au panneau, compteur dessous. Libellés Compte / Élément / Signalement / Action selon la rubrique. Type, Auteur et Délai sont séparés en Modération.
- Formulaires : mêmes champs, contrôles, espacements et fermetures partagés. Édition professionnelle avec Nom, E-mail, Ville, Catégorie et Présentation ; examen séparé. Ordre Titre/Audience/Message pour les annonces. Les formulaires d’accès, de décision, de support et d’édition conservent leurs contraintes API ; les fonctions métier encore absentes restent recensées ci-dessus.
- Fermetures en haut : croix rouge dans un cercle ; retours : flèche ; annulation en bas à droite, en rouge. Les confirmations gardent leur libellé d’action.
- Dashboard : listes Signalements/Demandes défilantes sans barre visible et espacement vertical augmenté autour des indicateurs d’état.
- Pilotage : panneau unique et cartes, filtres, définitions, cohortes et proportions repris de la référence. Le sélecteur de source est rangé dans « Démonstration locale » ; les chiffres réels ne sont pas remplacés silencieusement par les exemples.

Voir `ADMIN-VERIFICATION.md` pour les tests et parcours réellement exécutés et `API.md` pour le contrat. Cette comparaison est fonctionnelle et visuelle sur les parcours cités ; ce n’est pas une certification pixel par pixel de chaque fenêtre. Les modifications conservent `front`, `back`, `shared`, SQLite et les API existantes.
