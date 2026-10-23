import type {
  Database,
  Input,
  Animal,
  AnimalRow,
  AnimalEvent,
} from "../database/types.ts";
import { randomUUID } from "node:crypto";
import { transaction } from "../database/connection.ts";
import {
  ApiError,
  text,
  date,
  oneOf,
  upload,
  localToday,
  documentFile,
} from "./validation.ts";

const profileFields = [
  "breed",
  "sex",
  "dob",
  "weight",
  "coat",
  "identifier",
  "neutered",
  "food",
  "routine",
  "behavior",
  "medical",
  "contact",
  "vet",
] as const;
const longFields = ["food", "routine", "behavior", "medical"];
const species = ["Chien", "Chat"];
const eventTypes = ["Consultation", "Pesée", "Vaccination déclarée", "Autre"];

type ProfileValues = Partial<Record<(typeof profileFields)[number], string>> & {
  photo?: Uint8Array;
  photo_type?: string;
};

function speciesValue(value: unknown) {
  if (typeof value !== "string" || !species.includes(value))
    throw new ApiError(400, "Choisissez Chien ou Chat.", "species");
  return value;
}

/** Valide les champs du profil présents dans `data` (mise à jour partielle). */
function profileValues(data: Input): ProfileValues {
  const result: ProfileValues = {};
  for (const field of profileFields)
    if (Object.hasOwn(data, field))
      result[field] = text(
        data[field],
        field,
        longFields.includes(field) ? 500 : 120,
        false,
      );
  if (result.dob) {
    date(result.dob, "dob");
    if (result.dob > localToday())
      throw new ApiError(
        400,
        "La naissance ne peut pas être dans le futur.",
        "dob",
      );
  }
  const weight = Number(result.weight);
  if (
    result.weight &&
    (!Number.isFinite(weight) || weight < 0.1 || weight > 200)
  )
    throw new ApiError(
      400,
      "Choisissez un poids entre 0,1 et 200 kg.",
      "weight",
    );
  if (result.sex)
    oneOf(
      result.sex,
      ["Femelle", "Mâle", "Non renseigné"],
      "sex",
      "Choisissez un sexe valide.",
    );
  if (result.neutered)
    oneOf(
      result.neutered,
      ["Oui", "Non", "Non renseignée"],
      "neutered",
      "Choisissez un statut valide.",
    );
  if (data.photo) {
    const photo = upload(data.photo, "Choisissez un JPEG ou PNG.", "photo");
    if (
      typeof photo.type !== "string" ||
      !["image/png", "image/jpeg"].includes(photo.type)
    )
      throw new ApiError(400, "Choisissez un JPEG ou PNG.", "photo");
    const bytes = documentFile(photo.type, photo.content, "photo");
    if (bytes.length > 2 * 1024 * 1024)
      throw new ApiError(400, "La photo dépasse 2 Mo.", "photo");
    result.photo = bytes;
    result.photo_type = photo.type;
  }
  return result;
}

