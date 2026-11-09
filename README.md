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

Les comptes pour parcourir les **états vides** sont accessibles directement avec `npm run dev`, sur la même page de connexion http://127.0.0.1:5173 :

| Identifiant | Mot de passe | Espace |
|---|---|---|
| test.vide@anivaya.test | Anivaya2026! | Particulier vide |
| admin.vide@anivaya.test | Anivaya2026! | Administrateur sans dossiers d’exemple |

L’API sélectionne automatiquement leur base séparée dans `back/database/data/empty-state/` à la connexion, puis à partir de la session. Il n’y a aucun animal, document, rappel, contact, partage, réservation, notification, professionnel, communauté, événement ou dossier administratif d’exemple. Les deux comptes, le rôle administrateur et les sessions restent visibles dans Utilisateurs, Équipe et Sécurité ; utiliser un filtre sans résultat pour l’état vide de ces listes. Les ajouts manuels persistent après redémarrage. Les comptes habituels conservent leurs données. Ces comptes vides sont réservés au développement local et ne sont pas activés en production.

La commande facultative `npm run dev:empty` reste disponible pour ouvrir uniquement l’environnement vide sur le port 5174 (API 3002, cookie distinct).

Comptes de démonstration (aucun n’est présélectionné sur la page de connexion) :

| Identifiant | Mot de passe | Espace |
|---|---|---|
| test@gmail.com | Anivaya2026! | Particulier, foyer de Camille avec Nala et Milo |
| test2@gmail.com | Anivaya2026! | Particulier |
| test3@gmail.com | Anivaya2026! | Particulier |
| admin@anivaya.fr | Anivaya2026! | Administrateur |

Chacun a son propre espace d’exemple. Aucun e-mail n’est jamais envoyé à ces adresses, qui ne nous appartiennent pas ; leur mot de passe ne peut pas être modifié. Supprimer un compte de démonstration recrée son espace d’exemple au lieu de le faire disparaître.

L’administration ajoute une seule fois, à la première ouverture d’une page admin, 24 foyers d’exemple (`sample-01` à `sample-24`, adresses en `@foyers.example`, défini dans `back/api/admin-samples.ts`). Inscrits sur les onze derniers mois dans cinq villes et quatre origines, avec des animaux, des rappels et une activité datée, ils alimentent Utilisateurs et le Pilotage. Ils n’ont aucun mot de passe utilisable. Le même jeu ajoute des dossiers à tous les états dans chaque rubrique : signalements, recours, demandes, imports, retours, annonces, guides, suppressions, alertes de sécurité, équipe et historique.

L’inscription crée un vrai compte avec un espace vide. Le mot de passe doit comporter 8 à 256 caractères, dont une majuscule, une minuscule et un caractère spécial ; il est haché avec scrypt et un sel aléatoire. La session est stockée côté serveur ; le navigateur reçoit un cookie HttpOnly et SameSite=Strict, valable au maximum 24 heures sans option de mémorisation.

Chaque compte, y compris les comptes de démonstration, dispose d’une base dans `back/database/data/accounts/`. La base principale conserve les comptes, les sessions, les jetons des fiches publiques et les communautés, partagées entre comptes. L’ancien espace de démonstration, stocké dans la base principale, est copié une seule fois dans `accounts/demo.sqlite` au démarrage. L’API choisit la base depuis la session, jamais depuis un identifiant de compte envoyé par le client. Les bases et les fichiers importés qu’elles contiennent sont exclus de Git.

## E-mails et import par IA

Copiez `.env.example` en `.env` à la racine (jamais commité) :

