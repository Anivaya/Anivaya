import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { testEnvironment } from "./test-environment.ts";

// Private, disposable production-process test. No real credentials, SMTP or AI calls.
const root = mkdtempSync(join(tmpdir(), "anivaya-smoke-"));
const legal = join(root, "legal.json");
writeFileSync(legal, JSON.stringify({ reviewed: true, sections: ["mentions-legales", "confidentialite", "cookies"].map(id => ({ id, title: id, paragraphs: ["Local automated smoke test only. This content must never be published."] })) }));
const env = { ...testEnvironment(), NODE_ENV: "production", HOST: "127.0.0.1", PORT: "0", DATABASE_PATH: join(root, "central.sqlite"), APP_URL: "https://anivaya.com", PUBLIC_SITE_URL: "https://anivaya.com", ALLOWED_ORIGINS: "https://anivaya.com", LEGAL_CONTENT_PATH: legal, SMTP_HOST: "smtp.test.invalid", MAIL_FROM: "test@test.invalid", MFA_ENCRYPTION_KEY: randomBytes(32).toString("hex"), OPENROUTER_API_KEY: "", ANIVAYA_EMPTY_STATE: "0" };
let child: ChildProcess | undefined;
let base = "";
async function start() {
  child = spawn(process.execPath, [fileURLToPath(new URL("../back/api/server.ts", import.meta.url))], { env, stdio: ["ignore", "pipe", "pipe"] });
  const running = child;
  base = await new Promise<string>((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error("Production startup timed out")), 20_000);
    running.once("error", error => { clearTimeout(timer); reject(error); });
    running.once("exit", code => { clearTimeout(timer); reject(new Error("Production startup exited: " + code + " " + output)); });
    running.stderr?.on("data", chunk => { output += chunk.toString(); });
    running.stdout?.on("data", chunk => {
      output += chunk.toString();
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) { clearTimeout(timer); resolve(match[0] + "/api"); }
    });
  });
}
async function stop() {
  if (child && child.exitCode === null && child.signalCode === null) {
    const exited = once(child, "exit"); child.kill("SIGTERM"); await exited;
  }
}
async function request(path: string, method = "GET", body?: unknown, cookie = "") {
  return fetch(base + path, { method, headers: { "Content-Type": "application/json", Cookie: cookie, Origin: "https://anivaya.com" }, body: body === undefined ? undefined : JSON.stringify(body) });
}
try {
  await start();
  assert.equal((await request("/health")).status, 200);
  assert.equal((await request("/public/legal")).status, 200);
  assert.equal((await request("/dashboard")).status, 401);
  assert.equal((await request("/auth/login", "POST", { email: "admin@anivaya.fr", password: "Anivaya2026!" })).status, 401);
  const body = { name: "Smoke", email: "smoke@test.invalid", password: "Smoke-test-2026!", confirmPassword: "Smoke-test-2026!" };
  const registered = await request("/auth/register", "POST", body);
  assert.equal(registered.status, 201, await registered.clone().text());
  assert.match(registered.headers.get("set-cookie")!, /HttpOnly; SameSite=Strict;.*; Secure/);
  const cookie = registered.headers.get("set-cookie")!.split(";")[0];
  assert.equal((await request("/animals", "POST", { name: "Persisted", species: "Chat", contact: "Test", identifier: "", behavior: "", vet: "" }, cookie)).status, 201);
  await stop(); await start();
  const animals = await request("/animals", "GET", undefined, cookie);
  assert.equal(animals.status, 200);
  assert.equal((await animals.json() as { name: string }[])[0].name, "Persisted");
  assert.equal((await request("/auth/logout", "POST", {}, cookie)).status, 204);
  assert.equal((await request("/animals", "GET", undefined, cookie)).status, 401);
  console.log("Production smoke passed: startup, legal endpoint, secure session, no default admin, persistence after restart, logout.");
} finally {
  await stop();
  assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep));
  rmSync(root, { recursive: true, force: true });
}
