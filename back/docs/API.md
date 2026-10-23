# API Anivaya

API locale : http://127.0.0.1:3001. React utilise le proxy `/api` de Vite, puis l’API lit/écrit SQLite.

## Comptes et sessions

Toutes les routes métier nécessitent une session, sauf la santé du serveur, l’authentification et la lecture des fiches publiques. L’accès anonyme retourne 401. Les écritures utilisent JSON et vérifient l’origine du navigateur.

| Méthode     | Route                                        | Usage                                                                                |
| ----------- | -------------------------------------------- | ------------------------------------------------------------------------------------ |
| GET         | /api/auth/demo                               | Identifiants de démonstration affichés dans le formulaire                            |
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

Mot de passe : 12 à 256 caractères, hachage scrypt avec sel aléatoire. Jeton de session aléatoire, seul son SHA-256 est stocké. Durée maximale : 24 h, ou 7 jours avec remember=true. Connexion et inscription limitées à 30 tentatives par IP en 15 minutes. Le compte de démonstration conserve son adresse affichée.

Chaque compte dispose de sa base SQLite, sélectionnée depuis la session. Les identifiants des ressources d’un autre compte ne donnent pas accès à ses données.

PATCH /api/profile attend name, email, phone, city et notifications={reminders,reservations,shares} (booléens). photo est absent pour conserver l’image, null pour la retirer, ou {type,content} pour importer du JPG/PNG/WebP en base64, 5 Mo maximum.

Le prix vient du serveur. Réservations entre demain et dans 60 jours. Conflit de créneau : 409. payment=declined : 402 sans création ; payment=success : confirmation simulée. Une réservation passée ou annulée ne peut plus être déplacée. Les disponibilités des professionnels fictifs sont calculées dans chaque espace privé.

Une fiche publique utilise un jeton imprévisible. Désactivation : 410 sans informations personnelles. Suppression : 404 et révocation du jeton ; une recréation produit un nouveau lien. Aucun identifiant d’animal complet, document privé ou adresse du foyer n’est exposé.

## Routes métier

| Méthode              | Route                      | Usage                                                            |
| -------------------- | -------------------------- | ---------------------------------------------------------------- |
| GET                  | /api/health                | État du serveur                                                  |
| GET                  | /api/dashboard             | Foyer, animaux, rappels, documents, événements, fiches d’urgence |
| GET / POST           | /api/animals               | Liste / création                                                 |
| GET / PATCH / DELETE | /api/animals/:id           | Carnet complet / profil / retrait                                |
| GET                  | /api/animals/:id/photo     | Photo JPEG ou PNG                                                |
| GET / PUT / DELETE   | /api/animals/:id/emergency | Fiche sauvegardée / génération / retrait                         |
| POST                 | /api/events                | Ajouter un événement                                             |
| PATCH / DELETE       | /api/events/:id            | Modifier / retirer un événement                                  |
| POST                 | /api/reminders             | Ajouter un rappel                                                |
| PATCH / DELETE       | /api/reminders/:id         | Modifier nom, date, fréquence ou statut / retirer                |
| POST                 | /api/documents             | Ajouter un fichier                                               |
| PATCH / DELETE       | /api/documents/:id         | Modifier ou remplacer / retirer                                  |
| GET                  | /api/documents/:id/file    | Télécharger le fichier                                           |
| GET                  | /api/sharing               | Personnes et partages avec statut calculé                        |
| POST                 | /api/people                | Créer une personne de confiance                                  |
| PATCH / DELETE       | /api/people/:id            | Modifier / supprimer et révoquer ses partages                    |
| POST                 | /api/associations          | Associer ou retirer plusieurs personnes de plusieurs animaux     |
| POST                 | /api/shares                | Créer des partages simulés                                       |
| DELETE               | /api/shares/:id            | Révoquer un partage simulé                                       |

Création : 201. Lecture/modification : 200. Suppression : 204. Erreurs : `{ "error": "Message", "field": "name" }`, avec `field` facultatif.

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

## Persistance

SQLite : `back/database/data/anivaya.sqlite`, exclue de Git. Les migrations sont appliquées automatiquement une seule fois via `schema_migrations` ; les données existantes sont conservées. Les données fictives initiales sont chargées au premier démarrage. Animaux, événements, rappels et documents utilisent une suppression logique ; retirer un animal masque aussi son carnet et ses fichiers.

`DATABASE_PATH` choisit une autre base ; `PORT` change le port API (adapter également le proxy Vite). Node >= 22.18 est requis. Installer les dépendances avec `npm --prefix back install`.

Cette version dispose de comptes réels isolés ; les notifications, les paiements et les invitations de partage restent simulés. Les deux documents initiaux sont des exemples sans fichier.
