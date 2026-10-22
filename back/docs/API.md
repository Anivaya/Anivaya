# API Anivaya

API locale : http://127.0.0.1:3001. React utilise le proxy `/api` de Vite, puis l’API lit/écrit SQLite.

## Routes

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

Fiche d’urgence (PUT) : `{ "active": true, "photo": true, "details": true, "notes": false, "contact": true, "vet": false }`. Tous les choix sont booléens. Le serveur sauvegarde les choix, une copie des informations sélectionnées et un QR SVG. Identifiant complet et documents restent exclus. Le QR contient du texte de démonstration (900 caractères maximum), sans lien public hébergé. Les changements du profil sont repris lors du prochain enregistrement de la fiche.

La route `POST /api/animals/:id/emergency/preview` accepte les mêmes options que PUT et renvoie le QR recalculé sans écrire en base. React annule les requêtes précédentes quand les options changent ; seule la configuration sauvegardée est affichée dans le dashboard.

## Persistance

SQLite : `back/database/data/anivaya.sqlite`, exclue de Git. Les migrations sont appliquées automatiquement une seule fois via `schema_migrations` ; les données existantes sont conservées. Les données fictives initiales sont chargées au premier démarrage. Animaux, événements, rappels et documents utilisent une suppression logique ; retirer un animal masque aussi son carnet et ses fichiers.

`DATABASE_PATH` choisit une autre base ; `PORT` change le port API (adapter également le proxy Vite). Node >= 22.18 est requis. Installer les dépendances avec `npm --prefix back install`.

Cette version reste une démonstration locale mono-foyer, sans authentification ni notifications réelles. Les deux documents initiaux sont des exemples sans fichier.
