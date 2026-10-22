import type { Database } from "./types.ts";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export function openDatabase(
  path = process.env.DATABASE_PATH ||
    fileURLToPath(new URL("./data/anivaya.sqlite", import.meta.url)),
): Database {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const database = new DatabaseSync(path);
  database.exec(
    readFileSync(
      new URL("./migrations/001_dashboard.sql", import.meta.url),
      "utf8",
    ),
  );
  if (!database.prepare("SELECT id FROM household WHERE id = 1").get()) {
    database.exec("BEGIN");
    try {
      database.exec(
        readFileSync(new URL("./seeds/demo.sql", import.meta.url), "utf8"),
      );
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      database.close();
      throw error;
    }
  }
  database.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY)",
  );
  for (const migration of ["002_animal_records.sql", "003_sharing.sql"]) {
    if (
      !database
        .prepare("SELECT name FROM schema_migrations WHERE name=?")
        .get(migration)
    ) {
      database.exec("BEGIN");
      try {
        database.exec(
          readFileSync(
            new URL(`./migrations/${migration}`, import.meta.url),
            "utf8",
          ),
        );
        database
          .prepare("INSERT INTO schema_migrations VALUES (?)")
          .run(migration);
        database.exec("COMMIT");
      } catch (error) {
        database.exec("ROLLBACK");
        database.close();
        throw error;
      }
    }
  }
  return database as unknown as Database;
}
