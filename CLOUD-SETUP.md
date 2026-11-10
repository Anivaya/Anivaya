# Anivaya — Vercel, Render, Supabase

Ce profil sert au démarrage gratuit et à la recette. Le frontend est sur Vercel, l’API Node sur Render, les données dans PostgreSQL Supabase et les fichiers dans un bucket privé Supabase Storage. Les e-mails utilisent **Resend HTTP** (service supplémentaire à configurer). Aucun compte cloud n’est créé et aucun déploiement n’est effectué par ces fichiers.

## 1. Supabase

### Recette limitée sans e-mails

Profil explicitement choisi pour la première mise en ligne de test : conserver `NODE_ENV=production`, définir sur Render `ANIVAYA_TESTING_PREVIEW=1`, `MAIL_PROVIDER=disabled`, `REMINDERS_MODE=disabled`. Utiliser la même origine stable `https://….vercel.app` pour APP_URL, PUBLIC_SITE_URL et ALLOWED_ORIGINS. Le domaine public est refusé dans ce mode. PostgreSQL, TLS, bucket privé, MFA et secrets du proxy restent obligatoires. Aucun contenu juridique n'est marqué relu artificiellement.

Sur Vercel ajouter `VITE_TESTING_PREVIEW=1` : bandeau FR/EN invitant à utiliser des données fictives uniquement, robots.txt et en-tête noindex. Les e-mails sont court-circuités avant tout appel réseau ou écriture de boîte locale. Les réinitialisations de mot de passe, formulaires de contact/leads, rappels planifiés et modifications administratives retournent une indisponibilité explicite. Les inscriptions/connexions et l'espace particulier restent testables. Ce mode est une recette publique, pas une restriction d'accès par mot de passe ni un lancement commercial.

Avant un lancement complet, configurer le domaine, les e-mails vérifiés et le contenu juridique relu, retirer les deux indicateurs de test, restaurer Resend et les rappels externes, puis refaire les vérifications de bout en bout.

Les comptes démo sont disponibles uniquement avec `ANIVAYA_TESTING_PREVIEW=1` dans des espaces isolés des inscriptions du site : `test@gmail.com` (test), `admin@anivaya.fr` (admin), `test.vide@anivaya.test` (test-vide), `admin.vide@anivaya.test` (admin-vide). Mot de passe commun : `Anivaya2026!`. Utiliser leur adresse e-mail dans le formulaire de connexion. Les administrateurs démo ne voient que les données fictives de leur sandbox ; les modifications administratives restent désactivées dans l’aperçu. Les comptes vides restent vides tant qu’aucune donnée n’y est ajoutée ; les données persistent entre les connexions.

Les schémas PostgreSQL démo utilisent des identifiants d’espace préfixés `preview-sample-` et `preview-empty-`, hachés comme les autres espaces privés. La base des inscriptions reste sans comptes ni rôles administrateurs par défaut. Retirer le mode aperçu désactive l’accès aux démos sans les fusionner avec les données réelles. Après un push, déclencher aussi le déploiement manuel Render si son autodéploiement reste désactivé.

Créer un projet dédié, dans une région proche de Frankfurt (Render). Exécuter `deploy/supabase-setup.sql` dans son éditeur SQL, puis définir un mot de passe fort pour le rôle `anivaya_app` et activer LOGIN comme indiqué dans le fichier.

Dans **Connect**, choisir une connexion poolée compatible IPv4 (Supavisor). Utiliser le rôle `anivaya_app` dans le nom d’utilisateur du pooler (`anivaya_app.REFERENCE_DU_PROJET` selon la chaîne affichée). Encoder les caractères spéciaux du mot de passe dans l’URL. La connexion transactionnelle est compatible : le client utilise des paramètres liés sans préparations nommées, et fixe `search_path` dans chaque transaction. Le pool applicatif est limité à quatre connexions. Les requêtes SQL et l’attente de connexion ont des délais maximum.

