import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The review function has its own disposable account stores. Never use hosted credentials here.
for (const name of Object.keys(process.env)) {
  if (/^(DATABASE_|SUPABASE_|SMTP_|MAIL_|RESEND_|OPENROUTER_|LEGAL_CONTENT_|API_PROXY_SECRET$|CRON_SECRET$|ANIVAYA_|RENDER$)/.test(name))
    delete process.env[name];
}
const reviewRoot = mkdtempSync(join(tmpdir(), "anivaya-review-"));
const origin = "https://" + process.env.VERCEL_URL;
Object.assign(process.env, {
  NODE_ENV: "production",
  APP_URL: origin,
  PUBLIC_SITE_URL: origin,
  ALLOWED_ORIGINS: origin,
  DATABASE_PATH: join(reviewRoot, "central.sqlite"),
  ANIVAYA_LIMITED_LAUNCH: "1",
  ANIVAYA_DEMO_ACCOUNTS: "1",
  MAIL_PROVIDER: "disabled",
  REMINDERS_MODE: "disabled",
  MFA_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
});

const { validateProductionConfig } = await import("./back/api/config.js");
validateProductionConfig();
const { openDatabase } = await import("./back/database/connection.js");
const { createApi } = await import("./back/api/app.js");
const service = createApi(openDatabase(), {
  userDatabaseDirectory: join(reviewRoot, "accounts"),
  demoDatabase: openDatabase(join(reviewRoot, "sample.sqlite"), true, false, "preview-sample-central", "sample"),
  demoUserDatabaseDirectory: join(reviewRoot, "sample"),
  emptyDatabase: openDatabase(join(reviewRoot, "empty.sqlite"), false, true, "preview-empty-central", "empty"),
  emptyUserDatabaseDirectory: join(reviewRoot, "empty"),
});

export default async function handler(request, response) {
  const url = new URL(request.url, origin);
  if (url.pathname === "/review-api") {
    const path = url.searchParams.get("__path");
    if (!path || !/^[a-zA-Z0-9_/-]+$/.test(path)) {
      response.writeHead(404).end();
      return;
    }
    url.pathname = "/api/" + path;
  }
  url.searchParams.delete("__path");
  if (!url.pathname.startsWith("/api/") || url.pathname.startsWith("/api/internal/")) {
    response.writeHead(404).end();
    return;
  }
  // A branch alias can render the same deployment. Check only the alias set by Vercel.
  const branchHost = process.env.VERCEL_BRANCH_URL;
  if (branchHost && request.headers.origin === "https://" + branchHost &&
      request.headers.host === branchHost && branchHost.endsWith(".vercel.app"))
    request.headers.origin = origin;
  request.url = url.pathname + url.search;
  await service.ready;
  await new Promise((resolve, reject) => {
    response.once("finish", resolve);
    response.once("close", resolve);
    response.once("error", reject);
    service.emit("request", request, response);
  });
}
