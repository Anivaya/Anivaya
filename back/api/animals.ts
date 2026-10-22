import type {
  Database,
  Input,
  AnimalRow,
  AnimalEvent,
} from "../database/types.ts";
import { errorMessage } from "../../shared/models.ts";
import { randomUUID } from "node:crypto";
import { ApiError, text, date, documentFile } from "./validation.ts";

const fields = [
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
const eventTypes = ["Consultation", "Pesée", "Vaccination déclarée", "Autre"];
export function createAnimalRepository(db: Database) {
  function requireAnimal(id: unknown) {
    const key = text(id, "animal", 120);
    const pet = db
      .prepare("SELECT * FROM animals WHERE id=? AND deleted_at IS NULL")
      .get<AnimalRow>(key);
    if (!pet) throw new ApiError(404, "Cet animal est introuvable.");
    return pet;
  }
  function profile(data: Input) {
    const result: Partial<Record<(typeof fields)[number], string>> & {
      photo?: Uint8Array;
      photo_type?: string;
    } = {};
    for (const field of fields)
      if (Object.hasOwn(data, field))
        result[field] = text(
          data[field],
          field,
          ["food", "routine", "behavior", "medical"].includes(field)
            ? 500
            : 120,
          false,
        );
    if (result.dob) {
      try {
        date(result.dob);
      } catch (error) {
        throw new ApiError(400, errorMessage(error), "dob");
      }
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Paris",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      if (result.dob > today)
        throw new ApiError(
          400,
          "La naissance ne peut pas être dans le futur.",
          "dob",
        );
    }
    if (
      result.weight &&
      (!Number.isFinite(Number(result.weight)) ||
        Number(result.weight) < 0.1 ||
        Number(result.weight) > 200)
    )
      throw new ApiError(
        400,
        "Choisissez un poids entre 0,1 et 200 kg.",
        "weight",
      );
    if (
      result.sex &&
      !["Femelle", "Mâle", "Non renseigné"].includes(result.sex)
    )
      throw new ApiError(400, "Choisissez un sexe valide.", "sex");
    if (
      result.neutered &&
      !["Oui", "Non", "Non renseignée"].includes(result.neutered)
    )
      throw new ApiError(400, "Choisissez un statut valide.", "neutered");
    if (Object.hasOwn(data, "photo") && data.photo) {
      if (typeof data.photo !== "object" || Array.isArray(data.photo))
        throw new ApiError(400, "Choisissez un JPEG ou PNG.", "photo");
      const photo = data.photo as Input;
      if (
        typeof photo.type !== "string" ||
        !["image/png", "image/jpeg"].includes(photo.type)
      )
        throw new ApiError(400, "Choisissez un JPEG ou PNG.", "photo");
      let bytes;
      try {
        bytes = documentFile(photo.type, photo.content);
      } catch (error) {
        throw new ApiError(400, errorMessage(error), "photo");
      }
      if (bytes.length > 2 * 1024 * 1024)
        throw new ApiError(400, "La photo dépasse 2 Mo.", "photo");
      result.photo = bytes;
      result.photo_type = photo.type;
    }
    return result;
  }
  function allAnimals(): import("../../shared/models.ts").Animal[] {
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
  function editAnimal(id: string, data: Input) {
    const pet = requireAnimal(id);
    const name = Object.hasOwn(data, "name")
      ? text(data.name, "name", 40)
      : pet.name;
    const species = data.species ?? pet.species;
    if (typeof species !== "string" || !["Chien", "Chat"].includes(species))
      throw new ApiError(400, "Choisissez Chien ou Chat.", "species");
    const values = profile(data);
    db.exec("BEGIN");
    try {
      db.prepare(
        "INSERT OR IGNORE INTO animal_profiles(animal) VALUES (?)",
      ).run(id);
      if (Object.keys(values).length)
        db.prepare(
          `UPDATE animal_profiles SET ${Object.keys(values)
            .map((key) => `${key}=?`)
            .join(",")} WHERE animal=?`,
        ).run(...Object.values(values), id);
      const description = Object.hasOwn(values, "breed")
        ? values.breed || "Profil à compléter"
        : pet.description;
      db.prepare(
        "UPDATE animals SET name=?,species=?,description=? WHERE id=?",
      ).run(name, species, description, id);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    return allAnimals().find((animal) => animal.id === id)!;
  }
  return {
    allAnimals,
    editAnimal,
    createAnimal(data: Input) {
      // Validate all fields before the first write, then create profile in one transaction.
      const values = profile(data);
      const name = text(data.name, "name", 40),
        species = data.species || "Chien";
      if (typeof species !== "string" || !["Chien", "Chat"].includes(species))
        throw new ApiError(400, "Choisissez Chien ou Chat.", "species");
      const id = randomUUID();
      const description =
        values.breed ||
        text(data.description ?? "", "description", 70, false) ||
        "Profil à compléter";
      db.exec("BEGIN");
      try {
        db.prepare(
          "INSERT INTO animals(id,name,species,description,style) VALUES (?,?,?,?,?)",
        ).run(id, name, species, description, "new");
        db.prepare("INSERT INTO animal_profiles(animal) VALUES (?)").run(id);
        if (Object.keys(values).length)
          db.prepare(
            `UPDATE animal_profiles SET ${Object.keys(values)
              .map((key) => `${key}=?`)
              .join(",")} WHERE animal=?`,
          ).run(...Object.values(values), id);
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
      return allAnimals().find((animal) => animal.id === id);
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
      return { photo: row.photo, type: row.type };
    },
    events() {
      return db
        .prepare(
          "SELECT e.* FROM events e JOIN animals a ON a.id=e.animal WHERE e.deleted_at IS NULL AND a.deleted_at IS NULL ORDER BY e.date DESC,e.rowid DESC",
        )
        .all<AnimalEvent>();
    },
    saveEvent(id: string | null, data: Input) {
      const previous = id
        ? db
            .prepare("SELECT * FROM events WHERE id=? AND deleted_at IS NULL")
            .get<AnimalEvent>(id)
        : null;
      if (id && !previous) throw new ApiError(404, "Événement introuvable.");
      const animal = text(previous?.animal || data.animal, "animal", 120);
      requireAnimal(animal);
      if (typeof data.type !== "string" || !eventTypes.includes(data.type))
        throw new ApiError(400, "Choisissez un type valide.", "type");
      const when = date(data.date),
        note = text(data.note ?? "", "note", 500, false);
      if (id)
        db.prepare("UPDATE events SET type=?,date=?,note=? WHERE id=?").run(
          data.type,
          when,
          note,
          id,
        );
      else {
        id = randomUUID();
        db.prepare(
          "INSERT INTO events(id,animal,type,date,note) VALUES (?,?,?,?,?)",
        ).run(id, animal, data.type, when, note);
      }
      return db.prepare("SELECT * FROM events WHERE id=?").get<AnimalEvent>(id);
    },
    deleteEvent(id: string) {
      const e = db
        .prepare("SELECT * FROM events WHERE id=? AND deleted_at IS NULL")
        .get<AnimalEvent>(id);
      if (!e) throw new ApiError(404, "Événement introuvable.");
      requireAnimal(e.animal);
      db.prepare("UPDATE events SET deleted_at=? WHERE id=?").run(
        new Date().toISOString(),
        id,
      );
    },
  };
}
