import { createHash } from "node:crypto";
import QRCode from "qrcode";
import type {
  Animal,
  EmergencySettings,
  EmergencySnapshot,
  EmergencySheet,
} from "../../shared/models.ts";
import type { Database, Input, EmergencyRow } from "../database/types.ts";
import { ApiError } from "./validation.ts";

const settingKeys: (keyof EmergencySettings)[] = [
  "active",
  "photo",
  "details",
  "notes",
  "contact",
  "vet",
];

const qrCode = (payload: string) =>
  QRCode.toString(payload, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 4,
    width: 260,
  });

/** Texte ASCII encodé dans le QR quand aucune URL publique n’est disponible. */
function offlinePayload(fields: EmergencySnapshot) {
  return [
    "ANIVAYA - DEMONSTRATION",
    fields.name,
    fields.species,
    fields.details,
    fields.notes && `Consignes: ${fields.notes}`,
    fields.contact && `Contact: ${fields.contact}`,
    fields.vet && `Veterinaire: ${fields.vet}`,
    "Fiche fictive hors ligne.",
  ]
    .filter(Boolean)
    .join("\n")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7E\n]/g, " ")
    .slice(0, 900);
}

function visibleFields(
  pet: Animal,
  settings: EmergencySettings,
): EmergencySnapshot {
  if (!settings.active) return { name: pet.name };
  return {
    name: pet.name,
    species: pet.species,
    photo: settings.photo ? pet.photo : null,
    style: settings.photo ? pet.style : null,
    details: settings.details
      ? [pet.breed, pet.sex].filter(Boolean).join(" · ")
      : "",
    notes: settings.notes
      ? [pet.behavior, pet.medical].filter(Boolean).join("\n")
      : "",
    contact: settings.contact ? pet.contact : "",
    vet: settings.vet ? pet.vet : "",
  };
}

export function emergencyRepository(
  db: Database,
  animals: () => Animal[],
  publicURL?: (animal: string) => string,
) {
  /** Lien public versionné : la version change dès que le contenu visible change. */
  const publicLink = (animal: string, fields: EmergencySnapshot) =>
    publicURL!(animal) +
    "?v=" +
    createHash("sha256")
      .update(JSON.stringify(fields))
      .digest("hex")
      .slice(0, 12);

  const get = (animal: string): EmergencySheet | null => {
    const row = db
      .prepare("SELECT * FROM emergency_sheets WHERE animal=?")
      .get<EmergencyRow>(animal);
    return row
      ? {
          animal,
          settings: JSON.parse(row.settings),
          snapshot: JSON.parse(row.snapshot),
          updatedAt: row.updated_at,
        }
      : null;
  };

  async function preview(id: string, input: Input): Promise<EmergencySheet> {
    const pet = animals().find((a) => a.id === id);
    if (!pet) throw new ApiError(404, "Animal introuvable.");
    if (settingKeys.some((key) => typeof input[key] !== "boolean"))
      throw new ApiError(
        400,
        "Les choix de visibilité doivent être des booléens.",
      );
    const settings = Object.fromEntries(
      settingKeys.map((key) => [key, input[key]]),
    ) as unknown as EmergencySettings;
    const snapshot = visibleFields(pet, settings);
    if (settings.active) {
      snapshot.payload = publicURL
        ? publicLink(id, snapshot)
        : offlinePayload(snapshot);
      snapshot.qrSvg = await qrCode(snapshot.payload);
    }
    return { animal: id, settings, snapshot };
  }

  return {
    get,
    preview,
    all: () =>
      db
        .prepare(
          "SELECT animal FROM emergency_sheets e WHERE EXISTS (SELECT 1 FROM animals a WHERE a.id=e.animal AND a.deleted_at IS NULL)",
        )
        .all<EmergencyRow>()
        .map((row) => get(row.animal)!),
    /** Remplace les QR texte des anciennes fiches par un lien vers la fiche publique. */
    async upgradePublicLinks() {
      if (!publicURL) return;
      for (const row of db
        .prepare("SELECT * FROM emergency_sheets")
        .all<EmergencyRow>()) {
        const settings: EmergencySettings = JSON.parse(row.settings);
        const { payload, qrSvg, ...fields }: EmergencySnapshot = JSON.parse(
          row.snapshot,
        );
        if (!settings.active || payload?.startsWith("http")) continue;
        const link = publicLink(row.animal, fields);
        const snapshot = {
          ...fields,
          payload: link,
          qrSvg: await qrCode(link),
        };
        db.prepare("UPDATE emergency_sheets SET snapshot=? WHERE animal=?").run(
          JSON.stringify(snapshot),
          row.animal,
        );
      }
    },
    async save(id: string, input: Input) {
      const { settings, snapshot } = await preview(id, input);
      db.prepare(
        "INSERT INTO emergency_sheets VALUES (?,?,?,?) ON CONFLICT(animal) DO UPDATE SET settings=excluded.settings,snapshot=excluded.snapshot,updated_at=excluded.updated_at",
      ).run(
        id,
        JSON.stringify(settings),
        JSON.stringify(snapshot),
        new Date().toISOString(),
      );
      return get(id)!;
    },
    remove(id: string) {
      db.prepare("DELETE FROM emergency_sheets WHERE animal=?").run(id);
    },
  };
}
