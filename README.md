# Anivaya

Projet du site Anivaya. Le dépôt regroupe le frontend React et la structure du futur backend.

## Structure

```text
front-back/
├── front/                 # Frontend React + Vite (JavaScript)
│   ├── src/               # Composants, styles et ressources importées
│   ├── public/            # Fichiers statiques
│   └── package.json
├── back/
│   ├── api/               # Futur serveur, routes et logique métier
│   ├── database/
│   │   ├── migrations/    # Évolution du schéma
│   │   └── seeds/         # Données initiales et de démonstration
│   └── docs/              # Documentation et contrats d'API
├── merge/                 # Réservé à l'intégration frontend/backend
├── .gitignore
└── README.md
```

## Démarrer le frontend

Depuis la racine `front-back` :

```powershell
cd front
npm install
npm run dev
```

Ouvrir l'adresse affichée par Vite (habituellement http://localhost:5173).

Dans `front`, les commandes disponibles sont :

- `npm run dev` : serveur de développement avec rechargement automatique.
- `npm run build` : compilation de production dans `front/dist`.
- `npm run preview` : prévisualisation locale de la compilation.
- `npm run lint` : vérification du code avec Oxlint.

`front/src/main.jsx` est le point d'entrée React ; `front/src/App.jsx` contient le composant principal (exemple React/Vite pour le moment).

## Backend

La structure est préparée dans `back`. Aucune API ni base de données n'est encore installée ; le langage, le framework et le moteur de base restent à choisir.

Les secrets doivent rester dans des fichiers `.env` locaux exclus de Git. Seuls les exemples sans secrets peuvent être partagés.

## Git

Le dépôt privé est https://github.com/libehon/Anivaya.
La racine Git et le point de pull/push sont le dossier `front-back`.

```powershell
git pull
git add .
git commit -m "Description des modifications"
git push
```
