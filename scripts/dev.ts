import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const children = [
  spawn(process.execPath, ["--watch", "back/api/server.ts"], {
    cwd: root,
    stdio: "inherit",
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
      "5173",
      "--strictPort",
    ],
    {
      cwd: fileURLToPath(new URL("../front/", import.meta.url)),
      stdio: "inherit",
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
