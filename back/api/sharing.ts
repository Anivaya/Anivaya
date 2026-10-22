import type {
  Database,
  Input,
  AnimalRow,
  PersonRow,
  ShareRow,
} from "../database/types.ts";
import { errorMessage } from "../../shared/models.ts";
import { randomUUID } from "node:crypto";
import { ApiError, text, date } from "./validation.ts";
export const localToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function sharingRepository(db: Database) {
  function transaction<T>(work: () => T): T {
    db.exec("BEGIN");
    try {
      const result = work();
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
  function person(id: string) {
    const row = db
      .prepare("SELECT * FROM trusted_people WHERE id=? AND deleted_at IS NULL")
      .get<PersonRow>(id);
    if (!row) throw new ApiError(404, "Personne introuvable.");
    return row;
  }
  function ids(
    value: unknown,
    field: string,
    table: "animals" | "documents" | "trusted_people",
    required = true,
  ): string[] {
    if (
      !Array.isArray(value) ||
      value.length > 200 ||
      value.some((x) => typeof x !== "string")
    )
      throw new ApiError(400, "Sélection invalide.", field);
    const unique = [...new Set(value as string[])];
    if (required && !unique.length)
      throw new ApiError(400, "Sélectionnez au moins un élément.", field);
    for (const id of unique) {
      const row = db
        .prepare(`SELECT * FROM ${table} WHERE id=? AND deleted_at IS NULL`)
        .get<{ id: string; animal?: string }>(id);
      if (
        !row ||
        (table === "documents" &&
          !db
            .prepare("SELECT id FROM animals WHERE id=? AND deleted_at IS NULL")
            .get<AnimalRow>(row.animal ?? null))
      )
        throw new ApiError(
          400,
          "Un élément sélectionné n’est plus disponible.",
          field,
        );
    }
    return unique;
  }
  function contacts(data: Input) {
    const name = text(data.name, "name", 120),
      role = text(data.role || "Proche", "role", 40);
    if (
      !["Proche", "Famille", "Garde", "Professionnel", "Autre"].includes(role)
    )
      throw new ApiError(400, "Choisissez un lien valide.", "role");
    const email = text(data.email ?? "", "email", 120, false).toLowerCase(),
      phone = text(data.phone ?? "", "phone", 25, false),
      note = text(data.note ?? "", "note", 500, false);
    if (!email && !phone)
      throw new ApiError(400, "Renseignez un e-mail ou un téléphone.", "email");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new ApiError(400, "Vérifiez l’adresse e-mail.", "email");
    if (phone && !/^[+\d\s().-]{6,25}$/.test(phone))
      throw new ApiError(400, "Vérifiez le numéro de téléphone.", "phone");
    return { name, role, email, phone, note };
  }
  const allPeople = () =>
    db
      .prepare(
        "SELECT id,name,role,email,phone,note FROM trusted_people WHERE deleted_at IS NULL ORDER BY rowid",
      )
      .all<PersonRow>()
      .map((p) => ({
        ...p,
        animals: db
          .prepare(
            "SELECT pa.animal FROM person_animals pa JOIN animals a ON a.id=pa.animal WHERE person=? AND a.deleted_at IS NULL",
          )
          .all<{ animal: string }>(p.id)
          .map((x) => x.animal),
      }));
  const allShares = (): import("../../shared/models.ts").Share[] =>
    db
      .prepare(
        "SELECT s.* FROM document_shares s JOIN documents d ON d.id=s.doc JOIN animals a ON a.id=d.animal WHERE d.deleted_at IS NULL AND a.deleted_at IS NULL ORDER BY s.rowid DESC",
      )
      .all<ShareRow>()
      .map((s) => ({
        ...s,
        revoked: Boolean(s.revoked),
        status: s.revoked
          ? "revoked"
          : s.until < localToday()
            ? "expired"
            : "active",
      }));
  function savePerson(id: string | null, data: Input) {
    const old = id ? person(id) : {},
      values = contacts({ ...old, ...data });
    const pets = Object.hasOwn(data, "animals")
      ? ids(data.animals, "animals", "animals", false)
      : null;
    const others = allPeople().filter((p) => p.id !== id);
    if (
      others.some(
        (p) =>
          (values.email && p.email === values.email) ||
          (!values.email &&
            values.phone &&
            p.phone.replace(/[\s().-]/g, "") ===
              values.phone.replace(/[\s().-]/g, "")),
      )
    )
      throw new ApiError(
        400,
        "Cette personne est déjà enregistrée avec ces coordonnées.",
        values.email ? "email" : "phone",
      );
    const key = id || randomUUID();
    transaction(() => {
      db.prepare(
        "INSERT INTO trusted_people(id,name,role,email,phone,note) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,role=excluded.role,email=excluded.email,phone=excluded.phone,note=excluded.note",
      ).run(
        key,
        values.name,
        values.role,
        values.email,
        values.phone,
        values.note,
      );
      if (pets) {
        db.prepare("DELETE FROM person_animals WHERE person=?").run(key);
        for (const pet of pets)
          db.prepare("INSERT INTO person_animals VALUES (?,?)").run(key, pet);
      }
    });
    return allPeople().find((p) => p.id === key);
  }
  return {
    allPeople,
    allShares,
    savePerson,
    deletePerson(id: string) {
      const removed = person(id);
      transaction(() => {
        db.prepare("UPDATE trusted_people SET deleted_at=? WHERE id=?").run(
          new Date().toISOString(),
          id,
        );
        db.prepare("DELETE FROM person_animals WHERE person=?").run(id);
        db.prepare(
          "UPDATE document_shares SET revoked=1 WHERE person=? OR (email<>'' AND lower(email)=?)",
        ).run(id, removed.email);
      });
    },
    associate(data: Input) {
      const people = ids(data.people, "people", "trusted_people"),
        pets = ids(data.animals, "animals", "animals");
      if (
        typeof data.mode !== "string" ||
        !["add", "remove"].includes(data.mode)
      )
        throw new ApiError(400, "Choisissez une action valide.", "mode");
      transaction(() => {
        for (const p of people)
          for (const a of pets)
            db.prepare(
              data.mode === "add"
                ? "INSERT OR IGNORE INTO person_animals VALUES (?,?)"
                : "DELETE FROM person_animals WHERE person=? AND animal=?",
            ).run(p, a);
      });
      return allPeople();
    },
    createShares(data: Input) {
      const documents = ids(data.documents, "documents", "documents");
      let until;
      try {
        until = date(data.until);
      } catch (error) {
        throw new ApiError(400, errorMessage(error), "until");
      }
      if (until < localToday())
        throw new ApiError(
          400,
          "Choisissez une date à partir d’aujourd’hui.",
          "until",
        );
      const recipients = data.people
        ? ids(data.people, "people", "trusted_people").map(person)
        : [
            {
              ...contacts({ name: data.recipient, email: data.email }),
              id: null as string | null,
            },
          ];
      if (!data.people) {
        recipients[0].id =
          allPeople().find((p) => p.email === recipients[0].email)?.id ?? null;
      }
      if (recipients.some((p) => !p.email))
        throw new ApiError(
          400,
          "Chaque destinataire doit avoir un e-mail.",
          "people",
        );
      if (documents.length * recipients.length > 500)
        throw new ApiError(
          400,
          "Limitez la sélection à 500 accès par opération.",
        );
      return transaction(() => {
        let created = 0,
          skipped = 0;
        for (const p of recipients)
          for (const doc of documents) {
            if (
              db
                .prepare(
                  "SELECT id FROM document_shares WHERE doc=? AND lower(email)=? AND revoked=0 AND until>=?",
                )
                .get<ShareRow>(doc, p.email, localToday())
            ) {
              skipped++;
              continue;
            }
            db.prepare(
              "INSERT INTO document_shares(id,doc,person,recipient,email,until) VALUES (?,?,?,?,?,?)",
            ).run(randomUUID(), doc, p.id, p.name, p.email, until);
            created++;
          }
        if (!created)
          throw new ApiError(
            400,
            "Ces personnes ont déjà un accès actif aux documents sélectionnés.",
          );
        return { created, skipped };
      });
    },
    revoke(id: string) {
      if (!allShares().some((s) => s.id === id))
        throw new ApiError(404, "Partage introuvable.");
      db.prepare("UPDATE document_shares SET revoked=1 WHERE id=?").run(id);
      return allShares().find((s) => s.id === id);
    },
  };
}
