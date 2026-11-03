import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { openDatabase } from "../database/connection.ts";
import { createApi } from "./app.ts";

// Réglages locaux (SMTP, clé de l’API Claude…) : fichier .env à la racine, jamais commité.
const env = fileURLToPath(new URL("../../.env", import.meta.url));
if (existsSync(env)) process.loadEnvFile(env);

const database = openDatabase();
const server = createApi(database, { reminders: true });
const port = Number(process.env.PORT || 3001);
server.listen(port, "127.0.0.1", () =>
  console.log(`API Anivaya : http://127.0.0.1:${port}/api/dashboard`),
);
server.on("error", (error) => {
  console.error(error.message);
  database.close();
  process.exitCode = 1;
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(() => {
      database.close();
      process.exit(0);
    }),
  );
