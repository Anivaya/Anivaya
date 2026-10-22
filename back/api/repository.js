import { randomUUID } from "node:crypto";
import { ApiError, text, date, documentFile } from "./validation.js";
import { createAnimalRepository } from "./animals.js";
import { emergencyRepository } from "./emergency.js";
import { sharingRepository, localToday } from "./sharing.js";

export function createRepository(db) {
  const records = createAnimalRepository(db);
  const emergency = emergencyRepository(db, records.allAnimals);
  const sharing = sharingRepository(db);
  function reminderValues(data) {
    const repeat = data.repeat ?? "Aucune",
      notice = data.notice ?? "Le jour même";
    if (
      !["Aucune", "Chaque semaine", "Chaque mois", "Chaque année"].includes(
        repeat,
      )
    )
      throw new ApiError(400, "Choisissez une répétition valide.", "repeat");
    if (
      ![
        "Le jour même",
        "1 jour avant",
        "3 jours avant",
        "7 jours avant",
      ].includes(notice)
    )
      throw new ApiError(400, "Choisissez un délai valide.", "notice");
    return [
      text(data.name, "name", 80),
      animal(data.animal),
      date(data.date),
      repeat,
      notice,
      text(data.note ?? "", "note", 1000, false),
    ];
  }
  const animal = (id) => {
    if (typeof id !== "string")
      throw new ApiError(400, "Choisissez un animal existant.", "animal");
    if (
      !db
        .prepare("SELECT id FROM animals WHERE id = ? AND deleted_at IS NULL")
        .get(id ?? null)
    )
      throw new ApiError(400, "Choisissez un animal existant.", "animal");
    return id;
  };
  const find = (table, id) => {
    const row = db
      .prepare(`SELECT * FROM ${table} WHERE id = ? AND deleted_at IS NULL`)
      .get(id);
    if (!row) throw new ApiError(404, "Cet élément est introuvable.");
    return row;
  };
  const publicDoc = ({ content, deleted_at, ...row }) => ({
    ...row,
    example: Boolean(row.example),
    hasFile: Boolean(content),
    url: content ? `/api/documents/${row.id}/file` : null,
  });
  return {
    ...records,
    emergency,
    sharing,
    dashboard() {
      return {
        today: localToday(),
        household: db
          .prepare(
            "SELECT first_name AS firstName, last_name AS lastName, label FROM household WHERE id = 1",
          )
          .get(),
        animals: records.allAnimals(),
        events: records.events(),
        emergencySheets: emergency.all(),
        people: sharing.allPeople(),
        shares: sharing.allShares(),
        reminders: db
          .prepare(
            "SELECT r.* FROM reminders r JOIN animals a ON a.id=r.animal WHERE r.deleted_at IS NULL AND a.deleted_at IS NULL ORDER BY r.date,r.rowid",
          )
          .all()
          .map((row) => ({ ...row, done: Boolean(row.done) })),
        documents: db
          .prepare(
            "SELECT d.id,d.name,d.animal,d.type,d.example,d.category,length(d.content) AS content FROM documents d JOIN animals a ON a.id=d.animal WHERE d.deleted_at IS NULL AND a.deleted_at IS NULL ORDER BY d.rowid",
          )
          .all()
          .map(publicDoc),
      };
    },
    addAnimal(data) {
      return records.createAnimal(data);
    },
    addReminder(data) {
      const id = randomUUID();
      db.prepare(
        "INSERT INTO reminders(id,name,animal,date,repeat,notice,note,done) VALUES (?,?,?,?,?,?,?,0)",
      ).run(id, ...reminderValues(data));
      return { ...find("reminders", id), done: false };
    },
    setReminder(id, data) {
      find("reminders", id);
      if (Object.hasOwn(data, "done") && typeof data.done !== "boolean")
        throw new ApiError(400, "Le statut doit être un booléen.", "done");
      const old = find("reminders", id);
      animal(old.animal);
      const values = reminderValues({ ...old, ...data });
      db.prepare(
        "UPDATE reminders SET name=?,animal=?,date=?,repeat=?,notice=?,note=?,done=? WHERE id=?",
      ).run(...values, Number(data.done ?? old.done), id);
      const saved = find("reminders", id);
      return { ...saved, done: Boolean(saved.done) };
    },
    deleteReminder(id) {
      const row = find("reminders", id);
      animal(row.animal);
      db.prepare("UPDATE reminders SET deleted_at=? WHERE id=?").run(
        new Date().toISOString(),
        id,
      );
    },
    addDocument(data) {
      const id = randomUUID();
      const content = documentFile(data.type, data.content);
      db.prepare(
        "INSERT INTO documents (id,name,animal,type,content,example,category) VALUES (?,?,?,?,?,0,?)",
      ).run(
        id,
        text(data.name, "name", 120),
        animal(data.animal),
        data.type,
        content,
        text(data.category || "Santé", "category", 40),
      );
      return publicDoc(find("documents", id));
    },
    editDocument(id, data) {
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
        ).run(newFile, data.type, id);
      return publicDoc(find("documents", id));
    },
    deleteDocument(id) {
      find("documents", id);
      db.prepare("UPDATE document_shares SET revoked=1 WHERE doc=?").run(id);
      db.prepare("UPDATE documents SET deleted_at = ? WHERE id = ?").run(
        new Date().toISOString(),
        id,
      );
    },
    file(id) {
      const row = find("documents", id);
      animal(row.animal);
      if (!row.content)
        throw new ApiError(
          404,
          "Ce document de démonstration ne contient aucun fichier.",
        );
      return row;
    },
  };
}
