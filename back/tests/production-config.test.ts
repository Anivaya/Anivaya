import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { legalContent, validateProductionConfig } from "../api/config.ts";

test("production fails on missing or unsafe configuration and accepts complete legal content", () => {
  const root = mkdtempSync(join(tmpdir(), "anivaya-config-test-"));
  const config = {
    NODE_ENV: "production", APP_URL: "https://anivaya.com", PUBLIC_SITE_URL: "https://anivaya.com",
    ALLOWED_ORIGINS: "https://anivaya.com", DATABASE_PATH: join(root, "central.sqlite"), SMTP_HOST: "smtp.test.invalid",
    MAIL_FROM: "test@test.invalid", MFA_ENCRYPTION_KEY: "ab".repeat(32), LEGAL_CONTENT_PATH: join(root, "legal.json"),
    OPENROUTER_API_KEY: "", ANIVAYA_EMPTY_STATE: "0",
  };
  const saved = Object.fromEntries(Object.keys(config).map(key => [key, process.env[key]]));
  try {
    Object.assign(process.env, config);
    const content = { reviewed: true, sections: ["mentions-legales", "confidentialite", "cookies"].map(id => ({ id, title: id, paragraphs: ["Contenu de test local uniquement."] })) };
    writeFileSync(config.LEGAL_CONTENT_PATH, JSON.stringify(content));
    assert.deepEqual(legalContent(), content);
    assert.doesNotThrow(validateProductionConfig);
    process.env.MFA_ENCRYPTION_KEY = "";
    assert.throws(validateProductionConfig, /Missing production configuration/);
    process.env.MFA_ENCRYPTION_KEY = config.MFA_ENCRYPTION_KEY;
    process.env.APP_URL = "http://anivaya.com";
    assert.throws(validateProductionConfig, /HTTPS/);
    process.env.APP_URL = config.APP_URL;
    content.reviewed = false;
    writeFileSync(config.LEGAL_CONTENT_PATH, JSON.stringify(content));
    assert.throws(validateProductionConfig, /reviewed/);
    content.reviewed = true; content.sections[0].paragraphs = ["[Raison sociale]"];
    writeFileSync(config.LEGAL_CONTENT_PATH, JSON.stringify(content));
    assert.throws(validateProductionConfig, /placeholders/);
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep));
    rmSync(root, { recursive: true, force: true });
  }
});
