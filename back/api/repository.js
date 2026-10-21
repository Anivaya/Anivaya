import { randomUUID } from "node:crypto";
import { ApiError, text, date, documentFile } from "./validation.js";

export function createRepository(db) {
  const animal = (id) => {
    if (typeof id !== "string")
      throw new ApiError(400, "Choisissez un animal existant.", "animal");
    if (!db.prepare("SELECT id FROM animals WHERE id = ?").get(id ?? null))
      throw new ApiError(400, "Choisissez un animal existant.", "animal");
    return id;
  };
  const find = (table, id) => {
    const row = db
      .prepare(
        `SELECT * FROM ${table} WHERE id = ? ${table === "documents" ? "AND deleted_at IS NULL" : ""}`,
      )
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
    dashboard() {
      return {
        household: db
          .prepare(
            "SELECT first_name AS firstName, last_name AS lastName, label FROM household WHERE id = 1",
          )
          .get(),
        animals: db.prepare("SELECT * FROM animals ORDER BY rowid").all(),
        reminders: db
          .prepare("SELECT * FROM reminders ORDER BY date, rowid")
          .all()
          .map((row) => ({ ...row, done: Boolean(row.done) })),
        documents: db
          .prepare(
            "SELECT id,name,animal,type,example,length(content) AS content FROM documents WHERE deleted_at IS NULL ORDER BY rowid",
          )
          .all()
          .map(publicDoc),
      };
    },
    addAnimal(data) {
      const name = text(data.name, "name", 40);
      if (!["Chien", "Chat"].includes(data.species))
        throw new ApiError(400, "Choisissez Chien ou Chat.", "species");
      const description =
        text(data.description ?? "", "description", 70, false) ||
        "Profil à compléter";
      const id = randomUUID();
      db.prepare("INSERT INTO animals VALUES (?,?,?,?,?)").run(
        id,
        name,
        data.species,
        description,
        "new",
      );
      return find("animals", id);
    },
    addReminder(data) {
      const id = randomUUID();
      db.prepare("INSERT INTO reminders VALUES (?,?,?,?,0)").run(
        id,
        text(data.name, "name", 80),
        animal(data.animal),
        date(data.date),
      );
      return { ...find("reminders", id), done: false };
    },
    setReminder(id, data) {
      find("reminders", id);
      if (typeof data.done !== "boolean")
        throw new ApiError(400, "Le statut doit être un booléen.", "done");
      db.prepare("UPDATE reminders SET done = ? WHERE id = ?").run(
        Number(data.done),
        id,
      );
      return { ...find("reminders", id), done: data.done };
    },
    addDocument(data) {
      const id = randomUUID();
      const content = documentFile(data.type, data.content);
      db.prepare(
        "INSERT INTO documents (id,name,animal,type,content,example) VALUES (?,?,?,?,?,0)",
      ).run(
        id,
        text(data.name, "name", 120),
        animal(data.animal),
        data.type,
        content,
      );
      return publicDoc(find("documents", id));
    },
    editDocument(id, data) {
      find("documents", id);
      db.prepare("UPDATE documents SET name = ?, animal = ? WHERE id = ?").run(
        text(data.name, "name", 120),
        animal(data.animal),
        id,
      );
      return publicDoc(find("documents", id));
    },
    deleteDocument(id) {
      find("documents", id);
      db.prepare("UPDATE documents SET deleted_at = ? WHERE id = ?").run(
        new Date().toISOString(),
        id,
      );
    },
    file(id) {
      const row = find("documents", id);
      if (!row.content)
        throw new ApiError(
          404,
          "Ce document de démonstration ne contient aucun fichier.",
        );
      return row;
    },
  };
}
