# API Anivaya

API locale : http://127.0.0.1:3001. React utilise le proxy `/api` de Vite, puis l’API lit/écrit SQLite.

## Comptes et sessions

Toutes les routes métier nécessitent une session, sauf la santé du serveur, l’authentification et la lecture des fiches publiques. L’accès anonyme retourne 401. Les écritures utilisent JSON et vérifient l’origine du navigateur.

| Méthode     | Route                                        | Usage                                                                                |
| ----------- | -------------------------------------------- | ------------------------------------------------------------------------------------ |
| GET         | /api/auth/demo                               | Liste des comptes de démonstration (name, email, password)                           |
| GET         | /api/auth/session                            | Compte et profil, ou null                                                            |
| POST        | /api/auth/register                           | name, email, password, confirmPassword ; compte vide et session                      |
| POST        | /api/auth/login                              | email, password, remember facultatif ; cookie HttpOnly                               |
| POST        | /api/auth/logout                             | Invalide la session et expire le cookie                                              |
| GET / PATCH | /api/profile                                 | Profil, photo et préférences                                                         |
| GET         | /api/profile/photo                           | Avatar privé                                                                         |
| GET         | /api/directory                               | Professionnels, favoris, réservations et date de Paris                               |
| PUT         | /api/professionals/:id/favorite              | favorite: boolean                                                                    |
| GET         | /api/professionals/:id/slots?date=YYYY-MM-DD | Créneaux ; ignore=:bookingId pour un déplacement                                     |
| POST        | /api/bookings                                | professional, animal, service (index), date, time, contactName, email, note, payment |
| PATCH       | /api/bookings/:id                            | date et time pour déplacer, ou status: cancelled pour annuler                        |
| GET         | /api/public/emergency/:token                 | Informations sélectionnées, sans session                                             |
| GET         | /api/public/emergency/:token/photo           | Photo si autorisée sur la fiche active                                               |
| DELETE      | /api/account                                 | confirmation: "SUPPRIMER" ; supprime le compte et ferme ses sessions (204)           |
| GET         | /api/export?categories=profile,animals       | Export JSON : profile, animals, documents, sharing, bookings                         |

Mot de passe : 12 à 256 caractères, hachage scrypt avec sel aléatoire. Jeton de session aléatoire, seul son SHA-256 est stocké. Durée maximale : 24 h, ou 7 jours avec remember=true. Connexion et inscription limitées à 30 tentatives par IP en 15 minutes. Les comptes de démonstration conservent leur adresse affichée ; leur suppression recrée leur espace d’exemple.

Chaque compte dispose de sa base SQLite, sélectionnée depuis la session. Les identifiants des ressources d’un autre compte ne donnent pas accès à ses données.

PATCH /api/profile attend name, email, phone, city et notifications={reminders,reservations,shares} (booléens). photo est absent pour conserver l’image, null pour la retirer, ou {type,content} pour importer du JPG/PNG/WebP en base64, 5 Mo maximum.

Le prix vient du serveur. Réservations entre demain et dans 60 jours. Conflit de créneau : 409. payment=declined : 402 sans création ; payment=success : confirmation simulée. Une réservation passée ou annulée ne peut plus être déplacée. Les disponibilités des professionnels fictifs sont calculées dans chaque espace privé.

Une fiche publique utilise un jeton imprévisible. Désactivation : 410 sans informations personnelles. Suppression : 404 et révocation du jeton ; une recréation produit un nouveau lien. Aucun identifiant d’animal complet, document privé ou adresse du foyer n’est exposé.

## Routes métier

