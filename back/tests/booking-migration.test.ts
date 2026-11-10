import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { openDatabase } from "../database/connection.ts";
import { authentication } from "../api/auth.ts";
import { directoryRepository } from "../api/directory.ts";
import { migrateBookings, prepareBookingStore } from "../api/booking-store.ts";

test("legacy booking migration refuses conflicts atomically and preserves owners after reconciliation", async () => {
  const root = mkdtempSync(join(tmpdir(), "anivaya-booking-migration-"));
  const db = openDatabase(":memory:");
  const auth = authentication(db, join(root, "accounts"));
  try {
    await auth.ready;
    const owners = auth.accounts().filter(a => ["demo", "demo-2"].includes(a.id));
    const repositories = owners.map(a => directoryRepository(auth.workspace(a)));
    const date = new Date(); date.setUTCDate(date.getUTCDate() + 10);
    const input = { professional: "tilleuls", animal: "nala", service: 0, date: date.toISOString().slice(0, 10), time: "09:00", contactName: "Migration", email: "migration@example.test", note: "" };
    const bookings = repositories.map(repository => repository.create(input));
    prepareBookingStore(db);
    assert.throws(() => migrateBookings(db, auth), /Booking migration conflict/);
    assert.equal(db.prepare("SELECT count(*) AS n FROM shared_bookings").get()!.n, 0);
    assert.equal(db.prepare("SELECT count(*) AS n FROM booking_migrations").get()!.n, 0);
    assert.equal(repositories[0].all().bookings.find(b => b.id === bookings[0].id)!.status, "confirmed");
    assert.equal(repositories[1].all().bookings.find(b => b.id === bookings[1].id)!.status, "confirmed");
    repositories[1].update(bookings[1].id, { status: "cancelled" });
    migrateBookings(db, auth);
    const count = db.prepare("SELECT count(*) AS n FROM shared_bookings").get()!.n;
    migrateBookings(db, auth);
    assert.equal(db.prepare("SELECT count(*) AS n FROM shared_bookings").get()!.n, count);
    const first = directoryRepository(auth.workspace(owners[0]), { db, account: owners[0].id });
    const second = directoryRepository(auth.workspace(owners[1]), { db, account: owners[1].id });
    assert.ok(first.all().bookings.some(b => b.id === bookings[0].id));
    assert.ok(!second.all().bookings.some(b => b.id === bookings[0].id));
    assert.equal(second.slots("tilleuls", input.date).find(s => s.time === "09:00")!.available, false);
  } finally {
    auth.close(); db.close();
    assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep));
    rmSync(root, { recursive: true, force: true });
  }
});
