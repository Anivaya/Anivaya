import {
  randomBytes,
  createHmac,
  createHash,
  createCipheriv,
  createDecipheriv,
  timingSafeEqual,
} from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import QRCode from "qrcode";
import type { Database } from "../database/types.ts";
import { ApiError } from "./validation.ts";
import { transaction } from "../database/connection.ts";

/** RFC 6238, SHA-1, pas de 30 s. Export pour les vecteurs de conformité. */
export function totp(secret: Buffer, time = Date.now(), digits = 6) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(time / 30000)));
  const hmac = createHmac("sha1", secret).update(counter).digest(),
    offset = hmac[hmac.length - 1] & 15;
  return String(
    (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits,
  ).padStart(digits, "0");
}
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
function base32(bytes: Buffer) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let buffer = 0,
    bits = 0,
    result = "";
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result += alphabet[(buffer >>> bits) & 31];
    }
  }
  if (bits) result += alphabet[(buffer << (5 - bits)) & 31];
  return result;
}
interface MfaRow {
  secret: string;
  enabled: number;
  expires: number;
  last_step: number;
  recovery: string;
}
export function mfaService(db: Database, keyPath: string) {
  let key: Buffer | undefined;
  function encryptionKey() {
    if (key) return key;
    const configured = process.env.MFA_ENCRYPTION_KEY;
    if (configured) {
      if (!/^[a-fA-F0-9]{64}$/.test(configured))
        throw new ApiError(
          503,
          "La clé MFA doit contenir 64 caractères hexadécimaux.",
        );
      key = Buffer.from(configured, "hex");
    } else {
      if (process.env.NODE_ENV === "production")
        throw new ApiError(
          503,
          "Configurez MFA_ENCRYPTION_KEY avant d’utiliser la double authentification.",
        );
      mkdirSync(dirname(keyPath), { recursive: true });
      if (!existsSync(keyPath))
        writeFileSync(keyPath, randomBytes(32), { flag: "wx", mode: 0o600 });
      key = readFileSync(keyPath);
    }
    if (key.length !== 32)
      throw new ApiError(503, "Clé de chiffrement MFA indisponible.");
    return key;
  }
  function encrypt(secret: Buffer) {
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv),
      encrypted = Buffer.concat([cipher.update(secret), cipher.final()]);
    return [iv, cipher.getAuthTag(), encrypted]
      .map((b) => b.toString("hex"))
      .join(":");
  }
  function decrypt(encoded: string) {
    const [iv, tag, value] = encoded
      .split(":")
      .map((s) => Buffer.from(s, "hex"));
    const cipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    cipher.setAuthTag(tag);
    return Buffer.concat([cipher.update(value), cipher.final()]);
  }
  const row = (id: string) =>
    db.prepare("SELECT * FROM account_mfa WHERE account=?").get<MfaRow>(id);
  function verify(id: string, value: unknown, pending = false) {
    const config = row(id),
      code = typeof value === "string" ? value.trim().replaceAll(" ", "") : "";
    if (
      !config ||
      (!config.enabled && !pending) ||
      (pending && config.expires < Date.now())
    )
      throw new ApiError(
        400,
        "La configuration a expiré. Recommencez l’activation.",
        "mfaCode",
      );
    const step = Math.floor(Date.now() / 30000),
      secret = decrypt(config.secret);
    if (/^\d{6}$/.test(code))
      for (const n of [step, step - 1, step + 1]) {
        if (
          n > config.last_step &&
          timingSafeEqual(
            Buffer.from(totp(secret, n * 30000)),
            Buffer.from(code),
          )
        ) {
          if (
            db
              .prepare(
                "UPDATE account_mfa SET last_step=? WHERE account=? AND last_step<?",
              )
              .run(n, id, n).changes
          )
            return;
        }
      }
    if (!pending) {
      const codes = JSON.parse(config.recovery) as string[],
        hashed = digest(code.toUpperCase()),
        index = codes.indexOf(hashed);
      if (index !== -1) {
        codes.splice(index, 1);
        db.prepare("UPDATE account_mfa SET recovery=? WHERE account=?").run(
          JSON.stringify(codes),
          id,
        );
        return;
      }
    }
    throw new ApiError(
      401,
      "Code invalide ou déjà utilisé. Utilisez un nouveau code ou un code de secours.",
      "mfaCode",
    );
  }
  function recovery(id: string) {
    const codes = Array.from({ length: 8 }, () =>
      randomBytes(8).toString("hex").toUpperCase(),
    );
    db.prepare("UPDATE account_mfa SET recovery=? WHERE account=?").run(
      JSON.stringify(codes.map(digest)),
      id,
    );
    return codes;
  }
  return {
    status(id: string) {
      const config = row(id);
      return {
        enabled: !!config?.enabled,
        recoveryRemaining: config?.enabled
          ? (JSON.parse(config.recovery) as string[]).length
          : 0,
      };
    },
    verify,
    async setup(id: string, email: string) {
      if (row(id)?.enabled)
        throw new ApiError(409, "La double authentification est déjà active.");
      const secret = randomBytes(20),
        encoded = base32(secret);
      db.prepare(
        "INSERT INTO account_mfa(account,secret,expires) VALUES (?,?,?) ON CONFLICT(account) DO UPDATE SET secret=excluded.secret,expires=excluded.expires,last_step=-1",
      ).run(id, encrypt(secret), Date.now() + 10 * 60 * 1000);
      const uri = `otpauth://totp/${encodeURIComponent("Anivaya:" + email)}?secret=${encoded}&issuer=Anivaya&algorithm=SHA1&digits=6&period=30`;
      return {
        secret: encoded,
        qr: await QRCode.toDataURL(uri, { width: 240, margin: 2 }),
        expiresIn: 600,
      };
    },
    change(id: string, action: string, code: unknown) {
      return transaction(db, () => {
        if (action === "enable") {
          if (row(id)?.enabled)
            throw new ApiError(
              409,
              "La double authentification est déjà active.",
            );
          verify(id, code, true);
          db.prepare("UPDATE account_mfa SET enabled=1 WHERE account=?").run(
            id,
          );
          return { codes: recovery(id) };
        }
        if (!["disable", "renew"].includes(action))
          throw new ApiError(400, "Action inconnue.");
        verify(id, code);
        if (action === "disable") {
          db.prepare("DELETE FROM account_mfa WHERE account=?").run(id);
          return { codes: [] };
        }
        return { codes: recovery(id) };
      });
    },
  };
}
