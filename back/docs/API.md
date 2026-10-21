# API du dashboard

API locale : http://127.0.0.1:3001. Les appels du frontend passent par le proxy `/api` de Vite. Le frontend ne lit jamais SQLite directement.

## Routes

| Méthode | Route                   | Usage                                     |
| ------- | ----------------------- | ----------------------------------------- |
| GET     | /api/health             | Vérifier le serveur                       |
| GET     | /api/dashboard          | household, animals, reminders, documents  |
| POST    | /api/animals            | Créer un animal                           |
| POST    | /api/reminders          | Créer un rappel                           |
| PATCH   | /api/reminders/:id      | Changer done                              |
| POST    | /api/documents          | Enregistrer un fichier                    |
| PATCH   | /api/documents/:id      | Modifier nom et animal                    |
| DELETE  | /api/documents/:id      | Retirer un document (suppression logique) |
| GET     | /api/documents/:id/file | Télécharger le fichier                    |

Créations : 201. Modifications et lectures : 200. Suppression : 204. Erreurs JSON : `{ "error": "Message", "field": "name" }` (field facultatif), statut 400, 403, 404, 413, 415 ou 500.

## Corps JSON

Animal : `{ "name": "Rio", "species": "Chien", "description": "Labrador · 2 ans" }`.

Rappel : `{ "name": "Contrôle annuel", "animal": "nala", "date": "2026-12-20" }`.

Statut : `{ "done": true }`.

Document : `{ "name": "carnet.pdf", "animal": "nala", "type": "application/pdf", "content": "BASE64_DU_FICHIER" }`. PDF, JPEG, PNG uniquement, 10 Mo maximum. Le contenu est stocké en BLOB et n'est pas renvoyé dans la liste ; `url` et `hasFile` indiquent sa disponibilité. Les deux documents de seed sont des exemples sans fichier.

Modification du document : `{ "name": "Passeport", "animal": "milo" }`.

## Persistance

SQLite dans `back/database/data/anivaya.sqlite` (non versionné). Le serveur applique le schéma SQL et charge les données de démonstration uniquement au premier démarrage. Les ajouts sont conservés après rechargement du navigateur et redémarrage de l'API. `DATABASE_PATH` permet de choisir un autre fichier ; `PORT` change le port API (adapter alors le proxy Vite).

Node >= 22.18 requis. Le module intégré node:sqlite est expérimental dans Node 22 : un avertissement au démarrage est attendu. Référence : https://nodejs.org/download/release/latest-jod/docs/api/sqlite.html.

Cette API est une démonstration locale mono-foyer, sans authentification. Elle n'est pas destinée à être exposée sur Internet en l'état.
