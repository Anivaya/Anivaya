import type { Database, Notification } from "../database/types.ts";
import { ApiError } from "./validation.ts";

type NotificationRow = Omit<Notification, "read"> & { read: number };

export function notificationsRepository(db: Database) {
  const all = (): Notification[] =>
    db
      .prepare(
        "SELECT id,category,title,text,href,action,created_at AS date,read FROM notifications ORDER BY created_at DESC,rowid DESC",
      )
      .all<NotificationRow>()
      .map((row) => ({ ...row, read: Boolean(row.read) }));
  return {
    all,
    setRead(id: string, read: unknown) {
      if (typeof read !== "boolean")
        throw new ApiError(400, "Le statut doit être un booléen.", "read");
      const { changes } = db
        .prepare("UPDATE notifications SET read=? WHERE id=?")
        .run(Number(read), id);
      if (!changes) throw new ApiError(404, "Notification introuvable.");
      return all().find((notification) => notification.id === id)!;
    },
    readAll() {
      db.prepare("UPDATE notifications SET read=1 WHERE read=0").run();
      return all();
    },
  };
}
