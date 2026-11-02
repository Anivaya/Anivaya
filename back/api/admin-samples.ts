import { randomBytes, randomUUID } from "node:crypto";
import type { Database } from "../database/types.ts";
import type { Account, Authentication } from "./auth.ts";
import type { AdminRecord, AdminResource } from "../../shared/admin.ts";
import { transaction } from "../database/connection.ts";

const day = 86400000;
const firstNames = [
  "Claire",
  "Julien",
  "Inès",
  "Thomas",
  "Léa",
  "Hugo",
  "Sarah",
  "Nicolas",
  "Manon",
  "Karim",
  "Chloé",
  "Antoine",
  "Emma",
  "Mehdi",
  "Camille",
  "Louis",
  "Zoé",
  "Yanis",
  "Juliette",
  "Paul",
  "Alice",
  "Rayan",
  "Margaux",
  "Théo",
];
const lastNames = [
  "Dubois",
  "Moreau",
  "Laurent",
  "Garcia",
  "Roux",
  "Fournier",
  "Girard",
  "Bonnet",
  "Mercier",
  "Benali",
  "Lambert",
  "Faure",
  "Rousseau",
  "Haddad",
  "Blanc",
  "Guerin",
  "Muller",
  "Chevalier",
  "Perrin",
  "Morel",
  "Giraud",
  "Mathieu",
  "Clement",
  "Gauthier",
];
const cities = [
  "Lyon",
  "Villeurbanne",
  "Caluire-et-Cuire",
  "Vénissieux",
  "Bron",
];
const origins = [
  "Partenaire vétérinaire",
  "Réseaux sociaux",
  "Bouche-à-oreille",
  "Direct",
];
const pets = [
  ["Rex", "Chien", "Labrador"],
  ["Mina", "Chat", "Européen"],
  ["Oslo", "Chien", "Berger australien"],
  ["Pixel", "Chat", "Maine coon"],
  ["Ficelle", "Chien", "Jack Russell"],
  ["Sushi", "Chat", "Siamois"],
] as const;
/** Ancienneté de chaque foyer d’exemple, en jours : une à trois inscriptions par mois sur onze mois. */
const ages = [
  4, 9, 15, 22, 28, 36, 44, 52, 63, 75, 88, 97, 110, 124, 139, 151, 168, 182,
  197, 214, 236, 258, 281, 305,
];

/**
 * Foyers d’exemple de l’installation (identifiants `sample-…`, adresses en `.example`),
 * sans mot de passe utilisable : ils alimentent Utilisateurs et le Pilotage.
 */