La vérification TLS est obligatoire en production. Ne pas ajouter `sslmode`, `ssl` ou `no-verify` dans l’URL. Le profil inclut le certificat public Supabase Root 2021 CA dans `deploy/supabase-ca.crt`, téléchargé depuis le lien du tableau de bord Supabase et vérifié sur la connexion réelle ; `DATABASE_CA_PATH=deploy/supabase-ca.crt` est configuré dans le Blueprint. Ce certificat public n’est pas un secret et expire le 26 avril 2031. Lors d’une rotation du CA par Supabase, télécharger le nouveau certificat depuis le tableau de bord et vérifier la connexion avant déploiement. Ne jamais désactiver la vérification pour contourner une erreur de certificat.

Créer le bucket **anivaya-private**, **Public désactivé**, limite de fichier 10 MB, type autorisé `application/octet-stream` (le type réel est conservé dans PostgreSQL et servi par l’API après vérification des droits). Garder les schémas `anivaya` et `anivaya_u_*` hors des schémas exposés par la Data API. Ne créer aucune politique d’accès anonyme au bucket. La clé `service_role` reste uniquement sur le backend ; jamais dans React ni une variable `VITE_*`.

Les migrations créent automatiquement le schéma central et un schéma privé par compte, avec contraintes, index, transactions et RLS activée. L’application conserve sa propre authentification ; Supabase Auth n’est pas utilisé. Le rôle backend est propriétaire de ses tables et applique les autorisations existantes. Les fichiers binaires sont remplacés dans les colonnes BYTEA par des références opaques vers Storage. Les téléchargements passent par l’API et ses contrôles de session/partage ; aucun bucket public ni lien permanent public n’est créé.

**Premier lancement : base neuve, sans démos.** Les fichiers SQLite locaux sont conservés mais ne sont pas automatiquement importés. Ne pas télécharger la base de démonstration. Si une installation possède déjà de vraies données, préparer et vérifier un import explicite avant de changer de backend.

## 2. E-mails et secrets

Créer un compte Resend, vérifier le domaine expéditeur et configurer ses DNS. Renseigner `MAIL_PROVIDER=resend`, `RESEND_API_KEY` et `MAIL_FROM`. Les ports SMTP usuels étant bloqués sur Render Free, `SMTP_HOST` n’est pas utilisé dans ce profil. L’échec du fournisseur est signalé ; aucun e-mail n’est silencieusement écrit sur la disque temporaire de Render.

Générer **trois secrets distincts** de 32 octets, chacun avec :

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Les placer respectivement dans `MFA_ENCRYPTION_KEY`, `API_PROXY_SECRET` et `CRON_SECRET`. Conserver la clé MFA durablement : la changer empêche le déchiffrement des secrets MFA existants. Ne pas envoyer les valeurs dans un chat ni les committer.

## 3. Render

Le dépôt applicatif doit avoir `front-back` comme racine de travail. Importer le Blueprint `render.yaml` depuis ce dossier ; si le dépôt Git contient un dossier parent `front-back`, sélectionner `front-back/render.yaml` comme Blueprint et régler Root Directory sur `front-back`. Pour un service créé manuellement : runtime Node 22, plan Free, build `npm ci && npm --prefix back ci`, start `npm start`, health `/api/health`, host `0.0.0.0`. Render fournit `PORT`.

Reporter les variables de `.env.cloud.example` (sauf `RENDER_API_URL`, réservé au build Vercel). `DATABASE_URL` doit pointer sur Supabase, **pas** sur un Render Postgres gratuit à durée limitée. Aucun disque Render n’est nécessaire. Le démarrage refuse le mode SQLite et le SMTP classique sur Render.

`APP_URL`, `PUBLIC_SITE_URL` et `ALLOWED_ORIGINS` doivent être la même origine HTTPS finale : `https://anivaya.com`, ou d’abord l’URL stable du projet Vercel pour une recette. Ne pas autoriser tous les sous-domaines de prévisualisation. Utiliser un projet/base distinct pour une vraie préproduction.