| Méthode              | Route                       | Usage                                                               |
| -------------------- | --------------------------- | ------------------------------------------------------------------- |
| GET                  | /api/health                 | État du serveur                                                     |
| GET                  | /api/dashboard              | Foyer, animaux, rappels, documents, événements, fiches d’urgence    |
| GET / POST           | /api/animals                | Liste / création                                                    |
| GET / PATCH / DELETE | /api/animals/:id            | Carnet complet / profil / retrait                                   |
| GET                  | /api/animals/:id/photo      | Photo JPEG ou PNG                                                   |
| GET / PUT / DELETE   | /api/animals/:id/emergency  | Fiche sauvegardée / génération / retrait                            |
| POST                 | /api/events                 | Ajouter un événement                                                |
| PATCH / DELETE       | /api/events/:id             | Modifier / retirer un événement                                     |
| POST                 | /api/reminders              | Ajouter un rappel                                                   |
| PATCH / DELETE       | /api/reminders/:id          | Modifier nom, date, fréquence ou statut / retirer                   |
| POST                 | /api/documents              | Ajouter un fichier                                                  |
| PATCH / DELETE       | /api/documents/:id          | Modifier ou remplacer / retirer                                     |
| GET                  | /api/documents/:id/file     | Télécharger le fichier                                              |
| GET                  | /api/sharing                | Personnes et partages avec statut calculé                           |
| POST                 | /api/people                 | Créer une personne de confiance                                     |
| PATCH / DELETE       | /api/people/:id             | Modifier / supprimer et révoquer ses partages                       |
| POST                 | /api/associations           | Associer ou retirer plusieurs personnes de plusieurs animaux        |
| POST                 | /api/shares                 | Créer des partages simulés                                          |
| DELETE               | /api/shares/:id             | Révoquer un partage simulé                                          |
| PATCH                | /api/received-shares/:id    | `status` : `accepted` ou `declined`, pour une invitation en attente |
| PATCH                | /api/notifications/:id      | `read: boolean` : marquer comme lue ou non lue                      |
| POST                 | /api/notifications/read-all | Tout marquer comme lu ; renvoie la liste                            |

Création : 201. Lecture/modification : 200. Suppression : 204. Erreurs : `{ "error": "Message", "field": "name" }`, avec `field` facultatif.

## Administration, assistance et sécurité

Les rôles d’équipe (Administrateur, Modérateur, Support, Vétérinaire référent) sont enregistrés dans `admin_members` de la base centrale, par `npm run admin:grant -- adresse "Rôle"` ou depuis Équipe. Le compte de démonstration `admin@anivaya.fr` est administrateur. Le rôle envoyé par le client n’est jamais pris en compte ; l’inscription l’ignore. Un compte suspendu (`account_controls`) ne peut plus se connecter (403) et ses sessions sont fermées. Un membre de l’équipe ne peut pas supprimer son propre compte (409).

| Méthode    | Route                                        | Usage                                                                                                          |
| ---------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| GET        | /api/admin/overview                          | Rôle, compteurs, indicateurs, dossiers en attente, actions récentes et notifications non lues                  |
| GET        | /api/admin/analytics                         | Pilotage (administrateur) ; `source=maquette` pour le jeu d’exemples, `zone` et `channel` pour filtrer         |
| GET        | /api/admin/:resource                         | Liste paginée : `q`, `status`, `scope=pending`, `category`, `sort=name\|date`, `direction`, `page`, `pageSize` |
| POST       | /api/admin/:resource                         | Création : team (email, role), library (name, summary, body), announcements, tickets                           |
| GET        | /api/admin/:resource/:id                     | Dossier complet avec historique                                                                                |
| POST       | /api/admin/:resource/:id/actions             | `action`, `version` lue et `note` ; 409 si le dossier a changé ; 204 quand le dossier disparaît                |
| GET        | /api/public/resources                        | Guides publiés après relecture et annonces diffusées (sans session)                                            |
| POST       | /api/public/contact                          | name, email, subject, message : crée une demande d’assistance (sans session)                                   |
| POST       | /api/reports                                 | targetType: "pros", target, name, message : signalement d’une fiche de l’annuaire                              |
| POST       | /api/appeals                                 | reference (DEC-…), message : recours sur une décision concernant le compte                                     |
| POST       | /api/feedback                                | name, category, message : retour sur un import assisté                                                         |
| GET        | /api/support                                 | Demandes, signalements, recours et retours du compte connecté, réponses de l’équipe incluses                   |
| GET / POST | /api/account/mfa                             | État de la double authentification / `action` setup, enable, renew ou disable avec `password` et `mfaCode`     |
| POST       | /api/account/deletion-request                | message facultatif : demande de suppression examinée par l’équipe (409 si une demande est en cours)            |
| POST       | /api/imports                                 | name, kind (Fichier ou Exemple intégré) : suivi d’un import assisté validé par l’utilisateur                   |
| POST       | /api/public/emergency/:token/report          | name facultatif, message : signalement d’une fiche publique, avec ou sans session                              |
| GET        | /api/admin/pros/:id/documents/:document/file | Pièce justificative reçue (PDF, JPEG ou PNG)                                                                   |

