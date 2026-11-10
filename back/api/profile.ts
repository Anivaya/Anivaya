import type { Database, Input } from "../database/types.ts";
import type { Profile } from "../../shared/account.ts";
import { transaction } from "../database/connection.ts";
import {
  ApiError,
  text,
  upload,
  isPhone,
  isBase64,
  emailAddress,
  documentFile,
  postalCode,
} from "./validation.ts";

interface ProfileRow {
  name: string;
  email: string;
  phone: string;
  city: string;
  postal_code: string;
  photo: Uint8Array | number | null;
  photo_type: string | null;
  notifications: string;
  updated_at: string;
}
const notificationKeys = ["reminders", "reservations", "shares"] as const;

function notificationValues(value: unknown): Profile["notifications"] {
  const input = upload(value, "Préférences invalides.");
  if (notificationKeys.some((key) => typeof input[key] !== "boolean"))
    throw new ApiError(400, "Préférences invalides.");
  const { reminders, reservations, shares } = input as Profile["notifications"];
  return { reminders, reservations, shares };
}

function photoValue(value: unknown) {
  const file = upload(value, "Choisissez une image valide.", "photo");
  const type = text(file.type, "photo", 50);
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(type) ||
    typeof file.content !== "string"
  )
    throw new ApiError(400, "Choisissez un JPG, PNG ou WebP.", "photo");
  let content: Buffer;
  if (type === "image/webp") {
    if (!isBase64(file.content))
      throw new ApiError(400, "Image invalide.", "photo");
    content = Buffer.from(file.content, "base64");
    if (
      content.subarray(0, 4).toString() !== "RIFF" ||
      content.subarray(8, 12).toString() !== "WEBP"
    )
      throw new ApiError(400, "Image WebP invalide.", "photo");
  } else content = documentFile(type, file.content, "photo");
  if (!content.length || content.length > 5 * 1024 * 1024)
    throw new ApiError(400, "La photo doit faire moins de 5 Mo.", "photo");
  return { content, type };
}

export function profileRepository(db: Database) {
  const row = (withPhoto = false) =>
    db.prepare(withPhoto ? "SELECT * FROM user_profile WHERE id=1" : "SELECT name,email,phone,city,postal_code,length(photo) AS photo,photo_type,notifications,updated_at FROM user_profile WHERE id=1").get<ProfileRow>()!;
  const get = (): Profile => {
    const p = row();
    return {
      name: p.name,
      email: p.email,
      phone: p.phone,
      city: p.city,
      postalCode: p.postal_code,
      photo: p.photo
        ? `/api/profile/photo?v=${encodeURIComponent(p.updated_at)}`
        : null,
      notifications: JSON.parse(p.notifications),
    };
  };
  return {
    get,
    photo() {
      const p = row(true);
      if (!(p.photo instanceof Uint8Array) || !p.photo_type)
        throw new ApiError(404, "Aucune photo disponible.");
      return { content: p.photo, type: p.photo_type };
    },
    save(data: Input): Profile {
      const name = text(data.name, "name", 120),
        email = emailAddress(data.email),
        phone = text(data.phone ?? "", "phone", 25, false),
        city = text(data.city ?? "", "city", 120, false);
      if (phone && !isPhone(phone))
        throw new ApiError(400, "Vérifiez votre numéro de téléphone.", "phone");
      const notifications = notificationValues(data.notifications);
      // undefined : photo inchangée ; null : photo supprimée.
      const old = row();
      const code =
        data.postalCode === undefined
          ? old.postal_code
          : postalCode(data.postalCode);
      const photo =
        data.photo === undefined
          ? undefined
          : data.photo === null
            ? { content: null, type: null }
            : photoValue(data.photo);
      const [first, ...last] = name.split(/\s+/);
      transaction(db, () => {
        db.prepare(
          `UPDATE user_profile SET name=?,email=?,phone=?,city=?,postal_code=?,${photo ? "photo=?,photo_type=?," : ""}notifications=?,updated_at=? WHERE id=1`,
        ).run(
          name,
          email,
          phone,
          city,
          code,
          ...(photo ? [photo.content, photo.type] : []),
          JSON.stringify(notifications),
          new Date().toISOString(),
        );
        db.prepare(
          "UPDATE household SET first_name=?,last_name=? WHERE id=1",
        ).run(first, last.join(" "));
      });
      return get();
    },
  };
}
