import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const empty = process.argv.includes("--empty");
const frontPort = empty ? "5174" : "5173";
const env = empty
  ? {
      ...process.env,
      ANIVAYA_EMPTY_STATE: "1",
      DATABASE_PATH: fileURLToPath(new URL("../back/database/data/empty-state/central.sqlite", import.meta.url)),
      PORT: "3002",
      VITE_API_TARGET: "http://127.0.0.1:3002",
      ALLOWED_ORIGINS: "http://127.0.0.1:5174,http://localhost:5174,http://127.0.0.1:3002",
      APP_URL: "http://127.0.0.1:5174",
    }
  : process.env;
const children = [
  spawn(process.execPath, ["--watch", "back/api/server.ts"], {
    cwd: root,
    stdio: "inherit",
    env,
  }),
  spawn(
    process.execPath,
    [
      fileURLToPath(
        new URL("../front/node_modules/vite/bin/vite.js", import.meta.url),
      ),
      "--host",
      "127.0.0.1",
      "--port",
      frontPort,
      "--strictPort",
    ],
    {
      cwd: fileURLToPath(new URL("../front/", import.meta.url)),
      stdio: "inherit",
      env,
    },
  ),
];
// Vite's executable is relative to the project root, its working directory to front.
children[1].on("error", stop);
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
}
for (const child of children) child.on("exit", stop);
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
