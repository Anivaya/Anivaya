import type {
  Database,
  Input,
  AnimalRow,
  Person,
  PersonRow,
  Share,
  ShareRow,
} from "../database/types.ts";
import { randomUUID } from "node:crypto";
import { transaction } from "../database/connection.ts";
import {
  ApiError,
  text,
  date,
  oneOf,
  isEmail,
  isPhone,
  localToday,
} from "./validation.ts";

const roles = ["Proche", "Famille", "Garde", "Professionnel", "Autre"];
const digitsOnly = (phone: string) => phone.replace(/[\s().-]/g, "");

function contactValues(data: Input) {
  const name = text(data.name, "name", 120),
    role = oneOf(
      text(data.role || "Proche", "role", 40),
      roles,
      "role",
      "Choisissez un lien valide.",
    ),
    email = text(data.email ?? "", "email", 120, false).toLowerCase(),
    phone = text(data.phone ?? "", "phone", 25, false),
    note = text(data.note ?? "", "note", 500, false);
  if (!email && !phone)
    throw new ApiError(400, "Renseignez un e-mail ou un téléphone.", "email");
  if (email && !isEmail(email))
    throw new ApiError(400, "Vérifiez l’adresse e-mail.", "email");
  if (phone && !isPhone(phone))
    throw new ApiError(400, "Vérifiez le numéro de téléphone.", "phone");
  return { name, role, email, phone, note };
}

export function sharingRepository(db: Database) {
  function person(id: string) {
    const row = db
      .prepare("SELECT * FROM trusted_people WHERE id=? AND deleted_at IS NULL")
      .get<PersonRow>(id);
    if (!row) throw new ApiError(404, "Personne introuvable.");
    return row;
  }
  /** Identifiants uniques d’éléments existants (et dont l’animal existe encore). */
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
    const animalExists = (animal: string | undefined) =>
      Boolean(
        db
          .prepare("SELECT id FROM animals WHERE id=? AND deleted_at IS NULL")
          .get<AnimalRow>(animal ?? null),
      );
    for (const id of unique) {
      const row = db
        .prepare(`SELECT * FROM ${table} WHERE id=? AND deleted_at IS NULL`)
        .get<{ id: string; animal?: string }>(id);
      if (!row || (table === "documents" && !animalExists(row.animal)))
        throw new ApiError(
          400,
          "Un élément sélectionné n’est plus disponible.",
          field,
        );
    }
    return unique;
  }
  const allPeople = (): Person[] =>
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
  const allShares = (): Share[] =>
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

  return {
    allPeople,
    allShares,
    savePerson(id: string | null, data: Input) {
      const values = contactValues({ ...(id ? person(id) : {}), ...data });
      const pets = Object.hasOwn(data, "animals")
        ? ids(data.animals, "animals", "animals", false)
        : null;
      const duplicate = allPeople().some(
        (p) =>
          p.id !== id &&
          (values.email
            ? p.email === values.email
            : values.phone && digitsOnly(p.phone) === digitsOnly(values.phone)),
      );
      if (duplicate)
        throw new ApiError(
          400,
          "Cette personne est déjà enregistrée avec ces coordonnées.",
          values.email ? "email" : "phone",
        );
      const key = id || randomUUID();
      transaction(db, () => {
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
    },
    deletePerson(id: string) {
      const removed = person(id);
      transaction(db, () => {
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
      if (data.mode !== "add" && data.mode !== "remove")
        throw new ApiError(400, "Choisissez une action valide.", "mode");
      const statement = db.prepare(
        data.mode === "add"
          ? "INSERT OR IGNORE INTO person_animals VALUES (?,?)"
          : "DELETE FROM person_animals WHERE person=? AND animal=?",
      );
      transaction(db, () => {
        for (const p of people) for (const a of pets) statement.run(p, a);
      });
      return allPeople();
    },
    createShares(data: Input) {
      const documents = ids(data.documents, "documents", "documents");
      const until = date(data.until, "until");
      if (until < localToday())
        throw new ApiError(
          400,
          "Choisissez une date à partir d’aujourd’hui.",
          "until",
        );
      const recipients = data.people
        ? ids(data.people, "people", "trusted_people").map(person)
        : [contactValues({ name: data.recipient, email: data.email })].map(
            (contact) => ({
              ...contact,
              id:
                allPeople().find((p) => p.email === contact.email)?.id ?? null,
            }),
          );
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
      return transaction(db, () => {
        let created = 0,
          skipped = 0;
        const shares: {
          id: string;
          doc: string;
          email: string;
          until: string;
        }[] = [];
        for (const p of recipients)
          for (const doc of documents) {
            const active = db
              .prepare(
                "SELECT id FROM document_shares WHERE doc=? AND lower(email)=? AND revoked=0 AND until>=?",
              )
              .get<ShareRow>(doc, p.email, localToday());
            if (active) {
              skipped++;
              continue;
            }
            const id = randomUUID();
            db.prepare(
              "INSERT INTO document_shares(id,doc,person,recipient,email,until) VALUES (?,?,?,?,?,?)",
            ).run(id, doc, p.id, p.name, p.email, until);
            shares.push({ id, doc, email: p.email, until });
            created++;
          }
        if (!created)
          throw new ApiError(
            400,
            "Ces personnes ont déjà un accès actif aux documents sélectionnés.",
          );
        return { created, skipped, shares };
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
