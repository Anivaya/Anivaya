# Anivaya

Dashboard et carnets des animaux en React et TypeScript, reproduits à partir des maquettes, avec une API Node.js en TypeScript et une base SQLite locale.

## Démarrer

Node.js 22.18 ou plus récent est requis (testé avec Node 22.23.2).
Depuis `front-back` :

```powershell
npm install
npm --prefix front install
npm --prefix back install
npm run dev
```

La commande démarre l'interface sur http://127.0.0.1:5173 et l'API sur http://127.0.0.1:3001. Arrêter avec Ctrl+C.
Le serveur crée automatiquement la base et les données fictives au premier démarrage.

## Structure et ordre de lecture

```text
front-back/
├── front/
│   ├── public/images/             # Logo transparent et photo des compagnons
│   └── src/
│       ├── App.tsx                # Assemblage global et sélection de la page
│       ├── app/                   # Routage des fenêtres métier
│       ├── pages/
│       │   ├── dashboard/         # DashboardPage : assemble les panneaux
│       │   ├── animals/           # Mes animaux : page, cartes, fiches, formulaire
│       │   ├── reminders/         # Rappels : page, liste, fiche, formulaire
│       │   ├── documents/         # Documents : page, liste, fiches, formulaires
│       │   └── sharing/           # Partage : personnes, associations, accès simulés
│       ├── shared/                # Éléments universels
│       │   ├── layout/            # Navigation et en-tête de page
│       │   ├── ui/                # Fenêtre, champ, icônes, bouton fermer
│       │   ├── forms/             # Soumission, erreurs et état occupé
│       │   ├── hooks/             # Chargement des données
│       │   ├── services/          # Appels API
│       │   └── utils/             # Dates et libellés
│       └── css/                   # Tous les CSS, regroupés ici
├── back/
│   ├── api/
│   │   ├── app.ts                 # Routes HTTP et réponses
│   │   ├── repository.ts          # Accès aux données
│   │   ├── validation.ts          # Validation des entrées et fichiers
│   │   └── server.ts              # Démarrage du serveur
│   ├── database/
│   │   ├── connection.ts          # Connexion, schéma et premier chargement
│   │   ├── migrations/            # Schéma SQL
│   │   ├── seeds/                 # Données de démonstration
│   │   └── data/                  # Base locale, exclue de Git
│   ├── docs/API.md                # Contrat API et exemples JSON
│   └── tests/                     # Tests HTTP, fichiers et persistance
├── scripts/dev.ts                # Démarrage du front et de l'API
├── shared/models.ts               # Contrats de données communs à React et à l’API
├── tsconfig.json                  # Typage strict de l’API, des scripts et des tests
├── .gitignore
└── README.md
```

Chaque page possède son fichier `*Page.tsx` et importe ses composants. Un composant métier partagé reste dans son domaine : par exemple, le dashboard importe `AnimalsSection` depuis `pages/animals` (qui contient aussi son petit composant interne `AnimalCard`), et la sélection d'un animal est réutilisée dans les formulaires de rappels et de documents. Seuls les éléments universels sont dans `shared`. Tous les styles se trouvent dans `src/css`.

Le flux est **React → API → SQLite**. Les données métier ne sont pas dupliquées dans les composants React. Le contrat des routes est dans `back/docs/API.md`.

## Fonctionnalités

- Navigation entre la vue d'ensemble, les animaux, les documents, les rappels et le partage.
- Ajout et modification d'un animal, photo JPEG/PNG (2 Mo maximum), suppression du carnet.
- Carnet en sept onglets : vue d’ensemble, identité, suivi, documents, rappels, habitudes et personnes de confiance.
- Ajout, modification et suppression des événements et rappels ; statut, fréquence, délai de prévention et note. Recherche et filtres par animal/statut.
- Ajout d'un PDF/JPEG/PNG (10 Mo maximum), téléchargement, catégorie, remplacement et retrait du carnet.
- Fiche d’urgence : choix des informations visibles, aperçu, sauvegarde et QR téléchargeable/imprimable. Le QR contient du texte de démonstration, sans URL publique hébergée.
- Conservation des données après rechargement et redémarrage de l'API.
- Documents : aperçu PDF/image, recherche, filtres et partage simulé individuel ou multiple.
- Personnes de confiance communes aux carnets : ajout, modification, association à plusieurs animaux et retrait d’un carnet sans révocation des partages.
- Partages simulés en lecture seule, date de fin, détection des doublons et révocation. Supprimer une personne révoque ses partages ; aucun e-mail ni accès externe n’est créé.
- Erreurs de validation, état de chargement, reprise en cas d'API inaccessible et dialogues accessibles au clavier.

Les données initiales sont fictives : Camille, Nala et Milo. Les deux documents d'exemple ne contiennent aucun fichier. Les fichiers ajoutés sont enregistrés dans la base SQLite locale. La connexion et les partages sont simulés, sans authentification ni invitation ; cette version est destinée au développement local. Aucune notification réelle n'est envoyée.

## Vérifications

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

`npm run typecheck` vérifie le frontend et le backend en mode strict. Le build vérifie aussi les types avant de générer le site. Node exécute directement les fichiers `.ts` du backend ; Vite transforme les composants `.tsx` pour le navigateur. Les validations des données reçues par l’API restent nécessaires et sont conservées.

`npm test` utilise une base temporaire isolée : il ne modifie pas la base de développement.
Les migrations sont appliquées automatiquement et conservent les données existantes. La migration `002_animal_records.sql` ajoute les profils, événements et fiches d’urgence.
La migration `003_sharing.sql` ajoute les contacts, leurs associations, les partages et les précisions des rappels.
Le module natif `node:sqlite` émet un avertissement expérimental sur Node 22 ; c'est attendu.

## Git

Dépôt privé : https://github.com/libehon/Anivaya. La racine de pull/push est `front-back`. Ne pas committer la base SQLite, les fichiers `.env`, `node_modules` ou `dist`.

## Fichiers utiles

- `scripts/dev.ts` lance React et l’API ensemble avec `npm run dev`.
- `front/src/shared/utils/format.ts` centralise les dates et les noms d’animaux utilisés sur plusieurs pages.
- Les fichiers `package.json`, `package-lock.json`, `vite.config.ts`, `.oxlintrc.json` et `.gitignore` servent aux dépendances, au développement et à la vérification du code.
- Les migrations, les données initiales et les tests du backend sont conservés ; la base locale contient les données enregistrées.
- `node_modules` contient les dépendances installées ; il peut être régénéré avec `npm install`, mais il est nécessaire pour lancer le projet.

Les petits composants utilisés dans un seul fichier sont déclarés dans ce fichier : `AnimalCard` dans `AnimalsSection.tsx`, `PrivacyNote` dans `DashboardPage.tsx` et `PublicSiteNotice` dans `ActionDialog.tsx`. Les composants partagés et les formulaires/fiches métier restent séparés.
