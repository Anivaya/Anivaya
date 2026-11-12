import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { openDatabase } from "../database/connection.ts";
import { createApi } from "../api/app.ts";
import { localToday } from "../api/validation.ts";
import type { Profile } from "../../shared/account.ts";
import type { Animal, ExtractedValues } from "../../shared/models.ts";

test("API: legal loading, private profile photos, optional AI date and scheduled reminders", async t => {
  const before = { ...process.env };
  const directory = mkdtempSync(join(tmpdir(), "anivaya-additional-"));
  const outbox = join(directory, "outbox");
  Object.assign(process.env, { NODE_ENV: "production", MAIL_OUTBOX: outbox, CRON_SECRET: "local-fixture-secret", OPENROUTER_API_KEY: "local-fixture-key" });
  const db = openDatabase(join(directory, "central.sqlite"));
  const server = createApi(db, { userDatabaseDirectory: join(directory, "accounts") });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  t.after(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    db.close();
    rmSync(directory, { recursive: true, force: true });
    for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key];
    Object.assign(process.env, before);
  });
  const realFetch = globalThis.fetch;
  let aiCalls = 0;
  t.mock.method(globalThis, "fetch", (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    if (String(input) === "https://openrouter.ai/api/v1/chat/completions") {
      aiCalls++;
      return Promise.resolve(Response.json({ choices: [{ message: { content: JSON.stringify({ readable: true, title: "Document fictif", name: "Pixel", date: "" }) }, finish_reason: "stop" }] }));
    }
    assert.ok(String(input).startsWith(base), "Tests cannot contact an external service");
    return realFetch(input, init);
  });
  let cookie = "";
  const request = (path: string, method = "GET", body?: unknown, authorization?: string) => fetch(base + path, {
    method, headers: { "Content-Type": "application/json", Cookie: cookie, ...(authorization ? { Authorization: authorization } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  assert.equal(await (await request("/public/legal")).json(), null);
  assert.equal((await request("/profile/photo")).status, 401);
  const registration = await request("/auth/register", "POST", { name: "API Fixture", email: "api-fixture@example.net", password: "Fixture-password1!", confirmPassword: "Fixture-password1!" });
  assert.equal(registration.status, 201);
  cookie = registration.headers.get("set-cookie")!.split(";")[0];
  assert.equal((await request("/profile/photo")).status, 404);
  const profile = await (await request("/profile")).json() as Profile;
  const content = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6dVIAAAAASUVORK5CYII=";
  assert.equal((await request("/profile", "PATCH", { ...profile, photo: { type: "image/png", content } })).status, 200);
  const photo = await request("/profile/photo");
  assert.equal(photo.status, 200);
  assert.equal(photo.headers.get("content-type"), "image/png");
  assert.deepEqual(Buffer.from(await photo.arrayBuffer()), Buffer.from(content, "base64"));
  assert.equal((await request("/account/password-reset", "POST", {})).status, 204);
  assert.equal(readdirSync(outbox).length, 1);
  const extraction = await request("/imports/extract", "POST", { type: "image/png", content });
  assert.equal(extraction.status, 200);
  const extracted = await extraction.json() as ExtractedValues;
  assert.equal(extracted.date, "");
  assert.equal(extracted.name, "Pixel");
  assert.equal(aiCalls, 1);
  const animal = await request("/animals", "POST", { name: "Pixel", species: "Chat" });
  assert.equal(animal.status, 201);
  const { id } = await animal.json() as Animal;
  assert.equal((await request("/reminders", "POST", { animal: id, name: "Rappel fictif", date: localToday(), notice: "Le jour même" })).status, 201);
  assert.equal((await request("/internal/reminders", "POST", {})).status, 401);
  assert.equal((await request("/internal/reminders", "POST", {}, "Bearer local-fixture-secret")).status, 204);
  assert.equal(readdirSync(outbox).length, 2);
  assert.equal((await request("/internal/reminders", "POST", {}, "Bearer local-fixture-secret")).status, 204);
  assert.equal(readdirSync(outbox).length, 2, "A reminder must not be sent twice");
});
