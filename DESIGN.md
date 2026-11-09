---
version: alpha
name: Anivaya
description: Carnet animalier et administration, fidèles aux maquettes locales.
colors:
  primary: "#1b3b8e"
  navy: "#132e5c"
  accent: "#f0ab06"
  muted: "#65748b"
  pale: "#edf4fc"
  border: "#e1e7f0"
  surface: "#ffffff"
  background: "#f4f7fc"
  success: "#286348"
  danger: "#a52b38"
typography:
  sans:
    fontFamily: "Anivaya Nunito, Segoe UI, sans-serif"
  mono:
    fontFamily: "ui-monospace, monospace"
rounded:
  DEFAULT: "8px"
  card: "14px"
spacing:
  sidebar: "220px"
  page-max: "1500px"
  page-padding: "34px"
components:
  button: {}
  card: {}
  dialog: {}
  table: {}
---

# Anivaya Design System

## Overview

### Creative North Star

Les maquettes HTML `maquette/admin`, `maquette/particulier` et `maquette/public` sont la référence confirmée par le propriétaire du projet. Conserver le logo chien/chat, Nunito, les bleus et les accents dorés. Les cartes blanches arrondies et les icônes au trait accompagnent les tâches quotidiennes sans changer l’identité existante.

### Product context and register

Synchronisation du 6 novembre 2026 : l’accueil suit `maquette/source/front/src/pages/home` (accroche « Toute leur vie, à vos côtés », téléphone Nala/Milo, offres et trois parcours professionnels). `pages/home/landing.css` possède la composition publique ; `css/harmony.css` aligne les contrôles et les en-têtes ; `css/footer.css` rassemble les styles du composant `PublicFooter` et conserve la position du pied commun avec les espaces connectés. Les images sont des fichiers dans `public/images/home`, le contenu statique est du JSX et les formulaires sont des composants React. La police locale et les couleurs existantes sont réutilisées. Le défilement public appartient désormais au document : le suivi global de `shared/scrollbars.ts` conserve la préférence utilisateur. La molette conserve le défilement natif dans les sections longues. À leur bord, elle bascule vers la section voisine, avec la durée et la vitesse du défilement doux du navigateur, sans minuterie imposée. Les ancres conservent le défilement doux et respectent la réduction des animations. Les liens Contact et Informations restent accessibles dans les menus mobiles lorsque le pied de page est masqué, conformément à la maquette.

Interface française destinée aux propriétaires d’animaux et à l’équipe du service. Les écrans d’administration sont des outils de gestion, utilisables sur ordinateur et sur téléphone. Ils donnent priorité aux dossiers, décisions motivées et accès par rôle. Les pages publiques restent dans leur registre de présentation.

Cette documentation décrit les tokens existants ; elle ne les génère pas. `front/src/css/global.css` est propriétaire des couleurs, de la police et des contrôles communs. `dashboard.css` possède la structure des espaces. `admin.css` étend cette structure et définit les tons succès/danger des badges admin. Aucun nouveau système CSS ni composant de bibliothèque n’est introduit.

## Colors

Bleu principal pour les actions et la sélection, bleu marine pour les titres, gris bleuté pour les indications. Le doré conserve son rôle de focus. Les badges portent toujours un libellé en plus de leur couleur. Thème clair ; les préférences de contraste du navigateur restent utilisables.

## Typography

Nunito locale, poids 600, 700 et 800, avec Segoe UI comme repli. Titres admin de 34 px sur ordinateur, 28 px sur petit écran. Texte de tableau 13 px ; libellés et métadonnées 12 px. Les longs noms et messages peuvent revenir à la ligne. Les codes techniques utilisent une police monospace.

## Layout

La barre latérale de 220 px et la navigation réutilisent `Sidebar`. Le contenu admin possède une largeur maximale de 1500 px et un retrait de 34 px, réduit à 16 px sur mobile. Sous 1024 px (tablette et mobile), la barre devient un panneau qui s’ouvre depuis la gauche, par le bouton menu placé à gauche du header, à la place du logo (espace particulier et administration). Les tableaux défilent horizontalement dans leur propre région ; les formulaires et les pages conservent le défilement naturel. Les cartes du tableau de bord s’adaptent à la largeur disponible.

