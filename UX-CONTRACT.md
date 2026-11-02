# Contrat des interfaces Anivaya

Références : maquettes locales confirmées par l’utilisateur, `back/docs/API.md`, composants partagés et parcours profil/documents existants. Locale : français, données calendaires métier en Europe/Paris. Structure React → API Node → SQLite conservée.

## Canonical UI Map

| Capability      | Canonical owner                                   | Source of truth                              | Allowed variants                                    | Verification                              |
| --------------- | ------------------------------------------------- | -------------------------------------------- | --------------------------------------------------- | ----------------------------------------- |
| Table Selection | AdminCollection (pas de sélection multiple admin) | Ce contrat                                   | Consultation et pagination                          | Vérification navigateur, tests API        |
| Select/Listbox  | Élément select natif, Field pour la validation    | Composants existants                         | Popup du système accepté                            | Clavier et état ouvert dans le navigateur |
| Date            | Input date natif                                  | Validation serveur et Field                  | Calendrier du navigateur accepté                    | Validation API                            |
| Form            | shared/forms/SubmissionForm.tsx et Field          | Ce contrat                                   | Création, modification, confirmation                | Erreurs HTTP et focus navigateur          |
| Scrollbar       | css/global.css ; exception sidebar dans admin.css | Demande utilisateur du 30 octobre, DESIGN.md | Barre du sidebar admin masquée, défilement conservé | Vue ordinateur et mobile                  |
| Toast           | Message local role=status, erreur role=alert      | Parcours existants                           | Succès après mutation, erreur persistante           | Vérification navigateur                   |
| CRUD            | shared/services/admin.ts, back/api/admin.ts       | back/docs/API.md                             | Retour à la liste, filtres conservés                | back/tests/admin.test.ts                  |

## Parcours

- Création/modification : formulaire → requête unique pendant l’enregistrement → confirmation → même liste et mêmes filtres. Une erreur conserve la saisie.
- Consulter un dossier métier ne le modifie pas. Ouvrir une notification depuis la cloche la marque comme lue pour ce membre. Une action de décision, de rôle, de suspension, de publication ou de révocation est confirmée par le formulaire qui nomme la cible et exige un motif.
- Indicateur → `AdminPreview` (cinq dossiers et total API) → `AdminDialog` → retour à l’aperçu et focus du déclencheur. Si la ligne a disparu, le focus revient au titre de l’aperçu. La liste complète conserve le filtre et un lien de retour au dashboard. Les détails accessibles par `record` utilisent la même autorisation serveur que les listes.
- Notifications : état de lecture par membre, filtres catégorie/état et action collective limitée à ses alertes autorisées. Les alertes sont calculées depuis les dossiers en attente et disparaissent après résolution ; ce n’est pas un journal indépendant.
- Pilotage : la source installation ne présente aucun ratio sans données historiques. La source maquette est un jeu synthétique explicitement étiqueté, calculé et filtré côté API.
- Les mises à jour transmettent la version lue ; une version périmée reçoit 409. Fermer le dossier et actualiser permet de reprendre sans écraser la modification concurrente.
- Recherche admin temporisée de 300 ms, interrompue pendant la composition IME ; les anciennes réponses sont annulées. Recherche, état, tri, page et taille sont conservés dans la route hash existante. Les champs de recherche publics restent locaux, sans persistance de données personnelles dans l’URL.
- Les listes admin sont paginées par l’API (10, 20 ou 50). Les paramètres invalides sont bornés. Le focus clavier reste visible et les tableaux ont une région de défilement identifiable.
- Les tris nom/date sont effectués avant la pagination, avec un bouton icône à trois états et `aria-sort`. Le retour à l’ordre normal retire les paramètres de tri ; pour les signalements, il rétablit la priorité des dossiers ouverts et urgents. Les cohortes, déjà agrégées, se trient localement.
- L’édition des coordonnées professionnelles (nom, e-mail, ville, catégorie, présentation) est distincte de l’examen (SIRET, état, justificatifs). Une édition ordinaire conserve la décision et ses pièces. Le journal consigne automatiquement l’édition des coordonnées ; les décisions et changements d’accès gardent un motif explicite.
- `AdminIconButton` fournit les actions des tableaux et les croix de fermeture, avec nom accessible, infobulle et focus visible. `Tabs.animated` et `AdminDisclosure` fournissent les transitions demandées, désactivées en mouvement réduit. Les sections d’explication fermées sont inertes et masquées aux lecteurs d’écran.
- Les droits viennent de la session et de la base centrale. Le frontend ne constitue jamais une autorisation. Un compte particulier ne peut pas attribuer de rôle à l’inscription.
- Les guides doivent être relus par un vétérinaire référent avant publication par un administrateur. Une nouvelle version en cours ne retire pas la dernière version publiée.
- Contact, signalements, recours et retours sont persistés côté serveur. Le suivi personnel ne renvoie que les dossiers du compte authentifié. Aucun suivi public par simple adresse e-mail.
- Les anciennes fonctionnalités particulières, dont la suppression de compte en libre-service, restent présentes. Les paiements, réservations et imports IA conservent leur caractère de démonstration tant qu’aucun fournisseur réel n’est configuré.
- La MFA repose sur TOTP, pas sur le code fixe de la maquette. Activation et modification exigent le mot de passe courant ; les codes de secours ne sont affichés qu’à leur génération. Les autres sessions sont révoquées lors d’un changement de MFA.

## Périmètre de vérification

Le manifeste `premium-ui.json` audite les nouveaux écrans admin et leurs styles. La vérification des pages existantes modifiées utilise le typage, le lint, les tests HTTP et la revue des parcours dans le navigateur. Elle ne constitue pas un audit complet de tous les écrans historiques.
