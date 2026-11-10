# Déployer Anivaya sur anivaya.com

> Pour le nouveau choix Vercel + Render + Supabase, suivre [CLOUD-SETUP.md](CLOUD-SETUP.md). Cette page décrit uniquement l’option VPS/SQLite.

Le code dispose d’un déploiement Docker pour **un VPS Linux, une seule instance API et un volume SQLite persistant**. Le domaine communiqué est `anivaya.com`, chez one.com. Le type de forfait one.com, les accès au serveur, le SMTP réel et les informations légales restent à confirmer. Aucun site n’a été publié par ces changements.

La documentation [one.com VPS](https://help.one.com/hc/en-us/articles/39749383046033-Getting-Started-with-your-VPS-at-one-com) décrit l’installation de Node.js/Docker et le pointage DNS. Vérifier dans le panneau one.com la présence de **VPS** et d’une adresse IP de serveur. Un domaine ou un hébergement de pages statiques ne suffit pas à exécuter l’API Node persistante. Ne pas acheter ou changer de forfait sans confirmer celui déjà détenu.

## Avant le lancement

- Déployer une base neuve. Ne jamais téléverser `back/database/data`, `.env`, les fichiers de comptes de développement ou les documents de test. Les comptes et contenus fictifs ne sont pas créés en production. Le serveur refuse une base centrale portant les marqueurs des exemples locaux.
- Renseigner les vrais paramètres SMTP et valider l’adresse d’expédition chez le fournisseur. Tester réellement la réception d’un reset de mot de passe, d’une invitation d’équipe et d’une confirmation de réservation avant ouverture publique. Un test local ne prouve pas la délivrabilité.
- Fournir le texte des mentions légales, de la confidentialité et des cookies : identité/statut/immatriculation/adresse de l’éditeur, directeur de publication, contact, hébergeur et ses coordonnées, traitements réels de l’application (comptes, animaux, documents, partages, messages, réservations), destinataires, conservation, droits et éventuel prestataire IA. Ne pas reprendre les affirmations de la maquette sans vérification.
- Copier `deploy/legal.example.json` vers `deploy/legal.json`, compléter les trois sections, puis mettre `reviewed` à `true` après relecture effective. Le modèle vide est volontairement rejeté. Le contenu est affiché comme texte, sans HTML exécutable. Aucun nom d’entreprise ni adresse n’a été inventé.
- Conserver les paiements en ligne désactivés. Les prix affichés sont des tarifs annoncés, jamais un montant encaissé. Le catalogue initial de production est vide ; n’y introduire que des professionnels et services réels autorisés.

## Configuration et lancement sur le VPS

Installer Docker Engine et le plugin Compose. Copier le dépôt dans `/opt/anivaya/front-back` (sans fichiers secrets locaux), puis, dans ce dossier :

```sh
cp .env.production.example .env.production
cp deploy/legal.example.json deploy/legal.json
chmod 600 .env.production
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

La dernière commande génère une clé : la placer uniquement dans `MFA_ENCRYPTION_KEY` du fichier serveur, sans la publier ni l’envoyer dans un chat. Si Node n’est pas installé sur l’hôte, utiliser `openssl rand -hex 32`. Sauvegarder cette clé séparément et durablement : la changer rend les secrets MFA existants illisibles.

Compléter `.env.production` et `deploy/legal.json` **avant** les commandes suivantes. `APP_URL`, `PUBLIC_SITE_URL` et `ALLOWED_ORIGINS` sont déjà alignés sur `https://anivaya.com`. `SMTP_SECURE=false` avec le port 587 signifie STARTTLS obligatoire en production ; le port 465 utilise `true`. Les secrets sont injectés à l’exécution, jamais incorporés aux images. L’import IA reste désactivé sans clé ; pour l’activer, choisir explicitement un modèle et vérifier les conditions du fournisseur concernant les documents.

```sh
docker compose config --quiet
docker compose build
docker compose up -d
docker compose ps
docker compose logs --tail=100 api web
curl --fail https://anivaya.com/api/health
```

Faire pointer l’enregistrement DNS A du domaine vers l’IP du VPS ; ne conserver un AAAA que si IPv6 arrive réellement à ce serveur. Ouvrir 80/443 et restreindre SSH. Caddy sert le frontend et relaie `/api` sur le même domaine, avec certificat HTTPS automatique. Le port API n’est pas publié. Le nom `www.anivaya.com` n’est pas configuré : le rediriger explicitement si nécessaire.

Les images comportent un frontend compilé et une API exécutée sans privilèges root. `app-data` conserve la base centrale, les bases privées, fichiers importés et réservations. Ne pas lancer plusieurs réplicas, ne pas utiliser un stockage éphémère ou un partage réseau SQLite, et ne pas exécuter `docker compose down -v` : cette option détruirait les volumes.

## Premier administrateur

Créer votre compte personnel sur le site, vérifier qu’il s’agit bien de votre compte, puis attribuer le rôle **depuis le serveur** :

```sh
docker compose exec api npm run admin:grant -- votre-adresse-personnelle "Administrateur"
```

Se reconnecter, activer la double authentification et conserver les codes de secours. Il n’existe aucun mot de passe administrateur par défaut en production. Les anciens comptes de démonstration sont interdits de connexion, leurs sessions et rôles sont révoqués si une base héritée atteint le service d’authentification.

Les autres membres reçoivent un lien individuel par e-mail. Ils doivent se connecter avec l’adresse destinataire puis confirmer le lien. Un lien expire après 14 jours, ne fonctionne qu’une fois et est invalidé par renouvellement ou annulation. Une simple inscription ne confère plus de rôle. Les invitations créées avant cette version doivent être renouvelées.

## Sauvegardes et restauration

Les données couvrent plusieurs bases : le script arrête brièvement l’API pour obtenir un ensemble cohérent, puis la redémarre même si la sauvegarde échoue. L’accès peut répondre 502 durant cette courte maintenance.

```sh
sh deploy/backup.sh
docker compose run --rm --no-deps api node scripts/backup.ts verify /backups/NOM_DU_SNAPSHOT
```

Chaque base est sauvegardée avec `VACUUM INTO`, vérifiée par `PRAGMA integrity_check`, puis associée à une empreinte SHA-256. Le volume `backups` reste **sur le même serveur** : copier les snapshots vers un stockage externe chiffré, avec rétention adaptée. Les secrets `.env.production` et la clé MFA nécessitent une sauvegarde séparée. Le script ne supprime aucun ancien snapshot.

Faire un exercice de restauration dans un **nouveau volume vide**, sans toucher au volume d’origine :

```sh
docker compose stop api
ANIVAYA_DATA_VOLUME=anivaya-restored-YYYYMMDD docker compose run --rm --no-deps api node scripts/backup.ts restore /backups/NOM_DU_SNAPSHOT /data --offline
ANIVAYA_DATA_VOLUME=anivaya-restored-YYYYMMDD docker compose up -d api
curl --fail https://anivaya.com/api/health
```

Après validation, conserver `ANIVAYA_DATA_VOLUME=anivaya-restored-YYYYMMDD` dans le fichier `.env` de Compose sur le serveur ou l’environnement des futures commandes. Le serveur Node en production ne charge pas ce fichier. Pour revenir au volume initial, remettre son nom (`anivaya-data` par défaut) et recréer l’API. Ne supprimer aucun volume avant validation complète.

Vérifier un compte, un animal, un document téléchargé et une réservation après restauration. Le script refuse d’écraser un répertoire non vide et refuse les fichiers altérés. Après cet exercice, planifier `sh /opt/anivaya/front-back/deploy/backup.sh` avec l’outil d’administration du serveur et configurer une alerte en cas d’échec. La planification et le stockage externe ne sont pas encore installés.

## Vérifications avant ouverture publique

```sh
npm ci
npm --prefix front ci
npm --prefix back ci
npm run build
npm run lint
npm test
npm run test:production
```

`test:production` démarre deux fois un serveur réel en mode production sur des bases temporaires, vérifie sessions, persistance, refus du compte admin par défaut et déconnexion ; ses données légales factices restent dans ce test local. La CI vérifie aussi les images et Caddy. Elle est fournie mais n’a pas été exécutée sur GitHub tant que le code n’y est pas poussé.

Contrôler sur le vrai domaine : inscription/connexion/MFA, e-mail réel, invitation (mauvais compte/lien expiré), ajout d’animal, document et partage, visibilité QR, réservation depuis deux comptes concurrents, annulation sans faux remboursement, réouverture après redémarrage, sauvegarde/restauration, pages légales et rendu mobile. Vérifier les journaux, l’espace disque, la mémoire et mettre en place une surveillance externe de `/api/health`. La charge maximale et la délivrabilité ne sont pas certifiées par les tests locaux.

Les réservations héritées sont migrées en base centrale avant d’accepter des requêtes. Si deux vraies réservations occupaient déjà le même créneau, le démarrage échoue avec les identifiants concernés et annule la migration ; résoudre le conflit explicitement à partir d’une sauvegarde. Aucun choix de réservation à supprimer n’est automatisé.

Références techniques : [Docker multi-stage](https://docs.docker.com/build/building/multi-stage/), [dépendances et healthchecks Compose](https://docs.docker.com/compose/how-tos/startup-order/), [limites de corps HTTP Caddy](https://caddyserver.com/docs/caddyfile/directives/request_body), [jetons à usage unique OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).
