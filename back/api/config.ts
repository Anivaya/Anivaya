import { readFileSync } from "node:fs";
import { isAbsolute } from "node:path";
import type { LegalContent } from "../../shared/legal.ts";

export function legalContent(): LegalContent | null {
  if (!process.env.LEGAL_CONTENT_PATH && !process.env.LEGAL_CONTENT_JSON) return null;
  const value = JSON.parse(process.env.LEGAL_CONTENT_JSON || readFileSync(process.env.LEGAL_CONTENT_PATH!, "utf8")) as LegalContent;
  if (value.reviewed !== true || !Array.isArray(value.sections) ||
    !["mentions-legales", "confidentialite", "cookies"].every(id => value.sections.some(s => s.id === id)) ||
    value.sections.some(s => !/^[a-z-]+$/.test(s.id) || typeof s.title !== "string" || !s.title.trim() ||
      !Array.isArray(s.paragraphs) || !s.paragraphs.length || s.paragraphs.some(p => typeof p !== "string" || !p.trim())) ||
    value.sections.some(s => /\[[^\]]+\]|TODO|à compléter|example\.(com|org)|votre-domaine/i.test([s.title, ...s.paragraphs].join("\n"))))
    throw new Error("LEGAL_CONTENT_PATH must contain reviewed, complete legal sections without placeholders.");
  return value;
}

/** Fail before binding a port rather than silently running development defaults. */
export function validateProductionConfig() {
  if (process.env.NODE_ENV !== "production") return;
  const missing: string[] = [];
  const cloud = Boolean(process.env.DATABASE_URL);
  const mail = process.env.MAIL_PROVIDER || "smtp";
  if (!["smtp", "resend"].includes(mail)) throw new Error("Unknown MAIL_PROVIDER.");
  for (const name of ["APP_URL", "PUBLIC_SITE_URL", "ALLOWED_ORIGINS", ...(cloud ? ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_STORAGE_BUCKET"] : ["DATABASE_PATH"]), ...(mail === "resend" ? ["RESEND_API_KEY"] : ["SMTP_HOST"]), "MAIL_FROM", "MFA_ENCRYPTION_KEY", ...(process.env.LEGAL_CONTENT_JSON ? [] : ["LEGAL_CONTENT_PATH"])])
    if (!process.env[name]?.trim()) missing.push(name);
  if (missing.length) throw new Error("Missing production configuration: " + missing.join(", "));
  const origin = (name: string) => {
    const value = new URL(process.env[name]!);
    if (value.protocol !== "https:" || value.username || value.password || value.pathname !== "/" || value.search || value.hash || /^(localhost|127\.|0\.0\.0\.0)/.test(value.hostname))
      throw new Error(name + " must be a public HTTPS origin.");
    return value.origin;
  };
  const app = origin("APP_URL");
  if (origin("PUBLIC_SITE_URL") !== app || process.env.ALLOWED_ORIGINS !== app)
    throw new Error("APP_URL, PUBLIC_SITE_URL and ALLOWED_ORIGINS must use the same HTTPS origin.");
  if (!cloud && !isAbsolute(process.env.DATABASE_PATH!)) throw new Error("DATABASE_PATH must be an absolute persistent-volume path.");
  if (cloud) {
    const url = new URL(process.env.DATABASE_URL!);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.password)
      throw new Error("DATABASE_URL must be an authenticated PostgreSQL URL.");
    if (process.env.DATABASE_SSL === "disable" || process.env.ANIVAYA_POSTGRES_TEST === "1" || url.searchParams.has("sslmode") || url.searchParams.has("ssl"))
      throw new Error("Production PostgreSQL must verify TLS; remove SSL overrides from DATABASE_URL.");
    const storage = new URL(process.env.SUPABASE_URL!);
    if (storage.protocol !== "https:" || storage.username || storage.password || storage.pathname !== "/" || storage.search || storage.hash)
      throw new Error("SUPABASE_URL must be an HTTPS origin.");
    if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(process.env.SUPABASE_STORAGE_BUCKET!)) throw new Error("Invalid private storage bucket name.");
  }
  if (!/^[a-f\d]{64}$/i.test(process.env.MFA_ENCRYPTION_KEY!)) throw new Error("MFA_ENCRYPTION_KEY must be 64 hexadecimal characters.");
  if (mail === "smtp" && /exemple|example|localhost/i.test(process.env.SMTP_HOST!)) throw new Error("Configure a real SMTP_HOST.");
  if (process.env.RENDER === "true") {
    if (!cloud || mail !== "resend") throw new Error("Render requires PostgreSQL/private storage and Resend HTTP email; local SQLite and SMTP are unsupported.");
    if (!/^[a-f\d]{64}$/i.test(process.env.API_PROXY_SECRET || '')) throw new Error("API_PROXY_SECRET must be 64 hexadecimal characters shared with Vercel.");
    if (process.env.REMINDERS_MODE !== 'external' || !/^[a-f\d]{64}$/i.test(process.env.CRON_SECRET || '')) throw new Error("Render requires REMINDERS_MODE=external and a separate 64-character CRON_SECRET.");
    if (process.env.CRON_SECRET === process.env.API_PROXY_SECRET) throw new Error("Use different proxy and cron secrets.");
  }
  if (!/[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+/.test(process.env.MAIL_FROM!)) throw new Error("MAIL_FROM must contain a valid sender address.");
  if (process.env.ANIVAYA_EMPTY_STATE === "1") throw new Error("Empty-state mode is forbidden in production.");
  if (process.env.OPENROUTER_API_KEY && (!process.env.OPENROUTER_MODEL || process.env.OPENROUTER_MODEL.endsWith(":free")))
    throw new Error("Select an explicit non-free OPENROUTER_MODEL before enabling production AI imports.");
  legalContent();
}
