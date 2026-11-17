import { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { basename, dirname, join } from "node:path";

/** Package only application code and fictional fixtures for the isolated review branch. */
export function buildReviewFunction(root: string, output: string) {
  const target = join(output, "functions", "review-api.func");
  mkdirSync(target, { recursive: true });
  function compile(directory: string) {
    for (const entry of readdirSync(join(root, directory), { withFileTypes: true })) {
      const file = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "data") compile(file);
      } else if (entry.name.endsWith(".ts")) {
        const dest = join(target, file.replace(/\.ts$/, ".js"));
        mkdirSync(dirname(dest), { recursive: true });
        const code = stripTypeScriptTypes(readFileSync(join(root, file), "utf8"));
        writeFileSync(dest, code.replace(/\.ts(["'])/g, ".js$1"));
      }
    }
  }
  for (const dir of ["back/api", "back/database", "shared"]) compile(dir);
  for (const dir of ["migrations", "seeds", "fixtures"]) {
    cpSync(join(root, "back/database", dir), join(target, "back/database", dir), { recursive: true });
  }
  cpSync(join(root, "back/node_modules"), join(target, "back/node_modules"), {
    recursive: true, filter: path => basename(path) !== ".bin",
  });
  cpSync(join(root, "deploy/vercel-review.mjs"), join(target, "index.mjs"));
  writeFileSync(join(target, "package.json"), JSON.stringify({ type: "module" }));
  writeFileSync(join(target, ".vc-config.json"), JSON.stringify({
    runtime: "nodejs22.x", handler: "index.mjs", launcherType: "Nodejs", shouldAddHelpers: false, maxDuration: 60,
  }));
}