Ressources : `users`, `deletions`, `pros`, `reports`, `appeals`, `tickets`, `imports`, `feedback`, `announcements`, `library`, `team`, `security`, `history`, `alerts`. Chaque rôle n’accède qu’aux siennes (403 sinon). Les actions sont journalisées dans `admin_audit` avec leur auteur et leur motif.

Actions par ressource (`POST …/actions`) : `users` edit, save, reset ; `team` edit, save, et pour une invitation renew, cancel ; `deletions` delete, decline ; `pros` edit, save, proof, proof-file (`document`, `file`, `fileName`) ; `reports` decide (`status` parmi `choices`, `accountAction` Aucune sanction / Avertir le compte / Suspendre le compte), reopen, priority ; `appeals` decide ; `tickets` et `feedback` reply, feedback ticket ; `imports` retry, incident ; `announcements` save, publish, unpublish, delete ; `library` save, submit, review, publish, version, unpublish, delete ; `security` revoke (session) ou review (alerte) ; `alerts` read, unread, read-all.

Les notifications (`alerts`) gardent les dossiers réglés depuis moins de 30 jours avec l’état `Résolue` ; `Non lue` et `Lue` ne concernent que les dossiers en attente. `users` edit accepte `accountType` (Particulier ou Professionnel). `GET /api/admin/analytics` sans `source=maquette` lit les foyers réels : date d’inscription du compte, ville du profil, origine Démonstration ou Direct, et activité des carnets journalisée par la migration 010 (déclencheurs sur animaux, profils, rappels, événements et documents).

Une invitation (`team` avec une adresse inconnue) est valable 14 jours et s’applique à la première connexion ou inscription de l’adresse. Une fiche publique masquée par la modération répond 451. Les alertes de sécurité sont déposées automatiquement : cinq échecs de connexion en 15 minutes, limite de tentatives atteinte, double authentification désactivée. Le compte `admin@anivaya.fr` reçoit un jeu de démonstration (dossiers professionnels, signalements, recours, demandes, imports, annonces, guides, invitation, demande de suppression, alerte) daté des jours précédents.

MFA : TOTP (RFC 6238, 30 s) avec secret chiffré AES-256-GCM par `MFA_ENCRYPTION_KEY` (64 caractères hexadécimaux, obligatoire en production ; une clé locale est générée sinon). Huit codes de secours à usage unique, affichés une seule fois. Quand la MFA est active, `POST /api/auth/login` exige `mfaCode` (401 avec `field: "mfaCode"` sinon). Un changement de MFA ferme les autres sessions du compte.

## Corps JSON

Animal : `{ "name": "Rio", "species": "Chien", "breed": "Labrador", "sex": "Mâle", "dob": "2024-03-12", "weight": "24" }`.
Champs complémentaires : `coat`, `identifier`, `neutered`, `food`, `routine`, `behavior`, `medical`, `contact`, `vet`. La photo utilise `photo: { "content": "BASE64", "type": "image/png" }` (JPEG/PNG, 2 Mo maximum). Un PATCH conserve les champs absents.

Événement : `{ "animal": "nala", "type": "Consultation", "date": "2026-10-21", "note": "Contrôle de démonstration" }`. Types : Consultation, Pesée, Vaccination déclarée, Autre.

Rappel : `{ "name": "Contrôle annuel", "animal": "nala", "date": "2026-12-20", "repeat": "Chaque année" }`. Répétitions : Aucune, Chaque semaine, Chaque mois, Chaque année. Statut : `{ "done": true }`. La fréquence est enregistrée, sans planification de notifications.
Champs facultatifs : `notice` (Le jour même, 1 jour avant, 3 jours avant, 7 jours avant) et `note` (1 000 caractères). PATCH accepte aussi `animal` et conserve les champs absents.

Document : `{ "name": "Carnet", "animal": "nala", "category": "Santé", "type": "application/pdf", "content": "BASE64" }`. PDF/JPEG/PNG, 10 Mo maximum. Catégories : Santé, Identité, Assurance, Autre. PATCH accepte nom, animal, catégorie et éventuellement un nouveau fichier. Le BLOB est exclu des listes ; `url` et `hasFile` indiquent sa disponibilité.
Ajouter `?preview=1` à la route du fichier permet son affichage intégré (PDF/image). Supprimer un document révoque ses partages.

Personne : `{ "name": "Alex", "role": "Proche", "email": "alex@example.test", "phone": "", "note": "", "animals": ["nala"] }`. Nom obligatoire ; e-mail ou téléphone requis. Rôles : Proche, Famille, Garde, Professionnel, Autre. `animals` est facultatif ; un tableau vide retire toutes les associations. Les doublons de coordonnées sont refusés. Les personnes sont communes à la page Partage et aux carnets.

