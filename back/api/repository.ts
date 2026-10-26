import type {
  Database,
  Input,
  Dashboard,
  Document,
  DocumentRow,
  Household,
  ReminderRow,
} from "../database/types.ts";
import { randomUUID } from "node:crypto";
import {
  ApiError,
  text,
  date,
  oneOf,
  localToday,
  documentFile,
} from "./validation.ts";
import { createAnimalRepository } from "./animals.ts";
import { emergencyRepository } from "./emergency.ts";
import { sharingRepository } from "./sharing.ts";
import { notificationsRepository } from "./notifications.ts";

const repeats = ["Aucune", "Chaque semaine", "Chaque mois", "Chaque année"];
const notices = [
  "Le jour même",
  "1 jour avant",
  "3 jours avant",
  "7 jours avant",
];

const publicDocument = ({
  content,
  deleted_at,
  ...row
}: DocumentRow): Document => ({
  ...row,
  example: Boolean(row.example),
  hasFile: Boolean(content),
  url: content ? `/api/documents/${row.id}/file` : null,
});
const publicReminder = (row: ReminderRow) => ({
  ...row,
  done: Boolean(row.done),
});

/** Données d’un espace : animaux, événements, rappels, documents, fiches et partages. */
export function createRepository(
  db: Database,
  publicURL?: (animal: string) => string,
) {
  const records = createAnimalRepository(db);
  const emergency = emergencyRepository(db, records.allAnimals, publicURL);
  const sharing = sharingRepository(db);
  const notifications = notificationsRepository(db);

  /** Animal choisi dans un formulaire : il doit exister et ne pas être supprimé. */
  function animal(id: unknown) {
    const exists =
      typeof id === "string" &&
      db
        .prepare("SELECT id FROM animals WHERE id = ? AND deleted_at IS NULL")
        .get(id);
    if (!exists)
      throw new ApiError(400, "Choisissez un animal existant.", "animal");
    return id;
  }
  function find<T extends "documents" | "reminders">(table: T, id: string) {
    const row = db
      .prepare(`SELECT * FROM ${table} WHERE id = ? AND deleted_at IS NULL`)
      .get<{ documents: DocumentRow; reminders: ReminderRow }[T]>(id);
    if (!row) throw new ApiError(404, "Cet élément est introuvable.");
    return row;
  }
  function softDelete(table: "documents" | "reminders", id: string) {
    db.prepare(`UPDATE ${table} SET deleted_at = ? WHERE id = ?`).run(
      new Date().toISOString(),
      id,
    );
  }
  function reminderValues(data: Input) {
    const repeat = oneOf(
        text(data.repeat ?? "Aucune", "repeat", 40),
        repeats,
        "repeat",
        "Choisissez une répétition valide.",
      ),
      notice = oneOf(
        text(data.notice ?? "Le jour même", "notice", 40),
        notices,
        "notice",
        "Choisissez un délai valide.",
      );
    return [
      text(data.name, "name", 80),
      animal(data.animal),
      date(data.date),
      repeat,
      notice,
      text(data.note ?? "", "note", 1000, false),
    ];
  }
  function dashboard(): Dashboard {
    return {
      today: localToday(),
      household: db
        .prepare(
          "SELECT first_name AS firstName, last_name AS lastName, label FROM household WHERE id = 1",
        )
        .get<Household>()!,
      animals: records.allAnimals(),
      events: records.events(),
      emergencySheets: emergency.all(),
      people: sharing.allPeople(),
      shares: sharing.allShares(),
      notifications: notifications.all(),
      reminders: db
        .prepare(
          "SELECT r.* FROM reminders r JOIN animals a ON a.id=r.animal WHERE r.deleted_at IS NULL AND a.deleted_at IS NULL ORDER BY r.date,r.rowid",
        )
        .all<ReminderRow>()
        .map(publicReminder),
      documents: db
        .prepare(
          "SELECT d.id,d.name,d.animal,d.type,d.example,d.category,length(d.content) AS content FROM documents d JOIN animals a ON a.id=d.animal WHERE d.deleted_at IS NULL AND a.deleted_at IS NULL ORDER BY d.rowid",
        )
        .all<DocumentRow>()
        .map(publicDocument),
    };
  }

  return {
    ...records,
    emergency,
    sharing,
    notifications,
    dashboard,
    /** Carnet d’un animal : le dashboard filtré sur cet animal. */
    animalRecord(id: string) {
      const data = dashboard(),
        pet = data.animals.find((a) => a.id === id);
      if (!pet) throw new ApiError(404, "Cet animal est introuvable.");
      return {
        pet,
        events: data.events.filter((e) => e.animal === id),
        reminders: data.reminders.filter((r) => r.animal === id),
        documents: data.documents.filter((d) => d.animal === id),
        people: data.people.filter((p) => p.animals.includes(id)),
        shares: data.shares.filter((s) =>
          data.documents.some((d) => d.id === s.doc && d.animal === id),
        ),
      };
    },
    addReminder(data: Input) {
      const id = randomUUID();
      db.prepare(
        "INSERT INTO reminders(id,name,animal,date,repeat,notice,note,done) VALUES (?,?,?,?,?,?,?,0)",
      ).run(id, ...reminderValues(data));
      return publicReminder(find("reminders", id));
    },
    setReminder(id: string, data: Input) {
      const old = find("reminders", id);
      if (Object.hasOwn(data, "done") && typeof data.done !== "boolean")
        throw new ApiError(400, "Le statut doit être un booléen.", "done");
      animal(old.animal);
      db.prepare(
        "UPDATE reminders SET name=?,animal=?,date=?,repeat=?,notice=?,note=?,done=? WHERE id=?",
      ).run(
        ...reminderValues({ ...old, ...data }),
        Number(data.done ?? old.done),
        id,
      );
      return publicReminder(find("reminders", id));
    },
    deleteReminder(id: string) {
      animal(find("reminders", id).animal);
      softDelete("reminders", id);
    },
    addDocument(data: Input) {
      const id = randomUUID();
      const content = documentFile(data.type, data.content);
      db.prepare(
        "INSERT INTO documents (id,name,animal,type,content,example,category) VALUES (?,?,?,?,?,0,?)",
      ).run(
        id,
        text(data.name, "name", 120),
        animal(data.animal),
        text(data.type, "type", 100),
        content,
        text(data.category || "Santé", "category", 40),
      );
      return publicDocument(find("documents", id));
    },
    editDocument(id: string, data: Input) {
      const old = find("documents", id);
      const newFile = data.content
        ? documentFile(data.type, data.content)
        : null;
      db.prepare(
        "UPDATE documents SET name = ?, animal = ?, category=? WHERE id = ?",
      ).run(
        text(data.name, "name", 120),
        animal(data.animal),
        text(data.category || old.category, "category", 40),
        id,
      );
      if (newFile)
        db.prepare(
          "UPDATE documents SET content=?,type=?,example=0 WHERE id=?",
        ).run(newFile, text(data.type, "type", 100), id);
      return publicDocument(find("documents", id));
    },
    deleteDocument(id: string) {
      find("documents", id);
      db.prepare("UPDATE document_shares SET revoked=1 WHERE doc=?").run(id);
      softDelete("documents", id);
    },
    file(id: string) {
      const row = find("documents", id);
      animal(row.animal);
      if (!(row.content instanceof Uint8Array))
        throw new ApiError(
          404,
          "Ce document de démonstration ne contient aucun fichier.",
        );
      return {
        name: row.name,
        content: row.content,
        type: row.type ?? "application/octet-stream",
      };
    },
  };
}