export function createAnimalRepository(db: Database) {
  function requireAnimal(id: unknown) {
    const pet = db
      .prepare("SELECT * FROM animals WHERE id=? AND deleted_at IS NULL")
      .get<AnimalRow>(text(id, "animal", 120));
    if (!pet) throw new ApiError(404, "Cet animal est introuvable.");
    return pet;
  }
  function requireEvent(id: string) {
    const event = db
      .prepare("SELECT * FROM events WHERE id=? AND deleted_at IS NULL")
      .get<AnimalEvent>(id);
    if (!event) throw new ApiError(404, "Événement introuvable.");
    return event;
  }
  function saveProfile(id: string, values: ProfileValues) {
    const keys = Object.keys(values);
    if (keys.length)
      db.prepare(
        `UPDATE animal_profiles SET ${keys.map((key) => `${key}=?`).join(",")} WHERE animal=?`,
      ).run(...Object.values(values), id);
  }
  function allAnimals(): Animal[] {
    return db
      .prepare(
        "SELECT a.*,p.breed,p.sex,p.dob,p.weight,p.coat,p.identifier,p.neutered,p.food,p.routine,p.behavior,p.medical,p.contact,p.vet,length(p.photo) AS hasPhoto FROM animals a LEFT JOIN animal_profiles p ON p.animal=a.id WHERE a.deleted_at IS NULL ORDER BY a.rowid",
      )
      .all<AnimalRow>()
      .map(({ hasPhoto, deleted_at, ...pet }) => ({
        ...pet,
        photo: hasPhoto ? `/api/animals/${pet.id}/photo?v=${hasPhoto}` : null,
      }));
  }
  const findAnimal = (id: string) =>
    allAnimals().find((animal) => animal.id === id);

  return {
    allAnimals,
    createAnimal(data: Input) {
      // Tout est validé avant la première écriture.
      const values = profileValues(data);
      const name = text(data.name, "name", 40),
        kind = speciesValue(data.species || "Chien"),
        description =
          values.breed ||
          text(data.description ?? "", "description", 70, false) ||
          "Profil à compléter",
        id = randomUUID();
      transaction(db, () => {
        db.prepare(
          "INSERT INTO animals(id,name,species,description,style) VALUES (?,?,?,?,?)",
        ).run(id, name, kind, description, "new");
        db.prepare("INSERT INTO animal_profiles(animal) VALUES (?)").run(id);
        saveProfile(id, values);
      });
      return findAnimal(id);
    },
    editAnimal(id: string, data: Input) {
      const pet = requireAnimal(id);
      const name = Object.hasOwn(data, "name")
          ? text(data.name, "name", 40)
          : pet.name,
        kind = speciesValue(data.species ?? pet.species),
        values = profileValues(data),
        description = Object.hasOwn(values, "breed")
          ? values.breed || "Profil à compléter"
          : pet.description;
      transaction(db, () => {
        db.prepare(
          "INSERT OR IGNORE INTO animal_profiles(animal) VALUES (?)",
        ).run(id);
        saveProfile(id, values);
        db.prepare(
          "UPDATE animals SET name=?,species=?,description=? WHERE id=?",
        ).run(name, kind, description, id);
      });
      return findAnimal(id)!;
    },
    deleteAnimal(id: string) {
      requireAnimal(id);
      db.prepare("UPDATE animals SET deleted_at=? WHERE id=?").run(
        new Date().toISOString(),
        id,
      );
    },
    animalPhoto(id: string) {
      requireAnimal(id);
      const row = db
        .prepare(
          "SELECT photo,photo_type AS type FROM animal_profiles WHERE animal=?",
        )
        .get<{ photo: Uint8Array | null; type: string }>(id);
      if (!row?.photo) throw new ApiError(404, "Aucune photo disponible.");
      return { content: row.photo, type: row.type };
    },
    events() {
      return db
        .prepare(
          "SELECT e.* FROM events e JOIN animals a ON a.id=e.animal WHERE e.deleted_at IS NULL AND a.deleted_at IS NULL ORDER BY e.date DESC,e.rowid DESC",
        )
        .all<AnimalEvent>();
    },
    saveEvent(id: string | null, data: Input) {
      const previous = id ? requireEvent(id) : null;
      const animal = requireAnimal(previous?.animal || data.animal).id;
      if (typeof data.type !== "string" || !eventTypes.includes(data.type))
        throw new ApiError(400, "Choisissez un type valide.", "type");
      const when = date(data.date),
        note = text(data.note ?? "", "note", 500, false);
      const key = id ?? randomUUID();
      if (id)
        db.prepare("UPDATE events SET type=?,date=?,note=? WHERE id=?").run(
          data.type,
          when,
          note,
          id,
        );
      else
        db.prepare(
          "INSERT INTO events(id,animal,type,date,note) VALUES (?,?,?,?,?)",
        ).run(key, animal, data.type, when, note);
      return db
        .prepare("SELECT * FROM events WHERE id=?")
        .get<AnimalEvent>(key);
    },
    deleteEvent(id: string) {
      requireAnimal(requireEvent(id).animal);
      db.prepare("UPDATE events SET deleted_at=? WHERE id=?").run(
        new Date().toISOString(),
        id,
      );
    },
  };
}
