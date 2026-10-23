import type { Animal, Reminder, Share } from "../types.ts";
export const animalName = (animals: Animal[], id: string | undefined) =>
  animals.find((animal) => animal.id === id)?.name || "Animal";
export const parseDate = (value: string) => new Date(`${value}T12:00:00`);
export const fullDate = (value: string) =>
  parseDate(value).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
/** Jour AAAA-MM-JJ décalé de `days` jours, sans dépendre du fuseau du navigateur. */
export function addDays(day: string, days: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
/** Date du jour à Paris, au format AAAA-MM-JJ. */
export const parisToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
/** Date et heure à Paris, au format comparable AAAA-MM-JJ HH:MM. */
export const parisNow = () =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Paris",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());

export const svgImage = (svg: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

export const money = (value: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

/** Recherche insensible à la casse, utilisée par les filtres des listes. */
export const matches = (text: string, query: string) =>
  text.toLocaleLowerCase("fr").includes(query.trim().toLocaleLowerCase("fr"));

export const reminderState = (reminder: Reminder, today: string) =>
  reminder.done ? "done" : reminder.date < today ? "late" : "todo";
export const reminderLabels = {
  done: "Terminé",
  late: "En retard",
  todo: "À faire",
};
/** Les rappels à faire d’abord, puis par date. */
export const byReminderOrder = (a: Reminder, b: Reminder) =>
  Number(a.done) - Number(b.done) || a.date.localeCompare(b.date);

export const shareLabels: Record<Share["status"], string> = {
  active: "Actif dans la démo",
  expired: "Expiré",
  revoked: "Révoqué",
};
