import type { Database } from "../database/types.ts";
import type { Authentication } from "./auth.ts";
import { transaction } from "../database/connection.ts";

export function prepareBookingStore(db: Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS shared_bookings (
    account TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    id TEXT NOT NULL, professional TEXT NOT NULL, animal TEXT NOT NULL, animal_name TEXT NOT NULL,
    service INTEGER NOT NULL, date TEXT NOT NULL, time TEXT NOT NULL, price INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK(status IN ('confirmed','cancelled')),
    contact_name TEXT NOT NULL, email TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, cancelled_at TEXT,
    PRIMARY KEY(account,id));
    CREATE UNIQUE INDEX IF NOT EXISTS shared_booking_slot ON shared_bookings(professional,date,time)
      WHERE status='confirmed' AND id NOT LIKE 'demo-%';
    CREATE TABLE IF NOT EXISTS booking_migrations(account TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE);`);
}

/** All existing owners are imported before requests are accepted, so an unopened
 * account's reservations still block the slot. A conflict aborts the migration. */
export function migrateBookings(db: Database, auth: Authentication) {
  transaction(db, () => {
    for (const account of auth.accounts()) {
      if (db.prepare("SELECT account FROM booking_migrations WHERE account=?").get(account.id)) continue;
      const rows = auth.workspace(account).prepare("SELECT * FROM bookings").all();
      for (const row of rows) {
        try {
          db.prepare(`INSERT INTO shared_bookings(account,id,professional,animal,animal_name,service,date,time,price,status,contact_name,email,note,created_at,cancelled_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(account.id, row.id, row.professional, row.animal, row.animal_name, row.service, row.date, row.time, row.price, row.status, row.contact_name, row.email, row.note, row.created_at, row.cancelled_at);
        } catch (cause) {
          throw new Error(`Booking migration conflict for account ${account.id}, booking ${row.id}. Resolve existing duplicate slots before startup; no booking was discarded.`, { cause });
        }
      }
      db.prepare("INSERT INTO booking_migrations VALUES (?)").run(account.id);
    }
  }, "BEGIN IMMEDIATE");
}