Exception demandée explicitement par l’utilisateur le 30 octobre : la liste des liens du sidebar admin possède son propre défilement invisible (`overflow-y: auto`, `scrollbar-width: none`) ; le logo et le nom ANIVAYA restent fixes. Le clavier, la molette et le tactile continuent à faire défiler les liens. Même exception pour les listes Signalements et Demandes du dashboard, limitées à 340 px. Le comportement commun des barres est décrit ci-dessous.

PC, tablette et mobile, demande du 6 novembre : `scrollbars.css`, chargée en dernier, masque toutes les barres internes sans modifier les débordements. La barre de la page principale reste transparente au repos et utilise le gris bleuté existant pendant le défilement. Sa largeur réservée reste constante pour éviter un décalage. `shared/scrollbars.ts` ne suit que le document et le conteneur principal de l’accueil (`data-page-scroll`), jamais les formulaires, onglets ou dialogues. La barre disparaît en fin de défilement, avec un repli de 900 ms sans mouvement.

Dans l’administration, comme dans l’espace particulier, le menu du compte est en bas du sidebar sur ordinateur, et seulement dans le header (avatar seul, à droite du bouton de navigation, popup vers le bas) sous 1024 px. Le header admin reprend celui de l’espace particulier : collant et translucide, fil d’Ariane « Administration » en gras, cloche dans un cercle blanc bordé, avec le badge de non-lus en bas. Titres de page, introductions, panneaux et champs utilisent les mêmes tailles, rayons et bordures que l’espace particulier. Le sidebar ne contient plus de titre Administration ni de retour à l’espace particulier, et le menu du compte ne propose plus de basculer entre l’espace particulier et l’administration (ni « Administration », ni « Mon espace »). Le logo du sidebar, particulier comme admin, utilise l’image transparente avec son lettrage ANIVAYA intégré (`logo-anivaya-wordmark.png`), sans titre HTML ajouté. Équipe précède Publications, et Pilotage précède Historique. Tous les onglets de page (`.page-tabs`, dans `global.css`) sont centrés et reprennent le style de la page Partage : texte gris de 14 px (12 px sur mobile), onglet actif bleu en gras souligné d’or. Les filtres, la recherche et les actions sont intégrés au panneau du tableau, au-dessus du compteur de résultats.

## Elevation & Depth

Surfaces blanches, bordures fines et ombre légère uniquement sur les éléments interactifs. Le tableau reste plat ; l’élévation distingue les dialogues des pages. Pas de décor ou d’animation qui concurrence les décisions.

## Shapes

Champs à rayon de 8 px, panneaux à 14 px, badges en capsule. Icônes au trait dans des carrés arrondis bleu pâle. Ces valeurs suivent les maquettes et la grammaire existante.

## Components

### Foundational visual states

Chargement textuel dans une zone réservée, erreurs persistantes avec reprise, état vide explicatif, focus visible. Les contrôles occupés restent désactivés jusqu’à la réponse de l’API. Les états ne sont pas simulés par temporisation.

Les listes et blocs vides utilisent `shared/ui/EmptyState.tsx` : à la demande de l’utilisateur le 5 novembre, l’illustration, un titre et une courte explication sont centrés dans l’emplacement du contenu, sans bouton. Les actions, compteurs, sélections, tableaux et paginations sans données disparaissent ; titres et navigation restent présents. Les filtres restent accessibles pour une recherche sans résultat sur une collection existante. `EmptyIllustration.tsx` associe les neuf thèmes aux PNG transparents de `front/public/images/empty-state` (gamelle, personnes, documents, actions, conversations, événements, communautés, rappels et données) avec un texte alternatif vide : le message accessible est porté par le texte visible de `EmptyState`. `global.css` possède leurs dimensions adaptatives ; les tailles standard (image 148 px, zone minimale 260 px) et compacte (104 px, 190 px) servent aux pages et cartes ; elles diminuent sur mobile. Les petits indicateurs conservent le cadre `admin-stat` et utilisent une image de 72 px sans hauteur minimale, les lignes de synthèse une image de 32 px. Titres et descriptions utilisent respectivement 15 et 13 px, avec un titre de 13 px pour les indicateurs. Les listes remplies gardent leur contenu habituel. Le chargement, les erreurs et les accès indisponibles conservent leurs messages et actions de reprise.

### Buttons and actions

Réutiliser `.button`, `.outline` et `.danger`. Les actions destructives ou modifiant un accès passent par un formulaire explicite avec motif. Le bouton secondaire annule ; les libellés décrivent l’action.

