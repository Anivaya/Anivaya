import {
  randomBytes,
  randomUUID,
  createHash,
  scrypt as derive,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { join, dirname } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Database, Input } from "../database/types.ts";
import type { AuthUser } from "../../shared/account.ts";
import { openDatabase, databasePath } from "../database/connection.ts";
import { profileRepository } from "./profile.ts";
import type { SocialNotice } from "./social.ts";
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
export const DEMO_PASSWORD = "Anivaya2026!";
/** Comptes de démonstration : chacun a son propre espace d’exemple, recréé s’il est supprimé. */
export const demoAccounts = [
  { id: "demo", name: "test", email: "test@gmail.com" },
  { id: "demo-2", name: "test2", email: "test2@gmail.com" },
  { id: "demo-3", name: "test3", email: "test3@gmail.com" },
] as const;
export const demoCredentials = {
  email: demoAccounts[0].email,
  password: DEMO_PASSWORD,
};
const isDemo = (account: Pick<Account, "id">) =>
  demoAccounts.some((demo) => demo.id === account.id);
const defaultNotifications = {
  reminders: true,
  reservations: true,
  shares: true,
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
  const workspacePath = (name: string) => join(root, name + ".sqlite");
  function workspace(account: Account) {
    let own = connections.get(account.id);
    if (!own) {
      own = openDatabase(workspacePath(account.workspace), isDemo(account));
      connections.set(account.id, own);
    }
    return own;
  }
  /** Ferme et efface la base d’un espace. */
  function dropWorkspace(account: Account) {
    connections.get(account.id)?.close();
    connections.delete(account.id);
    for (const suffix of ["", "-wal", "-shm"])
      rmSync(workspacePath(account.workspace) + suffix, { force: true });
  }
  /** Crée l’espace d’exemple d’un compte de démonstration avec son identité. */
  function prepareDemoWorkspace(account: Account) {
    const demo = demoAccounts.find((d) => d.id === account.id)!;
    const profile = profileRepository(workspace(account));
    profile.save({
      // Le premier compte garde le foyer d’exemple (Camille Martin).
      name: demo.id === "demo" ? profile.get().name : demo.name,
      email: demo.email,
      phone: "",
      city: "",
      notifications: defaultNotifications,
    });
  }
  /**
   * L’ancien compte de démonstration utilisait la base centrale : son espace est copié
   * une fois dans sa propre base, sans les tables de comptes et de sessions.
   */
  function moveLegacyWorkspace(account: Account) {
    const target = workspacePath(account.id);
    mkdirSync(root, { recursive: true });
    rmSync(target, { force: true });
    db.exec(`VACUUM INTO '${target.replaceAll("'", "''")}'`);
    const copy = new DatabaseSync(target);
    copy.exec(
      "DROP TABLE IF EXISTS sessions; DROP TABLE IF EXISTS public_sheets; DROP TABLE IF EXISTS accounts;",
    );
    copy.close();
    db.prepare("UPDATE accounts SET workspace=? WHERE id=?").run(
      account.id,
      account.id,
    );
  }
  const ready = (async () => {
    for (const demo of demoAccounts) {
      const existing = db
        .prepare("SELECT * FROM accounts WHERE id=? OR email=?")
        .get<Account>(demo.id, demo.email);
      if (existing?.workspace === "legacy") moveLegacyWorkspace(existing);
      // Une adresse de démonstration déjà prise par un compte personnel le reste.
      if (existing) continue;
      const account = {
        id: demo.id,
        email: demo.email,
        password: await hash(DEMO_PASSWORD),
        workspace: demo.id,
      };
      dropWorkspace(account);
      prepareDemoWorkspace(account);
      db.prepare("INSERT INTO accounts VALUES (?,?,?,?)").run(
        account.id,
        account.email,
        account.password,
        account.workspace,
      );
    }
  })();
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
      demo: isDemo(account),
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
  function clearCookie(res: ServerResponse) {
    res.setHeader(
      "Set-Cookie",
      `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0`,
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
        notifications: defaultNotifications,
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
      clearCookie(res);
    },
    /**
     * Supprime le compte et ses données, puis ferme toutes ses sessions.
     * Un compte de démonstration retrouve un espace d’exemple neuf.
     */
    deleteAccount(res: ServerResponse, account: Account, data: Input) {
      if (data.confirmation !== "SUPPRIMER")
        throw new ApiError(
          400,
          "Saisissez SUPPRIMER pour confirmer.",
          "confirmation",
        );
      dropWorkspace(account);
      db.prepare("DELETE FROM public_sheets WHERE account=?").run(account.id);
      db.prepare("DELETE FROM sessions WHERE account=?").run(account.id);
      if (isDemo(account)) prepareDemoWorkspace(account);
      else db.prepare("DELETE FROM accounts WHERE id=?").run(account.id);
      clearCookie(res);
    },
    saveProfile(account: Account, data: Input) {
      const email = emailAddress(data.email);
      assertEmailAvailable(email, account.id);
      // Les comptes de démonstration gardent les identifiants affichés à la connexion.
      if (isDemo(account) && email !== account.email)
        throw new ApiError(
          400,
          `L’adresse du compte de démonstration reste ${account.email}. Créez votre compte pour utiliser votre adresse.`,
          "email",
        );
      const p = profileRepository(workspace(account)).save(data);
      db.prepare("UPDATE accounts SET email=? WHERE id=?").run(
        email,
        account.id,
      );
      return p;
    },
    /** Dépose ou met à jour une notification « Communautés » dans l’espace d’un compte. */
    notify(person: string, notice: SocialNotice) {
      const account = db
        .prepare("SELECT * FROM accounts WHERE id=?")
        .get<Account>(person);
      if (!account) return;
      workspace(account)
        .prepare(
          "INSERT INTO notifications(id,category,title,text,href,action,created_at,read) VALUES (?,'social',?,?,?,?,?,0) ON CONFLICT(id) DO UPDATE SET title=excluded.title,text=excluded.text,href=excluded.href,action=excluded.action,created_at=excluded.created_at,read=0",
        )
        .run(
          notice.id,
          notice.title,
          notice.text,
          notice.href,
          notice.action,
          notice.date,
        );
    },
    markNotificationRead(person: string, notification: string) {
      const account = db
        .prepare("SELECT * FROM accounts WHERE id=?")
        .get<Account>(person);
      if (account)
        workspace(account)
          .prepare("UPDATE notifications SET read=1 WHERE id=?")
          .run(notification);
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
