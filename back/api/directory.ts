import { randomUUID } from "node:crypto";
import type { Database, Input } from "../database/types.ts";
import type {
  Professional,
  Booking,
  DirectoryData,
} from "../../shared/account.ts";
import { transaction } from "../database/connection.ts";
import { appUrl, sendMail } from "./mail.ts";
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

export function directoryRepository(db: Database, shared?: { db: Database; account: string }) {
  const store = shared?.db ?? db;
  const table = shared ? "shared_bookings" : "bookings";
  const ownerWhere = shared ? " WHERE account=?" : "";
  const owner = shared ? [shared.account] : [];
  const professionals = (): Professional[] =>
    store
      .prepare("SELECT data FROM professionals ORDER BY rowid")
      .all<{ data: string }>()
      .map((p): Professional => JSON.parse(p.data))
      .filter((p) => !p.fictional || process.env.ANIVAYA_TESTING_PREVIEW === "1");
  function professional(id: string) {
    const found = professionals().find((p) => p.id === id);
    if (!found) throw new ApiError(404, "Professionnel introuvable.");
    return found;
  }
  const bookings = () =>
    store
      .prepare(
        `SELECT ${projection} FROM ${table}${ownerWhere} ORDER BY date DESC,time DESC`,
      )
      .all<Booking>(...owner);
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
    return !store
      .prepare(
        `SELECT id FROM ${table} WHERE professional=? AND date=? AND time=? AND status='confirmed' ${shared ? "AND id NOT LIKE 'demo-%'" : ""} AND NOT (id=? ${shared ? "AND account=?" : ""})`,
      )
      .get(pro, day, time, ignore ?? "", ...owner);
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
      if (ignore) booking(ignore);
      bookableDate(day);
      return displayedTimes.map((time) => ({
        time,
        available:
          bookableTimes.includes(time) && isFree(id, day, time, ignore),
      }));
    },
    favorite(id: string, value: unknown) {
      const pro = professional(id);
      if (shared) db.prepare("INSERT INTO professionals(id,data) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data").run(id, JSON.stringify(pro));
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
      const id = randomUUID();
      transaction(
        store,
        () => {
          const { day, time } = slot(pro.id, data);
          store.prepare(
            `INSERT INTO ${table}(${shared ? "account," : ""}id,professional,animal,animal_name,service,date,time,price,contact_name,email,note) VALUES (${shared ? "?," : ""}?,?,?,?,?,?,?,?,?,?,?)`,
          ).run(
            ...owner,
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
      const created = booking(id);
      bookingMail(created, "confirmed");
      return created;
    },
    update(id: string, data: Input): Booking {
      const current = booking(id);
      if (current.status === "cancelled" || isPast(current))
        throw new ApiError(409, "Ce rendez-vous ne peut plus être modifié.");
      transaction(
        store,
        () => {
          if (data.status === "cancelled")
            store.prepare(
              `UPDATE ${table} SET status='cancelled',cancelled_at=? WHERE id=?${shared ? " AND account=?" : ""}`,
            ).run(new Date().toISOString(), id, ...owner);
          else {
            const { day, time } = slot(current.professional, data, id);
            store.prepare(`UPDATE ${table} SET date=?,time=? WHERE id=?${shared ? " AND account=?" : ""}`).run(
              day,
              time,
              id,
              ...owner,
            );
          }
        },
        "BEGIN IMMEDIATE",
      );
      const updated = booking(id);
      bookingMail(updated, data.status === "cancelled" ? "cancelled" : "moved");
      return updated;
    },
  };
  /** Confirmation, déplacement ou annulation, envoyés à l’adresse donnée à la réservation. */
  function bookingMail(b: Booking, kind: "confirmed" | "moved" | "cancelled") {
    const pro = professional(b.professional),
      service = pro.services[b.service],
      price = euros(b.price),
      when = new Date(`${b.date}T${b.time}`).toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    const place = pro.mode === "En visio" ? "En visioconférence" : pro.address;
    const details = `${service?.name ?? "Rendez-vous"} pour ${b.animalName}\n${when} à ${b.time}\n${pro.name} · ${place}`;
    const reference = `Référence ${b.id.slice(0, 8).toUpperCase()}`;
    void sendMail({
      to: b.email,
      subject:
        kind === "confirmed"
          ? `Rendez-vous confirmé — ${pro.name}`
          : kind === "moved"
            ? `Rendez-vous déplacé — ${pro.name}`
            : `Rendez-vous annulé — ${pro.name}`,
      text:
        kind === "confirmed"
          ? `Bonjour ${b.contactName},\n\nVotre rendez-vous est confirmé.\n\n${details}\n\nTarif annoncé : ${price}. Aucun paiement en ligne effectué. ${reference}.`
          : kind === "moved"
            ? `Bonjour ${b.contactName},\n\nVotre rendez-vous a été déplacé.\n\n${details}\n\nTarif annoncé : ${price}. Aucun paiement en ligne effectué.`
            : `Bonjour ${b.contactName},\n\nVotre rendez-vous est annulé et le créneau libéré.\n\n${details}\n\nAucun paiement en ligne ni remboursement effectué. ${reference}.`,
      action: {
        label: "Voir mes réservations",
        url: `${appUrl()}/#reservations`,
      },
    });
  }
}
const euros = (value: number) =>
  value.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