À la demande de l’utilisateur, `AdminIconButton` possède les actions compactes des tableaux et leurs infobulles/noms accessibles. Le tri parcourt normal → croissant → décroissant → normal. Les fermetures en haut des dialogues utilisent un cercle rouge avec une croix ; les retours utilisent une flèche. Les boutons de confirmation des formulaires conservent un verbe explicite. Toutes les actions de suppression ou de retrait (supprimer, retirer, révoquer, refuser, annuler une invitation) sont en rouge, partout (`isDangerAction` dans `config.ts`) ; « Retirer de la publication » utilise l’œil barré pour se distinguer de « Consulter ». Les actions de suppression et de retrait sont toujours placées en dernier, à droite de la ligne (tri dans `actionsFor`, bouton poussé à droite dans le pied des dialogues). Une ligne de tableau ne montre jamais deux icônes identiques pour deux actions différentes. La première colonne des tableaux porte le nom de l’objet : Compte (comptes et demandes de suppression), Identité, Demande, Importation, Retour, Recours, Établissement, Annonce, Contenu, Historique. Les trois dernières colonnes (État, date, Actions) restent compactes et l’espace restant va aux colonnes de texte ; l’en-tête Actions est aligné à droite. Sous 1024 px, les cellules et les boutons d’action sont resserrés et les en-têtes peuvent passer à la ligne, pour que les tableaux tiennent sur tablette (Modération, à sept colonnes, défile horizontalement). Le contenu de la gestion de profil admin est centré dans la page.

