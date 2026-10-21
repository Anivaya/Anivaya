import QRCode from "qrcode";
import { ApiError } from "./validation.js";

const keys = ["active", "photo", "details", "notes", "contact", "vet"];
export function emergencyRepository(db, animals) {
  const get = (animal) => {
    const row = db
      .prepare("SELECT * FROM emergency_sheets WHERE animal=?")
      .get(animal);
    return row
      ? {
          animal,
          settings: JSON.parse(row.settings),
          snapshot: JSON.parse(row.snapshot),
          updatedAt: row.updated_at,
        }
      : null;
  };
  async function preview(id, settings) {
    const pet = animals().find((a) => a.id === id);
    if (!pet) throw new ApiError(404, "Animal introuvable.");
    if (keys.some((key) => typeof settings[key] !== "boolean"))
      throw new ApiError(
        400,
        "Les choix de visibilité doivent être des booléens.",
      );
    const allowed = Object.fromEntries(keys.map((key) => [key, settings[key]]));
    const snapshot = allowed.active
      ? {
          name: pet.name,
          species: pet.species,
          photo: allowed.photo ? pet.photo : null,
          style: allowed.photo ? pet.style : null,
          details: allowed.details
            ? [pet.breed, pet.sex].filter(Boolean).join(" · ")
            : "",
          notes: allowed.notes
            ? [pet.behavior, pet.medical].filter(Boolean).join("\n")
            : "",
          contact: allowed.contact ? pet.contact : "",
          vet: allowed.vet ? pet.vet : "",
        }
      : { name: pet.name };
    if (allowed.active) {
      snapshot.payload = [
        "ANIVAYA - DEMONSTRATION",
        snapshot.name,
        snapshot.species,
        snapshot.details,
        snapshot.notes && `Consignes: ${snapshot.notes}`,
        snapshot.contact && `Contact: ${snapshot.contact}`,
        snapshot.vet && `Veterinaire: ${snapshot.vet}`,
        "Fiche fictive hors ligne.",
      ]
        .filter(Boolean)
        .join("\n")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\x20-\x7E\n]/g, " ")
        .slice(0, 900);
      snapshot.qrSvg = await QRCode.toString(snapshot.payload, {
        type: "svg",
        errorCorrectionLevel: "M",
        margin: 4,
        width: 260,
      });
    }
    return { animal: id, settings: allowed, snapshot };
  }
  return {
    preview,
    all: () =>
      db
        .prepare(
          "SELECT animal FROM emergency_sheets e WHERE EXISTS (SELECT 1 FROM animals a WHERE a.id=e.animal AND a.deleted_at IS NULL)",
        )
        .all()
        .map((row) => get(row.animal)),
    get,
    async save(id, settings) {
      const { settings: allowed, snapshot } = await preview(id, settings);
      db.prepare(
        "INSERT INTO emergency_sheets VALUES (?,?,?,?) ON CONFLICT(animal) DO UPDATE SET settings=excluded.settings,snapshot=excluded.snapshot,updated_at=excluded.updated_at",
      ).run(
        id,
        JSON.stringify(allowed),
        JSON.stringify(snapshot),
        new Date().toISOString(),
      );
      return get(id);
    },
    remove(id) {
      db.prepare("DELETE FROM emergency_sheets WHERE animal=?").run(id);
    },
  };
}
