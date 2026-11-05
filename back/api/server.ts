import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { openDatabase, databasePath } from "../database/connection.ts";
import { emptyStateMode } from "../database/empty-state.ts";
import { createApi } from "./app.ts";

// Réglages locaux (SMTP, clé de l’API Claude…) : fichier .env à la racine, jamais commité.
const env = fileURLToPath(new URL("../../.env", import.meta.url));
if (existsSync(env)) process.loadEnvFile(env);

const database = openDatabase();
const emptyRoot = join(dirname(databasePath()), "empty-state");
const emptyDatabase = !emptyStateMode() && process.env.NODE_ENV !== "production"
  ? openDatabase(join(emptyRoot, "central.sqlite"), false, true)
  : undefined;
const server = createApi(database, {
  reminders: true,
  emptyDatabase,
  emptyUserDatabaseDirectory: join(emptyRoot, "accounts"),
});
const port = Number(process.env.PORT || 3001);
server.listen(port, "127.0.0.1", () =>
  console.log(`API Anivaya : http://127.0.0.1:${port}/api/dashboard`),
);
server.on("error", (error) => {
  console.error(error.message);
  database.close();
  emptyDatabase?.close();
  process.exitCode = 1;
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(() => {
      database.close();
      emptyDatabase?.close();
      process.exit(0);
    }),
  );