Couleurs de l’administration (palette du dossier stratégique, issue du logo : bleu #1B3B8E, or #F0AB06, bleu foncé #132E5C, blanc, bleu-gris #65748B) : lien actif du sidebar en bleu plein avec texte et icône or (aussi dans l’espace particulier, `dashboard.css`) ; trait or sous le titre de chaque page ; indicateurs du tableau de bord et du Pilotage en alternance or / bleu (bordure haute, pastille d’icône, jauge), bordure de leur couleur au survol ; indicateurs tous sur une ligne au-delà de 1280 px, moitié par moitié en dessous (tablette comprise), deux par deux sur mobile, lignes incomplètes centrées (`indicatorColumns`) ; marge intérieure de 12 px autour des dossiers en attente pour décoller les bulles d’état du bord ; bandeau « Activation et rétention » en dégradé bleu → bleu foncé avec bouton or ; lignes d’indicateurs avec un filet or à gauche et le nombre en bleu ; en-têtes de colonnes bleu pâle, en-têtes de ligne (Cohorte) sur fond blanc ; boutons des tableaux sur fond blanc, fond bleu pâle et bordure bleue au survol ; tableau des cohortes en six colonnes de même largeur. Les badges d’état suivent `statusTone` (`config.ts`) : or pour ce qui attend une action (« À … », Ouvert, Nouveau, Invité, Brouillon, En cours), vert pour ce qui est terminé, rouge pour ce qui bloque, bleu sinon. L’or n’est jamais utilisé pour du texte fin sur blanc. Sous 1024 px, les textes trop longs des tableaux Équipe et Retours utilisateurs se terminent par « … ». La gestion de profil admin présente une seule ligne d’onglets (Profil, Notifications, Sécurité, Exportation, Suppression du compte), comme l’espace particulier.

### Navigation and data display

`Tabs` possède la navigation clavier. `AdminCollection` possède les tableaux avec recherche, filtre d’état, tri, pagination et URL restaurable. Les résultats viennent de l’API et les états de concurrence sont vérifiés au serveur.

### Forms and overlays

`SubmissionForm`, `Field` et `Modal` sont les propriétaires partagés. Les champs select et date restent natifs : la géométrie des menus du système est acceptée, comme dans les pages existantes. Pas de double composant de sélection. Saisie conservée après erreur, champ invalide identifié, focus restauré après fermeture. Les brouillons admin préviennent avant abandon.

### Iconography

`shared/ui/Icon.tsx`, SVG au trait, généralement 22 px, accompagné de texte pour les actions métier.

### Motion

Pas d’animation de compteurs admin. Les réglages de réduction du mouvement existants s’appliquent ; les décisions et états changent immédiatement.

Variante `Tabs.animated` : transition de panneau de 160 ms vers la droite ou la gauche selon l’ordre des onglets. `AdminDisclosure` possède les sections d’explication de Pilotage, avec ouverture et fermeture de 160 ms. Dans Pilotage, changer un filtre garde les chiffres affichés pendant le chargement, puis les pourcentages défilent vers leur nouvelle valeur en 600 ms. Les deux effets respectent `prefers-reduced-motion`.

### Content and data visualization

Français simple, dates françaises. Les indicateurs sont calculés à partir des données présentes, sans faux taux d’activation ou de rétention. Les services externes absents sont indiqués dans les parcours concernés et la documentation.

Les quatre cartes principales du dashboard et les deux compteurs d’état suivent la maquette. Les ajouts appréciés par l’utilisateur restent dans « Suivi complémentaire ». `AdminPreview` possède la fenêtre des cinq premiers résultats ; `AdminDialog` possède le dossier et ses actions. Pilotage reprend le panneau unique, les cinq cartes bleu pâle, les définitions et les cohortes de la maquette. La source synthétique se sélectionne dans « Démonstration locale » et reste distincte des mesures de l’installation. Les écarts fonctionnels restants sont recensés dans `back/docs/ADMIN-MAQUETTES.md`.

Espace particulier, accents de la charte repris de l’administration (dans `dashboard.css` et `directory.css`) : trait or sous chaque titre de page (`.welcome h1`) ; cartes des animaux et des professionnels bordées en haut en alternance or / bleu (pour les animaux, la couleur suit le rang de l’animal dans la liste, classe `accent-blue`, et le garde quand le carrousel défile), pastille d’icône des professionnels pleine de la même couleur et bordure de cette couleur au survol ; filet or à gauche des rappels (neutre une fois fait) ; bordure haute bleue sur « Documents récents » et sur le panneau « Mes animaux » vide (même cadre blanc arrondi, titre inclus ; sur ordinateur, le décalage supérieur de la colonne Documents est retiré dans cet état pour aligner les deux titres) ; encart « Un dossier, vos choix. » en bandeau dégradé bleu → bleu foncé avec cadenas sur pastille or.

Mobile (≤ 620 px), après audit de toutes les pages : aucun texte sous 11 px ; champs et listes en 16 px (pas de zoom automatique sur iPhone) ; onglets de page sur une seule ligne, centrés, qui défilent horizontalement s’ils sont trop nombreux (Gestion de profil) ; boutons des titres de page en pleine largeur, deux par deux quand il y en a deux (Importer avec l’IA, Ajouter…) ; boutons d’enregistrement du profil et de l’import IA empilés en pleine largeur ; filtres de l’annuaire un par ligne ; dans Communautés, recherche sur sa ligne puis filtre et « + », une carte par ligne, « participants » / « membres » sous l’organisateur ou les avatars, en-tête de discussion sur deux lignes (titre, puis actions) ; cases à cocher et boutons de tri d’au moins 24 et 32 px ; points de navigation de l’accueil masqués. Le champ fichier natif de l’import IA est masqué à toutes les tailles : l’étiquette « Sélectionner un fichier ou le déposer ici » sert de bouton. La liste des prestations d’une réservation affiche « nom · prix », la durée est indiquée dessous.

Communautés sur mobile : la recherche et le bouton « + » partagent la première ligne, le filtre est en dessous. Discussion ouverte (≤ 800 px) : le nom à droite du bouton retour, puis l’icône et le nombre de participants à gauche, les actions à droite. Annuaire : le favori activé est rose (cœur rose, fond rose pâle) ; le survol ne change que la bordure, et seulement avec une souris, pour que l’icône redevienne blanche dès qu’on retire le favori, y compris sur mobile. Mobile : « Associer aux animaux », « Ajouter une personne » (Partage) et « Supprimer mon compte » sont centrés.

Fiche d’un animal : le badge « Dossier privé » vient en dernier, après l’éventuel message de profil incomplet ; les boutons d’action (fiche d’urgence, modifier, importer, supprimer) sont centrés sur tablette et deux par deux sur mobile. Partage avec moi, fiche reçue sur mobile : photo en haut à gauche, statut en haut à droite, informations en dessous. Messagerie : l’aide « Entrée / Maj + Entrée » est centrée ; sur mobile, le bouton Envoyer reste à droite. Interrupteurs (préférences de notification) : la pastille glisse avec un ✕ gris (désactivé) ou un ✓ bleu (activé) et s’étire pendant l’appui. Cases de choix (exportation, confirmation de suppression, visibilité de la fiche d’urgence) : la case se remplit de bleu et la coche apparaît en rebondissant. Aucune surbrillance native au toucher (`-webkit-tap-highlight-color: transparent`). Ces règles valent aussi pour la gestion de profil de l’administration, qui reprend la même page.

Tablette et mobile : tous les boutons texte (`.button`) ont la même hauteur (44 px) et la même taille de texte (13 px en tablette, 12 px en mobile) sur toutes les pages et pour tous les rôles ; seul le « + » carré de Communautés garde sa taille. Mobile : les groupes de boutons sont centrés, y compris les boutons des fenêtres (Annuler, Ajouter…), ceux des en-têtes de section de la fiche d’un animal et les actions d’un dossier admin. Fiche d’un animal ouverte depuis le tableau de bord (sans fiche d’urgence) : un seul bloc, l’identifiant en haut et la race en dessous. Un rafraîchissement rouvre toujours la page en haut (`history.scrollRestoration = "manual"`) ; les discussions se placent elles-mêmes sur leurs messages.

Les onglets du navigateur utilisent le format « Anivaya · Nom de la page », piloté par `shared/layout/startPageTitles.ts` et la table de titres pure `pageTitle.ts`. Le favicon SVG reprend celui de la maquette.


Sélection de langue (6 novembre) : `shared/ui/LanguageMenu.tsx` propose Français (par défaut) et English, avec une icône globe. Le choix commun est mémorisé dans le navigateur via `shared/language.ts` ; les pages d’accueil sont traduites en anglais et les images restent inchangées. Le contrôle figure à gauche de la connexion publique, entre Accueil/Espace et Gestion de profil dans le menu du compte, et au-dessus des notifications dans l’onglet Préférences (ancienne clé de route `notifications` conservée). Le survol ouvre temporairement le sous-menu ; un clic le maintient ouvert jusqu’au clic suivant sur le déclencheur, à un clic extérieur ou à Échap. La navigation clavier utilise les flèches, Début et Fin. La flèche du choix de langue est masquée lorsque le menu du compte se trouve en haut à droite ; elle reste visible dans le sidebar. Le menu public se déploie en bas à droite ; celui du compte se déploie à droite du sidebar, à gauche et vers le bas depuis l’en-tête, avec repli dans la largeur disponible sur téléphone.

Sur tablette et mobile, l’avatar seul suit immédiatement la cloche dans l’espace particulier ; il reste après le bouton de navigation dans l’administration et sur l’accueil. Les liens Informations du service et Nous contacter sont absents des menus et du pied de page pour un administrateur connecté. Informations du service reçoit l’icône d’information dans les menus.


Traductions (9 novembre) : l’accueil et toutes les pages de l’espace particulier utilisent les catalogues FR/EN de `GET /api/translations?scope=home|particular&lang=fr|en`. Le français reste la langue par défaut. `App` fournit le contexte commun ; connexion et administration restent en français. React met en cache les catalogues par périmètre et langue, regroupe les requêtes simultanées et charge le même catalogue local uniquement en secours si l’API échoue ou dépasse cinq secondes. Les sources versionnées sont dans `shared/translations/`. Les noms des animaux, documents et personnes, les messages et les contenus saisis ne passent pas dans le traducteur ; les phrases dynamiques utilisent des paramètres insérés après traduction. Aucun contenu personnel n’est envoyé à un service de traduction. Les valeurs de formulaires et filtres envoyées à l’API restent identiques. Les dates affichées, titres d’onglet et libellés accessibles suivent la langue. Changer de langue conserve les saisies et la structure des composants, le design et les images.

Ajustements du 9 novembre : le sélecteur de langue public est centré dans l’espace entre les liens de navigation et la connexion sur ordinateur. Le menu public mobile/tablette commence à 8 px sous l’en-tête et resserre le padding vertical des liens à 0,625 rem. La gestion de profil est centrée dans sa zone de contenu (largeur maximale de 940 px), avec une action extérieure seule centrée et les paires d’actions réparties à gauche et à droite, y compris sur mobile ; les textes et champs des panneaux gardent leur alignement intérieur. La navigation publique reste centrée entre le logo et la connexion ; la langue occupe le milieu de l’espace libre à sa droite, sans déplacer le logo ni la connexion. Le message « Vos paramètres sont à jour » est retiré ; l’avertissement de modifications non enregistrées reste présent.
