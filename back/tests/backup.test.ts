import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createBackup, restoreBackup, verifyBackup } from "../../scripts/backup.ts";

test("backup and restore preserve multiple databases, reject overwrite, tampering and traversal", () => {
  const root = mkdtempSync(join(tmpdir(), "anivaya-backup-test-"));
  try {
    const data = join(root, "data"); mkdirSync(join(data, "accounts"), { recursive: true });
    for (const name of ["central.sqlite", "accounts/user.sqlite"]) {
      const db = new DatabaseSync(join(data, name));
      db.exec("CREATE TABLE records(value TEXT); INSERT INTO records VALUES ('persistent content')"); db.close();
    }
    const backup = join(root, "backup"), restored = join(root, "restored");
    assert.equal(createBackup(data, backup).files.length, 2);
    restoreBackup(backup, restored);
    for (const name of ["central.sqlite", "accounts/user.sqlite"]) {
      const db = new DatabaseSync(join(restored, name), { readOnly: true });
      assert.equal(db.prepare("SELECT value FROM records").get()!.value, "persistent content"); db.close();
    }
    assert.throws(() => restoreBackup(backup, restored), /never overwritten/);
    writeFileSync(join(backup, "central.sqlite"), "tampered");
    assert.throws(() => verifyBackup(backup), /checksum/);
    const manifest = JSON.parse(readFileSync(join(backup, "manifest.json"), "utf8"));
    manifest.files[0].path = "../outside.sqlite";
    writeFileSync(join(backup, "manifest.json"), JSON.stringify(manifest));
    assert.throws(() => verifyBackup(backup), /Unsafe backup path/);
  } finally {
    assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep));
    rmSync(root, { recursive: true, force: true });
  }
});
