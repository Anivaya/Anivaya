import type { Database } from "./types.ts";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { emptyStateMode } from "./empty-state.ts";
import { openPostgres } from "./postgres.ts";

const migrations = [
  "002_animal_records.sql",
  "003_sharing.sql",
  "004_profile_directory.sql",
  "005_notifications.sql",
  "006_received_shares.sql",
  "007_social_notifications.sql",
  "010_activity.sql",
  "011_reminder_notifications.sql",
  "012_wording.sql",
  "013_contact_wording.sql",
  "014_profile_postal_code.sql",
];
const sql = (file: string) =>
  readFileSync(new URL(file, import.meta.url), "utf8");
/** Migration de la base centrale seule (comptes, administration), appliquée par `authentication`. */
export const centralMigration = (name: string) => sql(`./migrations/${name}`);

/** Base centrale : `DATABASE_PATH` ou `data/anivaya.sqlite`. */
export const databasePath = () =>
  process.env.DATABASE_PATH ||
  fileURLToPath(new URL("./data/anivaya.sqlite", import.meta.url));

/** Exécute `work` dans une transaction, annulée si une erreur survient. */
export function transaction<T>(
  db: Pick<DatabaseSync, "exec">,
  work: () => T,
  begin = "BEGIN",
): T {
  db.exec(begin);
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function openDatabase(
  path = databasePath(),
  demo = process.env.NODE_ENV !== "production",
  empty = emptyStateMode(),
  workspace?: string,
): Database {
  if (process.env.DATABASE_URL) demo = false;
  if (emptyStateMode(empty)) demo = false;
  if (!process.env.DATABASE_URL && path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const database = process.env.DATABASE_URL ? openPostgres(workspace) : new DatabaseSync(path);
  const applyOnce = (name: string, file: string) => {
    if (
      database
        .prepare("SELECT name FROM schema_migrations WHERE name=?")
        .get(name)
    )
      return;
    transaction(database, () => {
      database.exec(sql(file));
      if (empty && name === "005_notifications.sql")
        database
          .prepare("DELETE FROM notifications WHERE id='bienvenue'")
          .run();
      database.prepare("INSERT INTO schema_migrations VALUES (?)").run(name);
    });
  };
  try {
    database.exec(sql("./migrations/001_dashboard.sql"));
    if (!database.prepare("SELECT id FROM household WHERE id = 1").get())
      transaction(database, () => {
        if (demo) database.exec(sql("./seeds/demo.sql"));
        else
          database
            .prepare(
              "INSERT INTO household(id,first_name,last_name,label) VALUES (1,?,?,?)",
            )
            .run("", "", "Mon foyer");
      });
    database.exec(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY)",
    );
    for (const migration of migrations)
      applyOnce(migration, `./migrations/${migration}`);
    if (!empty && process.env.NODE_ENV !== "production" && !process.env.DATABASE_URL) database.exec(sql("./seeds/professionals.sql"));
    if (demo) {
      applyOnce("directory_demo_bookings", "./seeds/bookings.sql");
      applyOnce("demo_notifications", "./seeds/notifications.sql");
      applyOnce("demo_received_shares", "./seeds/received_shares.sql");
    }
  } catch (error) {
    database.close();
    throw error;
  }
  return database as unknown as Database;
}
