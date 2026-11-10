import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { validateProductionConfig } from "../api/config.ts";
import { sendMail } from "../api/mail.ts";
import { createApi } from "../api/app.ts";
import { openDatabase } from "../database/connection.ts";
import { vercelConfig } from "../../scripts/vercel-output.ts";

test("preview explicitly disables email while retaining production security requirements", async t => {
  const before = { ...process.env };
  t.after(() => { for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key]; Object.assign(process.env, before); });
  Object.assign(process.env, {
    NODE_ENV: "production", RENDER: "true", ANIVAYA_TESTING_PREVIEW: "1",
    DATABASE_URL: "postgresql://app:fixture@db.invalid/postgres", DATABASE_SSL: "", ANIVAYA_POSTGRES_TEST: "",
    SUPABASE_URL: "https://fixture.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "fixture", SUPABASE_STORAGE_BUCKET: "anivaya-private",
    APP_URL: "https://anivaya-test.vercel.app", PUBLIC_SITE_URL: "https://anivaya-test.vercel.app", ALLOWED_ORIGINS: "https://anivaya-test.vercel.app",
    MFA_ENCRYPTION_KEY: "ab".repeat(32), API_PROXY_SECRET: "cd".repeat(32), CRON_SECRET: "ef".repeat(32),
    MAIL_PROVIDER: "disabled", REMINDERS_MODE: "disabled", LEGAL_CONTENT_JSON: "", LEGAL_CONTENT_PATH: "", OPENROUTER_API_KEY: "",
  });
  assert.doesNotThrow(validateProductionConfig);
  process.env.OPENROUTER_API_KEY = "fixture-ai-key";
  process.env.OPENROUTER_MODEL = "nvidia/nemotron-3.5-super-vl:free";
  assert.doesNotThrow(validateProductionConfig);
  delete process.env.OPENROUTER_MODEL;
  assert.doesNotThrow(validateProductionConfig); // The preview may use the free default.
  process.env.OPENROUTER_API_KEY = "";
  process.env.ANIVAYA_TESTING_PREVIEW = "0"; assert.throws(validateProductionConfig); process.env.ANIVAYA_TESTING_PREVIEW = "1";
  process.env.MAIL_PROVIDER = "resend"; assert.throws(validateProductionConfig, /disabled/); process.env.MAIL_PROVIDER = "disabled";
  process.env.APP_URL = "https://anivaya.com"; assert.throws(validateProductionConfig, /testing hostname/); process.env.APP_URL = process.env.PUBLIC_SITE_URL;
  process.env.DATABASE_SSL = "disable"; assert.throws(validateProductionConfig, /TLS/); process.env.DATABASE_SSL = "";
  process.env.API_PROXY_SECRET = ""; assert.throws(validateProductionConfig, /API_PROXY_SECRET/);
  t.mock.method(globalThis, "fetch", () => { throw new Error("No network mail permitted"); });
  assert.equal(await sendMail({ to: "person@example.net", subject: "Test", text: "Test" }), "skipped");
  assert.equal(vercelConfig("https://anivaya-api.onrender.com", "ab".repeat(32), true).routes[0].headers?.["X-Robots-Tag"], "noindex, nofollow, noarchive");
});

test("preview rejects email-dependent HTTP actions before persisting requests", async t => {
  const old = process.env.ANIVAYA_TESTING_PREVIEW;
  process.env.ANIVAYA_TESTING_PREVIEW = "1";
  const directory = mkdtempSync(join(tmpdir(), "anivaya-preview-"));
  const db = openDatabase(join(directory, "test.sqlite"));
  const server = createApi(db, { authentication: false });
  t.after(async () => {
    await new Promise<void>(resolve => server.close(() => resolve())); db.close();
    rmSync(directory, { recursive: true, force: true });
    if (old === undefined) delete process.env.ANIVAYA_TESTING_PREVIEW; else process.env.ANIVAYA_TESTING_PREVIEW = old;
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  for (const path of ["/api/public/contact", "/api/public/leads", "/api/auth/password-reset", "/api/account/password-reset", "/api/admin/team", "/api/internal/reminders"]) {
    const response = await fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    assert.equal(response.status, 503, path);
    assert.match(await response.text(), /Version de test/);
  }
  const health = await fetch(base + "/api/health"); assert.equal(health.status, 200);
  assert.match(health.headers.get("x-robots-tag")!, /noindex/);
});
