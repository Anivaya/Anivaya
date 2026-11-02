# Vérification de l’administration — 30 octobre 2026

Les maquettes locales sont la référence confirmée par l’utilisateur. L’implémentation conserve les dossiers `front`, `back` et `shared`, les composants partagés et les bases privées existantes. Les données d’administration résident dans la base centrale, derrière les API.

## Vérifications automatisées

- `npm test` : 27 tests réussis, aucun échec. Les bases temporaires sont supprimées à la fin des tests ; la base de développement n’est pas utilisée.
- `npm run typecheck`, `npm run lint`, `npm run build` : réussis.
- Audit statique strict du périmètre défini dans `premium-ui.json` : aucune observation. Rapport : `admin-ui-audit.json`.
- `git diff --check` : aucun problème d’espacement.

Les tests HTTP couvrent notamment le refus des rôles forgés et des accès hors périmètre, les réponses privées de l’assistance, les mises à jour concurrentes, la séparation relecture/publication, la conservation de la dernière version publiée, la suspension des fiches et des réservations directes, les recours liés au bon compte et la fermeture des sessions d’un compte suspendu. La MFA est testée pour le chiffrement, la vérification du mot de passe, l’anti-rejeu et les secours à usage unique.

Après comparaison des maquettes : égalité compteurs/listes/aperçus, permissions du détail direct, filtres et cohortes synthétiques, retour converti en ticket privé, lecture des alertes par membre, historique des justificatifs, suppression de brouillon et de guide publié, édition des coordonnées synchronisée avec la connexion et refus des doublons.

La passe d’ajustements visuels vérifie aussi les tris avant pagination (professionnels, historique, alertes), l’édition des coordonnées professionnelles sans modification des justificatifs ou de la décision, les e-mails invalides et le refus du support sur cette édition.

## Vérifications dans le navigateur

Application locale sur une base distincte placée dans le répertoire temporaire, avec des comptes de démonstration. Aucun dossier métier existant n’a été modifié.

- Connexion admin et redirection vers le tableau de bord.
- Création d’un guide brouillon ; validation des champs et focus du premier champ invalide ; apparition du résultat et retour à la liste.
- Consultation et modification ; abandon confirmé ; « Continuer » conserve la saisie non enregistrée.
- Erreur réseau après redémarrage du serveur de développement puis reprise avec « Réessayer ».
- Recherche, filtre d’état, état sans résultat et effacement des filtres.
- Affichage à 390 × 844 : navigation mobile, accès au profil et à la déconnexion, focus du menu, contenu en arrière-plan inerte, défilement horizontal limité au tableau.
- Profil intégré et carte de double authentification ; l’activation MFA est couverte par les tests HTTP.
- Retour aux dimensions par défaut et capture du tableau de bord.
- Nouvelle comparaison avec le dashboard HTML de référence : quatre compteurs principaux, deux compteurs d’état, ajouts complémentaires conservés et scrollbar du sidebar masquée.
- Professionnels → aperçu de cinq dossiers sur six → dossier → justificatif → dossier → aperçu. Retour clavier au déclencheur ; repli sur le titre quand la notification lue a disparu de la liste.
- Lien vers la liste complète avec provenance/filtre ; lien depuis les demandes du dashboard vers un dossier précis ; action directe de modification avec validation du motif puis succès.
- Pilotage : sélection explicite des exemples, cinq ratios, filtres Lyon/Direct donnant quatre foyers et tableau des cohortes correspondant.
- Cloche : lecture d’une notification, compteur actualisé, retour à l’aperçu, liste filtrée par catégorie Imports sans résultats. Menu du compte et onglets Profil/Sécurité vérifiés.
- Passe suivante : comparaison côte à côte des formulaires Professionnels et du Pilotage avec leurs HTML de référence ; menu du compte dans le header ; cycle de tri croissant/décroissant/normal ; focus clavier de Demandes vers Imports IA ; ouverture et fermeture des deux sections d’explication du Pilotage.

Le sélecteur d’état utilise le contrôle natif : sa sélection est vérifiée, mais son popup système n’est pas visible dans la capture du navigateur. Il ne s’agit pas d’un audit exhaustif des anciennes pages ni d’une comparaison visuelle pixel par pixel.

La vérification mobile à 390 × 844 ci-dessus appartient à la première passe. Lors de la reprise des aperçus, la commande de redimensionnement est restée sans effet (dimensions DOM 1280 × 720) : les nouveaux dialogues n’ont donc pas été revérifiés sur mobile. Le contrôle final de cette reprise porte sur ordinateur. Le serveur d’aperçu isolé a été redémarré après le formatage pour évacuer un module Vite mis en cache pendant son écriture.

## Limites explicites

Dernier ajustement visuel : profil déplacé dans le pied fixe du sidebar, popup ouvert et entièrement visible vers le haut ; header avec cloche seule ; logo et lettrage intégrés contrôlés dans le navigateur. PNG RGBA avec alpha 0–255 et 722 422 pixels entièrement transparents. Icône d’actualisation remplacée par un arc continu arrondi. Compilation, TypeScript et lint réussis. Aucun changement d’API pour cette passe.

Asset : `front/public/images/logo-anivaya-wordmark.png`, préparé avec l’outil intégré image_gen à partir du fichier fourni, sans écraser l’original. Prompt utilisé : « Edit target: the supplied Anivaya logo. Remove only the background and edge background contamination, producing genuine transparent alpha outside the logo and inside the openings in the letters. Preserve exactly the original yellow dog / blue cat artwork, white facial details, colors, shape, proportions and original rounded blue ANIVAYA wordmark beneath it. Do not redesign, retype or replace the letters. No white or grey backdrop, no shadow, no additional content. Keep the entire logo and wordmark visible. »

Les professionnels et leurs disponibilités restent fictifs. Les justificatifs professionnels sont contrôlés manuellement ; aucun registre officiel n’est connecté. Les annonces sont consultables dans l’application, sans diffusion externe. L’e-mail, le paiement réel, l’extraction IA et les mesures de rétention ne sont pas configurés. La suppression personnelle existante reste en libre-service et alimente un journal anonymisé ; il n’y a pas de suppression administrative arbitraire d’un compte tiers.

Les écarts fonctionnels ne se limitent pas aux services externes. Le détail page par page, y compris les fonctions actives non reprises et celles désactivées dans les maquettes, est dans [ADMIN-MAQUETTES.md](ADMIN-MAQUETTES.md). La suppression définitive des nouveaux exemples a été vérifiée par tests HTTP sur bases jetables ; le navigateur a servi à la consultation, à l’édition et aux transitions, sans supprimer de données existantes.
