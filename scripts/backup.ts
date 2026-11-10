import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

interface Manifest { version: number; createdAt: string; files: { path: string; sha256: string }[] }
const digest = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");
function inside(root: string, name: string) {
  const target = resolve(root, name);
  if (isAbsolute(name) || !target.startsWith(resolve(root) + sep)) throw new Error("Unsafe backup path.");
  return target;
}
function emptyDirectory(path: string) {
  if (existsSync(path)) {
    if (lstatSync(path).isSymbolicLink() || !lstatSync(path).isDirectory() || readdirSync(path).length)
      throw new Error("Destination must be a new or empty directory; existing data is never overwritten.");
  } else mkdirSync(path, { recursive: true, mode: 0o700 });
}
function integrity(path: string) {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const result = db.prepare("PRAGMA integrity_check").all();
    if (result.length !== 1 || result[0].integrity_check !== "ok") throw new Error("SQLite integrity check failed: " + path);
  } finally { db.close(); }
}
export function verifyBackup(directory: string): Manifest {
  const manifest = JSON.parse(readFileSync(join(directory, "manifest.json"), "utf8")) as Manifest;
  if (manifest.version !== 1 || !Array.isArray(manifest.files) || !manifest.files.length)
    throw new Error("Invalid or incomplete backup manifest.");
  const paths = new Set<string>();
  for (const file of manifest.files) {
    if (typeof file.path !== "string" || !/^[a-f0-9]{64}$/.test(file.sha256) || paths.has(file.path)) throw new Error("Invalid backup entry.");
    paths.add(file.path);
    const path = inside(directory, file.path);
    // Reject symlinks at every level, not only at the leaf.
    let current = path;
    while (current !== resolve(directory)) {
      if (lstatSync(current).isSymbolicLink()) throw new Error("Backup symlinks are forbidden.");
      current = dirname(current);
    }
    if (digest(path) !== file.sha256) throw new Error("Backup checksum mismatch: " + file.path);
    if (file.path.endsWith(".sqlite")) integrity(path);
  }
  return manifest;
}
export function createBackup(source: string, destination: string) {
  source = resolve(source); destination = resolve(destination);
  if (source === destination || destination.startsWith(source + sep) || source.startsWith(destination + sep))
    throw new Error("Source and backup destination must be separate directories.");
  emptyDirectory(destination);
  const manifest: Manifest = { version: 1, createdAt: new Date().toISOString(), files: [] };
  function visit(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error("Source symlinks are forbidden.");
      const path = join(directory, entry.name);
      if (entry.isDirectory()) { visit(path); continue; }
      if (!entry.isFile() || !/\.(sqlite|key)$/.test(entry.name)) continue;
      const name = relative(source, path).split(sep).join("/");
      const output = inside(destination, name);
      mkdirSync(dirname(output), { recursive: true, mode: 0o700 });
      if (entry.name.endsWith(".sqlite")) {
        const db = new DatabaseSync(path, { readOnly: true });
        try { db.prepare("VACUUM INTO ?").run(output); } finally { db.close(); }
        integrity(output);
      } else copyFileSync(path, output);
      manifest.files.push({ path: name, sha256: digest(output) });
    }
  }
  visit(source);
  if (!manifest.files.some(file => file.path.endsWith(".sqlite"))) throw new Error("No databases found; backup is incomplete.");
  writeFileSync(join(destination, "manifest.json"), JSON.stringify(manifest, null, 2), { flag: "wx", mode: 0o600 });
  verifyBackup(destination);
  return manifest;
}
export function restoreBackup(source: string, destination: string) {
  const manifest = verifyBackup(source);
  emptyDirectory(destination);
  for (const file of manifest.files) {
    const output = inside(destination, file.path);
    mkdirSync(dirname(output), { recursive: true, mode: 0o700 });
    copyFileSync(inside(source, file.path), output, 1); // COPYFILE_EXCL
  }
  return manifest;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [action, source, destination, offline] = process.argv.slice(2);
  if (process.env.DATABASE_URL && action !== "verify") throw new Error("This tool backs up SQLite only. For Supabase use PostgreSQL and private Storage backups as described in CLOUD-SETUP.md.");
  if (!source || !["create", "verify", "restore"].includes(action) ||
    (action !== "verify" && (!destination || offline !== "--offline")))
    throw new Error("Usage: node scripts/backup.ts verify BACKUP | create DATA BACKUP --offline | restore BACKUP EMPTY_DATA --offline. Stop the API first.");
  const result = action === "create" ? createBackup(source, destination) : action === "restore" ? restoreBackup(source, destination) : verifyBackup(source);
  console.log(`${action}: ${result.files.length} files verified.`);
}
