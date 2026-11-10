import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import type { AddressInfo } from "node:net";
import type { AuthUser } from "../../shared/account.ts";
import { openDatabase } from "../database/connection.ts";
import { createApi } from "../api/app.ts";
import { authentication, DEMO_PASSWORD } from "../api/auth.ts";
import { rateLimiter } from "../api/rate-limit.ts";

test("Production: no default admin, verified invitations, shared bookings and persistent limits", async t => {
  const root = mkdtempSync(join(tmpdir(), "anivaya-production-test-"));
  const saved = { NODE_ENV: process.env.NODE_ENV, MAIL_OUTBOX: process.env.MAIL_OUTBOX, SMTP_HOST: process.env.SMTP_HOST };
  process.env.NODE_ENV = "production";
  process.env.MAIL_OUTBOX = join(root, "outbox");
  delete process.env.SMTP_HOST;
  const path = join(root, "central.sqlite");
  let db = openDatabase(path);
  let server = createApi(db, { userDatabaseDirectory: join(root, "accounts") });
  let base = "";
  async function start() {
    await server.ready;
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  }
  await start();
  t.after(async () => {
    await new Promise<void>(r => server.close(() => r()));
    db.close();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep));
    rmSync(root, { recursive: true, force: true });
  });
  const req = (url: string, method = "GET", body?: unknown, cookie = "") => fetch(base + url, {
    method, headers: { "Content-Type": "application/json", Cookie: cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  async function register(email: string) {
    const response = await req("/auth/register", "POST", { email, name: "Test", password: DEMO_PASSWORD, confirmPassword: DEMO_PASSWORD });
    assert.equal(response.status, 201, await response.clone().text());
    assert.match(response.headers.get("set-cookie")!, /; Secure/);
    return { user: await response.json() as AuthUser, cookie: response.headers.get("set-cookie")!.split(";")[0] };
  }
  await t.test("production starts empty and unknown login returns 401", async () => {
    assert.equal(db.prepare("SELECT count(*) AS n FROM accounts").get()!.n, 0);
    assert.equal(db.prepare("SELECT count(*) AS n FROM professionals").get()!.n, 0);
    assert.equal((await req("/auth/login", "POST", { email: "admin@anivaya.fr", password: DEMO_PASSWORD })).status, 401);
    const response = await fetch(base + "/health", { headers: { Origin: "http://localhost:5173" } });
    assert.equal(response.status, 403);
  });
  const owner = await register("owner@example.net");
  db.prepare("INSERT INTO admin_members(account,role) VALUES (?,'Administrateur')").run(owner.user.id);
  const recipient = await register("recipient@example.net");
  const other = await register("other@example.net");
  function mailedTokens() {
    return readdirSync(join(root, "outbox")).flatMap(name => [...readFileSync(join(root, "outbox", name), "utf8").matchAll(/#invitation\/([a-f0-9]{64})/g)].map(m => m[1]));
  }
  await t.test("existing and new accounts need a secret link; renew, wrong user, expiry and replay", async () => {
    const invite = await req("/admin/team", "POST", { email: recipient.user.profile.email, role: "Support" }, owner.cookie);
    assert.equal(invite.status, 201);
    const record = await invite.json() as { id: string; version: number };
    const token = mailedTokens()[0];
    assert.ok(token);
    const stored = db.prepare("SELECT token_hash FROM admin_invitations WHERE id=?").get(record.id)!.token_hash;
    assert.equal(stored, createHash("sha256").update(token).digest("hex"));
    assert.equal((await req("/admin/overview", "GET", undefined, recipient.cookie)).status, 403);
    assert.equal((await req("/account/invitation", "POST", { token }, other.cookie)).status, 403);
    assert.equal((await req(`/admin/team/${record.id}/actions`, "POST", { action: "renew", note: "Test", version: record.version }, owner.cookie)).status, 200);
    const renewed = mailedTokens().find(value => value !== token)!;
    assert.ok(renewed);
    assert.equal((await req("/account/invitation", "POST", { token }, recipient.cookie)).status, 400);
    db.prepare("UPDATE admin_invitations SET expires_at=? WHERE id=?").run("2000-01-01T00:00:00.000Z", record.id);
    assert.equal((await req("/account/invitation", "POST", { token: renewed }, recipient.cookie)).status, 400);
    db.prepare("UPDATE admin_invitations SET expires_at=? WHERE id=?").run("2099-01-01T00:00:00.000Z", record.id);
    const accepted = await req("/account/invitation", "POST", { token: renewed }, recipient.cookie);
    assert.equal(accepted.status, 200);
    assert.equal((await accepted.json() as AuthUser).adminRole, "Support");
    const oldCookie = recipient.cookie;
    recipient.cookie = accepted.headers.get("set-cookie")!.split(";")[0];
    assert.notEqual(recipient.cookie, oldCookie);
    assert.equal((await req("/admin/overview", "GET", undefined, oldCookie)).status, 401);
    assert.equal((await req("/account/invitation", "POST", { token: renewed }, recipient.cookie)).status, 400);
    const pending = await req("/admin/team", "POST", { email: "new@example.net", role: "Modérateur" }, owner.cookie);
    assert.equal(pending.status, 201);
    const newcomer = await register("new@example.net");
    assert.equal(newcomer.user.adminRole, undefined);
    const pendingRecord = await pending.json() as { id: string; version: number };
    const pendingToken = mailedTokens().find(value => value !== token && value !== renewed)!;
    assert.equal((await req(`/admin/team/${pendingRecord.id}/actions`, "POST", { action: "cancel", note: "Test", version: pendingRecord.version }, owner.cookie)).status, 204);
    assert.equal((await req("/account/invitation", "POST", { token: pendingToken }, newcomer.cookie)).status, 400);
  });
  await t.test("two accounts cannot reserve the same slot; cancel releases it; restart preserves it", async () => {
    // Explicit test-only fixture; production never seeds professionals.
    db.exec(readFileSync(new URL("../database/seeds/professionals.sql", import.meta.url), "utf8"));
    const pro = db.prepare("SELECT id FROM professionals LIMIT 1").get()!.id as string;
    const at = new Date().toISOString();
    db.prepare("INSERT INTO admin_records(id,resource,name,status,data,created_at,updated_at) VALUES (?,'pros','Test','Validé','{}',?,?)").run(pro, at, at);
    const pets: string[] = [];
    for (const person of [owner, other]) {
      const pet = await req("/animals", "POST", { name: "Pixel", species: "Chien", contact: "Test", identifier: "", behavior: "", vet: "" }, person.cookie);
      assert.equal(pet.status, 201, await pet.clone().text());
      pets.push((await pet.json() as { id: string }).id);
    }
    const date = new Date(); date.setUTCDate(date.getUTCDate() + 10);
    const input = { professional: pro, service: 0, date: date.toISOString().slice(0, 10), time: "09:00", contactName: "Test", email: "booking@example.test", note: "" };
    const results = await Promise.all([owner, other].map((p, i) => req("/bookings", "POST", { ...input, animal: pets[i] }, p.cookie)));
    assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
    const winner = results[0].status === 201 ? 0 : 1;
    const people = [owner, other];
    const booking = await results[winner].json() as { id: string };
    assert.equal((await req(`/bookings/${booking.id}`, "PATCH", { status: "cancelled" }, people[1-winner].cookie)).status, 404);
    assert.equal((await req(`/professionals/${pro}/slots?date=${input.date}&ignore=${booking.id}`, "GET", undefined, people[1-winner].cookie)).status, 404);
    assert.equal((await req(`/bookings/${booking.id}`, "PATCH", { status: "cancelled" }, people[winner].cookie)).status, 200);
    assert.equal((await req("/bookings", "POST", { ...input, animal: pets[1-winner] }, people[1-winner].cookie)).status, 201);
    await new Promise<void>(r => server.close(() => r())); db.close();
    db = openDatabase(path); server = createApi(db, { userDatabaseDirectory: join(root, "accounts") }); await start();
    assert.equal((await req("/bookings", "POST", { ...input, animal: pets[winner] }, people[winner].cookie)).status, 409);
  });
  await t.test("contact and AI quotas are enforced and survive limiter recreation", async () => {
    for (let i = 0; i < 5; i++) assert.equal((await req("/public/contact", "POST", { name: "Test", email: "test@example.test", subject: "Test", message: "Message de test suffisamment long" })).status, 201);
    assert.equal((await req("/public/contact", "POST", {})).status, 429);
    for (let i = 0; i < 10; i++) assert.notEqual((await req("/imports/extract", "POST", {}, other.cookie)).status, 429);
    assert.equal((await req("/imports/extract", "POST", {}, other.cookie)).status, 429);
    const limits = rateLimiter(db); limits.consume("test", "identity", 1, 60_000);
    assert.throws(() => rateLimiter(db).consume("test", "identity", 1, 60_000), /Trop de demandes/);
  });
});

test("production revokes demo privileges and sessions from an existing database", async () => {
  const root = mkdtempSync(join(tmpdir(), "anivaya-demo-quarantine-"));
  const previous = process.env.NODE_ENV; delete process.env.NODE_ENV;
  const db = openDatabase(":memory:");
  let auth = authentication(db, join(root, "accounts"));
  try {
    await auth.ready;
    const token = "previous-demo-session";
    db.prepare("INSERT INTO sessions VALUES (?,'demo-admin',?)").run(createHash("sha256").update(token).digest("hex"), Date.now() + 60_000);
    auth.close(); process.env.NODE_ENV = "production";
    auth = authentication(db, join(root, "accounts")); await auth.ready;
    assert.equal(db.prepare("SELECT * FROM admin_members WHERE account='demo-admin'").get(), undefined);
    assert.equal(db.prepare("SELECT * FROM sessions WHERE account='demo-admin'").get(), undefined);
    assert.equal(auth.accounts().some(a => a.id === "demo-admin"), false);
  } finally {
    auth.close(); db.close();
    if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous;
    assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep));
    rmSync(root, { recursive: true, force: true });
  }
});
