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

Création : 201. Lecture/modification : 200. Suppression : 204. Erreurs : `{ "error": "Message", "field": "name" }`, avec `field` facultatif.

## Corps JSON

Animal : `{ "name": "Rio", "species": "Chien", "breed": "Labrador", "sex": "Mâle", "dob": "2024-03-12", "weight": "24" }`.
Champs complémentaires : `coat`, `identifier`, `neutered`, `food`, `routine`, `behavior`, `medical`, `contact`, `vet`. La photo utilise `photo: { "content": "BASE64", "type": "image/png" }` (JPEG/PNG, 2 Mo maximum). Un PATCH conserve les champs absents.

Événement : `{ "animal": "nala", "type": "Consultation", "date": "2026-10-21", "note": "Contrôle de démonstration" }`. Types : Consultation, Pesée, Vaccination déclarée, Autre.

Rappel : `{ "name": "Contrôle annuel", "animal": "nala", "date": "2026-12-20", "repeat": "Chaque année" }`. Répétitions : Aucune, Chaque semaine, Chaque mois, Chaque année. Statut : `{ "done": true }`. La fréquence est enregistrée, sans planification de notifications.

Document : `{ "name": "Carnet", "animal": "nala", "category": "Santé", "type": "application/pdf", "content": "BASE64" }`. PDF/JPEG/PNG, 10 Mo maximum. Catégories : Santé, Identité, Assurance, Autre. PATCH accepte nom, animal, catégorie et éventuellement un nouveau fichier. Le BLOB est exclu des listes ; `url` et `hasFile` indiquent sa disponibilité.

Fiche d’urgence (PUT) : `{ "active": true, "photo": true, "details": true, "notes": false, "contact": true, "vet": false }`. Tous les choix sont booléens. Le serveur sauvegarde les choix, une copie des informations sélectionnées et un QR SVG. Identifiant complet et documents restent exclus. Le QR contient du texte de démonstration (900 caractères maximum), sans lien public hébergé. Les changements du profil sont repris lors du prochain enregistrement de la fiche.

La route `POST /api/animals/:id/emergency/preview` accepte les mêmes options que PUT et renvoie le QR recalculé sans écrire en base. React annule les requêtes précédentes quand les options changent ; seule la configuration sauvegardée est affichée dans le dashboard.

## Persistance

SQLite : `back/database/data/anivaya.sqlite`, exclue de Git. Les migrations sont appliquées automatiquement une seule fois via `schema_migrations` ; les données existantes sont conservées. Les données fictives initiales sont chargées au premier démarrage. Animaux, événements, rappels et documents utilisent une suppression logique ; retirer un animal masque aussi son carnet et ses fichiers.

`DATABASE_PATH` choisit une autre base ; `PORT` change le port API (adapter également le proxy Vite). Node >= 22.18 est requis. Installer les dépendances avec `npm --prefix back install`.

Cette version reste une démonstration locale mono-foyer, sans authentification ni notifications réelles. Les deux documents initiaux sont des exemples sans fichier.