Compléter `deploy/legal.example.json` avec les informations réelles de l’entreprise et des prestataires, puis fournir son JSON dans `LEGAL_CONTENT_JSON`. Le serveur refuse le modèle vide ou non relu. Le paiement en ligne reste désactivé. Les fonctions IA restent désactivées sans configuration spécifique.

L’autodéploiement Render est désactivé dans le Blueprint : le premier déploiement se lance après configuration. `/api/health` reste public et vérifie PostgreSQL. Les autres routes applicatives nécessitent le secret de proxy Vercel en plus des autorisations habituelles ; une requête directe au domaine Render est refusée.

### Import IA dans la version de test

Dans Render → `anivaya-api` → Environment, renseigner `OPENROUTER_API_KEY` et
`OPENROUTER_MODEL=nvidia/nemotron-3.5-super-vl:free`. Le modèle gratuit est autorisé
uniquement en développement ou dans le profil explicite `ANIVAYA_TESTING_PREVIEW=1`.
Ce profil conserve `NODE_ENV=production`, les e-mails et les rappels désactivés,
ainsi que les contrôles TLS et de proxy. Utiliser uniquement des documents fictifs.
Hors version de test, un modèle explicite sans suffixe `:free` reste obligatoire.

Après publication de cette version du code, déployer le nouveau commit sur Render.
Pour les changements de variables seuls, « Save and deploy » applique les valeurs
à la version existante ; il ne remplace pas le déploiement du correctif de code.
La clé reste côté backend, jamais dans une variable `VITE_*` ni dans Git.

## 4. Vercel

Importer le même dépôt avec Root Directory `front-back` si nécessaire. `vercel.json` utilise le framework Other et `npm run build:vercel`. Configurer seulement :

- `RENDER_API_URL=https://LE-VRAI-NOM.onrender.com`
- `API_PROXY_SECRET`, identique à Render, en variable secrète de build.

Le build génère `.vercel/output/static` et les règles Build Output API. `/api/*` est relayé vers Render avec le secret dans un **en-tête de requête**, jamais dans le bundle public ni un en-tête de réponse. Les réponses API ne sont pas mises en cache ; `/api/internal/*` est bloqué côté Vercel. Ne pas publier `.vercel/output/config.json` comme fichier statique ou artefact public : il contient le secret de proxy. Le dossier `.vercel` est ignoré par Git.

Ce proxy conserve les URLs `/api`, les téléchargements et les cookies HttpOnly/Secure/SameSite sur la même origine. Aucun réglage CORS permissif ni cookie tiers n’est nécessaire. Vercel remplace l’en-tête X-Forwarded-For ; le backend ne fait confiance à cette chaîne que si le secret de proxy est valide.

Ajouter `anivaya.com` dans Vercel et appliquer chez one.com **les valeurs DNS affichées par Vercel**. Ne pas supprimer les MX/TXT utilisés par la messagerie. Vérifier domaine, HTTPS et variables d’origine avant de tester les connexions. Ne pas transférer le domaine pour ce seul changement.

## 5. Premier administrateur et rappels

Créer son compte depuis le site. Render Free ne fournit pas de shell : depuis un ordinateur de confiance, copier `.env.cloud.example` vers `.env.cloud.local` (ignoré), renseigner les variables backend, puis :

```sh
node --env-file=.env.cloud.local scripts/admin.ts votre-adresse "Administrateur"
```

Se reconnecter et activer MFA. Aucun mot de passe admin par défaut n’est créé.

Dans Supabase, activer les extensions pg_cron et pg_net. Ajouter dans Vault `anivaya_api_url` et `anivaya_cron_secret`, puis appliquer `deploy/supabase-reminders.sql`. La tâche horaire appelle Render directement, ce qui permet de réveiller le service. L’endpoint nécessite un Bearer distinct du proxy et refuse tout appel non autorisé. Les tâches concurrentes dans une même instance sont regroupées et chaque e-mail possède une clé d’idempotence Resend. Vérifier un rappel réel et le statut HTTP **204** dans `net._http_response` ; le simple succès SQL de cron ne prouve pas l’envoi de l’e-mail.

