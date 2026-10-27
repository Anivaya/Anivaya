# Anivaya

Application React et TypeScript reproduite à partir des treize maquettes : accueil public, connexion, inscription, réinitialisation du mot de passe, espace connecté, carnet, partage, profil, annuaire, notifications, communautés, contact et informations, et fiche d’urgence publique. API Node.js et bases SQLite locales.

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

Ouvrez [la connexion](http://127.0.0.1:5173/#connexion). Trois comptes de démonstration y sont listés : **test@gmail.com**, **test2@gmail.com** et **test3@gmail.com**, tous avec le mot de passe **Anivaya2026!** ; « Utiliser ce compte » remplit les champs. Chacun a son propre espace d’exemple. Supprimer un compte de démonstration recrée son espace d’exemple au lieu de le faire disparaître.

L’inscription crée un vrai compte avec un espace vide. Le mot de passe doit comporter 12 à 256 caractères ; il est haché avec scrypt et un sel aléatoire. La session est stockée côté serveur ; le navigateur reçoit un cookie HttpOnly et SameSite=Strict, valable au maximum 24 heures sans option de mémorisation.

Chaque compte, y compris les comptes de démonstration, dispose d’une base dans `back/database/data/accounts/`. La base principale conserve les comptes, les sessions, les jetons des fiches publiques et les communautés, partagées entre comptes. L’ancien espace de démonstration, stocké dans la base principale, est copié une seule fois dans `accounts/demo.sqlite` au démarrage. L’API choisit la base depuis la session, jamais depuis un identifiant de compte envoyé par le client. Les bases et les fichiers importés qu’elles contiennent sont exclus de Git.

La récupération de mot de passe par e-mail n’est pas configurée : le parcours de réinitialisation est simulé et ne modifie aucun mot de passe. Le formulaire de contact n’envoie ni ne conserve les messages. Les notifications, les invitations de partage et les paiements ne sont pas envoyés à un service externe. Les professionnels et leurs disponibilités sont fictifs ; les réservations sont enregistrées pour tester les parcours, sans engager un prestataire ni débiter une carte.

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
│       │   ├── auth/              # Connexion, inscription et réinitialisation simulée du mot de passe
│       │   ├── profile/           # Profil, photo et préférences
│       │   ├── directory/         # Annuaire, réservations et parcours de réservation
│       │   ├── dashboard/         # Vue d’ensemble et panneaux
│       │   ├── animals/           # AnimalsPage, AnimalDialogs, carnet, fiche d’urgence et fiche publique
│       │   ├── reminders/         # RemindersPage et ReminderDialogs
│       │   ├── documents/         # DocumentsPage et DocumentDialogs
│       │   ├── sharing/           # SharingPage et SharingDialogs (contacts, associations, partages simulés)
│       │   ├── notifications/     # Centre de notifications (filtres, lu / non lu)
│       │   └── contact/           # Contact et informations, publique ou dans l’espace
│       ├── shared/
│       │   ├── services/api.ts    # Tous les appels à l’API
│       │   ├── hooks.ts           # useDashboard et useDialogAction
│       │   ├── forms/             # Formulaire, champs et messages d’erreur
│       │   ├── layout/            # Barre latérale, menu du compte, en-têtes
│       │   ├── ui/                # Fenêtre modale, onglets, icônes, filtres
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
│   │   ├── notifications.ts       # Notifications : liste, lu / non lu
│   │   ├── received.ts            # Partages reçus : invitations, acceptation, refus
│   │   ├── export.ts              # Export JSON des données du compte
│   │   ├── social.ts              # Communautés, événements et messagerie partagés (base centrale)
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
- Profil : photo JPG/PNG/WebP jusqu’à 5 Mo, coordonnées, préférences de notification, accès au changement de mot de passe, confirmation avant de perdre les modifications.
- Exportation de ses données en JSON, par catégorie (sans fichiers d’origine, mot de passe ni contenu d’autres propriétaires) ; suppression du compte confirmée par une case et la saisie de SUPPRIMER.
- Partage avec moi : invitations reçues d’autres propriétaires (exemples sur les comptes de démonstration), acceptation ou refus, consultation en lecture seule des accès actifs, recherche et filtre par statut.
- Communautés : communautés, événements et messagerie partagés entre tous les comptes (exemples communs aux comptes de démonstration, avec Claire et Samir, membres fictifs). Rejoindre ou quitter, créer et gérer ses communautés et événements, places limitées, discussions de groupe, messages privés et groupes privés, photos jointes (1 Mo), « Envoyé » / « Lu », amis, blocage et signalement. Chaque nouveau message ou demande d’ami crée une notification chez le destinataire.
- Documents : téléchargement direct, et sur la page Documents sélection multiple pour partager, télécharger (archive ZIP) ou supprimer plusieurs documents.
- Notifications : cloche avec le nombre de non lues dans la barre du haut, filtres Toutes / Non lues et par catégorie, lu / non lu, tout marquer comme lu. Enregistrées par compte, sans envoi externe.
- Contact et informations : formulaire simulé, présentation du service et données, accessible sans compte ou depuis l’espace.
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

Les migrations sont appliquées automatiquement et conservent les données existantes. `004_profile_directory.sql` ajoute le profil, l’annuaire, les favoris et les réservations ; `005_notifications.sql` ajoute les notifications ; `006_received_shares.sql` ajoute les partages reçus ; `007_social_notifications.sql` ajoute la catégorie de notification « social ». Les tables des communautés (`social_*`) sont créées dans la base centrale par `back/api/social.ts`. Le module natif `node:sqlite` émet un avertissement expérimental sur Node 22 : c’est attendu.

## Git et fichiers générés

Dépôt privé : https://github.com/libehon/Anivaya. La racine de pull/push est `front-back`. Ne pas committer SQLite, `.env`, `node_modules` ou `dist`.

`node_modules` est nécessaire pour lancer le projet et peut être régénéré avec `npm install`. `dist` est uniquement le résultat d’un build pour déploiement ; il n’est pas nécessaire pendant le développement. Les fichiers de configuration, migrations, seeds et tests participent au fonctionnement ou à la vérification du projet.