export const sampleHouseholds = ages.map((age, i) => ({
  id: `sample-${String(i + 1).padStart(2, "0")}`,
  name: `${firstNames[i]} ${lastNames[i]}`,
  email: `${firstNames[i]}.${lastNames[i]}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .concat("@foyers.example"),
  city: cities[i % cities.length],
  origin: origins[i % origins.length],
  age,
  index: i,
}));

/** Origine d’un foyer d’exemple pour le filtre « Origine » du Pilotage. */
export const sampleOrigin = (account: string) =>
  sampleHouseholds.find((h) => h.id === account)?.origin;

interface SeedContext {
  db: Database;
  auth: Authentication;
  admin: string;
  ago: (days: number, hours?: number) => string;
  entry: (
    days: number,
    action: string,
    note: string,
    actor?: string,
  ) => { date: string; actor: string; action: string; note: string };
  insert: (
    kind: AdminResource,
    data: Pick<AdminRecord, "name" | "status"> & Partial<AdminRecord>,
    id: string,
    at: string,
  ) => unknown;
  update: (
    kind: AdminResource,
    id: string,
    patch: Partial<AdminRecord>,
    at: string,
  ) => void;
  audit: (
    days: number,
    kind: AdminResource,
    target: string,
    action: string,
    note?: string,
  ) => void;
}

/**
 * Carnets d’un foyer d’exemple : animaux, rappels et journal d’activité datés depuis
 * l’inscription. Les déclencheurs datent l’activité d’aujourd’hui : elle est remplacée.
 */
function fillWorkspace(
  own: Database,
  household: (typeof sampleHouseholds)[number],
  signup: number,
  now: number,
) {
  const i = household.index;
  const at = (days: number) =>
    new Date(Math.min(now - 3600000, signup + days * day)).toISOString();
  const after = (days: number) => signup + days * day < now;
  const activated = i % 4 !== 3,
    complete = activated || i % 5 === 0,
    scheduled = i % 4 !== 1;
  own
    .prepare("UPDATE user_profile SET name=?,email=?,city=? WHERE id=1")
    .run(household.name, household.email, household.city);
  const count = i % 3 === 0 ? 2 : 1;
  for (let n = 0; n < count; n++) {
    const [name, species, breed] = pets[(i + n * 3) % pets.length];
    const animal = `${household.id}-${n + 1}`;
    own
      .prepare(
        "INSERT INTO animals(id,name,species,description,style) VALUES (?,?,?,?,'new')",
      )
      .run(animal, name, species, `${breed} · ${1 + ((i + n) % 9)} ans`);
    own
      .prepare(
        "INSERT INTO animal_profiles(animal,breed,dob,identifier) VALUES (?,?,?,?)",
      )
      .run(
        animal,
        breed,
        complete ? `${2016 + ((i + n) % 9)}-0${1 + (i % 9)}-12` : "",
        complete ? `250269${String(600000000 + i * 1000 + n).slice(0, 9)}` : "",
      );
    own
      .prepare(
        "INSERT INTO reminders(id,name,animal,date,done) VALUES (?,?,?,?,?)",
      )
      .run(
        randomUUID(),
        "Vaccin annuel",
        animal,
        new Date(now + (5 + ((i * 7) % 60)) * day).toISOString().slice(0, 10),
        scheduled ? 0 : 1,
      );
    own.prepare("DELETE FROM activity WHERE animal=?").run(animal);
    const log = own.prepare("INSERT INTO activity VALUES (?,?,?)");
    log.run(animal, "animal-created", at(0.02));
    if (complete) log.run(animal, "profile", at(activated ? 1.5 : 11));
    log.run(animal, "reminder-created", at(activated ? 3 : 12));
    // Rétention : interactions dans les fenêtres J30–J59, M3 et M6, selon le foyer.
    if (i % 5 !== 4 && after(40)) log.run(animal, "event", at(40));
    if (i % 3 !== 2 && after(100)) log.run(animal, "document", at(100));
    if (i % 2 === 0 && after(190)) log.run(animal, "reminder", at(190));
    // Suivi actif : une interaction dans les 30 derniers jours.
    if (scheduled && i % 6 !== 5)
      log.run(
        animal,
        "reminder",
        new Date(
          Math.max(signup + day, now - (1 + (i % 20)) * day),
        ).toISOString(),
      );
  }
}

/**
 * Données d’exemple supplémentaires pour toutes les pages de l’administration :
 * foyers datés pour le Pilotage, équipe, et dossiers de chaque rubrique à divers états.
 */
export function seedSamples({
  db,
  auth,
  admin,
  ago,
  entry,
  insert,
  update,
  audit,
}: SeedContext) {
  const now = Date.now();
  for (const household of sampleHouseholds) {
    if (db.prepare("SELECT id FROM accounts WHERE id=?").get(household.id))
      continue;
    const signup = now - household.age * day - (household.index % 7) * 3600000;
    // Mot de passe aléatoire jamais communiqué : aucune connexion possible.
    db.prepare(
      "INSERT INTO accounts(id,email,password,workspace,created_at) VALUES (?,?,?,?,?)",
    ).run(
      household.id,
      household.email,
      `${randomBytes(16).toString("hex")}:${randomBytes(64).toString("hex")}`,
      household.id,
      new Date(signup).toISOString(),
    );
    const account = db
      .prepare("SELECT * FROM accounts WHERE id=?")
      .get<Account>(household.id)!;
    const own = auth.workspace(account);
    transaction(own, () => fillWorkspace(own, household, signup, now));
  }
  const email = (id: string) =>
    sampleHouseholds.find((h) => h.id === id)!.email;
  const person = (id: string) =>
    sampleHouseholds.find((h) => h.id === id)!.name;
  // Comptes : un compte suspendu, un compte professionnel, un profil public masqué.
  db.prepare(
    "INSERT OR IGNORE INTO account_controls(account,status,version) VALUES ('sample-14','Suspendu',2)",
  ).run();
  db.prepare(
    "INSERT OR IGNORE INTO account_controls(account,status,version,account_type) VALUES ('sample-08','Actif',2,'Professionnel')",
  ).run();
  db.prepare(
    "INSERT OR IGNORE INTO account_controls(account,status,version,public_visibility) VALUES ('sample-19','Actif',2,'Masqué')",
  ).run();
  // Équipe : une personne au support, une à la modération, une invitation expirée.
  db.prepare(
    "INSERT OR IGNORE INTO admin_members(account,role,created_at) VALUES ('sample-02','Support',?)",
  ).run(ago(40));
  db.prepare(
    "INSERT OR IGNORE INTO admin_members(account,role,created_at) VALUES ('sample-06','Modérateur',?)",
  ).run(ago(25));
  db.prepare(
    "INSERT OR IGNORE INTO admin_invitations(id,email,role,invited_by,created_at,expires_at) VALUES (?,?,?,?,?,?)",
  ).run(
    "invite-moderation",
    "moderation@anivaya.example",
    "Modérateur",
    admin,
    ago(30),
    ago(16),
  );
  // Professionnels : un dossier complet validé, un dossier à corriger.
  update(
    "pros",
    "complice",
    {
      status: "Validé",
      siret: "85678901200041",
      email: "bonjour@complice.example",
      documents: [
        {
          id: "activity",
          name: "Justificatif d’activité",
          status: "Conforme",
          applicable: true,
          expires: "",
          note: "Certificat d’éducateur canin vérifié.",
          history: [
            entry(15, "Conforme", "Certificat d’éducateur canin vérifié."),
          ],
        },
        {
          id: "insurance",
          name: "Assurance professionnelle",
          status: "Conforme",
          applicable: true,
          expires: new Date(now + 200 * day).toISOString().slice(0, 10),
          note: "Attestation valable jusqu’à la fin de l’année prochaine.",
          history: [entry(15, "Conforme", "Attestation lisible et à jour.")],
        },
      ],
      history: [entry(15, "save", "Dossier complet : fiche validée.")],
      note: "Dossier complet : fiche validée.",
    },
    ago(15),
  );
  update(
    "pros",
    "gamelle",
    {
      status: "À corriger",
      siret: "86789012300058",
      documents: [
        {
          id: "activity",
          name: "Justificatif d’activité",
          status: "Conforme",
          applicable: true,
          expires: "",
          note: "",
          history: [entry(11, "Conforme", "Inscription au registre vérifiée.")],
        },
        {
          id: "insurance",
          name: "Assurance professionnelle",
          status: "À corriger",
          applicable: true,
          expires: "",
          note: "Attestation expirée : demander la nouvelle période.",
          history: [
            entry(
              11,
              "À corriger",
              "Attestation expirée : demander la nouvelle période.",
            ),
          ],
        },
      ],
      history: [
        entry(11, "save", "Corrections demandées : assurance expirée."),
      ],
      note: "Corrections demandées : assurance expirée.",
    },
    ago(11),
  );
  // Signalements : fiches publiques et annuaire, à traiter ou décidés.
  const report = (
    id: string,
    data: Partial<AdminRecord> & Pick<AdminRecord, "name" | "status">,
    at: string,
  ) => insert("reports", { history: [], ...data }, id, at);
  report(
    "report-cession",
    {
      name: "Annonce de cession sur un profil public",
      message:
        "Le profil public propose un chiot à vendre, contrairement aux règles.",
      target: "sample-17",
      targetType: "users",
      account: "sample-03",
      email: email("sample-03"),
      status: "À traiter",
      priority: "Risque grave",
      reference: "DEC-FICHE-0004",
    },
    ago(0, 7),
  );
  report(
    "report-photo",
    {
      name: "Photo trompeuse sur une fiche d’animal",
      message:
        "La photo de la fiche publique ne correspond pas à l’animal décrit.",
      target: "sample-04",
      targetType: "users",
      account: "sample-09",
      email: email("sample-09"),
      status: "À traiter",
      priority: "Normale",
      reference: "DEC-FICHE-0005",
    },
    ago(0, 15),
  );
  report(
    "report-tarifs",
    {
      name: "Tarifs différents de ceux affichés",
      message:
        "Le tarif demandé sur place était plus élevé que celui de la fiche.",
      target: "complice",
      targetType: "pros",
      account: "sample-12",
      email: email("sample-12"),
      status: "À traiter",
      priority: "Normale",
      reference: "DEC-ANNUAIRE-0006",
    },
    ago(2, 3),
  );
  report(
    "report-doublon",
    {
      name: "Fiche en double dans l’annuaire",
      message:
        "La même boutique apparaît deux fois avec des horaires différents.",
      target: "gamelle",
      targetType: "pros",
      account: "sample-05",
      email: email("sample-05"),
      status: "Signalement confirmé",
      priority: "Normale",
      reference: "DEC-ANNUAIRE-0007",
      firstResponseAt: ago(11, 20),
      note: "Doublon confirmé : le professionnel doit mettre sa fiche à jour.",
      history: [
        entry(
          11,
          "decide",
          "Doublon confirmé : le professionnel doit mettre sa fiche à jour.",
        ),
      ],
    },
    ago(12),
  );
  report(
    "report-adresse",
    {
      name: "Adresse introuvable",
      message: "L’adresse affichée mène à un local fermé.",
      target: "douce",
      targetType: "pros",
      account: "sample-21",
      email: email("sample-21"),
      status: "Classé sans suite",
      priority: "Normale",
      reference: "DEC-ANNUAIRE-0008",
      firstResponseAt: ago(19, 22),
      note: "Déménagement récent signalé par la clinique : nouvelle adresse déjà en ligne.",
      history: [
        entry(
          19,
          "decide",
          "Déménagement récent signalé par la clinique : nouvelle adresse déjà en ligne.",
        ),
      ],
    },
    ago(20),
  );
  insert(
    "appeals",
    {
      name: "Recours DEC-ANNUAIRE-0007",
      reference: "DEC-ANNUAIRE-0007",
      message: "Il s’agit de deux boutiques distinctes, avec deux adresses.",
      status: "Décision maintenue",
      target: "report-doublon",
      targetType: "reports",
      email: "contact@gamelle.example",
      note: "Une seule adresse figure sur les justificatifs transmis.",
      history: [
        entry(
          8,
          "decide",
          "Une seule adresse figure sur les justificatifs transmis.",
        ),
      ],
    },
    "appeal-doublon",
    ago(10),
  );
  insert(
    "appeals",
    {
      name: "Recours DEC-ANNUAIRE-0008",
      reference: "DEC-ANNUAIRE-0008",
      message: "La nouvelle adresse n’est toujours pas la bonne sur la fiche.",
      status: "À examiner",
      target: "report-adresse",
      targetType: "reports",
      account: "sample-21",
      email: email("sample-21"),
      history: [],
    },
    "appeal-adresse",
    ago(1, 2),
  );
  // Assistance : demandes à tous les stades, imports et retours d’utilisateurs.
  const ticket = (
    id: string,
    who: string,
    name: string,
    category: string,
    status: string,
    assignee: string,
    days: number,
    message: string,
    reply?: string,
  ) =>
    insert(
      "tickets",
      {
        name,
        email: email(who),
        account: who,
        message,
        category,
        status,
        assignee,
        history: [
          entry(days, "Demande reçue", message, person(who)),
          ...(reply ? [entry(Math.max(0, days - 1), "reply", reply)] : []),
        ],
      },
      id,
      ago(days),
    );
  ticket(
    "ticket-connexion",
    "sample-07",
    "Connexion impossible",
    "Mon compte",
    "Ouvert",
    "Support",
    0,
    "Le code de double authentification n’arrive pas.",
  );
  ticket(
    "ticket-rdv",
    "sample-10",
    "Réservation à annuler",
    "Une réservation",
    "En cours",
    person("sample-02"),
    2,
    "Je souhaite annuler mon rendez-vous de samedi.",
    "Demande transmise au professionnel, en attente de sa confirmation.",
  );
  ticket(
    "ticket-export",
    "sample-13",
    "Export du carnet",
    "Mes animaux et documents",
    "Résolu",
    "Support",
    6,
    "Comment exporter le carnet de Pixel en PDF ?",
    "Depuis la fiche de l’animal, utilisez « Exporter » en haut à droite.",
  );
  ticket(
    "ticket-lenteur",
    "sample-16",
    "Application lente",
    "Un problème technique",
    "En cours",
    "Administrateur",
    3,
    "Les documents mettent longtemps à s’ouvrir.",
    "Analyse en cours avec l’équipe technique.",
  );
  ticket(
    "ticket-idee",
    "sample-20",
    "Rappels partagés",
    "Une suggestion",
    "Fermé",
    "Support",
    14,
    "Pourrait-on partager un rappel avec la personne qui garde le chien ?",
    "Merci, l’idée est ajoutée aux pistes d’amélioration.",
  );
  const imported = (
    id: string,
    who: string,
    name: string,
    status: string,
    issue: string,
    days: number,
  ) =>
    insert(
      "imports",
      {
        name,
        account: who,
        email: email(who),
        kind: "Fichier",
        status,
        issue,
        history: issue ? [entry(days, status, issue, "Service d’import")] : [],
      },
      id,
      ago(days, 4),
    );
  imported(
    "import-ordonnance",
    "sample-11",
    "Ordonnance — photo",
    "En cours",
    "",
    0,
  );
  imported(
    "import-passeport",
    "sample-15",
    "Passeport européen — PDF",
    "Terminé",
    "Informations confirmées par l’utilisateur.",
    5,
  );
  imported(
    "import-analyse",
    "sample-18",
    "Résultats d’analyse — photo",
    "Échoué",
    "Document partiellement coupé : une nouvelle photo est nécessaire.",
    1,
  );
  imported(
    "import-vermifuge",
    "sample-23",
    "Carnet de vermifuge — photo",
    "À analyser",
    "Dates extraites à vérifier avant création des rappels.",
    3,
  );
  const feedback = (
    id: string,
    who: string,
    name: string,
    category: string,
    status: string,
    days: number,
    message: string,
  ) =>
    insert(
      "feedback",
      {
        name,
        message,
        category,
        account: who,
        email: email(who),
        status,
        history: [],
      },
      id,
      ago(days, 6),
    );
  feedback(
    "feedback-race",
    "sample-15",
    "Race mal reconnue",
    "Information incorrecte",
    "À analyser",
    4,
    "La race proposée par l’import ne correspond pas à celle du passeport.",
  );
  feedback(
    "feedback-etapes",
    "sample-18",
    "Étapes peu claires",
    "Difficulté rencontrée",
    "Nouveau",
    1,
    "Je n’ai pas compris qu’il fallait valider chaque information.",
  );
  feedback(
    "feedback-multi",
    "sample-01",
    "Importer plusieurs pages",
    "Suggestion",
    "Résolu",
    18,
    "Pouvoir importer un carnet de plusieurs pages en une fois.",
  );
  feedback(
    "feedback-doublon",
    "sample-23",
    "Rappel créé en double",
    "Information incorrecte",
    "Classé",
    9,
    "Le rappel de vermifuge apparaît deux fois.",
  );
  // Publications : annonces diffusées ou archivées, guides à tous les stades.
  insert(
    "announcements",
    {
      name: "Nouveaux rappels de vaccination",
      message:
        "Les rappels affichent désormais la prochaine échéance directement sur la fiche de chaque animal.",
      audience: "Particuliers",
      status: "Publié",
      recipients: sampleHouseholds.length,
      history: [entry(13, "publish", "Diffusion aux particuliers.")],
    },
    "announce-rappels",
    ago(13),
  );
  insert(
    "announcements",
    {
      name: "Vérification des pièces professionnelles",
      message:
        "Pensez à renouveler votre attestation d’assurance avant son expiration pour rester visible dans l’annuaire.",
      audience: "Professionnels",
      status: "Archivé",
      recipients: 6,
      history: [
        entry(40, "publish", "Diffusion aux professionnels."),
        entry(20, "unpublish", "Campagne terminée."),
      ],
    },
    "announce-pieces",
    ago(40),
  );
  const guide = (
    id: string,
    name: string,
    summary: string,
    body: string,
    status: string,
    days: number,
    history: ReturnType<SeedContext["entry"]>[],
    extra: Record<string, unknown> = {},
  ) =>
    insert(
      "library",
      {
        name,
        status,
        versions: [{ number: 1, title: name, summary, body, status, ...extra }],
        history,
      },
      id,
      ago(days),
    );
  guide(
    "guide-voyage",
    "Voyager avec son animal",
    "Les documents à prévoir avant un départ.",
    "Vérifiez que l’identification et les vaccinations sont à jour dans le carnet. Pour un voyage à l’étranger, renseignez-vous sur les règles du pays de destination. Votre vétérinaire vous indiquera les démarches adaptées.",
    "Publié",
    30,
    [
      entry(30, "submit", "Relecture demandée."),
      entry(28, "review", "Validé", "veterinaire@example.fr"),
      entry(27, "publish", "Version 1 publiée."),
    ],
    {
      review: {
        reviewer: "veterinaire@example.fr",
        note: "Informations générales, sans indication médicale.",
        date: ago(28),
      },
      publishedAt: ago(27),
    },
  );
  guide(
    "guide-chaton",
    "Accueillir un chaton",
    "Préparer la maison pour les premières semaines.",
    "Prévoyez un coin calme, une litière et des points d’eau. Notez dans Anivaya les premiers rendez-vous proposés par votre vétérinaire.",
    "À corriger",
    6,
    [
      entry(6, "submit", "Relecture demandée."),
      entry(4, "review", "À corriger", "veterinaire@example.fr"),
    ],
    {
      review: {
        reviewer: "veterinaire@example.fr",
        note: "Retirer la mention d’un âge précis de sevrage.",
        date: ago(4),
      },
    },
  );
  guide(
    "guide-garde",
    "Bien choisir sa garde",
    "Les questions à poser avant de confier son animal.",
    "Rencontrez la personne avant la garde, présentez les habitudes de l’animal et partagez sa fiche depuis Anivaya.",
    "Brouillon",
    2,
    [],
  );
  // Suppressions de compte et alertes de sécurité.
  insert(
    "deletions",
    {
      name: `Demande de ${person("sample-22")}`,
      account: "sample-22",
      email: email("sample-22"),
      message: "Je déménage à l’étranger et souhaite fermer mon compte.",
      status: "À traiter",
      history: [],
    },
    "deletion-sample-22",
    ago(1, 5),
  );
  insert(
    "deletions",
    {
      name: `Demande de ${person("sample-24")}`,
      account: "sample-24",
      email: email("sample-24"),
      message: "Demande envoyée par erreur.",
      status: "Refusée",
      note: "Demande annulée par la personne avant traitement.",
      history: [
        entry(
          20,
          "decline",
          "Demande annulée par la personne avant traitement.",
        ),
      ],
    },
    "deletion-sample-24",
    ago(21),
  );
  const alert = (
    id: string,
    name: string,
    kind: string,
    message: string,
    who: string,
    status: string,
    days: number,
  ) =>
    insert(
      "security",
      { name, kind, message, account: who, status, history: [] },
      id,
      ago(days, 3),
    );
  alert(
    "security-mfa",
    "Double authentification désactivée",
    "Compte",
    `La double authentification a été désactivée pour ${email("sample-06")}.`,
    "sample-06",
    "À examiner",
    1,
  );
  alert(
    "security-pays",
    "Connexion depuis un nouvel appareil",
    "Connexion",
    `Nouvel appareil utilisé pour ${email("sample-02")}.`,
    "sample-02",
    "Examiné",
    8,
  );
  alert(
    "security-reset",
    "Réinitialisations répétées",
    "Connexion",
    `3 demandes de réinitialisation en une heure pour ${email("sample-14")}.`,
    "sample-14",
    "Examiné",
    16,
  );
  // Historique : actions de l’équipe sur ces dossiers.
  audit(
    40,
    "team",
    "sample-02",
    `Membre ajouté : ${email("sample-02")}`,
    "Support",
  );
  audit(
    30,
    "team",
    "invite-moderation",
    "Invitation : moderation@anivaya.example",
    "Modérateur",
  );
  audit(
    27,
    "library",
    "guide-voyage",
    "publish : Voyager avec son animal",
    "Version 1 publiée.",
  );
  audit(
    25,
    "team",
    "sample-06",
    `Membre ajouté : ${email("sample-06")}`,
    "Modérateur",
  );
  audit(
    20,
    "announcements",
    "announce-pieces",
    "unpublish : Vérification des pièces professionnelles",
    "Campagne terminée.",
  );
  audit(
    20,
    "deletions",
    "deletion-sample-24",
    `decline : Demande de ${person("sample-24")}`,
    "Demande annulée.",
  );
  audit(
    19,
    "reports",
    "report-adresse",
    "decide : Adresse introuvable",
    "Classé sans suite",
  );
  audit(
    16,
    "security",
    "security-reset",
    "review : Réinitialisations répétées",
    "Examiné",
  );
  audit(15, "pros", "complice", "save : Complice au quotidien", "Validé");
  audit(14, "tickets", "ticket-idee", "reply : Rappels partagés", "Fermé");
  audit(
    13,
    "announcements",
    "announce-rappels",
    "publish : Nouveaux rappels de vaccination",
    "Diffusion aux particuliers.",
  );
  audit(11, "pros", "gamelle", "save : La Juste Gamelle", "À corriger");
  audit(
    11,
    "reports",
    "report-doublon",
    "decide : Fiche en double dans l’annuaire",
    "Signalement confirmé",
  );
  audit(10, "users", "sample-14", `save : ${person("sample-14")}`, "Suspendu");
  audit(
    8,
    "appeals",
    "appeal-doublon",
    "decide : Recours DEC-ANNUAIRE-0007",
    "Décision maintenue",
  );
  audit(6, "tickets", "ticket-export", "reply : Export du carnet", "Résolu");
  audit(
    4,
    "library",
    "guide-chaton",
    "review : Accueillir un chaton",
    "À corriger",
  );
  audit(
    2,
    "tickets",
    "ticket-rdv",
    "reply : Réservation à annuler",
    "En cours",
  );
}
