import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { openDatabase, databasePath } from "../database/connection.ts";
import { emptyStateMode } from "../database/empty-state.ts";
import { createApi } from "./app.ts";
import { validateProductionConfig } from "./config.ts";

// Réglages locaux (SMTP, clé OpenRouter…) : fichier .env à la racine, jamais commité.
const env = fileURLToPath(new URL("../../.env", import.meta.url));
if (process.env.NODE_ENV !== "production" && existsSync(env)) process.loadEnvFile(env);
validateProductionConfig();

const database = openDatabase();
if (process.env.NODE_ENV === "production" && (
  database.prepare("SELECT id FROM animals LIMIT 1").get() ||
  database.prepare("SELECT name FROM schema_migrations WHERE name IN ('directory_demo_bookings','demo_notifications','demo_received_shares') LIMIT 1").get()
)) {
  database.close();
  throw new Error("The central database contains development animal records. Start production with a clean persistent volume; do not upload the local demo database.");
}
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
const host = process.env.HOST || "127.0.0.1";
await server.ready;
server.listen(port, host, () => {
  const address = server.address();
  console.log(`API Anivaya : http://${host}:${typeof address === "object" && address ? address.port : port}/api/health`);
});
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
