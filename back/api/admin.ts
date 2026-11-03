import { randomUUID } from "node:crypto";
import type { Database, Input } from "../database/types.ts";
import type { Account, Authentication } from "./auth.ts";
import type {
  AdminRole,
  AdminResource,
  AdminRecord,
  AdminList,
  AdminOverview,
} from "../../shared/admin.ts";
import {
  adminResources,
  adminRoles,
  roleResources,
} from "../../shared/admin.ts";
import { transaction } from "../database/connection.ts";
import {
  ApiError,
  text,
  emailAddress,
  oneOf,
  date,
  documentFile,
} from "./validation.ts";
import { directoryRepository } from "./directory.ts";
import { profileRepository } from "./profile.ts";
import type { Household } from "./admin-analytics.ts";
import { sampleOrigin, seedSamples } from "./admin-samples.ts";
import { appUrl, sendMail } from "./mail.ts";

interface Row {
  id: string;
  name: string;
  status: string;
  data: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
const projection =
  "id,name,status,data,version,created_at AS createdAt,updated_at AS updatedAt";
const now = () => new Date().toISOString();
const today = () => now().slice(0, 10);
const proofExpired = (proof: { expires: string }) =>
  !!proof.expires && proof.expires < today();
/** Dossier vérifié : fiche validée, SIRET présent et pièces applicables conformes et valides. */
function proLevel(row: AdminRecord): AdminRecord["level"] {
  const documents = row.documents || [];
  if (
    row.status === "Validé" &&
    /^\d{14}$/.test(row.siret || "") &&
    documents
      .filter((d) => d.applicable)
      .every((d) => d.status === "Conforme" && !proofExpired(d))
  )
    return "Dossier vérifié";
  return documents.some(
    (d) =>
      d.applicable &&
      (d.status === "Manquant" || d.status === "À corriger" || proofExpired(d)),
  )
    ? "Pièces à compléter"
    : "Vérification en cours";
}
const unpack = ({ data, ...row }: Row): AdminRecord => {
  const value: AdminRecord = { ...JSON.parse(data), ...row };
  if (value.priority) {
    const due = Date.parse(value.createdAt) + 86400000;
    value.responseDueAt = new Date(due).toISOString();
    value.responseLate =
      (value.firstResponseAt ? Date.parse(value.firstResponseAt) : Date.now()) >
      due;
  }
  if (value.documents) value.level = proLevel(value);
  return value;
};
const pick = (value: unknown, allowed: readonly string[], field = "status") =>
  oneOf(
    text(value, field, 100),
    allowed,
    field,
    "Choisissez une valeur proposée.",
  );
const labels: Partial<Record<AdminResource, string>> = {
  pros: "Professionnels à vérifier",
  reports: "Signalements à traiter",
  appeals: "Recours à examiner",
  tickets: "Demandes ouvertes",
  feedback: "Retours à analyser",
  library: "Contenus à relire",
  imports: "Imports à suivre",
  deletions: "Suppressions à traiter",
  security: "Alertes de sécurité à examiner",
};
const pendingStatuses: Partial<Record<AdminResource, string[]>> = {
  pros: ["À vérifier", "À corriger"],
  reports: ["À traiter"],
  appeals: ["À examiner"],
  tickets: ["Ouvert", "En cours"],
  imports: ["En cours", "Échoué", "À analyser"],
  feedback: ["Nouveau", "À analyser", "Pris en charge"],
  library: ["À relire"],
  deletions: ["À traiter"],
  security: ["À examiner"],
};
const ACCOUNT_ACTIONS = [
  "Aucune sanction",
  "Avertir le compte",
  "Suspendre le compte",
];
const INVITATION_DAYS = 14;

/** Service central : aucune décision d'autorisation ne dépend du rôle envoyé par React. */
export function adminService(db: Database, auth: Authentication) {
  function role(account: Account): AdminRole {
    const member = db
      .prepare(
        "SELECT role FROM admin_members WHERE account=? AND status='Actif'",
      )
      .get<{ role: AdminRole }>(account.id);
    if (!member)
      throw new ApiError(403, "Cet espace est réservé à l’équipe Anivaya.");
    return member.role;
  }
  function authorize(account: Account, resource?: AdminResource) {
    const current = role(account);
    if (resource && !roleResources[current].includes(resource))
      throw new ApiError(
        403,
        "Votre rôle ne permet pas d’accéder à cette rubrique.",
      );
    return current;
  }
  function resource(value: string): AdminResource {
    if (!(adminResources as readonly string[]).includes(value))
      throw new ApiError(404, "Rubrique introuvable.");
    return value as AdminResource;
  }
  function insert(
    kind: AdminResource,
    data: Pick<AdminRecord, "name" | "status"> & Partial<AdminRecord>,
    id: string = randomUUID(),
    at = now(),
  ) {
    db.prepare(
      "INSERT INTO admin_records(id,resource,name,status,data,created_at,updated_at) VALUES (?,?,?,?,?,?,?)",
    ).run(id, kind, data.name, data.status, JSON.stringify(data), at, at);
    return get(kind, id);
  }
  function setVisibility(account: string, visibility: string) {
    db.prepare(
      "INSERT INTO account_controls(account,status,version,public_visibility) VALUES (?,'Actif',2,?) ON CONFLICT(account) DO UPDATE SET public_visibility=excluded.public_visibility,version=account_controls.version+1",
    ).run(account, visibility);
  }
  function suspendAccount(account: string) {
    db.prepare(
      "INSERT INTO account_controls(account,status,version) VALUES (?,'Suspendu',2) ON CONFLICT(account) DO UPDATE SET status='Suspendu',version=account_controls.version+1",
    ).run(account);
    db.prepare("DELETE FROM sessions WHERE account=?").run(account);
  }
  /** Noms des membres actifs, proposés pour l’attribution des demandes. */
  function teamNames() {
    return [
      "Support",
      "Administrateur",
      ...accountRows(true)
        .filter((m) => m.status === "Actif")
        .map((m) => m.name),
    ].filter((name, i, all) => all.indexOf(name) === i);
  }
  function invitationRows(): AdminRecord[] {
    return db
      .prepare(
        "SELECT id,email,role,invited_by AS invitedBy,created_at AS createdAt,expires_at AS expiresAt FROM admin_invitations ORDER BY created_at DESC",
      )
      .all<{
        id: string;
        email: string;
        role: string;
        invitedBy: string;
        createdAt: string;
        expiresAt: string;
      }>()
      .map((i) => ({
        id: i.id,
        name: i.email,
        email: i.email,
        role: i.role,
        status: i.expiresAt < now() ? "Invitation expirée" : "Invité",
        version: 1,
        createdAt: i.createdAt,
        updatedAt: i.createdAt,
        expiresAt: i.expiresAt,
        invitation: true,
        note: `Invité par ${i.invitedBy}. Un e-mail d’invitation a été envoyé à cette adresse.`,
      }));
  }
  function securityRows(): AdminRecord[] {
    return db
      .prepare(
        `SELECT ${projection} FROM admin_records WHERE resource='security' ORDER BY created_at DESC`,
      )
      .all<Row>()
      .map(unpack);
  }
  function sessionRows(): AdminRecord[] {
    return db
      .prepare(
        "SELECT s.token AS id,a.email, s.expires FROM sessions s JOIN accounts a ON a.id=s.account WHERE s.expires>? ORDER BY s.expires DESC",
      )
      .all<{ id: string; email: string; expires: number }>(Date.now())
      .map((r) => ({
        id: r.id,
        name: r.email,
        email: r.email,
        kind: "Session",
        status: "Active",
        version: 1,
        createdAt: "",
        updatedAt: new Date(r.expires).toISOString(),
        note:
          "Expiration : " +
          new Date(r.expires).toLocaleString("fr-FR", {
            timeZone: "Europe/Paris",
          }),
      }));
  }
  function get(kind: AdminResource, id: string): AdminRecord {
    const row = db
      .prepare(
        `SELECT ${projection} FROM admin_records WHERE resource=? AND id=?`,
      )
      .get<Row>(kind, id);
    if (!row) throw new ApiError(404, "Ce dossier est introuvable.");
    return unpack(row);
  }
  function save(kind: AdminResource, row: AdminRecord) {
    const result = db
      .prepare(
        "UPDATE admin_records SET name=?,status=?,data=?,version=version+1,updated_at=? WHERE resource=? AND id=? AND version=?",
      )
      .run(
        row.name,
        row.status,
        JSON.stringify(row),
        now(),
        kind,
        row.id,
        row.version,
      );
    if (!result.changes)
      throw new ApiError(
        409,
        "Ce dossier a changé. Actualisez-le avant de recommencer.",
      );
    return get(kind, row.id);
  }
  function log(
    account: Account,
    kind: AdminResource,
    target: string,
    action: string,
    note: string,
  ) {
    db.prepare("INSERT INTO admin_audit VALUES (?,?,?,?,?,?,?)").run(
      randomUUID(),
      account.email,
      action,
      kind,
      target,
      note,
      now(),
    );
  }
  function checkVersion(expected: unknown, actual: number) {
    if (expected !== actual)
      throw new ApiError(
        409,
        "Ce dossier a changé. Fermez-le et actualisez la liste.",
      );
  }
  let seeded = false;
  function seed() {
    if (seeded) return;
    transaction(db, () => {
      if (
        !db.prepare("SELECT key FROM admin_metadata WHERE key='seed-v1'").get()
      ) {
        for (const pro of directoryRepository(db).all().professionals)
          insert(
            "pros",
            {
              name: pro.name,
              status: "À vérifier",
              city: pro.city,
              category: pro.category,
              body: pro.about,
              documents: [
                {
                  id: "activity",
                  name: "Justificatif d’activité",
                  status: "Manquant",
                  applicable: true,
                  expires: "",
                  note: "",
                },
                {
                  id: "insurance",
                  name: "Assurance professionnelle",
                  status: "Manquant",
                  applicable: true,
                  expires: "",
                  note: "",
                },
              ],
            },
            pro.id,
          );
        insert(
          "library",
          {
            name: "Préparer un rendez-vous vétérinaire",
            status: "Brouillon",
            versions: [
              {
                number: 1,
                title: "Préparer un rendez-vous vétérinaire",
                summary: "Rassembler les informations utiles avant de partir.",
                body: "Retrouvez les documents de votre animal dans son carnet. Notez les changements observés et les questions que vous souhaitez poser. Votre vétérinaire reste votre interlocuteur pour les soins.",
                status: "Brouillon",
              },
            ],
          },
          "guide-rdv",
        );
        db.prepare("INSERT INTO admin_metadata VALUES ('seed-v1',?)").run(
          now(),
        );
      }
      if (
        !db.prepare("SELECT key FROM admin_metadata WHERE key='seed-v2'").get()
      ) {
        seedDemo();
        db.prepare("INSERT INTO admin_metadata VALUES ('seed-v2',?)").run(
          now(),
        );
      }
      // v5 : imports créés avec l’ancien « exemple intégré », devenus de simples fichiers.
      if (
        !db.prepare("SELECT key FROM admin_metadata WHERE key='seed-v5'").get()
      ) {
        db.prepare(
          "UPDATE admin_records SET data=json_set(data,'$.kind','Fichier') WHERE resource='imports' AND json_extract(data,'$.kind')='Exemple intégré'",
        ).run();
        db.prepare(
          "UPDATE admin_records SET name=replace(name,' — exemple',''),data=json_set(data,'$.name',replace(json_extract(data,'$.name'),' — exemple','')) WHERE resource='imports' AND name LIKE '% — exemple'",
        ).run();
        db.prepare("INSERT INTO admin_metadata VALUES ('seed-v5',?)").run(
          now(),
        );
      }
      // v4 : formulations sans mention de test dans les dossiers déjà créés.
      if (
        !db.prepare("SELECT key FROM admin_metadata WHERE key='seed-v4'").get()
      ) {
        for (const pro of directoryRepository(db).all().professionals)
          db.prepare(
            "UPDATE admin_records SET data=json_set(data,'$.body',?) WHERE resource='pros' AND id=?",
          ).run(pro.about, pro.id);
        db.prepare(
          "UPDATE admin_records SET data=json_set(data,'$.issue',?) WHERE resource='imports' AND id='import-consultation'",
        ).run(
          "Dates extraites à vérifier : l’utilisateur n’a pas encore validé l’import.",
        );
        db.prepare(
          "UPDATE admin_records SET name=?,data=json_set(data,'$.name',?,'$.kind','Fichier','$.issue',?,'$.history[0].note','Import enregistré.') WHERE resource='imports' AND id='import-exemple'",
        ).run(
          "Certificat d’identification",
          "Certificat d’identification",
          "Informations extraites par l’IA, vérifiées puis enregistrées par l’utilisateur.",
        );
        db.prepare("INSERT INTO admin_metadata VALUES ('seed-v4',?)").run(
          now(),
        );
      }
      // v3 : foyers datés pour le Pilotage et dossiers supplémentaires dans chaque rubrique.
      if (
        !db.prepare("SELECT key FROM admin_metadata WHERE key='seed-v3'").get()
      ) {
        const tools = demoTools();
        if (tools) seedSamples({ db, auth, insert, ...tools });
        db.prepare("INSERT INTO admin_metadata VALUES ('seed-v3',?)").run(
          now(),
        );
      }
    });
    seeded = true;
  }
  /** Outils des jeux de démonstration ; `null` quand le compte admin de démonstration n’existe pas. */
  function demoTools() {
    const accounts = Object.fromEntries(
      db
        .prepare("SELECT id,email FROM accounts")
        .all<{ id: string; email: string }>()
        .map((a) => [a.id, a.email]),
    );
    if (!accounts["demo-admin"]) return null;
    const ago = (days: number, hours = 10) =>
      new Date(Date.now() - days * 86400000 - hours * 3600000).toISOString();
    const admin = accounts["demo-admin"];
    const entry = (
      days: number,
      action: string,
      note: string,
      actor = admin,
    ) => ({ date: ago(days), actor, action, note });
    const audit = (
      days: number,
      kind: AdminResource,
      target: string,
      action: string,
      note = "",
    ) =>
      db
        .prepare("INSERT INTO admin_audit VALUES (?,?,?,?,?,?,?)")
        .run(randomUUID(), admin, action, kind, target, note, ago(days));
    const update = (
      kind: AdminResource,
      id: string,
      patch: Partial<AdminRecord>,
      at: string,
    ) => {
      const row = db
        .prepare(
          `SELECT ${projection} FROM admin_records WHERE resource=? AND id=?`,
        )
        .get<Row>(kind, id);
      if (!row) return;
      const value = { ...JSON.parse(row.data), ...patch };
      db.prepare(
        "UPDATE admin_records SET name=?,status=?,data=?,updated_at=? WHERE resource=? AND id=?",
      ).run(value.name, value.status, JSON.stringify(value), at, kind, id);
    };
    return { accounts, admin, ago, entry, audit, update };
  }
  /**
   * Jeu de démonstration de l’administration : dossiers datés des jours précédents,
   * rattachés aux comptes de démonstration. Ignoré quand le compte admin n’existe pas.
   */
  function seedDemo() {
    const tools = demoTools();
    if (!tools) return;
    const { accounts, admin, ago, entry, audit, update } = tools;
    // Professionnels : un dossier vérifié, un à corriger, une pièce manquante.
    update(
      "pros",
      "tilleuls",
      {
        status: "Validé",
        siret: "82345678900017",
        email: "contact@tilleuls.example",
        documents: [
          {
            id: "activity",
            name: "Justificatif d’activité",
            status: "Conforme",
            applicable: true,
            expires: "",
            note: "Inscription à l’ordre vérifiée sur la pièce transmise.",
            history: [
              entry(
                6,
                "Conforme",
                "Inscription à l’ordre vérifiée sur la pièce transmise.",
              ),
            ],
          },
          {
            id: "insurance",
            name: "Assurance professionnelle",
            status: "Conforme",
            applicable: true,
            expires: today().slice(0, 4) + "-12-31",
            note: "Attestation en cours de validité.",
            history: [
              entry(6, "Conforme", "Attestation en cours de validité."),
            ],
          },
        ],
        history: [
          entry(6, "save", "Dossier complet : fiche validée pour l’annuaire."),
        ],
        note: "Dossier complet : fiche validée pour l’annuaire.",
      },
      ago(6),
    );
    update(
      "pros",
      "bulle",
      {
        status: "À corriger",
        siret: "83456789000025",
        email: "salon@bulle.example",
        documents: [
          {
            id: "activity",
            name: "Justificatif d’activité",
            status: "À corriger",
            applicable: true,
            expires: "",
            note: "L’extrait transmis date de plus d’un an : demander une version récente.",
            history: [
              entry(
                3,
                "À corriger",
                "L’extrait transmis date de plus d’un an : demander une version récente.",
              ),
            ],
          },
          {
            id: "insurance",
            name: "Assurance professionnelle",
            status: "Conforme",
            applicable: true,
            expires: "",
            note: "",
            history: [entry(3, "Conforme", "Attestation lisible et à jour.")],
          },
        ],
        history: [
          entry(
            3,
            "save",
            "Corrections demandées : justificatif d’activité trop ancien.",
          ),
        ],
        note: "Corrections demandées : justificatif d’activité trop ancien.",
      },
      ago(3),
    );
    update(
      "pros",
      "maison",
      {
        siret: "84567890100033",
        documents: [
          {
            id: "activity",
            name: "Justificatif d’activité",
            status: "À examiner",
            applicable: true,
            expires: "",
            note: "",
            history: [],
          },
          {
            id: "insurance",
            name: "Assurance professionnelle",
            status: "Manquant",
            applicable: true,
            expires: "",
            note: "",
            history: [],
          },
        ],
      },
      ago(1),
    );
    audit(6, "pros", "tilleuls", "save : Clinique des Tilleuls", "Validé");
    audit(3, "pros", "bulle", "save : Bulle de poils", "À corriger");
    // Signalements : un à traiter sur l’annuaire, un urgent sur une fiche publique, un classé.
    insert(
      "reports",
      {
        name: "Coordonnées incorrectes dans l’annuaire",
        message:
          "Le lien de contact affiché sur cette fiche ne correspond pas au salon.",
        target: "bulle",
        targetType: "pros",
        account: "demo",
        email: accounts.demo,
        status: "À traiter",
        priority: "Normale",
        reference: "DEC-ANNUAIRE-0001",
        history: [],
      },
      "report-annuaire",
      ago(0, 20),
    );
    insert(
      "reports",
      {
        name: "Information inappropriée sur une fiche publique",
        message:
          "Le texte public de la fiche comporte une publicité sans rapport avec l’animal.",
        target: "demo-2",
        targetType: "users",
        account: "demo-3",
        email: accounts["demo-3"],
        status: "À traiter",
        priority: "Risque grave",
        reference: "DEC-FICHE-0002",
        history: [],
      },
      "report-fiche",
      ago(1, 6),
    );
    insert(
      "reports",
      {
        name: "Horaires différents de ceux affichés",
        message: "La clinique était fermée à l’horaire indiqué sur la fiche.",
        target: "tilleuls",
        targetType: "pros",
        account: "demo",
        email: accounts.demo,
        status: "Classé sans suite",
        priority: "Normale",
        reference: "DEC-ANNUAIRE-0003",
        firstResponseAt: ago(7, 20),
        note: "Horaires exceptionnels annoncés par la clinique : fiche conforme.",
        history: [
          entry(
            7,
            "decide",
            "Horaires exceptionnels annoncés par la clinique : fiche conforme.",
          ),
        ],
      },
      "report-horaires",
      ago(8),
    );
    update("reports", "report-horaires", {}, ago(7, 20));
    insert(
      "appeals",
      {
        name: "Recours DEC-ANNUAIRE-0003",
        reference: "DEC-ANNUAIRE-0003",
        message:
          "La fermeture a duré toute la semaine, pas seulement un jour : je demande un nouvel examen.",
        status: "À examiner",
        target: "report-horaires",
        targetType: "reports",
        email: accounts.demo,
        account: "demo",
        history: [],
      },
      "appeal-horaires",
      ago(2, 4),
    );
    // Assistance : une demande ouverte, une résolue ; imports et retour associé.
    insert(
      "tickets",
      {
        name: "Document inaccessible",
        email: accounts.demo,
        account: "demo",
        message:
          "Je ne parviens plus à ouvrir le carnet de santé de Nala depuis hier.",
        category: "Mes animaux et documents",
        status: "Ouvert",
        assignee: "Support",
        history: [
          entry(
            1,
            "Demande reçue",
            "Je ne parviens plus à ouvrir le carnet de santé de Nala depuis hier.",
            "test",
          ),
        ],
      },
      "ticket-document",
      ago(1, 2),
    );
    insert(
      "tickets",
      {
        name: "Question sur un partage",
        email: accounts["demo-2"],
        account: "demo-2",
        message: "Comment retirer l’accès d’une personne de confiance ?",
        category: "Les partages",
        status: "Résolu",
        assignee: "Support",
        history: [
          entry(
            5,
            "Demande reçue",
            "Comment retirer l’accès d’une personne de confiance ?",
            "test2",
          ),
          entry(
            4,
            "reply",
            "Depuis Partage, ouvrez le partage concerné puis « Révoquer ». La personne n’y a plus accès immédiatement.",
          ),
        ],
      },
      "ticket-partage",
      ago(5),
    );
    update("tickets", "ticket-partage", {}, ago(4));
    insert(
      "imports",
      {
        name: "Carnet de vaccination — photo",
        account: "demo",
        email: accounts.demo,
        kind: "Fichier",
        status: "Échoué",
        issue: "Photo illisible : une nouvelle prise de vue est nécessaire.",
        history: [
          entry(
            2,
            "Échoué",
            "Photo illisible : une nouvelle prise de vue est nécessaire.",
            "Service d’import",
          ),
        ],
      },
      "import-vaccins",
      ago(2, 3),
    );
    insert(
      "imports",
      {
        name: "Compte rendu de consultation",
        account: "demo-2",
        email: accounts["demo-2"],
        kind: "Fichier",
        status: "À analyser",
        issue:
          "Dates extraites à vérifier : l’utilisateur n’a pas encore validé l’import.",
        history: [],
      },
      "import-consultation",
      ago(0, 5),
    );
    insert(
      "imports",
      {
        name: "Certificat d’identification",
        account: "demo",
        email: accounts.demo,
        kind: "Fichier",
        status: "Terminé",
        issue:
          "Informations extraites par l’IA, vérifiées puis enregistrées par l’utilisateur.",
        history: [entry(9, "Terminé", "Import enregistré.", "test")],
      },
      "import-exemple",
      ago(9),
    );
    insert(
      "feedback",
      {
        name: "Date à corriger",
        message:
          "La date proposée pour le rappel ne correspond pas à celle du document.",
        category: "Information incorrecte",
        account: "demo",
        email: accounts.demo,
        status: "Nouveau",
        importId: "import-vaccins",
        history: [],
      },
      "feedback-date",
      ago(1, 8),
    );
    // Publications : une annonce diffusée, un brouillon ; un guide publié, un à relire.
    insert(
      "announcements",
      {
        name: "Maintenance prévue dimanche matin",
        message:
          "Anivaya sera indisponible dimanche entre 7 h et 8 h pour une mise à jour. Vos données ne sont pas concernées.",
        audience: "Tous",
        status: "Publié",
        recipients: Object.keys(accounts).length,
        history: [entry(4, "publish", "Diffusion aux comptes actifs.")],
      },
      "announce-maintenance",
      ago(4),
    );
    insert(
      "announcements",
      {
        name: "De nouveaux guides sont disponibles",
        message:
          "Retrouvez nos premiers guides relus par un vétérinaire dans Contact → Guides.",
        audience: "Particuliers",
        status: "Brouillon",
        history: [],
      },
      "announce-guides",
      ago(0, 2),
    );
    insert(
      "library",
      {
        name: "Préparer un relais de garde",
        status: "Publié",
        versions: [
          {
            number: 1,
            title: "Préparer un relais de garde",
            summary:
              "Ce qu’il faut transmettre à la personne qui garde votre animal.",
            body: "Partagez la fiche de votre animal avec la personne de confiance : habitudes, alimentation, contacts utiles. Vérifiez que les rappels à venir sont visibles et que le vétérinaire habituel est renseigné. Un relais serein commence par des informations à jour.",
            status: "Publié",
            review: {
              reviewer: "veterinaire@example.fr",
              note: "Conseils généraux conformes ; aucune indication médicale.",
              date: ago(10),
            },
            publishedAt: ago(9),
          },
        ],
        history: [
          entry(11, "submit", "Relecture demandée."),
          entry(10, "review", "Validé", "veterinaire@example.fr"),
          entry(9, "publish", "Version 1 publiée."),
        ],
      },
      "guide-relais",
      ago(12),
    );
    update("library", "guide-relais", {}, ago(9));
    insert(
      "library",
      {
        name: "Comprendre le calendrier vaccinal",
        status: "À relire",
        versions: [
          {
            number: 1,
            title: "Comprendre le calendrier vaccinal",
            summary: "Pourquoi les rappels sont espacés et comment les suivre.",
            body: "Les rappels de vaccination suivent un calendrier défini par votre vétérinaire selon l’âge et le mode de vie de l’animal. Notez chaque rappel dans Anivaya pour être prévenu à temps. En cas de doute, votre vétérinaire reste votre interlocuteur.",
            status: "À relire",
          },
        ],
        history: [entry(1, "submit", "Relecture demandée.")],
      },
      "guide-vaccins",
      ago(1, 9),
    );
    // Équipe, suppression de compte et sécurité.
    db.prepare(
      "INSERT OR IGNORE INTO admin_invitations(id,email,role,invited_by,created_at,expires_at) VALUES (?,?,?,?,?,?)",
    ).run(
      "invite-veterinaire",
      "veterinaire@example.fr",
      "Vétérinaire référent",
      admin,
      ago(2),
      new Date(Date.parse(ago(2)) + INVITATION_DAYS * 86400000).toISOString(),
    );
    if (accounts["demo-3"])
      insert(
        "deletions",
        {
          name: "Demande de test3",
          account: "demo-3",
          email: accounts["demo-3"],
          message:
            "Je n’utilise plus l’application et souhaite effacer mes données.",
          status: "À traiter",
          history: [],
        },
        "deletion-demo-3",
        ago(0, 30),
      );
    insert(
      "security",
      {
        name: "Tentatives de connexion répétées",
        kind: "Connexion",
        message: `5 échecs de connexion en 15 minutes pour ${accounts["demo-3"] || "un compte"}.`,
        account: "demo-3",
        status: "À examiner",
        history: [],
      },
      "security-attempts",
      ago(0, 12),
    );
    audit(
      12,
      "team",
      "demo-admin",
      "Provisionnement serveur",
      "Accès équipe attribué",
    );
    audit(
      2,
      "team",
      "invite-veterinaire",
      "Invitation : veterinaire@example.fr",
      "Vétérinaire référent",
    );
    audit(
      9,
      "library",
      "guide-relais",
      "publish : Préparer un relais de garde",
      "Version 1 publiée.",
    );
    audit(
      4,
      "announcements",
      "announce-maintenance",
      "publish : Maintenance prévue dimanche matin",
      "Diffusion aux comptes actifs.",
    );
    audit(
      7,
      "reports",
      "report-horaires",
      "decide : Horaires différents de ceux affichés",
      "Horaires exceptionnels annoncés par la clinique : fiche conforme.",
    );
    audit(
      4,
      "tickets",
      "ticket-partage",
      "reply : Question sur un partage",
      "Révocation expliquée.",
    );
  }
  function accountRows(team = false): AdminRecord[] {
    return db
      .prepare(
        `SELECT a.id,a.email,COALESCE(c.status,'Actif') AS status,COALESCE(c.version,1) AS version,COALESCE(c.public_visibility,'Visible') AS visibility,COALESCE(c.account_type,'Particulier') AS accountType,m.role,m.status AS memberStatus,m.version AS memberVersion,COALESCE(m.created_at,a.created_at,'') AS createdAt FROM accounts a LEFT JOIN account_controls c ON c.account=a.id LEFT JOIN admin_members m ON m.account=a.id ${team ? "WHERE m.account IS NOT NULL" : ""}`,
      )
      .all<{
        id: string;
        email: string;
        status: string;
        version: number;
        visibility: string;
        accountType: string;
        role: string | null;
        memberStatus: string;
        memberVersion: number;
        createdAt: string;
      }>()
      .map((row) => ({
        id: row.id,
        name: auth.user(
          db.prepare("SELECT * FROM accounts WHERE id=?").get<Account>(row.id)!,
        ).profile.name,
        email: row.email,
        role: row.role || "Particulier",
        status: team ? row.memberStatus : row.status,
        visibility: row.visibility,
        accountType: row.accountType,
        version: team ? row.memberVersion : row.version,
        createdAt: row.createdAt || "",
        updatedAt: "",
      }));
  }
  function list(
    account: Account,
    kind: AdminResource,
    query: URLSearchParams,
  ): AdminList {
    authorize(account, kind);
    seed();
    const q = (query.get("q") || "").slice(0, 120).trim(),
      status = query.get("status") || "";
    const pending = query.get("scope") === "pending";
    const category = query.get("category") || "";
    const pageSize = Math.min(
      50,
      Math.max(1, Math.floor(Number(query.get("pageSize")) || 10)),
    );
    let page = Math.max(1, Math.floor(Number(query.get("page")) || 1));
    const sort = query.get("sort") === "name" ? "name" : "updated_at";
    const direction = query.get("direction") === "asc" ? "ASC" : "DESC";
    if (kind === "users" || kind === "team" || kind === "security") {
      // Sécurité : alertes à examiner puis sessions ouvertes ; équipe : membres puis invitations.
      let rows =
        kind === "security"
          ? [...securityRows(), ...sessionRows()]
          : kind === "team"
            ? [...accountRows(true), ...invitationRows()]
            : accountRows();
      const statuses = [...new Set(rows.map((r) => r.status))];
      rows = rows.filter(
        (r) =>
          (!status || r.status === status) &&
          (!pending || pendingStatuses[kind]?.includes(r.status)) &&
          `${r.name} ${r.email}`
            .toLocaleLowerCase("fr")
            .includes(q.toLocaleLowerCase("fr")),
      );
      rows.sort(
        (a, b) =>
          (query.get("sort") === "date"
            ? a.updatedAt.localeCompare(b.updatedAt)
            : a.name.localeCompare(b.name, "fr")) *
          (direction === "ASC" ? 1 : -1),
      );
      page = Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize)));
      return {
        items: rows.slice((page - 1) * pageSize, page * pageSize),
        total: rows.length,
        page,
        pageSize,
        statuses,
      };
    }
    if (kind === "history") {
      const historySort = sort === "name" ? "action" : "created_at";
      const filter = "WHERE (action LIKE ? OR actor LIKE ? OR note LIKE ?)",
        term = `%${q}%`;
      const total = db
        .prepare(`SELECT count(*) AS n FROM admin_audit ${filter}`)
        .get<{ n: number }>(term, term, term)!.n;
      page = Math.min(page, Math.max(1, Math.ceil(total / pageSize)));
      const items = db
        .prepare(
          `SELECT id,actor AS email,action AS name,note,created_at AS createdAt,created_at AS updatedAt FROM admin_audit ${filter} ORDER BY ${historySort} COLLATE NOCASE ${direction},rowid DESC LIMIT ? OFFSET ?`,
        )
        .all<Omit<AdminRecord, "status" | "version">>(
          term,
          term,
          term,
          pageSize,
          (page - 1) * pageSize,
        )
        .map((r) => ({
          ...r,
          status: "Enregistré",
          source: "Serveur",
          version: 1,
        }));
      return { items, total, page, pageSize, statuses: [] };
    }
    // Les alertes reflètent les dossiers visibles par le rôle, sans recopier leur contenu privé.
    if (kind === "alerts") {
      const filtered = alertRows(account).filter(
        (r) =>
          (!status || r.status === status) &&
          (!category || r.resource === category) &&
          r.name.toLowerCase().includes(q.toLowerCase()),
      );
      if (query.has("sort"))
        filtered.sort(
          (a, b) =>
            (sort === "name"
              ? a.name.localeCompare(b.name, "fr")
              : a.updatedAt.localeCompare(b.updatedAt)) *
            (direction === "ASC" ? 1 : -1),
        );
      page = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)));
      return {
        items: filtered.slice((page - 1) * pageSize, page * pageSize),
        total: filtered.length,
        page,
        pageSize,
        statuses: ["Non lue", "Lue", "Résolue"],
      };
    }
    const term = `%${q.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
    const pendingValues = pendingStatuses[kind] || [];
    const pendingFilter = pending
      ? ` AND status IN (${pendingValues.map(() => "?").join(",") || "NULL"})`
      : "";
    const filter =
      "resource=? AND (?='' OR status=?) AND (name LIKE ? ESCAPE '\\' OR COALESCE(json_extract(data,'$.email'),'') LIKE ? ESCAPE '\\' OR COALESCE(json_extract(data,'$.message'),'') LIKE ? ESCAPE '\\' OR COALESCE(json_extract(data,'$.city'),'') LIKE ? ESCAPE '\\')" +
      pendingFilter;
    const args = [
      kind,
      status,
      status,
      term,
      term,
      term,
      term,
      ...(pending ? pendingValues : []),
    ];
    const total = db
      .prepare(`SELECT count(*) AS n FROM admin_records WHERE ${filter}`)
      .get<{ n: number }>(...args)!.n;
    page = Math.min(page, Math.max(1, Math.ceil(total / pageSize)));
    const items = db
      .prepare(
        `SELECT ${projection} FROM admin_records WHERE ${filter} ORDER BY ${kind === "reports" && !query.has("sort") ? "(status='À traiter') DESC,(json_extract(data,'$.priority')='Risque grave') DESC,created_at ASC," : ""} ${sort} ${direction},id LIMIT ? OFFSET ?`,
      )
      .all<Row>(...args, pageSize, (page - 1) * pageSize)
      .map(unpack);
    const statuses = db
      .prepare(
        "SELECT DISTINCT status FROM admin_records WHERE resource=? ORDER BY status",
      )
      .all<{ status: string }>(kind)
      .map((r) => r.status);
    return { items, total, page, pageSize, statuses };
  }
  function alertRows(account: Account): AdminRecord[] {
    const visible = roleResources[authorize(account, "alerts")].filter(
      (r) => pendingStatuses[r],
    );
    const read = new Set(
      db
        .prepare("SELECT alert FROM admin_alert_reads WHERE account=?")
        .all<{ alert: string }>(account.id)
        .map((r) => r.alert),
    );
    // Journal : les dossiers réglés depuis moins de 30 jours restent visibles, marqués « Résolue ».
    const horizon = new Date(Date.now() - 30 * 86400000).toISOString();
    return visible
      .flatMap((resource) =>
        db
          .prepare(
            `SELECT ${projection} FROM admin_records WHERE resource=? AND (updated_at>=? OR status IN (${pendingStatuses[resource]!.map(() => "?").join(",")}))`,
          )
          .all<Row>(resource, horizon, ...pendingStatuses[resource]!)
          .map(unpack)
          // Un dossier réglé n’est journalisé que s’il a réellement été traité.
          .filter(
            (row) =>
              pendingStatuses[resource]!.includes(row.status) ||
              row.history?.length ||
              row.firstResponseAt,
          )
          .map((row) => {
            const pending = pendingStatuses[resource]!.includes(row.status);
            return {
              ...row,
              resource,
              target: row.id,
              targetType: resource,
              category: labels[resource],
              issue: row.status,
              read: !pending || read.has(row.id),
              status: !pending
                ? "Résolue"
                : read.has(row.id)
                  ? "Lue"
                  : "Non lue",
            };
          }),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  /** Foyers réels de l’installation pour le pilotage : dates, zone et activité par animal. */
  function households(): Household[] {
    const today = now().slice(0, 10);
    return auth.accounts().map((account) => {
      const own = auth.workspace(account);
      const profile = profileRepository(own).get();
      const animals = own
        .prepare("SELECT id FROM animals WHERE deleted_at IS NULL")
        .all<{ id: string }>()
        .map(({ id }) => {
          const activity = own
            .prepare("SELECT kind,at FROM activity WHERE animal=? ORDER BY at")
            .all<{ kind: string; at: string }>(id);
          const complete = own
            .prepare(
              "SELECT breed<>'' AND dob<>'' AND identifier<>'' AS done FROM animal_profiles WHERE animal=?",
            )
            .get<{ done: number }>(id)?.done;
          const reminder = activity.find((a) => a.kind === "reminder-created");
          return {
            profileCompleteAt: complete
              ? (activity.find((a) => a.kind === "profile")?.at ??
                activity[0]?.at ??
                null)
              : null,
            reminderCreatedAt: reminder?.at ?? "",
            scheduledReminder: !!own
              .prepare(
                "SELECT id FROM reminders WHERE animal=? AND done=0 AND deleted_at IS NULL AND date>=? LIMIT 1",
              )
              .get(id, today),
            interactions: activity.map((a) => a.at),
          };
        });
      return {
        createdAt: account.created_at || now(),
        zone: profile.city.trim() || "Non renseignée",
        channel: sampleOrigin(account.id) ?? "Direct",
        animals,
      };
    });
  }
  function detail(
    account: Account,
    kind: AdminResource,
    id: string,
  ): AdminRecord {
    authorize(account, kind);
    seed();
    let row: AdminRecord | undefined;
    if (kind === "users" || kind === "team") {
      row =
        accountRows(kind === "team").find((r) => r.id === id) ||
        (kind === "team"
          ? invitationRows().find((r) => r.id === id)
          : undefined);
      if (row && !row.invitation)
        row.history = db
          .prepare(
            "SELECT actor,action,note,created_at AS date FROM admin_audit WHERE resource IN ('users','team') AND target=? ORDER BY created_at",
          )
          .all(id) as AdminRecord["history"];
    } else if (kind === "alerts")
      row = alertRows(account).find((r) => r.id === id);
    else if (kind === "reports") {
      row = get(kind, id);
      // Contexte de la cible : fiche de l’annuaire ou compte d’un particulier.
      if (row.targetType === "pros") {
        const pro = get("pros", row.target!);
        row.targetName = pro.name;
        row.targetStatus = pro.status;
        row.choices = [
          "Classé sans suite",
          "Signalement confirmé",
          pro.status === "Suspendu" ? "Fiche rétablie" : "Fiche suspendue",
        ];
        row.sanctionable = false;
      } else {
        const target = accountRows().find((a) => a.id === row!.target);
        row.targetName = target
          ? `${target.name} · ${target.email}`
          : "Compte supprimé";
        row.targetStatus = target
          ? `${target.status} · fiches publiques : ${target.visibility}`
          : "Indisponible";
        row.choices = [
          "Classé sans suite",
          "Signalement confirmé",
          target?.visibility === "Masqué" ? "Profil rétabli" : "Profil masqué",
        ];
        row.sanctionable = !!target && target.status !== "Supprimé";
      }
    } else if (kind === "tickets") {
      row = get(kind, id);
      row.assignees = teamNames();
    } else if (kind === "security") {
      row =
        securityRows().find((r) => r.id === id) ||
        sessionRows().find((r) => r.id === id);
    } else if (kind === "history") {
      const entry = db
        .prepare(
          "SELECT id,actor AS email,action AS name,note,created_at AS createdAt,created_at AS updatedAt FROM admin_audit WHERE id=?",
        )
        .get<Omit<AdminRecord, "status" | "version">>(id);
      if (entry)
        row = { ...entry, status: "Enregistré", source: "Serveur", version: 1 };
    } else row = get(kind, id);
    if (!row) throw new ApiError(404, "Ce dossier est introuvable.");
    return row;
  }
  function overview(account: Account): AdminOverview {
    const current = authorize(account);
    seed();
    const counts: AdminOverview["counts"] = {};
    for (const r of roleResources[current])
      counts[r] = list(account, r, new URLSearchParams()).total;
    const attention = Object.entries(labels)
      .filter(([r]) => roleResources[current].includes(r as AdminResource))
      .map(([r, label]) => ({
        resource: r as AdminResource,
        label: label!,
        count: list(
          account,
          r as AdminResource,
          new URLSearchParams("scope=pending&pageSize=1"),
        ).total,
      }));
    const metrics =
      current === "Administrateur"
        ? [
            {
              label: "Comptes inscrits",
              value: accountRows().length,
              description:
                "Comptes réellement enregistrés dans cette installation.",
            },
            {
              label: "Comptes actifs",
              value: accountRows().filter((a) => a.status === "Actif").length,
              description:
                "Comptes non suspendus ; cet indicateur ne mesure pas les connexions.",
            },
            {
              label: "Guides publiés",
              value: publications().guides.length,
              description: "Versions publiées après validation vétérinaire.",
            },
            {
              label: "Actions enregistrées",
              value: counts.history || 0,
              description:
                "Actions administratives conservées dans le journal central.",
            },
          ]
        : [];
    return {
      role: current,
      counts,
      attention,
      recent:
        current === "Administrateur"
          ? list(account, "history", new URLSearchParams("pageSize=5")).items
          : [],
      metrics,
      indicators: [
        {
          id: "users",
          label: "Comptes",
          resource: "users",
          query: "",
          icon: "people",
        },
        {
          id: "pros",
          label: "Professionnels",
          resource: "pros",
          query: "",
          icon: "medical",
        },
        {
          id: "imports",
          label: "Imports à suivre",
          resource: "imports",
          query: "scope=pending",
          icon: "file",
        },
        {
          id: "reports",
          label: "Signalements à traiter",
          resource: "reports",
          query: "scope=pending",
          icon: "shield",
        },
        {
          id: "active-users",
          label: "Comptes autorisés à se connecter",
          resource: "users",
          query: "status=Actif",
          icon: "people",
        },
        {
          id: "validated-pros",
          label: "Fiches professionnelles validées",
          resource: "pros",
          query: "status=Valid%C3%A9",
          icon: "medical",
        },
      ]
        .filter((item) =>
          roleResources[current].includes(item.resource as AdminResource),
        )
        .map((item) => ({
          ...item,
          resource: item.resource as AdminResource,
          count: list(
            account,
            item.resource as AdminResource,
            new URLSearchParams(item.query),
          ).total,
        })),
      pending: attention.map((item) => ({
        ...item,
        total: item.count,
        items: list(
          account,
          item.resource,
          new URLSearchParams("scope=pending&pageSize=5"),
        ).items,
      })),
      unread: roleResources[current].includes("alerts")
        ? list(
            account,
            "alerts",
            new URLSearchParams("status=Non+lue&pageSize=1"),
          ).total
        : 0,
    };
  }
  function create(account: Account, kind: AdminResource, data: Input) {
    const current = authorize(account, kind);
    seed();
    if (
      current !== "Administrateur" &&
      !(current === "Support" && kind === "tickets")
    )
      throw new ApiError(
        403,
        "Cette création est réservée à l’administration.",
      );
    return transaction(db, () => {
      let row: AdminRecord;
      if (kind === "team") {
        const email = emailAddress(data.email),
          memberRole = pick(data.role, adminRoles, "role");
        const target = db
          .prepare("SELECT id FROM accounts WHERE email=?")
          .get<{ id: string }>(email);
        if (!target) {
          // Personne non inscrite : invitation, appliquée à sa première connexion.
          if (
            db
              .prepare("SELECT id FROM admin_invitations WHERE email=?")
              .get(email)
          )
            throw new ApiError(
              409,
              "Une invitation est déjà en attente pour cette adresse.",
              "email",
            );
          const id = randomUUID();
          db.prepare(
            "INSERT INTO admin_invitations(id,email,role,invited_by,created_at,expires_at) VALUES (?,?,?,?,?,?)",
          ).run(
            id,
            email,
            memberRole,
            account.email,
            now(),
            new Date(Date.now() + INVITATION_DAYS * 86400000).toISOString(),
          );
          row = invitationRows().find((r) => r.id === id)!;
          log(account, kind, id, "Invitation : " + email, memberRole);
          inviteByMail(email, memberRole, account.email);
          return row;
        }
        if (
          db
            .prepare("SELECT account FROM admin_members WHERE account=?")
            .get(target.id)
        )
          throw new ApiError(409, "Ce compte appartient déjà à l’équipe.");
        db.prepare("INSERT INTO admin_members(account,role) VALUES (?,?)").run(
          target.id,
          memberRole,
        );
        row = accountRows(true).find((r) => r.id === target.id)!;
        void sendMail({
          to: email,
          subject: "Vous rejoignez l’équipe Anivaya",
          text: `Bonjour,\n\n${account.email} vous a ajouté à l’équipe Anivaya en tant que ${memberRole}. L’administration est accessible dès votre prochaine connexion.`,
          action: {
            label: "Ouvrir l’administration",
            url: `${appUrl()}/#admin`,
          },
        });
      } else if (kind === "library") {
        const title = text(data.name, "name", 180),
          summary = text(data.summary, "summary", 600),
          body = text(data.body, "body", 20000);
        row = insert(kind, {
          name: title,
          status: "Brouillon",
          versions: [{ number: 1, title, summary, body, status: "Brouillon" }],
        });
      } else if (kind === "announcements")
        row = insert(kind, {
          name: text(data.name, "name", 180),
          status: "Brouillon",
          message: text(data.message, "message", 3000),
          audience: pick(
            data.audience,
            ["Tous", "Particuliers", "Professionnels"],
            "audience",
          ),
        });
      else if (kind === "tickets")
        row = insert(kind, {
          name: text(data.name, "name", 180),
          email: emailAddress(data.email),
          message: text(data.message, "message", 3000),
          status: "Ouvert",
          category: "Assistance",
          assignee: "Support",
          history: [],
        });
      else
        throw new ApiError(
          400,
          "Cette rubrique ne permet pas de création manuelle.",
        );
      log(account, kind, row.id, "Création : " + row.name, "");
      return row;
    });
  }
  function act(account: Account, kind: AdminResource, id: string, data: Input) {
    const current = authorize(account, kind),
      action = text(data.action, "action", 50);
    seed();
    const allowed =
      current === "Administrateur" ||
      (current === "Modérateur" &&
        ["reports", "appeals", "alerts"].includes(kind)) ||
      (current === "Support" &&
        ["tickets", "imports", "feedback", "alerts"].includes(kind)) ||
      (current === "Vétérinaire référent" &&
        kind === "library" &&
        action === "review");
    if (!allowed)
      throw new ApiError(403, "Votre rôle ne permet pas cette action.");
    return transaction(db, () => {
      if (kind === "alerts") {
        if (action === "read-all") {
          for (const row of alertRows(account))
            db.prepare(
              "INSERT OR IGNORE INTO admin_alert_reads VALUES (?,?)",
            ).run(account.id, row.id);
          return;
        }
        if (!alertRows(account).some((r) => r.id === id))
          throw new ApiError(404, "Notification introuvable.");
        if (action !== "read" && action !== "unread")
          throw new ApiError(400, "Action inconnue.");
        if (action === "read")
          db.prepare(
            "INSERT OR IGNORE INTO admin_alert_reads VALUES (?,?)",
          ).run(account.id, id);
        else
          db.prepare(
            "DELETE FROM admin_alert_reads WHERE account=? AND alert=?",
          ).run(account.id, id);
        return;
      }
      const note = text(
        data.note ||
          (action === "edit"
            ? "Coordonnées mises à jour depuis la fiche."
            : action === "reset"
              ? "Lien de réinitialisation envoyé depuis la fiche du compte."
              : undefined),
        "note",
        3000,
      );
      if (kind === "security") {
        if (action === "review") {
          const row = get(kind, id);
          checkVersion(data.version, row.version);
          if (row.status !== "À examiner")
            throw new ApiError(409, "Cette alerte est déjà examinée.");
          row.status = "Examiné";
          row.note = note;
          row.history ??= [];
          row.history.push({
            date: now(),
            actor: account.email,
            action: "Examiné",
            note,
          });
          const saved = save(kind, row);
          log(account, kind, id, "Alerte examinée : " + row.name, note);
          return saved;
        }
        if (action !== "revoke") throw new ApiError(400, "Action inconnue.");
        if (!db.prepare("DELETE FROM sessions WHERE token=?").run(id).changes)
          throw new ApiError(404, "Cette session est déjà fermée.");
        log(account, kind, "session", "Session révoquée", note);
        return;
      }
      if (kind === "team" && action === "cancel") {
        const invitation = invitationRows().find((r) => r.id === id);
        if (!invitation) throw new ApiError(404, "Invitation introuvable.");
        db.prepare("DELETE FROM admin_invitations WHERE id=?").run(id);
        log(
          account,
          kind,
          id,
          "Invitation annulée : " + invitation.email,
          note,
        );
        return;
      }
      if (kind === "team" && action === "renew") {
        const invitation = invitationRows().find((r) => r.id === id);
        if (!invitation) throw new ApiError(404, "Invitation introuvable.");
        db.prepare("UPDATE admin_invitations SET expires_at=? WHERE id=?").run(
          new Date(Date.now() + INVITATION_DAYS * 86400000).toISOString(),
          id,
        );
        log(
          account,
          kind,
          id,
          "Invitation prolongée : " + invitation.email,
          note,
        );
        inviteByMail(
          invitation.email ?? "",
          invitation.role ?? "membre",
          account.email,
        );
        return invitationRows().find((r) => r.id === id);
      }
      if (kind === "users" || kind === "team") {
        const row = accountRows(kind === "team").find((r) => r.id === id);
        if (!row) throw new ApiError(404, "Compte introuvable.");
        checkVersion(data.version, row.version);
        if (kind === "users" && action === "reset") {
          // Lien valable une heure envoyé au titulaire ; la demande reste tracée.
          const target = db
            .prepare("SELECT * FROM accounts WHERE id=?")
            .get<Account>(id)!;
          void auth.sendPasswordReset(target);
          log(
            account,
            kind,
            id,
            "Réinitialisation du mot de passe demandée",
            note ||
              "Lien de réinitialisation envoyé depuis la fiche du compte.",
          );
          return detail(account, kind, id);
        }
        if (action === "edit") {
          const target = db
            .prepare("SELECT * FROM accounts WHERE id=?")
            .get<Account>(id)!;
          const profile = auth.user(target).profile;
          auth.saveProfile(target, {
            ...profile,
            photo: undefined,
            name: text(data.name, "name", 120),
            email: emailAddress(data.email),
          });
          if (kind === "users") {
            const accountType = pick(
              data.accountType ?? row.accountType,
              ["Particulier", "Professionnel"],
              "accountType",
            );
            db.prepare(
              "INSERT INTO account_controls(account,status,version,account_type) VALUES (?,?,2,?) ON CONFLICT(account) DO UPDATE SET version=account_controls.version+1,account_type=excluded.account_type",
            ).run(id, row.status, accountType);
          } else
            db.prepare(
              "UPDATE admin_members SET version=version+1 WHERE account=?",
            ).run(id);
          log(account, kind, id, "Coordonnées du compte modifiées", note);
          return detail(account, kind, id);
        }
        if (action !== "save") throw new ApiError(400, "Action inconnue.");
        const status = pick(data.status, ["Actif", "Suspendu"]);
        const nextRole =
          kind === "team" ? pick(data.role, adminRoles, "role") : row.role;
        if (
          id === account.id &&
          (status !== "Actif" || (kind === "team" && nextRole !== current))
        )
          throw new ApiError(
            409,
            "Vous ne pouvez pas retirer votre propre accès.",
          );
        if (
          row.role === "Administrateur" &&
          (status !== "Actif" || nextRole !== "Administrateur") &&
          !db
            .prepare(
              "SELECT m.account FROM admin_members m LEFT JOIN account_controls c ON c.account=m.account WHERE m.role='Administrateur' AND m.status='Actif' AND COALESCE(c.status,'Actif')='Actif' AND m.account<>? LIMIT 1",
            )
            .get(id)
        )
          throw new ApiError(
            409,
            "Conservez au moins un administrateur actif.",
          );
        if (kind === "team")
          db.prepare(
            "UPDATE admin_members SET role=?,status=?,version=version+1 WHERE account=?",
          ).run(nextRole!, status, id);
        else
          db.prepare(
            "INSERT INTO account_controls(account,status,version) VALUES (?,?,2) ON CONFLICT(account) DO UPDATE SET status=excluded.status,version=account_controls.version+1",
          ).run(id, status);
        if (status === "Suspendu")
          db.prepare("DELETE FROM sessions WHERE account=?").run(id);
        log(
          account,
          kind,
          id,
          kind === "team" ? "Accès équipe modifié" : "État du compte modifié",
          note,
        );
        return accountRows(kind === "team").find((r) => r.id === id);
      }
      const row = get(kind, id);
      checkVersion(data.version, row.version);
      if (kind === "library") {
        if (action === "delete") {
          db.prepare(
            "DELETE FROM admin_records WHERE resource='library' AND id=?",
          ).run(id);
          log(account, kind, id, "Contenu supprimé : " + row.name, note);
          return;
        }
        const versions = row.versions!,
          v = versions.at(-1)!;
        if (action === "review") {
          if (current !== "Vétérinaire référent")
            throw new ApiError(
              403,
              "La relecture est réservée au vétérinaire référent.",
            );
          if (v.status !== "À relire")
            throw new ApiError(409, "Cette version n’attend pas de relecture.");
          v.status = pick(data.status, ["Validé", "À corriger"]);
          v.review = { reviewer: account.email, note, date: now() };
        } else if (action === "save") {
          if (!["Brouillon", "À corriger"].includes(v.status))
            throw new ApiError(
              409,
              "Créez une nouvelle version avant de modifier ce guide.",
            );
          Object.assign(v, {
            title: text(data.name, "name", 180),
            summary: text(data.summary, "summary", 600),
            body: text(data.body, "body", 20000),
            status: "Brouillon",
          });
          delete v.review;
          row.name = v.title;
        } else if (action === "submit") {
          if (!["Brouillon", "À corriger"].includes(v.status))
            throw new ApiError(409, "Cette version n’est pas un brouillon.");
          v.status = "À relire";
        } else if (action === "publish") {
          if (v.status !== "Validé" || !v.review)
            throw new ApiError(
              409,
              "Une validation vétérinaire est nécessaire avant publication.",
            );
          versions.forEach((old) => {
            if (old.status === "Publié") old.status = "Archivé";
          });
          v.status = "Publié";
          v.publishedAt = now();
        } else if (action === "version") {
          if (["Brouillon", "À relire", "À corriger"].includes(v.status))
            throw new ApiError(409, "Terminez la version en cours.");
          versions.push({
            number: v.number + 1,
            title: v.title,
            summary: v.summary,
            body: v.body,
            status: "Brouillon",
          });
        } else if (action === "unpublish") {
          const published = versions.find((v) => v.status === "Publié");
          if (!published) throw new ApiError(409, "Aucune version publiée.");
          published.status = "Archivé";
        } else throw new ApiError(400, "Action éditoriale inconnue.");
        row.status = versions.at(-1)!.status;
      } else if (kind === "announcements") {
        if (action === "save" && row.status === "Brouillon")
          Object.assign(row, {
            name: text(data.name, "name", 180),
            message: text(data.message, "message", 3000),
            audience: pick(
              data.audience,
              ["Tous", "Particuliers", "Professionnels"],
              "audience",
            ),
          });
        else if (action === "publish" && row.status === "Brouillon") {
          row.status = "Publié";
          // Destinataires au moment de la diffusion : comptes actifs selon l’audience.
          const accounts = accountRows().filter((a) => a.status === "Actif");
          row.recipients =
            row.audience === "Professionnels"
              ? db
                  .prepare(
                    "SELECT count(*) AS n FROM admin_records WHERE resource='pros' AND status='Validé'",
                  )
                  .get<{ n: number }>()!.n
              : accounts.length;
        } else if (action === "unpublish" && row.status === "Publié")
          row.status = "Archivé";
        else if (action === "delete" && row.status === "Brouillon") {
          db.prepare(
            "DELETE FROM admin_records WHERE resource='announcements' AND id=?",
          ).run(id);
          log(account, kind, id, "Brouillon supprimé : " + row.name, note);
          return;
        } else
          throw new ApiError(409, "Cette annonce ne permet pas cette action.");
      } else if (kind === "deletions") {
        if (row.status !== "À traiter")
          throw new ApiError(409, "Cette demande est déjà traitée.");
        if (action === "decline") {
          row.status = "Refusée";
          if (row.email)
            void sendMail({
              to: row.email,
              subject: "Votre demande de suppression de compte",
              text: `Bonjour,\n\nVotre demande de suppression de compte Anivaya n’a pas été appliquée.${note ? `\n\nMotif : ${note}` : ""}\n\nVous pouvez répondre via le formulaire de contact pour toute question.`,
            });
        } else if (action === "delete") {
          if (row.email)
            void sendMail({
              to: row.email,
              subject: "Votre compte Anivaya a été supprimé",
              text: "Bonjour,\n\nComme vous l’avez demandé, votre compte Anivaya et les données de votre espace ont été supprimés. Merci d’avoir utilisé Anivaya.",
            });
          const target = row.account
            ? db
                .prepare("SELECT id FROM accounts WHERE id=?")
                .get<{ id: string }>(row.account)
            : null;
          if (target) auth.deleteAccountById(target.id);
          // Le dossier ne conserve aucune donnée personnelle après traitement.
          row.status = "Traitée";
          row.name = "Demande traitée";
          row.email = "";
          row.message = "";
          row.account = "";
        } else throw new ApiError(400, "Action inconnue.");
      } else if (kind === "imports") {
        if (action === "retry") {
          if (row.status === "Terminé")
            throw new ApiError(409, "Cet import est déjà terminé.");
          row.status = "Échoué";
          row.issue =
            "Relance demandée : l’utilisateur est invité à importer à nouveau son document.";
          if (row.email)
            void sendMail({
              to: row.email,
              subject: "Votre import de document",
              text: `Bonjour,\n\nL’import de « ${row.name} » n’a pas pu aboutir. Importez à nouveau votre document depuis Documents → Importer avec l’IA, avec une photo nette et bien éclairée ou un PDF.`,
              action: {
                label: "Ouvrir mes documents",
                url: `${appUrl()}/#documents`,
              },
            });
        } else if (action === "incident") {
          if (row.ticketId) return get("tickets", row.ticketId);
          const ticket = insert("tickets", {
            name: text(data.name ?? "Incident : " + row.name, "name", 180),
            status: "Ouvert",
            email: row.email,
            account: row.account,
            message: note,
            category: "Import IA",
            assignee: "Support",
            importId: row.id,
            history: [
              { date: now(), actor: account.email, action: "Incident", note },
            ],
          });
          row.ticketId = ticket.id;
          row.status = "Pris en charge";
          row.history ??= [];
          row.history.push({
            date: now(),
            actor: account.email,
            action: "Ticket créé",
            note,
          });
          save(kind, row);
          log(account, kind, id, "Ticket d’incident : " + row.name, note);
          return ticket;
        } else throw new ApiError(400, "Action inconnue.");
      } else if (kind === "pros") {
        if (action === "proof-file") {
          const proof = row.documents?.find((d) => d.id === data.document);
          if (!proof) throw new ApiError(404, "Justificatif introuvable.");
          const file = data.file as
            { type?: unknown; content?: unknown } | undefined;
          const bytes = documentFile(file?.type, file?.content, "file");
          const fileName = text(data.fileName ?? proof.name, "fileName", 180);
          db.prepare(
            "INSERT INTO admin_files(id,record,document,name,type,content,created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(record,document) DO UPDATE SET name=excluded.name,type=excluded.type,content=excluded.content,created_at=excluded.created_at",
          ).run(
            randomUUID(),
            id,
            proof.id,
            fileName,
            String(file!.type),
            bytes,
            now(),
          );
          proof.file = true;
          proof.fileName = fileName;
          if (proof.status === "Manquant") proof.status = "À examiner";
          proof.history ??= [];
          proof.history.push({
            date: now(),
            actor: account.email,
            action: "Pièce reçue",
            note,
          });
        } else if (action === "proof") {
          const proof = row.documents?.find((d) => d.id === data.document);
          if (!proof) throw new ApiError(404, "Justificatif introuvable.");
          proof.status = pick(data.status, [
            "Manquant",
            "À examiner",
            "Conforme",
            "Refusé",
            "À corriger",
          ]);
          proof.applicable = data.applicable === true;
          proof.note = note;
          proof.history ??= [];
          proof.history.push({
            date: now(),
            actor: account.email,
            action: proof.status,
            note,
          });
          proof.expires = data.expires ? date(data.expires, "expires") : "";
          if (row.status === "Validé") row.status = "À vérifier";
        } else if (action === "edit") {
          row.name = text(data.name, "name", 180);
          row.email = data.email ? emailAddress(data.email) : "";
          row.city = text(data.city, "city", 120);
          row.category = text(data.category, "category", 120);
          row.body = text(data.body ?? "", "body", 3000, false);
        } else if (action === "save") {
          row.name = text(data.name ?? row.name, "name", 180);
          row.city = text(data.city ?? row.city, "city", 120);
          row.category = text(data.category ?? row.category, "category", 120);
          row.body = text(data.body ?? row.body ?? "", "body", 3000, false);
          const siret = text(data.siret ?? "", "siret", 14, false);
          if (siret && !/^\d{14}$/.test(siret))
            throw new ApiError(400, "Le SIRET comporte 14 chiffres.", "siret");
          row.siret = siret;
          row.status = pick(data.status, [
            "À vérifier",
            "À corriger",
            "Validé",
            "Suspendu",
            "Refusé",
          ]);
          if (
            row.status === "Validé" &&
            (!row.siret ||
              !row.documents?.length ||
              row.documents.some(
                (d) =>
                  d.applicable &&
                  (d.status !== "Conforme" ||
                    (d.expires && d.expires < now().slice(0, 10))),
              ))
          )
            throw new ApiError(
              409,
              "Renseignez le SIRET et contrôlez toutes les pièces applicables avant validation.",
            );
        } else throw new ApiError(400, "Action inconnue.");
      } else if (kind === "reports") {
        if (action === "priority")
          row.priority = pick(
            data.priority,
            ["Normale", "Risque grave"],
            "priority",
          );
        else if (action === "reopen") row.status = "À traiter";
        else if (action === "decide") {
          if (row.status !== "À traiter")
            throw new ApiError(
              409,
              "Rouvrez le dossier avant une nouvelle décision.",
            );
          const context = detail(account, "reports", id);
          row.status = pick(data.status, context.choices!);
          row.firstResponseAt ??= now();
          if (
            row.status === "Fiche suspendue" ||
            row.status === "Fiche rétablie"
          ) {
            const pro = get("pros", row.target!);
            pro.status =
              row.status === "Fiche suspendue" ? "Suspendu" : "À vérifier";
            save("pros", pro);
          }
          if (row.status === "Profil masqué" || row.status === "Profil rétabli")
            setVisibility(
              row.target!,
              row.status === "Profil masqué" ? "Masqué" : "Visible",
            );
          // Sanction du compte signalé, réservée aux décisions qui ne classent pas le dossier.
          const sanction = data.accountAction
            ? pick(data.accountAction, ACCOUNT_ACTIONS, "accountAction")
            : "Aucune sanction";
          if (sanction !== "Aucune sanction") {
            if (!context.sanctionable || row.status === "Classé sans suite")
              throw new ApiError(
                400,
                "Cette décision ne permet pas de sanctionner ce compte.",
                "accountAction",
              );
            if (sanction === "Suspendre le compte") {
              if (row.target === account.id)
                throw new ApiError(
                  409,
                  "Vous ne pouvez pas suspendre votre propre compte.",
                );
              suspendAccount(row.target!);
            }
            const targetEmail = accountRows().find(
              (a) => a.id === row.target,
            )?.email;
            if (targetEmail)
              void sendMail({
                to: targetEmail,
                subject:
                  sanction === "Suspendre le compte"
                    ? "Votre compte Anivaya est suspendu"
                    : "Avertissement concernant votre compte Anivaya",
                text: `Bonjour,\n\nÀ la suite d’un signalement (${row.reference}), l’équipe de modération ${sanction === "Suspendre le compte" ? "a suspendu votre compte" : "vous adresse un avertissement"}.${note ? `\n\nMotif : ${note}` : ""}\n\nVous pouvez contester cette décision depuis Contact → Vos demandes, avec la référence ${row.reference}.`,
              });
            log(
              account,
              "users",
              row.target!,
              sanction === "Suspendre le compte"
                ? "Compte suspendu après signalement"
                : "Avertissement après signalement",
              `${row.reference} : ${note}`,
            );
            row.accountAction = sanction;
          }
          // Les recours en attente de ce dossier sont clos par la nouvelle décision.
          for (const appeal of db
            .prepare(
              "SELECT " +
                projection +
                " FROM admin_records WHERE resource='appeals' AND json_extract(data,'$.target')=? AND status='Réexamen demandé'",
            )
            .all<Row>(id)
            .map(unpack)) {
            appeal.status = "Réexamen terminé";
            appeal.history ??= [];
            appeal.history.push({
              date: now(),
              actor: account.email,
              action: "Nouvelle décision : " + row.status,
              note,
            });
            save("appeals", appeal);
          }
        } else throw new ApiError(400, "Action inconnue.");
      } else if (kind === "appeals") {
        if (action !== "decide" || row.status !== "À examiner")
          throw new ApiError(
            409,
            "Ce recours ne peut pas être traité à nouveau.",
          );
        row.status = pick(data.status, [
          "Décision maintenue",
          "Réexamen demandé",
        ]);
        if (row.status === "Réexamen demandé") {
          const report = get("reports", row.target!);
          report.status = "À traiter";
          save("reports", report);
        }
      } else if (kind === "tickets" || kind === "feedback") {
        if (kind === "feedback" && action === "ticket") {
          if (row.ticketId) return get("tickets", row.ticketId);
          const ticket = insert("tickets", {
            name: "Import IA : " + row.name,
            status: "Ouvert",
            email: row.email,
            account: row.account,
            message: row.message,
            category: "Import IA",
            assignee: "Support",
            feedbackId: row.id,
            history: [],
          });
          row.ticketId = ticket.id;
          row.status = "Pris en charge";
          row.history ??= [];
          row.history.push({
            date: now(),
            actor: account.email,
            action: "Transmis au support",
            note,
          });
          save(kind, row);
          log(account, kind, id, "Ticket créé : " + row.name, note);
          return ticket;
        }
        if (action !== "reply" && action !== "save")
          throw new ApiError(400, "Action inconnue.");
        row.status = pick(
          data.status,
          kind === "tickets"
            ? ["Ouvert", "En cours", "Résolu", "Fermé"]
            : ["Nouveau", "À analyser", "Pris en charge", "Résolu", "Classé"],
        );
        if (data.assignee)
          row.assignee = pick(data.assignee, teamNames(), "assignee");
      } else
        throw new ApiError(400, "Aucune action disponible pour ce dossier.");
      row.note = note;
      row.history ??= [];
      row.history.push({ date: now(), actor: account.email, action, note });
      const saved = save(kind, row);
      log(account, kind, id, action + " : " + row.name, note);
      // Réponse du support : envoyée à la personne qui a écrit.
      if (kind === "tickets" && action === "reply" && note && row.email)
        void sendMail({
          to: row.email,
          subject: `Réponse à votre demande : ${row.name}`,
          text: `Bonjour,\n\n${note}\n\nÉtat de votre demande : ${row.status}.\n\nL’équipe Anivaya`,
          action: {
            label: "Voir mes demandes",
            url: `${appUrl()}/#contact/recours`,
          },
        });
      return saved;
    });
  }
  function publications(account?: Account | null) {
    seed();
    const guides = db
      .prepare(
        `SELECT ${projection} FROM admin_records WHERE resource='library'`,
      )
      .all<Row>()
      .map(unpack)
      .flatMap((r) =>
        (r.versions || [])
          .filter((v) => v.status === "Publié" && v.review)
          .map((v) => ({
            id: r.id,
            title: v.title,
            summary: v.summary,
            body: v.body,
            publishedAt: v.publishedAt,
            version: v.number,
          })),
      );
    const announcements = db
      .prepare(
        `SELECT ${projection} FROM admin_records WHERE resource='announcements' AND status='Publié' ORDER BY updated_at DESC LIMIT 50`,
      )
      .all<Row>()
      .map(unpack)
      .map((r) => ({
        id: r.id,
        name: r.name,
        message: r.message,
        audience: r.audience,
        updatedAt: r.updatedAt,
      }));
    return {
      guides,
      announcements: announcements.filter(
        (a) =>
          a.audience === "Tous" || (account && a.audience === "Particuliers"),
      ),
    };
  }
  function contact(data: Input, account?: Account | null) {
    const name = text(data.name, "name", 120),
      email = emailAddress(data.email),
      subject = text(data.subject, "subject", 180),
      message = text(data.message, "message", 2000);
    if (message.length < 10)
      throw new ApiError(400, "Ajoutez au moins 10 caractères.", "message");
    const record = insert("tickets", {
      name: subject,
      email,
      message,
      category: subject,
      status: "Ouvert",
      account: account?.id,
      assignee: "Support",
      history: [
        { date: now(), actor: name, action: "Demande reçue", note: message },
      ],
    });
    void sendMail({
      to: email,
      subject: `Nous avons bien reçu votre demande : ${subject}`,
      text: `Bonjour ${name},\n\nVotre demande a bien été transmise à l’équipe Anivaya. Nous vous répondrons à cette adresse.\n\nVotre message :\n${message}`,
    });
    return { reference: record.id, status: record.status };
  }
  /** Invitation à rejoindre l’équipe : à créer son compte avec l’adresse invitée. */
  function inviteByMail(email: string, role: string, invitedBy: string) {
    void sendMail({
      to: email,
      subject: "Invitation à rejoindre l’équipe Anivaya",
      text: `Bonjour,\n\n${invitedBy} vous invite à rejoindre l’équipe Anivaya en tant que ${role}. L’invitation est valable ${INVITATION_DAYS} jours.\n\nCréez votre compte avec cette adresse e-mail, ou connectez-vous si vous en avez déjà un : l’accès à l’administration s’ouvre à votre première connexion.`,
      action: { label: "Rejoindre l’équipe", url: `${appUrl()}/#inscription` },
    });
  }
  function createReport(
    reporter: Account | null | undefined,
    targetType: string,
    target: string,
    data: Input,
  ) {
    const row = insert("reports", {
      name: text(data.name, "name", 180),
      message: text(data.message, "message", 3000),
      target,
      targetType,
      account: reporter?.id,
      email: reporter?.email || "",
      status: "À traiter",
      priority: "Normale",
      reference: "DEC-" + randomUUID().slice(0, 12).toUpperCase(),
      history: [],
    });
    return { id: row.id, reference: row.reference, status: row.status };
  }
  function submitReport(account: Account, data: Input) {
    const targetType = pick(data.targetType, ["pros", "users"], "targetType"),
      target = text(data.target, "target", 100);
    if (targetType === "pros") get("pros", target);
    else {
      if (target === account.id)
        throw new ApiError(
          400,
          "Vous ne pouvez pas signaler votre propre compte.",
        );
      if (!db.prepare("SELECT id FROM accounts WHERE id=?").get(target))
        throw new ApiError(404, "Compte introuvable.");
    }
    return createReport(account, targetType, target, data);
  }
  /** Signalement d’une fiche d’urgence publique, depuis son lien, avec ou sans session. */
  function reportPublicSheet(
    token: string,
    data: Input,
    reporter?: Account | null,
  ) {
    const owner = auth.publicOwner(token);
    if (!owner) throw new ApiError(404, "Fiche indisponible.");
    if (reporter && reporter.id === owner.account)
      throw new ApiError(
        400,
        "Vous ne pouvez pas signaler votre propre fiche.",
      );
    return createReport(reporter, "users", owner.account, {
      ...data,
      name: data.name || "Fiche publique signalée",
    });
  }
  /** Demande de suppression confiée à l’équipe ; le compte reste actif jusqu’à la décision. */
  function requestDeletion(account: Account, data: Input) {
    if (
      db
        .prepare(
          "SELECT id FROM admin_records WHERE resource='deletions' AND status='À traiter' AND json_extract(data,'$.account')=?",
        )
        .get(account.id)
    )
      throw new ApiError(
        409,
        "Votre demande de suppression est déjà en cours d’examen.",
      );
    const name = auth.user(account).profile.name;
    const row = insert("deletions", {
      name: "Demande de " + name,
      account: account.id,
      email: account.email,
      message: text(data.message ?? "", "message", 1000, false),
      status: "À traiter",
      history: [],
    });
    return { id: row.id, status: row.status };
  }
  /** Suivi d’un import assisté validé par l’utilisateur ; aucune extraction réelle n’a lieu. */
  /**
   * Suivi d’un import par l’assistance : « Terminé » quand l’utilisateur a enregistré les
   * informations vérifiées, « Échoué » quand l’analyse n’a pas abouti (avec la raison).
   */
  function registerImport(account: Account, data: Input) {
    const status = pick(data.status ?? "À analyser", [
      "À analyser",
      "Terminé",
      "Échoué",
    ]);
    const row = insert("imports", {
      name: text(data.name, "name", 180),
      account: account.id,
      email: account.email,
      kind: pick(data.kind, ["Fichier", "Exemple intégré"], "kind"),
      status,
      issue:
        status === "Terminé"
          ? "Informations extraites par l’IA, vérifiées puis enregistrées par l’utilisateur."
          : text(data.issue ?? "", "issue", 300, false),
      history: [],
    });
    return { id: row.id, status: row.status };
  }
  /** Alerte de sécurité déposée par l’authentification (tentatives répétées, MFA désactivée…). */
  function securityEvent(kind: string, detail: string, target?: string) {
    insert("security", {
      name: kind,
      kind: "Connexion",
      message: detail,
      account: target,
      status: "À examiner",
      history: [],
    });
  }
  /** Invitation acceptée à la première connexion de la personne invitée. */
  function acceptInvitation(account: Account) {
    const invitation = db
      .prepare(
        "SELECT id,role,expires_at AS expiresAt FROM admin_invitations WHERE email=?",
      )
      .get<{ id: string; role: AdminRole; expiresAt: string }>(account.email);
    if (!invitation) return;
    db.prepare("DELETE FROM admin_invitations WHERE id=?").run(invitation.id);
    if (invitation.expiresAt < now()) return;
    db.prepare(
      "INSERT OR IGNORE INTO admin_members(account,role) VALUES (?,?)",
    ).run(account.id, invitation.role);
    db.prepare("INSERT INTO admin_audit VALUES (?,?,?,?,?,?,?)").run(
      randomUUID(),
      account.email,
      "Invitation acceptée",
      "team",
      account.id,
      invitation.role,
      now(),
    );
  }
  function proofFile(account: Account, id: string, document: string) {
    authorize(account, "pros");
    const file = db
      .prepare(
        "SELECT name,type,content FROM admin_files WHERE record=? AND document=?",
      )
      .get<{ name: string; type: string; content: Uint8Array }>(id, document);
    if (!file) throw new ApiError(404, "Aucun fichier pour ce justificatif.");
    return file;
  }
  function appeal(account: Account, data: Input) {
    const reference = text(data.reference, "reference", 80),
      message = text(data.message, "message", 3000);
    const report = db
      .prepare(
        `SELECT ${projection} FROM admin_records WHERE resource='reports' AND json_extract(data,'$.reference')=? AND json_extract(data,'$.account')=?`,
      )
      .get<Row>(reference, account.id);
    if (!report)
      throw new ApiError(
        404,
        "Aucune décision correspondante pour votre compte.",
        "reference",
      );
    if (report.status === "À traiter")
      throw new ApiError(409, "Ce signalement attend encore une décision.");
    if (
      db
        .prepare(
          "SELECT id FROM admin_records WHERE resource='appeals' AND json_extract(data,'$.target')=? AND status IN ('À examiner','Réexamen demandé')",
        )
        .get(report.id)
    )
      throw new ApiError(
        409,
        "Un recours est déjà en cours pour cette décision.",
      );
    return insert("appeals", {
      name: "Recours " + reference,
      reference,
      message,
      status: "À examiner",
      target: report.id,
      targetType: "reports",
      email: account.email,
      account: account.id,
      history: [],
    });
  }
  function mine(account: Account) {
    return db
      .prepare(
        `SELECT ${projection} FROM admin_records WHERE resource IN ('reports','appeals','tickets','feedback') AND json_extract(data,'$.account')=? ORDER BY updated_at DESC LIMIT 100`,
      )
      .all<Row>(account.id)
      .map(unpack)
      .map((r) => ({
        ...r,
        history: r.history?.map((h) => ({
          ...h,
          actor: h.actor === account.email ? "Vous" : "Équipe Anivaya",
        })),
      }));
  }
  function directory() {
    seed();
    return directoryRepository(db)
      .all()
      .professionals.flatMap((pro) => {
        const row = get("pros", pro.id);
        return ["Suspendu", "Refusé"].includes(row.status)
          ? []
          : [
              {
                ...pro,
                name: row.name,
                city: row.city || pro.city,
                category: row.category || pro.category,
                about: row.body || pro.about,
                verification: row.status,
              },
            ];
      });
  }
  function requireAvailableProfessional(id: unknown) {
    seed();
    const row = get("pros", text(id, "professional", 80));
    if (["Suspendu", "Refusé"].includes(row.status))
      throw new ApiError(
        409,
        "Ce professionnel n’est plus disponible dans l’annuaire.",
      );
  }
  function feedback(account: Account, data: Input) {
    const importId = data.importId
      ? text(data.importId, "importId", 100)
      : undefined;
    if (
      importId &&
      !db
        .prepare(
          "SELECT id FROM admin_records WHERE resource='imports' AND id=? AND json_extract(data,'$.account')=?",
        )
        .get(importId, account.id)
    )
      throw new ApiError(404, "Import introuvable.", "importId");
    return insert("feedback", {
      name: text(data.name, "name", 180),
      message: text(data.message, "message", 3000),
      category: pick(
        data.category,
        ["Information incorrecte", "Difficulté rencontrée", "Suggestion"],
        "category",
      ),
      account: account.id,
      email: account.email,
      status: "Nouveau",
      ...(importId ? { importId } : {}),
      history: [],
    });
  }
  return {
    role,
    authorize,
    resource,
    list,
    detail,
    overview,
    create,
    act,
    publications,
    contact,
    submitReport,
    reportPublicSheet,
    requestDeletion,
    registerImport,
    securityEvent,
    acceptInvitation,
    proofFile,
    appeal,
    mine,
    directory,
    requireAvailableProfessional,
    feedback,
    households,
  };
}
export type AdminService = ReturnType<typeof adminService>;
