import { randomUUID } from "node:crypto";
import type { Database, Input } from "../database/types.ts";
import type {
  Professional,
  Booking,
  DirectoryData,
} from "../../shared/account.ts";
import { transaction } from "../database/connection.ts";
import {
  ApiError,
  text,
  date,
  localToday,
  emailAddress,
} from "./validation.ts";

const projection =
  "id,professional,animal,animal_name AS animalName,service,date,time,price,status,contact_name AS contactName,email,note,created_at AS createdAt,cancelled_at AS cancelledAt";
/** Créneaux affichés ; 12:00 reste toujours indisponible (pause). */
const displayedTimes = ["09:00", "10:30", "12:00", "14:00", "15:30", "17:00"];
const bookableTimes = ["09:00", "10:30", "14:00", "15:30", "17:00"];

function offsetDay(days: number) {
  const day = new Date(localToday() + "T12:00:00Z");
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
}
function isPast(booking: Booking) {
  const now = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Paris",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());
  return `${booking.date} ${booking.time}` <= now;
}

export function directoryRepository(db: Database) {
  const professionals = (): Professional[] =>
    db
      .prepare("SELECT data FROM professionals ORDER BY rowid")
      .all<{ data: string }>()
      .map((p) => JSON.parse(p.data));
  function professional(id: string) {
    const found = professionals().find((p) => p.id === id);
    if (!found) throw new ApiError(404, "Professionnel introuvable.");
    return found;
  }
  const bookings = () =>
    db
      .prepare(
        `SELECT ${projection} FROM bookings ORDER BY date DESC,time DESC`,
      )
      .all<Booking>();
  function booking(id: string) {
    const found = bookings().find((b) => b.id === id);
    if (!found) throw new ApiError(404, "Réservation introuvable.");
    return found;
  }
  function bookableDate(value: unknown) {
    const day = date(value);
    if (day < offsetDay(1) || day > offsetDay(60))
      throw new ApiError(
        400,
        "Choisissez une date entre demain et les 60 prochains jours.",
        "date",
      );
    return day;
  }
  function isFree(pro: string, day: string, time: string, ignore?: string) {
    return !db
      .prepare(
        "SELECT id FROM bookings WHERE professional=? AND date=? AND time=? AND status='confirmed' AND id<>?",
      )
      .get(pro, day, time, ignore ?? "");
  }
  /** Créneau demandé, à valider dans la transaction qui l’enregistre. */
  function slot(pro: string, data: Input, ignore?: string) {
    const day = bookableDate(data.date),
      time = text(data.time, "time", 5);
    if (!bookableTimes.includes(time))
      throw new ApiError(400, "Choisissez un horaire disponible.", "time");
    if (!isFree(pro, day, time, ignore))
      throw new ApiError(
        409,
        "Ce créneau vient d’être réservé. Choisissez-en un autre.",
        "time",
      );
    return { day, time };
  }

  return {
    all(): DirectoryData {
      return {
        professionals: professionals(),
        favorites: db
          .prepare("SELECT professional FROM professional_favorites")
          .all<{ professional: string }>()
          .map((r) => r.professional),
        bookings: bookings(),
        today: localToday(),
      };
    },
    slots(id: string, day: string, ignore?: string) {
      professional(id);
      bookableDate(day);
      return displayedTimes.map((time) => ({
        time,
        available:
          bookableTimes.includes(time) && isFree(id, day, time, ignore),
      }));
    },
    favorite(id: string, value: unknown) {
      professional(id);
      if (typeof value !== "boolean")
        throw new ApiError(400, "Statut de favori invalide.");
      db.prepare(
        value
          ? "INSERT OR IGNORE INTO professional_favorites VALUES (?)"
          : "DELETE FROM professional_favorites WHERE professional=?",
      ).run(id);
    },
    create(data: Input): Booking {
      const pro = professional(text(data.professional, "professional", 80));
      const serviceIndex = data.service;
      if (
        typeof serviceIndex !== "number" ||
        !Number.isInteger(serviceIndex) ||
        !pro.services[serviceIndex]
      )
        throw new ApiError(400, "Choisissez une prestation.", "service");
      const service = pro.services[serviceIndex],
        pet = db
          .prepare(
            "SELECT id,name,species FROM animals WHERE id=? AND deleted_at IS NULL",
          )
          .get<{ id: string; name: string; species: string }>(
            text(data.animal, "animal", 120),
          );
      if (!pet || !pro.species.includes(pet.species))
        throw new ApiError(
          400,
          "Choisissez un animal accueilli par ce professionnel.",
          "animal",
        );
      const contactName = text(data.contactName, "contactName", 80),
        email = emailAddress(data.email),
        note = text(data.note ?? "", "note", 500, false);
      if (data.payment === "declined")
        throw new ApiError(
          402,
          "Paiement refusé (simulation). Aucun rendez-vous n’a été créé.",
        );
      if (data.payment !== "success")
        throw new ApiError(400, "Choisissez un scénario de paiement valide.");
      const id = randomUUID();
      transaction(
        db,
        () => {
          const { day, time } = slot(pro.id, data);
          db.prepare(
            "INSERT INTO bookings(id,professional,animal,animal_name,service,date,time,price,contact_name,email,note) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
          ).run(
            id,
            pro.id,
            pet.id,
            pet.name,
            serviceIndex,
            day,
            time,
            service.price,
            contactName,
            email,
            note,
          );
        },
        "BEGIN IMMEDIATE",
      );
      return booking(id);
    },
    update(id: string, data: Input): Booking {
      const current = booking(id);
      if (current.status === "cancelled" || isPast(current))
        throw new ApiError(409, "Ce rendez-vous ne peut plus être modifié.");
      transaction(
        db,
        () => {
          if (data.status === "cancelled")
            db.prepare(
              "UPDATE bookings SET status='cancelled',cancelled_at=? WHERE id=?",
            ).run(new Date().toISOString(), id);
          else {
            const { day, time } = slot(current.professional, data, id);
            db.prepare("UPDATE bookings SET date=?,time=? WHERE id=?").run(
              day,
              time,
              id,
            );
          }
        },
        "BEGIN IMMEDIATE",
      );
      return booking(id);
    },
  };
}