Ne pas ajouter de service de ping continu. Le profil reste soumis au sommeil et aux quotas gratuits ; aucune ponctualité stricte des rappels n’est promise. Une interruption de Supabase ou du fournisseur d’e-mail peut retarder les envois.

## 6. Sauvegardes, maintenance et limites

Les scripts `scripts/backup.ts` et `deploy/backup.sh` concernent **uniquement SQLite/VPS**, pas PostgreSQL/Supabase. Pour le cloud, sauvegarder les schémas `anivaya*` avec `pg_dump` (format custom) et exporter séparément les objets du bucket privé. Les sauvegardes de base ne contiennent pas les octets Storage. Conserver séparément la clé MFA et les autres secrets. Tester `pg_restore --single-transaction --exit-on-error --no-owner --no-privileges` dans un projet vide, restaurer les objets avec leurs clés exactes, puis vérifier une session, un document et une réservation. Aucune sauvegarde externe automatique n’est installée par ce changement.

Le registre `_objects` permet de retirer les anciens fichiers remplacés et les uploads dont la transaction a échoué. Après arrêt des écritures API, exécuter depuis un ordinateur de confiance :

```sh
node --env-file=.env.cloud.local scripts/storage-cleanup.ts --offline
```

Seuls les objets non référencés et âgés de plus de 24 heures sont retirés. Les documents simplement archivés restent référencés et conservés selon le fonctionnement de l’application. La suppression d’un compte supprime son schéma et ses objets privés ; ne pas lancer cette action comme test sur un vrai compte.

La couche PostgreSQL utilise un worker I/O pour préserver les transactions synchrones des repositories existants. Les requêtes de l’application restent séquentielles pendant les accès SQL : ce profil vise une seule instance et un petit trafic. Il n’y a ni réplication SQLite ni cache local considéré comme source de vérité. Une panne réseau ne provoque jamais de repli vers une base locale vide. Avant une montée en charge, mesurer les latences et migrer les repositories vers des appels asynchrones/batchés.

## 7. Vérification

```sh
npm run build
npm run lint
npm test
npm run test:production
```

Pour la recette PostgreSQL : créer une base **jetable**, définir `TEST_DATABASE_URL` vers elle et lancer `npm run test:cloud`. Cette commande crée des schémas de test ; elle ne doit jamais viser des données de production. Le serveur Storage de test est un double HTTP local, sans Supabase réel ni envoi d’e-mail. Les tests couvrent notamment les droits admin, les créneaux concurrents, l’isolation des comptes, les fichiers privés et partagés, RLS, le proxy, le cron et un redémarrage dans un nouveau processus Node.

Vérifier ensuite sur les vrais services : certificat PostgreSQL, bucket privé, DNS, cookies, invitations et reset reçus, upload de PDF et photo, partage/révocation, rendez-vous depuis deux comptes, réveil Render et rappel planifié. Les tests locaux ne prouvent pas le routage Vercel réel ni la délivrabilité Resend.

Références : [Supabase PostgreSQL](https://supabase.com/docs/guides/database/connecting-to-postgres), [Storage](https://supabase.com/docs/guides/storage/uploads/standard-uploads), [Cron et Vault](https://supabase.com/docs/guides/functions/schedule-functions), [Render Free](https://render.com/docs/free), [Vercel Build Output API](https://vercel.com/docs/build-output-api/configuration), [Vercel Hobby](https://vercel.com/docs/plans/hobby), [Resend](https://resend.com/docs/api-reference/emails/send-email). Vercel Hobby reste réservé à l’usage personnel non commercial ; Render Free est présenté par le fournisseur comme une offre de test. Ce profil gratuit n’est pas une certification de disponibilité pour un lancement commercial.
