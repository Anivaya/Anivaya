import { createHash } from "node:crypto";
import type { Database } from "../database/types.ts";
import { transaction } from "../database/connection.ts";
import { ApiError } from "./validation.ts";

/** Persistent, bounded windows; only hashed identifiers are retained. */
export function rateLimiter(db: Database) {
  db.exec("CREATE TABLE IF NOT EXISTS request_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL)");
  const consume = (scope: string, identity: string, maximum: number, duration: number) => {
    const key = createHash("sha256").update(`${scope}:${identity}`).digest("hex");
    const now = Date.now();
    transaction(db, () => {
      db.prepare("DELETE FROM request_limits WHERE expires<=?").run(now);
      const row = db.prepare("SELECT count FROM request_limits WHERE key=?").get<{ count: number }>(key);
      if (row && row.count >= maximum)
        throw new ApiError(429, "Trop de demandes. Réessayez plus tard.");
      db.prepare("INSERT INTO request_limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1").run(key, now + duration);
    }, "BEGIN IMMEDIATE");
  };
  return { consume };
}
