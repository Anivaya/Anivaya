# Anivaya

Application React et TypeScript reproduite à partir des neuf maquettes : accueil public, connexion, inscription, espace connecté, carnet, partage, profil, annuaire et fiche d’urgence publique. API Node.js et bases SQLite locales.

## Démarrer

Node.js 22.18 ou plus récent est requis (testé avec Node 22.23.2). Depuis `front-back` :

```powershell
npm install
npm --prefix front install
npm --prefix back install
npm run dev
```

La commande démarre React sur http://127.0.0.1:5173 et l’API sur http://127.0.0.1:3001. Arrêter avec Ctrl+C. Les migrations et données initiales sont chargées automatiquement. Si les ports sont déjà occupés, utiliser l’instance existante ou arrêter son terminal avant de relancer.

## Comptes

Ouvrez [la connexion](http://127.0.0.1:5173/#connexion). Le bouton sous le formulaire affiche **test@gmail.com** / **Anivaya2026!** et remplit les champs en un clic. Ce compte conserve les données déjà présentes dans le projet.

L’inscription crée un vrai compte avec un espace vide. Le mot de passe doit comporter 12 à 256 caractères ; il est haché avec scrypt et un sel aléatoire. La session est stockée côté serveur ; le navigateur reçoit un cookie HttpOnly et SameSite=Strict, valable au maximum 24 heures sans option de mémorisation.

Chaque nouveau compte dispose d’une base dans `back/database/data/accounts/`. La base principale conserve les données du compte de démonstration, les comptes, les sessions et les jetons des fiches publiques. L’API choisit la base depuis la session, jamais depuis un identifiant de compte envoyé par le client. Les bases et les fichiers importés qu’elles contiennent sont exclus de Git.

La récupération de mot de passe par e-mail n’est pas configurée. Les notifications, les invitations de partage et les paiements ne sont pas envoyés à un service externe. Les professionnels et leurs disponibilités sont fictifs ; les réservations sont enregistrées pour tester les parcours, sans engager un prestataire ni débiter une carte.

## Structure et ordre de lecture

```text
front-back/
├── front/
│   ├── public/                    # Logo, polices et images des maquettes
│   └── src/
│       ├── main.tsx               # Montage React et import de tous les styles
│       ├── App.tsx                # Session, routes, espace connecté et choix des fenêtres
│       ├── pages/
│       │   ├── home/              # Accueil public
│       │   ├── auth/              # Connexion et inscription
│       │   ├── profile/           # Profil, photo et préférences
│       │   ├── directory/         # Annuaire, réservations et parcours de réservation
│       │   ├── dashboard/         # Vue d’ensemble et panneaux
│       │   ├── animals/           # AnimalsPage, AnimalDialogs, carnet, fiche d’urgence et fiche publique
│       │   ├── reminders/         # RemindersPage et ReminderDialogs
│       │   ├── documents/         # DocumentsPage et DocumentDialogs
│       │   └── sharing/           # SharingPage et SharingDialogs (contacts, associations, partages simulés)
│       ├── shared/
│       │   ├── services/api.ts    # Tous les appels à l’API
│       │   ├── hooks.ts           # useDashboard et useDialogAction
│       │   ├── forms/             # Formulaire, champs et messages d’erreur
│       │   ├── layout/            # Barre latérale, menu du compte, en-têtes
│       │   ├── ui/                # Fenêtre modale, icônes, filtres
│       │   ├── utils/format.ts    # Dates, montants, recherche et libellés
│       │   └── types.ts           # Types communs du frontend
│       └── css/                   # Tous les styles
├── back/
│   ├── api/
│   │   ├── app.ts                 # Table des routes HTTP, origine, lecture JSON et réponses
│   │   ├── auth.ts                # Comptes, sessions et sélection de la base privée
│   │   ├── profile.ts             # Profil, photo et préférences
│   │   ├── directory.ts           # Professionnels, favoris et réservations
│   │   ├── repository.ts          # Dashboard, carnet, rappels et documents d’un espace
│   │   ├── animals.ts             # Animaux, profils, photos et événements
│   │   ├── emergency.ts           # Choix de visibilité et génération des QR
│   │   ├── sharing.ts             # Contacts et partages
│   │   ├── validation.ts          # Erreurs API, validation des champs, dates, e-mails et fichiers
│   │   └── server.ts              # Démarrage
│   ├── database/
│   │   ├── connection.ts          # Connexion, transactions, migrations et chargement initial
│   │   ├── migrations/            # Schéma SQL versionné
│   │   ├── seeds/                 # Données fictives, chargées sans écraser les ajouts
│   │   └── data/                  # Bases locales, exclues de Git
│   ├── docs/API.md                # Contrat API et exemples
│   └── tests/                     # Tests HTTP, isolation, fichiers et persistance
├── shared/                       # Contrats JSON communs : models.ts et account.ts
├── scripts/dev.ts                # Lance le front et l’API ensemble
├── tsconfig.json                 # Typage strict du backend et des tests
├── .gitignore
└── README.md
```

Chaque page importe ses contenus métier. Les composants réutilisés restent dans leur domaine : le dashboard importe les cartes depuis `pages/animals`, par exemple. Les petits éléments à usage unique restent dans leur fichier. Les éléments universels sont dans `shared` et tous les styles dans `css`.

Le flux est **React → API → SQLite**. Les données métier ne sont pas dupliquées dans React. Le contrat des routes est dans `back/docs/API.md`.

Côté API, chaque route est une ligne de `back/api/app.ts`, par exemple `api.patch("/api/reminders/:id", …)`. `open` regroupe les routes sans session, `api` celles de l’espace connecté. Un gestionnaire qui ne renvoie rien répond 204, un `FileReply` renvoie un fichier, tout autre résultat est envoyé en JSON. Les écritures multiples passent par `transaction()` de `database/connection.ts`.

## Fonctionnalités

- Accueil responsive, sections interactives et FAQ ; connexion, inscription et déconnexion réelles.
- Profil : photo JPG/PNG/WebP jusqu’à 5 Mo, coordonnées, préférences de notification, confirmation avant de perdre les modifications.
- Annuaire : six professionnels fictifs, filtres et favoris privés. Réservation en trois étapes, créneaux, paiement accepté/refusé simulé, déplacement et annulation persistants.
- Ajout, modification et suppression d’un animal ; photo JPEG/PNG jusqu’à 2 Mo.
- Carnet en sept onglets : vue d’ensemble, identité, suivi, documents, rappels, habitudes et personnes de confiance.
- Événements et rappels : ajout, modification, suppression, statut, fréquence, délai, recherche et filtres.
- Documents PDF/JPEG/PNG jusqu’à 10 Mo : import, aperçu, téléchargement, remplacement et suppression.
- Fiche d’urgence : choix des informations visibles, aperçu, sauvegarde, QR agrandi, téléchargé ou imprimé. Le QR ouvre la fiche publique avec seulement les informations sélectionnées.
- Contacts communs aux carnets, associations à plusieurs animaux et partages simulés avec date de fin et révocation. Aucun e-mail ni accès documentaire externe n’est créé.
- États de chargement, erreurs de validation, reprise après erreur et dialogues accessibles au clavier.

Les données initiales sont fictives : Camille, Nala et Milo. Les documents initiaux sont des exemples sans fichier. Les fichiers importés sont conservés dans SQLite. Les réservations d’exemple sont ajoutées une seule fois au compte de démonstration, sans remplacer les réservations créées ensuite.

## Fiche publique et configuration

Désactiver une fiche bloque son accès public. La supprimer révoque définitivement son lien ; la recréation utilise un nouveau jeton. Une prévisualisation n’applique pas les choix : il faut sauvegarder. Les anciens QR texte sont convertis dans l’application au chargement du dashboard ; leurs anciennes copies déjà téléchargées restent lisibles.

Les QR utilisent l’origine locale du navigateur par défaut. Pour une future installation accessible depuis un téléphone, définir `PUBLIC_SITE_URL` avec l’URL HTTPS du site et ajouter son origine à `ALLOWED_ORIGINS` (origines séparées par une virgule). Une adresse 127.0.0.1 n’est accessible que sur sa propre machine.

`DATABASE_PATH` permet de choisir la base centrale. `NODE_ENV=production` active le cookie Secure et nécessite HTTPS. L’hébergement et les services d’e-mail et de paiement ne sont pas configurés dans cette version locale.

## Vérifications

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

Le typage strict couvre le frontend, le backend et les tests. Node exécute directement les fichiers `.ts` ; Vite transforme les composants `.tsx`. Les entrées HTTP restent validées côté serveur.

Les tests utilisent des bases temporaires isolées. Ils couvrent les données métier, les fichiers, les partages, les sessions, l’isolation de deux comptes, le profil, les conflits de réservation et la révocation des QR. Ils ne modifient pas la base de développement.

Les migrations sont appliquées automatiquement et conservent les données existantes. `004_profile_directory.sql` ajoute le profil, l’annuaire, les favoris et les réservations. Le module natif `node:sqlite` émet un avertissement expérimental sur Node 22 : c’est attendu.

## Git et fichiers générés

Dépôt privé : https://github.com/libehon/Anivaya. La racine de pull/push est `front-back`. Ne pas committer SQLite, `.env`, `node_modules` ou `dist`.

`node_modules` est nécessaire pour lancer le projet et peut être régénéré avec `npm install`. `dist` est uniquement le résultat d’un build pour déploiement ; il n’est pas nécessaire pendant le développement. Les fichiers de configuration, migrations, seeds et tests participent au fonctionnement ou à la vérification du projet.