Associations : `{ "people": ["ID_PERSONNE"], "animals": ["nala", "milo"], "mode": "add" }`. `mode` accepte `add` et `remove`. L’opération est atomique ; retirer une association ne révoque aucun partage.

Partage multiple : `{ "documents": ["ID_DOCUMENT"], "people": ["ID_PERSONNE"], "until": "2099-01-01" }`. Chaque destinataire doit avoir un e-mail. Variante ponctuelle : remplacer `people` par `recipient` et `email`. La date de fin est inclusive, comparée au jour courant en Europe/Paris, et ne peut pas être passée. Le serveur crée chaque paire document/destinataire et renvoie `{ "created": 2, "skipped": 1 }` ; les accès actifs déjà existants sont conservés. Si aucun accès n’est créé, réponse 400. Maximum 500 accès par opération.

Les listes renvoient `status` : `active`, `expired` ou `revoked`. `GET /api/dashboard` inclut également `today`, `people` et `shares`. Le carnet individuel renvoie les contacts associés et les partages de ses documents. Les coordonnées d’un partage sont une copie au moment de sa création ; la modification d’un contact ne les change pas rétroactivement. Supprimer une personne révoque ses accès, même après modification de son e-mail.

Ces accès sont une simulation locale : aucune invitation, URL publique ou autorisation externe n’est créée.

Fiche d’urgence (PUT) : `{ "active": true, "photo": true, "details": true, "notes": false, "contact": true, "vet": false }`. Tous les choix sont booléens. Le serveur sauvegarde les choix, une copie des informations sélectionnées et un QR SVG. Identifiant complet et documents restent exclus. Le QR contient le lien vers la fiche publique. Les informations affichées suivent la dernière configuration sauvegardée et active. Les changements du profil sont repris lors du prochain enregistrement de la fiche.

La route `POST /api/animals/:id/emergency/preview` accepte les mêmes options que PUT et renvoie le QR recalculé sans publier ni sauvegarder les choix (le jeton public peut être réservé en base). React annule les requêtes précédentes quand les options changent ; seule la configuration sauvegardée est affichée dans le dashboard.

Partages reçus : `GET /api/dashboard` inclut `receivedShares` avec `state` (`pending`, `accepted`, `expired`, `revoked`, `declined`). `content` n’est renvoyé que pour un accès actif. Répondre à une invitation qui n’est plus en attente renvoie 409.

Notifications : `GET /api/dashboard` inclut `notifications`, de la plus récente à la plus ancienne : `{ "id", "category", "title", "text", "href", "action", "date", "read" }`. Catégories : `reminders`, `reservations`, `shares`, `documents`, `account`. `href` est un lien interne de l’application (par exemple `#rappels`). Chaque compte reçoit une notification de bienvenue ; le compte de démonstration a aussi des exemples. Aucune notification n’est envoyée à l’extérieur.

## Communautés

Données partagées entre tous les comptes, dans la base centrale (tables `social_*`). Les personnes sont identifiées par l’identifiant de leur compte (`demo`, `demo-2`, `demo-3` pour les comptes de démonstration ; `claire-demo` et `samir-demo` sont fictifs). Sans authentification, ces routes répondent 404.

| Méthode       | Route                                       | Usage                                                                                      |
| ------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------ |
| GET           | /api/social                                 | Vue du compte : personnes, communautés, événements, discussions lisibles, amis, blocages   |
| POST / PATCH  | /api/social/communities[/:id]               | name, city, topic, description ; modification réservée au créateur                         |
| DELETE        | /api/social/communities/:id                 | Supprime la discussion et annule les événements à venir                                    |
| POST          | /api/social/communities/:id/join, /leave    | Rejoindre ou quitter ; la gestion passe au membre suivant                                  |
| POST / PATCH  | /api/social/events[/:id]                    | name, city, place, date (à venir), capacity (1 à 200), community, description              |
| POST          | /api/social/events/:id/cancel               | Annulation par l’organisateur                                                              |
| POST          | /api/social/events/:id/participation        | join: boolean ; 409 si complet, fermé ou communauté non rejointe                           |
| POST          | /api/social/threads                         | people, name facultatif (groupe privé) ; renvoie l’id, réutilise un message privé existant |
| POST          | /api/social/threads/:id/members, /leave     | Inviter (créateur d’un groupe privé) ou quitter                                            |
| POST / DELETE | /api/social/threads/:id/messages[/:message] | text (3 000 caractères), photo {type, content} JPG/PNG/WebP 1 Mo ; supprimer ses messages  |
| POST          | /api/social/threads/:id/read                | Marque lu ; alimente « Lu » chez les autres membres                                        |
| GET           | /api/social/photos/:message                 | Photo jointe, réservée aux membres de la discussion                                        |
| PUT           | /api/social/friends/:person                 | action : request, accept ou remove                                                         |
| PUT           | /api/social/blocks/:person                  | blocked: boolean ; bloquer masque les messages et retire l’amitié                          |
| POST          | /api/social/reports                         | type (person ou message), target, reason                                                   |

