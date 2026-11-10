import type { Authentication } from "./auth.ts";
import { profileRepository } from "./profile.ts";
import { localToday } from "./validation.ts";
import { appUrl, sendMail } from "./mail.ts";

/** Délai de prévenance choisi sur le rappel, en jours avant l’échéance. */
const noticeDays: Record<string, number> = {
  "Le jour même": 0,
  "1 jour avant": 1,
  "3 jours avant": 3,
  "7 jours avant": 7,
};
const addDays = (day: string, days: number) => {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/**
 * Rappels arrivés à leur délai de prévenance : une notification dans l’espace et un
 * e-mail, une seule fois par rappel, si la personne a gardé « Rappels » dans ses préférences.
 */
const running = new WeakMap<Authentication, Promise<void>>();
export function sendDueReminders(auth: Authentication): Promise<void> {
  const existing = running.get(auth);
  if (existing) return existing;
  const job = deliverDueReminders(auth).finally(() => running.delete(auth));
  running.set(auth, job);
  return job;
}
async function deliverDueReminders(auth: Authentication) {
  const today = localToday();
  for (const account of auth.accounts()) {
    const ws = auth.workspace(account);
    const profile = profileRepository(ws).get();
    if (!profile.notifications.reminders) continue;
    const due = ws
      .prepare(
        "SELECT r.id,r.name,r.date,r.notice,a.name AS animal FROM reminders r JOIN animals a ON a.id=r.animal WHERE r.done=0 AND r.deleted_at IS NULL AND a.deleted_at IS NULL AND r.notified_at IS NULL AND r.date>=?",
      )
      .all<{
        id: string;
        name: string;
        date: string;
        notice: string;
        animal: string;
      }>(today)
      .filter((r) => addDays(r.date, -(noticeDays[r.notice] ?? 0)) <= today);
    for (const reminder of due) {
      const when =
        reminder.date === today
          ? "aujourd’hui"
          : `le ${new Date(`${reminder.date}T12:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}`;
      ws.prepare(
        "INSERT OR IGNORE INTO notifications(id,category,title,text,href,action,created_at,read) VALUES (?,'reminders',?,?,?,?,?,0)",
      ).run(
        `reminder-${reminder.id}-${reminder.date}`,
        `${reminder.name} · ${reminder.animal}`,
        `À faire ${when}.`,
        "#rappels",
        "Voir les rappels",
        new Date().toISOString(),
      );
      const delivery = await sendMail({
        idempotencyKey: `reminder/${account.id}/${reminder.id}/${reminder.date}`,
        to: account.email,
        subject: `Rappel : ${reminder.name} pour ${reminder.animal}`,
        text: `Bonjour ${profile.name || ""},\n\n« ${reminder.name} » pour ${reminder.animal} est prévu ${when}.\n\nVous recevez ce message car les rappels sont activés dans vos préférences.`,
        action: { label: "Voir mes rappels", url: `${appUrl()}/#rappels` },
      });
      if (delivery !== "failed") ws.prepare("UPDATE reminders SET notified_at=? WHERE id=?").run(
        new Date().toISOString(),
        reminder.id,
      );
    }
  }
}

/** Vérifie les rappels au démarrage puis toutes les heures. */
export function startReminderMail(auth: Authentication) {
  const run = () =>
    sendDueReminders(auth).catch((error) =>
      console.error("Envoi des rappels impossible :", error),
    );
  void auth.ready.then(run);
  const timer = setInterval(run, 60 * 60 * 1000);
  timer.unref();
  return () => clearInterval(timer);
}
