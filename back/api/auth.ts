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
import { passwordProblem } from "../../shared/account.ts";
import type { AdminRole } from "../../shared/admin.ts";
import {
  openDatabase,
  databasePath,
  centralMigration,
} from "../database/connection.ts";
import { profileRepository } from "./profile.ts";
import { postalCode } from "./validation.ts";
import { mfaService } from "./mfa.ts";
import type { SocialNotice } from "./social.ts";
import { ApiError, clientAddress, text, emailAddress } from "./validation.ts";
import { appUrl, excludeFromMail, sendMail } from "./mail.ts";
import { emptyStateMode } from "../database/empty-state.ts";
import { dropPostgresWorkspace } from "../database/postgres.ts";

const scrypt = promisify(derive);
/** Durée de validité d’un lien de réinitialisation du mot de passe. */
const RESET_MS = 60 * 60 * 1000;
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export type Authentication = ReturnType<typeof authentication>;
export interface Account {
  id: string;
  email: string;
  password: string;
  workspace: string;
  /** Date d’inscription ; les comptes antérieurs au suivi portent la date de sa mise en place. */
  created_at?: string;
}
export const DEMO_PASSWORD = "Anivaya2026!";
/** Comptes de démonstration : chacun a son propre espace d’exemple, recréé s’il est supprimé. */
export const demoAccounts = [
  { id: "demo", name: "test", email: "test@gmail.com" },
  { id: "demo-2", name: "test2", email: "test2@gmail.com" },
  { id: "demo-3", name: "test3", email: "test3@gmail.com" },
  { id: "demo-admin", name: "admin", email: "admin@anivaya.fr" },
] as const;
export const emptyAccounts = [
  { id: "empty-test", name: "Test vide", email: "test.vide@anivaya.test" },
  { id: "empty-admin", name: "Admin vide", email: "admin.vide@anivaya.test" },
] as const;
/** Le compte de démonstration qui ouvre l’administration. */
const DEMO_ADMIN = { id: "demo-admin", role: "Administrateur" } as const;
export const demoCredentials = {
  email: demoAccounts[0].email,
  password: DEMO_PASSWORD,
};
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
export function authentication(
  db: Database,
  directory?: string,
  empty = emptyStateMode(),
  cookieName?: string,
) {
  emptyStateMode(empty);
  const production = process.env.NODE_ENV === "production";
  const initialAccounts = production ? [] : empty ? emptyAccounts : demoAccounts;
  const adminAccount = empty ? "empty-admin" : DEMO_ADMIN.id;
  const SESSION_COOKIE =
    cookieName || (empty ? "anivaya_empty_session" : "anivaya_session");
  const isDemo = (account: Pick<Account, "id">) =>
    [...demoAccounts, ...emptyAccounts].some((demo) => demo.id === account.id);
  const isDevelopmentAccount = (account: Pick<Account, "id">) => isDemo(account) || /^sample-\d+$/.test(account.id);
  db.exec(`CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,password TEXT NOT NULL,workspace TEXT NOT NULL UNIQUE);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,account TEXT NOT NULL REFERENCES accounts(id),expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS public_sheets(token TEXT PRIMARY KEY,account TEXT NOT NULL REFERENCES accounts(id),animal TEXT NOT NULL,UNIQUE(account,animal));
 CREATE TABLE IF NOT EXISTS password_resets(token TEXT PRIMARY KEY,account TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,expires INTEGER NOT NULL);`);
  // Les adresses des comptes de démonstration ne nous appartiennent pas : aucun e-mail.
  excludeFromMail(initialAccounts.map((demo) => demo.email));
  // Équipe, suspensions, dossiers d’administration et MFA : après la table des comptes.
  db.exec(centralMigration("008_admin.sql"));
  db.exec(centralMigration("009_admin_extensions.sql"));
  if (
    !db
      .prepare("PRAGMA table_info(account_controls)")
      .all<{ name: string }>()
      .some((c) => c.name === "public_visibility")
  )
    db.exec(
      "ALTER TABLE account_controls ADD COLUMN public_visibility TEXT NOT NULL DEFAULT 'Visible'",
    );
  if (
    !db
      .prepare("PRAGMA table_info(account_controls)")
      .all<{ name: string }>()
      .some((c) => c.name === "account_type")
  )
    db.exec(
      "ALTER TABLE account_controls ADD COLUMN account_type TEXT NOT NULL DEFAULT 'Particulier'",
    );
  // Date d’inscription, pour les cohortes du pilotage ; les comptes antérieurs datent de la mise en place.
  if (
    !db
      .prepare("PRAGMA table_info(accounts)")
      .all<{ name: string }>()
      .some((c) => c.name === "created_at")
  ) {
    db.exec(
      "ALTER TABLE accounts ADD COLUMN created_at TEXT NOT NULL DEFAULT ''",
    );
    db.prepare("UPDATE accounts SET created_at=? WHERE created_at=''").run(
      new Date().toISOString(),
    );
  }
  const root = directory || join(dirname(databasePath()), "accounts");
  const mfa = mfaService(db, join(root, "mfa.key"));
  /** Branchements de l’administration : alertes de sécurité et invitations acceptées. */
  const hooks: {
    security?: (kind: string, detail: string, account?: string) => void;
  } = {};
  const failures = new Map<string, { count: number; until: number }>();
  function failed(email: string, account: Account | undefined) {
    const now = Date.now();
    for (const [k, v] of failures) if (v.until <= now) failures.delete(k);
    const f = failures.get(email) || { count: 0, until: now + 15 * 60 * 1000 };
    f.count++;
    failures.set(email, f);
    if (f.count === 5)
      hooks.security?.(
        "Tentatives de connexion répétées",
        `${f.count} échecs de connexion en 15 minutes pour ${email}.`,
        account?.id,
      );
  }
  const connections = new Map<string, Database>();
  const attempts = new Map<string, { count: number; until: number }>();
  const workspacePath = (name: string) => join(root, name + ".sqlite");
  function workspace(account: Account) {
    let own = connections.get(account.id);
    if (!own) {
      own = openDatabase(
        workspacePath(account.workspace),
        isDemo(account),
        empty,
        account.workspace,
      );
      connections.set(account.id, own);
    }
    return own;
  }
  /** Ferme et efface la base d’un espace. */
  function dropWorkspace(account: Account) {
    connections.get(account.id)?.close();
    connections.delete(account.id);
    if (process.env.DATABASE_URL) return dropPostgresWorkspace(account.workspace);
    for (const suffix of ["", "-wal", "-shm"])
      rmSync(workspacePath(account.workspace) + suffix, { force: true });
  }
  /** Crée l’espace d’exemple d’un compte de démonstration avec son identité. */
  function prepareDemoWorkspace(account: Account) {
    const demo = initialAccounts.find((d) => d.id === account.id)!;
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
  let dummyPassword = "";
  const ready = (async () => {
    dummyPassword = await hash(randomBytes(32).toString("hex"));
    // A copied development database must not preserve privileged demo sessions.
    if (production) {
      for (const account of db.prepare("SELECT id FROM accounts").all<{ id: string }>()) {
        if (!isDevelopmentAccount(account)) continue;
        db.prepare("DELETE FROM sessions WHERE account=?").run(account.id);
        db.prepare("DELETE FROM admin_members WHERE account=?").run(account.id);
        db.prepare("DELETE FROM public_sheets WHERE account=?").run(account.id);
      }
    }
    for (const demo of initialAccounts) {
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
      db.prepare(
        "INSERT INTO accounts(id,email,password,workspace,created_at) VALUES (?,?,?,?,?)",
      ).run(
        account.id,
        account.email,
        account.password,
        account.workspace,
        new Date().toISOString(),
      );
    }
    if (!production && db.prepare("SELECT id FROM accounts WHERE id=?").get(adminAccount))
      db.prepare(
        "INSERT OR IGNORE INTO admin_members(account,role) VALUES (?,?)",
      ).run(adminAccount, DEMO_ADMIN.role);
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
  /** Rôle d’équipe actif du compte, s’il en a un. */
  function adminRole(account: Pick<Account, "id">) {
    return db
      .prepare(
        "SELECT role FROM admin_members WHERE account=? AND status='Actif'",
      )
      .get<{ role: AdminRole }>(account.id)?.role;
  }
  /** Visibilité des fiches publiques d’un compte, décidée par la modération. */
  function publicVisibility(id: string) {
    return (
      db
        .prepare(
          "SELECT public_visibility AS visibility FROM account_controls WHERE account=?",
        )
        .get<{ visibility: string }>(id)?.visibility || "Visible"
    );
  }
  function suspended(account: Pick<Account, "id">) {
    if (production && isDevelopmentAccount(account)) return true;
    return (
      db
        .prepare("SELECT status FROM account_controls WHERE account=?")
        .get<{ status: string }>(account.id)?.status === "Suspendu"
    );
  }
  function user(account: Account): AuthUser {
    const role = adminRole(account);
    return {
      id: account.id,
      ...(role ? { adminRole: role } : {}),
      demo: isDemo(account),
      profile: profileRepository(workspace(account)).get(),
    };
  }
  function current(req: IncomingMessage): Account | null {
    const account = db
      .prepare(
        "SELECT a.* FROM accounts a JOIN sessions s ON s.account=a.id WHERE s.token=? AND s.expires>?",
      )
      .get<Account>(digest(token(req)), Date.now());
    return account && !suspended(account) ? account : null;
  }
  async function verifyPassword(account: Account, value: unknown) {
    const [salt, key] = account.password.split(":");
    const candidate = await hash(passwordValue(value), salt);
    return timingSafeEqual(
      Buffer.from(candidate.split(":")[1], "hex"),
      Buffer.from(key, "hex"),
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
  /** Crée un lien de réinitialisation (une heure, usage unique) et l’envoie au titulaire. */
  async function sendPasswordReset(account: Account) {
    const now = Date.now();
    db.prepare("DELETE FROM password_resets WHERE expires<?").run(now);
    // Une demande par minute et par compte suffit.
    const recent = db
      .prepare(
        "SELECT token FROM password_resets WHERE account=? AND expires>?",
      )
      .get(account.id, now + RESET_MS - 60_000);
    if (recent) return;
    const token = randomBytes(32).toString("base64url");
    db.prepare("DELETE FROM password_resets WHERE account=?").run(account.id);
    db.prepare("INSERT INTO password_resets VALUES (?,?,?)").run(
      digest(token),
      account.id,
      now + RESET_MS,
    );
    await sendMail({
      to: account.email,
      subject: "Réinitialiser votre mot de passe Anivaya",
      text: [
        "Bonjour,",
        "Une réinitialisation du mot de passe de votre compte Anivaya a été demandée. Ce lien est valable une heure et ne fonctionne qu’une seule fois.",
        "Si vous n’êtes pas à l’origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.",
      ].join("\n\n"),
      action: {
        label: "Choisir un nouveau mot de passe",
        url: `${appUrl()}/#mot-de-passe/${token}`,
      },
    });
  }
  function rate(req: IncomingMessage) {
    const key = clientAddress(req),
      now = Date.now();
    for (const [k, v] of attempts) if (v.until <= now) attempts.delete(k);
    const a = attempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
    a.count++;
    attempts.set(key, a);
    if (a.count > 30) {
      if (a.count === 31)
        hooks.security?.(
          "Limite de tentatives atteinte",
          `Plus de 30 tentatives de connexion ou d’inscription en 15 minutes depuis ${key}.`,
        );
      throw new ApiError(
        429,
        "Trop de tentatives. Réessayez dans quelques minutes.",
      );
    }
  }
  /** Efface le compte, son espace, ses liens publics et ses sessions. */
  function purge(account: Account) {
    if (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='shared_bookings'").get()) {
      db.prepare("DELETE FROM shared_bookings WHERE account=?").run(account.id);
      db.prepare("DELETE FROM booking_migrations WHERE account=?").run(account.id);
    }
    dropWorkspace(account);
    db.prepare("DELETE FROM public_sheets WHERE account=?").run(account.id);
    db.prepare("DELETE FROM sessions WHERE account=?").run(account.id);
    if (isDemo(account)) prepareDemoWorkspace(account);
    else db.prepare("DELETE FROM accounts WHERE id=?").run(account.id);
  }
  return {
    ready,
    current,
    workspace,
    user,
    mfa,
    verifyPassword,
    refreshSession(req: IncomingMessage, res: ServerResponse, account: Account) {
      db.prepare("DELETE FROM sessions WHERE account=?").run(account.id);
      session(req, res, account);
    },
    /** Ferme les autres sessions du compte, par exemple après un changement de MFA. */
    revokeOtherSessions(req: IncomingMessage, account: Account) {
      db.prepare("DELETE FROM sessions WHERE account=? AND token<>?").run(
        account.id,
        digest(token(req)),
      );
    },
    async login(req: IncomingMessage, res: ServerResponse, data: Input) {
      await ready;
      rate(req);
      const email = emailAddress(data.email),
        password = passwordValue(data.password);
      const account = db
        .prepare("SELECT * FROM accounts WHERE email=?")
        .get<Account>(email);
      // Le temps de réponse ne révèle pas si l’adresse existe.
      const stored =
        account || { password: dummyPassword } as Account;
      if (!(await verifyPassword(stored, password)) || !account) {
        failed(email, account);
        throw new ApiError(401, "Adresse e-mail ou mot de passe incorrect.");
      }
      if (suspended(account))
        throw new ApiError(
          403,
          "Ce compte est suspendu. Contactez l’équipe Anivaya.",
        );
      if (mfa.status(account.id).enabled) {
        if (!data.mfaCode)
          throw new ApiError(
            401,
            "Saisissez le code de votre application d’authentification ou un code de secours.",
            "mfaCode",
          );
        mfa.verify(account.id, data.mfaCode);
      }
      failures.delete(email);
      session(req, res, account, data.remember === true);
      return user(account);
    },
    /**
     * Mot de passe oublié : si l’adresse correspond à un compte, un lien valable une heure
     * et utilisable une fois lui est envoyé. La réponse est la même dans tous les cas.
     */
    async requestPasswordReset(req: IncomingMessage, data: Input) {
      await ready;
      rate(req);
      const email = emailAddress(data.email);
      const account = db
        .prepare("SELECT * FROM accounts WHERE email=?")
        .get<Account>(email);
      if (!account || isDemo(account)) return;
      await sendPasswordReset(account);
    },
    /** Lien de réinitialisation envoyé à l’adresse du compte (aussi depuis l’administration). */
    sendPasswordReset,
    /** Le lien de réinitialisation est-il encore utilisable ? */
    passwordResetStatus(token: string) {
      const row = db
        .prepare("SELECT expires FROM password_resets WHERE token=?")
        .get<{ expires: number }>(digest(token));
      return { valid: !!row && row.expires > Date.now() };
    },
    /** Nouveau mot de passe depuis le lien reçu : les sessions ouvertes sont fermées. */
    async resetPassword(req: IncomingMessage, data: Input) {
      await ready;
      rate(req);
      const raw = typeof data.token === "string" ? data.token : "";
      const row = db
        .prepare("SELECT account,expires FROM password_resets WHERE token=?")
        .get<{ account: string; expires: number }>(digest(raw));
      if (!row || row.expires <= Date.now())
        throw new ApiError(
          400,
          "Ce lien a expiré ou a déjà servi. Demandez un nouveau lien.",
          "token",
        );
      const password = passwordValue(data.password);
      const problem = passwordProblem(password);
      if (problem) throw new ApiError(400, problem, "password");
      if (data.confirmPassword !== password)
        throw new ApiError(
          400,
          "Les mots de passe ne correspondent pas.",
          "confirmPassword",
        );
      const encoded = await hash(password);
      db.prepare("UPDATE accounts SET password=? WHERE id=?").run(
        encoded,
        row.account,
      );
      db.prepare("DELETE FROM password_resets WHERE account=?").run(
        row.account,
      );
      db.prepare("DELETE FROM sessions WHERE account=?").run(row.account);
    },
    async register(req: IncomingMessage, res: ServerResponse, data: Input) {
      await ready;
      rate(req);
      const email = emailAddress(data.email),
        name = text(data.name, "name", 120),
        code = postalCode(data.postalCode),
        password = passwordValue(data.password);
      const problem = passwordProblem(password);
      if (problem) throw new ApiError(400, problem, "password");
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
        postalCode: code,
        phone: "",
        city: "",
        notifications: defaultNotifications,
      });
      db.prepare(
        "INSERT INTO accounts(id,email,password,workspace,created_at) VALUES (?,?,?,?,?)",
      ).run(id, email, encoded, id, new Date().toISOString());
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
      if (
        db
          .prepare("SELECT account FROM admin_members WHERE account=?")
          .get(account.id)
      )
        throw new ApiError(
          409,
          "Ce compte fait partie de l’équipe Anivaya. Demandez à un administrateur de retirer votre accès avant de le supprimer.",
        );
      purge(account);
      clearCookie(res);
    },
    /** Suppression décidée par l’administration à la demande du titulaire. */
    deleteAccountById(id: string) {
      const account = db
        .prepare("SELECT * FROM accounts WHERE id=?")
        .get<Account>(id);
      if (!account) throw new ApiError(404, "Compte introuvable.");
      if (
        db
          .prepare("SELECT account FROM admin_members WHERE account=?")
          .get(account.id)
      )
        throw new ApiError(
          409,
          "Retirez d’abord ce compte de l’équipe avant de le supprimer.",
        );
      purge(account);
      return account;
    },
    publicVisibility,
    isDemo,
    /** Tous les comptes, pour les indicateurs de l’installation. */
    accounts() {
      return db.prepare("SELECT * FROM accounts").all<Account>().filter(a => !production || !isDevelopmentAccount(a));
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
    /** Dépose ou met à jour une notification (Communautés par défaut) dans l’espace d’un compte. */
    notify(person: string, notice: SocialNotice, category = "social") {
      const account = db
        .prepare("SELECT * FROM accounts WHERE id=?")
        .get<Account>(person);
      if (!account) return;
      workspace(account)
        .prepare(
          "INSERT INTO notifications(id,category,title,text,href,action,created_at,read) VALUES (?,?,?,?,?,?,?,0) ON CONFLICT(id) DO UPDATE SET title=excluded.title,text=excluded.text,href=excluded.href,action=excluded.action,created_at=excluded.created_at,read=0",
        )
        .run(
          notice.id,
          category,
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
      return row && !suspended(row)
        ? {
            db: workspace(row),
            animal: row.animal,
            account: row.id,
            hidden: publicVisibility(row.id) === "Masqué",
          }
        : null;
    },
    hooks,
    close() {
      for (const own of connections.values()) own.close();
      connections.clear();
    },
  };
}