Un nouveau message crée ou met à jour une notification par discussion chez les autres membres (`social-thread-<id>`) ; une demande d’ami crée `social-friend-<id>`. Lire la discussion marque sa notification comme lue. La suppression d’un compte le retire des communautés, des événements, des discussions et des relations.

## Persistance

SQLite : `back/database/data/anivaya.sqlite`, exclue de Git. Les migrations sont appliquées automatiquement une seule fois via `schema_migrations` ; les données existantes sont conservées. Les données fictives initiales sont chargées au premier démarrage. Animaux, événements, rappels et documents utilisent une suppression logique ; retirer un animal masque aussi son carnet et ses fichiers.

`DATABASE_PATH` choisit une autre base ; `PORT` change le port API (adapter également le proxy Vite). Node >= 22.18 est requis. Installer les dépendances avec `npm --prefix back install`.

Cette version dispose de comptes réels isolés ; les notifications, les paiements et les invitations de partage restent simulés. Les deux documents initiaux sont des exemples sans fichier.

## Nouvel accueil — novembre 2026

- `POST /api/public/leads` (sans session, 201) : `kind` (`liste-attente`, `pro`, `clinique`, `entreprise`), `name`, `email`, `consent: true`, `requestId` UUID. Champs conditionnels : `profile`, `animals` (`chien`, `chat`), `plan` (`gratuit`, `plus`, `famille`), `activity`, `organization`, `organizationType`, `phone`, `message`. `postalCode` facultatif : cinq chiffres, avec conservation du zéro initial. Réponse `{ "accepted": true }`, y compris après répétition identique. La réponse reste uniforme pour ne pas révéler une inscription antérieure ; aucun jeton ni résultat d’envoi d’e-mail n’est exposé. Erreur 400 avec `field` et `fields` (messages par champ) ; 429 après 20 tentatives en 15 minutes par adresse réseau. Aucune lecture publique des demandes. Une demande et son ticket administratif sont enregistrés dans une transaction.
- `POST /api/auth/register` accepte `postalCode` facultatif.
- `GET /api/profile`, `GET /api/auth/session`, `PATCH /api/profile` et l’export du profil incluent `postalCode`. Une modification sans ce champ conserve sa valeur ; une chaîne vide l’efface.

Les demandes publiques alimentent `/api/admin/tickets` et utilisent les droits de cette ressource. Les formulaires ne créent ni session, ni rôle professionnel, ni abonnement payant. La liste d’attente envoie un e-mail transactionnel avec son lien de désinscription. Les autres formulaires ne déclenchent pas d’e-mail automatique.

- `POST /api/public/unsubscribe-link` : `email`, réponse générique `{ accepted: true }` que l’adresse soit inscrite ou non. Envoie un lien personnel aux adresses inscrites, y compris les anciennes demandes.
- `POST /api/public/unsubscribe` : `token` aléatoire de 64 caractères hexadécimaux, transmis depuis `#desinscription/<token>`. Un GET ne retire jamais le consentement. Le POST est idempotent, met à jour `public_waitlist_subscriptions.withdrawn_at` et indique le retrait dans les tickets associés. Le jeton est stocké uniquement sous forme de SHA-256 ; les liens personnels ne sont jamais renvoyés par l’API publique.
- Une nouvelle inscription explicite peut réactiver le consentement ; rejouer une ancienne requête ne le réactive pas. Toute future campagne doit sélectionner uniquement les souscriptions dont `withdrawn_at IS NULL`. Les demandes historiques restent distinctes de ce consentement courant.
- Ces routes partagent la limite de 20 tentatives / 15 minutes / adresse réseau. La migration centrale `016_public_unsubscribe.sql` conserve les demandes existantes.