- **E-mails** (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`, `APP_URL`) : mot de passe oublié (lien valable une heure, à usage unique), invitations de l’équipe, partages de documents, confirmations, déplacements et annulations de réservation avec reçu, accusé de réception et réponses du support, décisions de modération, rappels selon le délai choisi (vérifiés toutes les heures, si « Rappels » est activé dans les préférences). Sans `SMTP_HOST`, chaque e-mail est déposé dans `back/database/data/outbox/` pour être consulté. Aucun e-mail n’est envoyé aux adresses des comptes de démonstration ni aux domaines réservés (`.example`, `.test`).
- **Import par IA** (`OPENROUTER_API_KEY`, `OPENROUTER_MODEL`) : le document (photo ou PDF) est lu par un modèle choisi sur OpenRouter (gratuit par défaut pour les tests, `anthropic/claude-haiku-5.5` conseillé en production) ; les champs proposés sont vérifiés par la personne, puis le document, l’identité, l’événement et le rappel choisis sont enregistrés dans le carnet. Sans clé, l’import affiche un message de configuration.

Le paiement des réservations reste simulé (aucun débit) ; la confirmation et le reçu sont envoyés par e-mail.

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
│       │   ├── auth/              # Connexion, inscription et réinitialisation du mot de passe par e-mail
│       │   ├── profile/           # Profil, photo et préférences
│       │   ├── directory/         # Annuaire, réservations et parcours de réservation
│       │   ├── dashboard/         # Vue d’ensemble et panneaux
│       │   ├── animals/           # AnimalsPage, AnimalDialogs, carnet, fiche d’urgence et fiche publique
│       │   ├── reminders/         # RemindersPage et ReminderDialogs
│       │   ├── documents/         # DocumentsPage et DocumentDialogs
│       │   ├── sharing/           # SharingPage et SharingDialogs (contacts, associations, partages entre comptes)
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

### Synchronisation des maquettes du 6 novembre 2026

Le nouvel accueil remplace l’ancienne page : présentation, choix Nala/Milo, fonctionnalités, offres, FAQ, liste d’attente et parcours professionnels, cliniques et entreprises. Le contenu est rendu en JSX dans `LandingContent.tsx`, avec des images locales séparées. Les anciennes ancres de l’accueil restent reconnues. La navigation publique, le pied de page, le menu du compte, les formulaires et les contrôles communs reprennent les nouvelles maquettes ; les barres de défilement personnalisées sont conservées.

Les quatre formulaires utilisent `POST /api/public/leads`. La validation, le consentement, la limitation des envois et la détection des doublons sont gérés par l’API. Les demandes sont enregistrées dans `public_leads` dans la base centrale et dans **Administration → Assistance → Demandes**, avec les autorisations existantes. Aucun compte, abonnement ou paiement n’est créé par ces formulaires ; les tarifs restent une présentation des offres envisagées. Aucune campagne de lancement n’est envoyée automatiquement. La liste d’attente envoie un e-mail de confirmation avec un lien personnel : un clic sur « Me désinscrire » retire le consentement en base. Sans SMTP, l’e-mail reste dans la boîte locale. Les autres demandes conservent le retrait via Contact.

Le code postal facultatif est validé à l’inscription et dans le profil, conservé dans la base privée et inclus dans l’export du profil. La migration `014_profile_postal_code.sql` conserve les données existantes ; `015_public_leads.sql` initialise les demandes de la vitrine dans la base centrale uniquement.

La connexion se fait par saisie des identifiants, sans sélection de compte de maquette. Les services simulés des maquettes, la MFA fictive et les décisions administratives simulées ne sont pas repris : les parcours existants continuent d’utiliser l’API réelle.

Les informations légales de la maquette restent un **gabarit à compléter** avant publication. Les prix et le calendrier conservent leur mention indicative.

- Accueil responsive, sections interactives et FAQ ; connexion, inscription et déconnexion réelles.
- Profil : photo JPG/PNG/WebP jusqu’à 5 Mo, coordonnées, préférences de notification, accès au changement de mot de passe, confirmation avant de perdre les modifications.
- Exportation de ses données en JSON, par catégorie (sans fichiers d’origine, mot de passe ni contenu d’autres propriétaires) ; suppression du compte confirmée par une case et la saisie de SUPPRIMER.
- Partage avec moi : invitations reçues d’autres propriétaires (exemples sur les comptes de démonstration), acceptation ou refus, consultation en lecture seule des accès actifs, recherche et filtre par statut.
- Communautés : communautés, événements et messagerie partagés entre tous les comptes (exemples communs aux comptes de démonstration, avec Claire et Samir, membres fictifs). Rejoindre ou quitter, créer et gérer ses communautés et événements, places limitées, discussions de groupe, messages privés et groupes privés, photos jointes (1 Mo), « Envoyé » / « Lu », amis, blocage et signalement. Chaque nouveau message ou demande d’ami crée une notification chez le destinataire.
- Documents : téléchargement direct, et sur la page Documents sélection multiple pour partager, télécharger (archive ZIP) ou supprimer plusieurs documents.
- Notifications : cloche avec le nombre de non lues dans la barre du haut, filtres Toutes / Non lues et par catégorie, lu / non lu, tout marquer comme lu. Rappels, partages et réservations sont aussi envoyés par e-mail selon les préférences.
- Contact et informations : formulaire transmis au support (accusé de réception par e-mail), présentation du service et données, accessible sans compte ou depuis l’espace.
- Annuaire : six professionnels, filtres et favoris privés. Réservation en trois étapes, créneaux, paiement simulé, déplacement et annulation persistants, confirmations et reçus par e-mail.
- Ajout, modification et suppression d’un animal ; photo JPEG/PNG jusqu’à 2 Mo.
- Carnet en sept onglets : vue d’ensemble, identité, suivi, documents, rappels, habitudes et personnes de confiance.
- Événements et rappels : ajout, modification, suppression, statut, fréquence, délai, recherche et filtres.
- Documents PDF/JPEG/PNG jusqu’à 10 Mo : import, aperçu, téléchargement, remplacement et suppression.
- Fiche d’urgence : choix des informations visibles, aperçu, sauvegarde, QR agrandi, téléchargé ou imprimé. Le QR ouvre la fiche publique avec seulement les informations sélectionnées.
- Contacts communs aux carnets, associations à plusieurs animaux et partages réels entre comptes : invitation par e-mail, document consultable en lecture seule dans « Partage avec moi » jusqu’à la date de fin, révocation immédiate.
- États de chargement, erreurs de validation, reprise après erreur et dialogues accessibles au clavier.

Les comptes de démonstration contiennent des exemples : Camille, Nala et Milo. Les documents initiaux n’ont pas de fichier. Les fichiers importés sont conservés dans SQLite. Les réservations d’exemple sont ajoutées une seule fois au compte de démonstration, sans remplacer les réservations créées ensuite.

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
