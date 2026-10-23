import {
  randomBytes,
  randomUUID,
  createHash,
  scrypt as derive,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { join, dirname } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Database, Input } from "../database/types.ts";
import type { AuthUser } from "../../shared/account.ts";
import { openDatabase, databasePath } from "../database/connection.ts";
import { profileRepository } from "./profile.ts";
import { ApiError, text, emailAddress } from "./validation.ts";

const scrypt = promisify(derive);
const SESSION_COOKIE = "anivaya_session";
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export type Authentication = ReturnType<typeof authentication>;
export interface Account {
  id: string;
  email: string;
  password: string;
  workspace: string;
}
export const demoCredentials = {
  email: "test@gmail.com",
  password: "Anivaya2026!",
};
async function hash(password: string, salt = randomBytes(16).toString("hex")) {
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}
function passwordValue(value: unknown) {
  if (typeof value !== "string" || !value.length || value.length > 256)
    throw new ApiError(
      400,
      "Saisissez un mot de passe de 256 caractères maximum.",
      "password",
    );
  return value;
}
/** Comptes, sessions et liens publics ; chaque compte a sa propre base. */
export function authentication(db: Database, directory?: string) {
  db.exec(`CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,password TEXT NOT NULL,workspace TEXT NOT NULL UNIQUE);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,account TEXT NOT NULL REFERENCES accounts(id),expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS public_sheets(token TEXT PRIMARY KEY,account TEXT NOT NULL REFERENCES accounts(id),animal TEXT NOT NULL,UNIQUE(account,animal));`);
  const root = directory || join(dirname(databasePath()), "accounts");
  const connections = new Map<string, Database>();
  const attempts = new Map<string, { count: number; until: number }>();
  const ready = (async () => {
    if (!db.prepare("SELECT id FROM accounts WHERE workspace='legacy'").get()) {
      const password = await hash(demoCredentials.password);
      db.prepare("INSERT OR IGNORE INTO accounts VALUES (?,?,?,?)").run(
        "demo",
        demoCredentials.email,
        password,
        "legacy",
      );
      db.prepare("UPDATE user_profile SET email=? WHERE id=1 AND email=''").run(
        demoCredentials.email,
      );
    }
  })();
  function workspace(account: Account) {
    if (account.workspace === "legacy") return db;
    let own = connections.get(account.id);
    if (!own) {
      own = openDatabase(join(root, account.workspace + ".sqlite"), false);
      connections.set(account.id, own);
    }
    return own;
  }
  function token(req: IncomingMessage) {
    return (
      req.headers.cookie
        ?.split(";")
        .map((x) => x.trim())
        .find((x) => x.startsWith(`${SESSION_COOKIE}=`))
        ?.slice(SESSION_COOKIE.length + 1) || ""
    );
  }
  function assertEmailAvailable(email: string, except = "") {
    if (
      db
        .prepare("SELECT id FROM accounts WHERE email=? AND id<>?")
        .get(email, except)
    )
      throw new ApiError(
        409,
        "Cette adresse e-mail est déjà utilisée.",
        "email",
      );
  }
  function user(account: Account): AuthUser {
    return {
      id: account.id,
      profile: profileRepository(workspace(account)).get(),
    };
  }
  function current(req: IncomingMessage): Account | null {
    return (
      db
        .prepare(
          "SELECT a.* FROM accounts a JOIN sessions s ON s.account=a.id WHERE s.token=? AND s.expires>?",
        )
        .get<Account>(digest(token(req)), Date.now()) || null
    );
  }
  function session(
    req: IncomingMessage,
    res: ServerResponse,
    account: Account,
    remember = false,
  ) {
    const old = token(req);
    if (old) db.prepare("DELETE FROM sessions WHERE token=?").run(digest(old));
    const value = randomBytes(32).toString("hex"),
      age = remember ? 60 * 60 * 24 * 7 : 60 * 60 * 24;
    db.prepare("DELETE FROM sessions WHERE expires<=?").run(Date.now());
    db.prepare("INSERT INTO sessions VALUES (?,?,?)").run(
      digest(value),
      account.id,
      Date.now() + age * 1000,
    );
    res.setHeader(
      "Set-Cookie",
      `${SESSION_COOKIE}=${value}; HttpOnly; SameSite=Strict; Path=/api${remember ? `; Max-Age=${age}` : ""}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
    );
  }
  function rate(req: IncomingMessage) {
    const key = req.socket.remoteAddress || "local",
      now = Date.now();
    for (const [k, v] of attempts) if (v.until <= now) attempts.delete(k);
    const a = attempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
    a.count++;
    attempts.set(key, a);
    if (a.count > 30)
      throw new ApiError(
        429,
        "Trop de tentatives. Réessayez dans quelques minutes.",
      );
  }
  return {
    ready,
    current,
    workspace,
    user,
    async login(req: IncomingMessage, res: ServerResponse, data: Input) {
      await ready;
      rate(req);
      const email = emailAddress(data.email),
        password = passwordValue(data.password);
      const account = db
        .prepare("SELECT * FROM accounts WHERE email=?")
        .get<Account>(email);
      const stored =
        account?.password ||
        db
          .prepare("SELECT password FROM accounts WHERE id='demo'")
          .get<{ password: string }>()!.password;
      const [salt, key] = stored.split(":");
      const candidate = await hash(password, salt);
      if (
        !account ||
        !timingSafeEqual(
          Buffer.from(candidate.split(":")[1], "hex"),
          Buffer.from(key, "hex"),
        )
      )
        throw new ApiError(401, "Adresse e-mail ou mot de passe incorrect.");
      session(req, res, account, data.remember === true);
      return user(account);
    },
    async register(req: IncomingMessage, res: ServerResponse, data: Input) {
      await ready;
      rate(req);
      const email = emailAddress(data.email),
        name = text(data.name, "name", 120),
        password = passwordValue(data.password);
      if (password.length < 12)
        throw new ApiError(400, "Utilisez au moins 12 caractères.", "password");
      if (data.confirmPassword !== password)
        throw new ApiError(
          400,
          "Les mots de passe ne correspondent pas.",
          "confirmPassword",
        );
      assertEmailAvailable(email);
      const encoded = await hash(password),
        id = randomUUID(),
        account = { id, email, password: encoded, workspace: id };
      // Recheck after asynchronous password hashing; the unique index is the final guard.
      assertEmailAvailable(email);
      profileRepository(workspace(account)).save({
        name,
        email,
        phone: "",
        city: "",
        notifications: { reminders: true, reservations: true, shares: true },
      });
      db.prepare("INSERT INTO accounts VALUES (?,?,?,?)").run(
        id,
        email,
        encoded,
        id,
      );
      session(req, res, account);
      return user(account);
    },
    logout(req: IncomingMessage, res: ServerResponse) {
      db.prepare("DELETE FROM sessions WHERE token=?").run(digest(token(req)));
      res.setHeader(
        "Set-Cookie",
        `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0`,
      );
    },
    saveProfile(account: Account, data: Input) {
      const email = emailAddress(data.email);
      assertEmailAvailable(email, account.id);
      // The public demo login stays usable with the advertised credentials.
      if (account.workspace === "legacy" && email !== demoCredentials.email)
        throw new ApiError(
          400,
          "L’adresse du compte de démonstration reste test@gmail.com. Créez votre compte pour utiliser votre adresse.",
          "email",
        );
      const p = profileRepository(workspace(account)).save(data);
      db.prepare("UPDATE accounts SET email=? WHERE id=?").run(
        email,
        account.id,
      );
      return p;
    },
    publicToken(account: Account, animal: string) {
      let row = db
        .prepare("SELECT token FROM public_sheets WHERE account=? AND animal=?")
        .get<{ token: string }>(account.id, animal);
      if (!row) {
        row = { token: randomBytes(24).toString("hex") };
        db.prepare("INSERT INTO public_sheets VALUES (?,?,?)").run(
          row.token,
          account.id,
          animal,
        );
      }
      return row.token;
    },
    revokePublicToken(account: Account, animal: string) {
      db.prepare("DELETE FROM public_sheets WHERE account=? AND animal=?").run(
        account.id,
        animal,
      );
    },
    publicOwner(value: string) {
      const row = db
        .prepare(
          "SELECT a.*,p.animal FROM public_sheets p JOIN accounts a ON a.id=p.account WHERE p.token=?",
        )
        .get<Account & { animal: string }>(value);
      return row ? { db: workspace(row), animal: row.animal } : null;
    },
    close() {
      for (const own of connections.values()) own.close();
      connections.clear();
    },
  };
}
