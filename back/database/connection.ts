import type { Database } from "./types.ts";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const migrations = [
  "002_animal_records.sql",
  "003_sharing.sql",
  "004_profile_directory.sql",
  "005_notifications.sql",
];
const sql = (file: string) =>
  readFileSync(new URL(file, import.meta.url), "utf8");

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

export function openDatabase(path = databasePath(), demo = true): Database {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const database = new DatabaseSync(path);
  const applyOnce = (name: string, file: string) => {
    if (
      database
        .prepare("SELECT name FROM schema_migrations WHERE name=?")
        .get(name)
    )
      return;
    transaction(database, () => {
      database.exec(sql(file));
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
    database.exec(sql("./seeds/professionals.sql"));
    if (demo) {
      applyOnce("directory_demo_bookings", "./seeds/bookings.sql");
      applyOnce("demo_notifications", "./seeds/notifications.sql");
    }
  } catch (error) {
    database.close();
    throw error;
  }
  return database as unknown as Database;
}
