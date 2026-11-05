import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Database, Input } from "../database/types.ts";
import type { Account, Authentication } from "./auth.ts";
import { authentication, emptyAccounts } from "./auth.ts";
import { emptyStateMode } from "../database/empty-state.ts";
import { adminService } from "./admin.ts";
import type { AdminService } from "./admin.ts";
import { analytics } from "./admin-analytics.ts";
import { exportAccount } from "./export.ts";
import { socialService } from "./social.ts";
import type { SocialService } from "./social.ts";
import { directoryRepository } from "./directory.ts";
import { profileRepository } from "./profile.ts";
import { createRepository } from "./repository.ts";
import { sharedAccess } from "./shared-access.ts";
import { startReminderMail } from "./reminder-mail.ts";
import { extractDocument } from "./ai-import.ts";
import type { SharedAccess } from "./shared-access.ts";
import { ApiError, text } from "./validation.ts";

const MAX_BODY_BYTES = 14 * 1024 * 1024;
const LOCAL_ORIGINS = [
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "http://127.0.0.1:3001",
  "http://localhost:3001",
];

/** Contexte commun à toutes les routes. */
interface RequestContext {
  request: IncomingMessage;
  response: ServerResponse;
  auth: Authentication | null;
  /** Administration : dossiers de la base centrale ; absente sans authentification. */
  admin: AdminService | null;
  params: string[];
  query: URLSearchParams;
  body: () => Promise<Input>;
}
/** Contexte des routes privées : les données de l’espace connecté. */
interface WorkspaceContext extends RequestContext {
  account: Account | null;
  repository: ReturnType<typeof createRepository>;
  profile: ReturnType<typeof profileRepository>;
  directory: ReturnType<typeof directoryRepository>;
  /** Communautés partagées entre comptes ; absentes sans authentification. */
  social: SocialService | null;
  /** Documents partagés entre comptes ; absents sans authentification. */
  access: SharedAccess | null;
}
type Handler<C> = (context: C) => unknown;
interface Route<C> {
  method: string;
  pattern: RegExp;
  status: number;
  handle: Handler<C>;
}

/** Réponse binaire (photo, document) au lieu de JSON. */
class FileReply {
  type: string;
  content: Uint8Array;
  headers: Record<string, string>;
  constructor(
    file: { type: string; content: Uint8Array },
    headers: Record<string, string> = {},
  ) {
    this.type = file.type;
    this.content = file.content;
    this.headers = headers;
  }
}

/** Table de routes ; `:nom` capture un segment, transmis dans `params`. */
function router<C>() {
  const routes: Route<C>[] = [];
  const add =
    (method: string) =>
    (path: string | RegExp, handle: Handler<C>, status = 200) => {
      const pattern =
        typeof path === "string"
          ? new RegExp(`^${path.replace(/:\w+/g, "([^/]+)")}$`)
          : path;
      routes.push({ method, pattern, status, handle });
    };
  return {
    get: add("GET"),
    post: add("POST"),
    put: add("PUT"),
    patch: add("PATCH"),
    delete: add("DELETE"),
    match(method: string | undefined, path: string) {
      for (const route of routes) {
        const found = route.method === method && path.match(route.pattern);
        if (found) return { route, params: found.slice(1) };
      }
      return null;
    },
  };
}

function requireAuth(auth: Authentication | null) {
  if (!auth) throw new ApiError(404, "Cette route est introuvable.");
  return auth;
}
function requireAdmin(admin: AdminService | null) {
  if (!admin) throw new ApiError(404, "Cette route est introuvable.");
  return admin;
}

// Routes accessibles sans session.
const open = router<RequestContext>();
open.get("/api/health", () => ({ status: "ok" }));
open.post("/api/auth/login", async ({ auth, request, response, body }) =>
  requireAuth(auth).login(request, response, await body()),
);
open.post(
  "/api/auth/register",
  async ({ auth, request, response, body }) =>
    requireAuth(auth).register(request, response, await body()),
  201,
);
open.post("/api/auth/logout", ({ auth, request, response }) => {
  requireAuth(auth).logout(request, response);
});
// Mot de passe oublié : envoi du lien, vérification du lien, nouveau mot de passe.
open.post("/api/auth/password-reset", async ({ auth, request, body }) => {
  await requireAuth(auth).requestPasswordReset(request, await body());
});
open.get("/api/auth/password-reset/:token", ({ auth, params }) =>
  requireAuth(auth).passwordResetStatus(decodeURIComponent(params[0])),
);
open.post(
  "/api/auth/password-reset/confirm",
  async ({ auth, request, body }) => {
    await requireAuth(auth).resetPassword(request, await body());
  },
);
open.get("/api/auth/session", ({ auth, request }) => {
  const sessions = requireAuth(auth);
  const account = sessions.current(request);
  return account ? sessions.user(account) : null;
});
// Guides validés et annonces publiées ; les annonces aux particuliers demandent une session.
open.get("/api/public/resources", ({ admin, auth, request }) =>
  requireAdmin(admin).publications(auth?.current(request)),
);
open.post(
  "/api/public/contact",
  async ({ admin, auth, request, body }) =>
    requireAdmin(admin).contact(await body(), auth?.current(request)),
  201,
);
// Signalement d’une fiche publique depuis son lien ; la session, si elle existe, identifie l’auteur.
open.post(
  "/api/public/emergency/:token/report",
  async ({ admin, auth, request, params, body }) =>
    requireAdmin(admin).reportPublicSheet(
      params[0],
      await body(),
      auth?.current(request),
    ),
  201,
);
open.get(/^\/api\/public\/emergency\/(.+)$/, ({ auth, params }) => {
  const [, token, photo] = params[0].match(/^([a-f0-9]{48})(\/photo)?$/) ?? [];
  const owner = token ? auth?.publicOwner(token) : null;
  if (!owner) throw new ApiError(404, "Fiche indisponible.");
  if (owner.hidden)
    throw new ApiError(
      451,
      "Cette fiche a été masquée par l’équipe Anivaya après un signalement.",
    );
  const record = createRepository(owner.db),
    sheet = record.emergency.get(owner.animal);
  if (!record.allAnimals().some((a) => a.id === owner.animal) || !sheet)
    throw new ApiError(404, "Fiche indisponible.");
  const { settings, snapshot } = sheet;
  if (!settings.active)
    throw new ApiError(410, "Cette fiche a été désactivée.");
  if (photo) {
    if (!settings.photo) throw new ApiError(404, "Photo indisponible.");
    return new FileReply(record.animalPhoto(owner.animal));
  }
  return {
    name: snapshot.name,
    species: snapshot.species,
    details: settings.details ? snapshot.details : "",
    notes: settings.notes ? snapshot.notes : "",
    contact: settings.contact ? snapshot.contact : "",
    vet: settings.vet ? snapshot.vet : "",
    style: settings.photo ? snapshot.style : null,
    photo:
      settings.photo && snapshot.photo
        ? `/api/public/emergency/${token}/photo`
        : null,
  };
});

// Routes de l’espace connecté.
const api = router<WorkspaceContext>();

api.get("/api/profile", ({ profile }) => profile.get());
api.patch("/api/profile", async ({ auth, account, profile, body }) =>
  auth && account
    ? auth.saveProfile(account, await body())
    : profile.save(await body()),
);
api.get("/api/profile/photo", ({ profile }) => new FileReply(profile.photo()));

api.delete(
  "/api/account",
  async ({ auth, account, social, response, body }) => {
    const data = await body();
    requireAuth(auth).deleteAccount(response, account!, data);
    social?.removePerson(account!.id);
  },
);
// Depuis la gestion de profil : lien de changement de mot de passe envoyé à sa propre adresse.
api.post("/api/account/password-reset", async ({ auth, account, request }) => {
  const sessions = requireAuth(auth);
  if (sessions.isDemo(account!))
    throw new ApiError(
      409,
      "Le mot de passe d’un compte de démonstration ne peut pas être modifié.",
    );
  await sessions.requestPasswordReset(request, { email: account!.email });
});
api.get("/api/account/mfa", ({ auth, account }) =>
  requireAuth(auth).mfa.status(account!.id),
);
api.post(
  "/api/account/mfa",
  async ({ auth, admin, account, request, body }) => {
    const sessions = requireAuth(auth),
      data = await body();
    if (!(await sessions.verifyPassword(account!, data.password)))
      throw new ApiError(400, "Mot de passe incorrect.", "password");
    const action = text(data.action, "action", 20);
    if (action === "setup")
      return sessions.mfa.setup(account!.id, account!.email);
    const result = sessions.mfa.change(account!.id, action, data.mfaCode);
    // Un changement de seconde vérification ferme les autres sessions du compte.
    sessions.revokeOtherSessions(request, account!);
    if (action === "disable")
      admin?.securityEvent(
        "Double authentification désactivée",
        `La seconde vérification a été retirée pour ${account!.email}.`,
        account!.id,
      );
    return result;
  },
);
api.post(
  "/api/account/deletion-request",
  async ({ admin, account, body }) =>
    requireAdmin(admin).requestDeletion(account!, await body()),
  201,
);
// Import assisté : lecture du document par l’API Claude ; rien n’est enregistré à ce stade.
api.post("/api/imports/extract", async ({ body }) =>
  extractDocument(await body()),
);
api.post(
  "/api/imports",
  async ({ admin, account, body }) =>
    requireAdmin(admin).registerImport(account!, await body()),
  201,
);
api.get("/api/export", (context) =>
  exportAccount(
    {
      ...context,
      socialExport: () =>
        context.social && context.account
          ? socialUser(context).social.exportFor(context.account.id)
          : null,
    },
    context.query.get("categories"),
  ),
);

/** Compte connecté dans les communautés, avec sa fiche (nom, ville, animaux) à jour. */
function socialUser({
  social,
  account,
  profile,
  repository,
}: WorkspaceContext) {
  if (!social || !account)
    throw new ApiError(404, "Cette route est introuvable.");
  const { name, city } = profile.get();
  social.ensurePerson(account.id, {
    name,
    city,
    animal: repository
      .allAnimals()
      .map((a) => a.name)
      .join(" et "),
  });
  return { social, me: account.id };
}
const bodyOf = (context: WorkspaceContext) => context.body();

// Communautés, événements et messagerie.
api.get("/api/social", (context) => {
  const { social, me } = socialUser(context);
  return social.view(me);
});
api.post(
  "/api/social/communities",
  async (context) => {
    const { social, me } = socialUser(context);
    return social.saveCommunity(me, null, await bodyOf(context));
  },
  201,
);
api.patch("/api/social/communities/:id", async (context) => {
  const { social, me } = socialUser(context);
  return social.saveCommunity(me, context.params[0], await bodyOf(context));
});
api.delete("/api/social/communities/:id", (context) => {
  const { social, me } = socialUser(context);
  social.deleteCommunity(me, context.params[0]);
});
api.post("/api/social/communities/:id/join", (context) => {
  const { social, me } = socialUser(context);
  social.joinCommunity(me, context.params[0], true);
});
api.post("/api/social/communities/:id/leave", (context) => {
  const { social, me } = socialUser(context);
  social.joinCommunity(me, context.params[0], false);
});
api.post(
  "/api/social/events",
  async (context) => {
    const { social, me } = socialUser(context);
    return social.saveEvent(me, null, await bodyOf(context));
  },
  201,
);
api.patch("/api/social/events/:id", async (context) => {
  const { social, me } = socialUser(context);
  return social.saveEvent(me, context.params[0], await bodyOf(context));
});
api.post("/api/social/events/:id/cancel", (context) => {
  const { social, me } = socialUser(context);
  social.cancelEvent(me, context.params[0]);
});
api.post("/api/social/events/:id/participation", async (context) => {
  const { social, me } = socialUser(context);
  social.attendEvent(me, context.params[0], (await bodyOf(context)).join);
});
api.post(
  "/api/social/threads",
  async (context) => {
    const { social, me } = socialUser(context);
    return social.createThread(me, await bodyOf(context));
  },
  201,
);
api.post("/api/social/threads/:id/members", async (context) => {
  const { social, me } = socialUser(context);
  social.invite(me, context.params[0], (await bodyOf(context)).people);
});
api.post("/api/social/threads/:id/leave", (context) => {
  const { social, me } = socialUser(context);
  social.leaveThread(me, context.params[0]);
});
api.post("/api/social/threads/:id/messages", async (context) => {
  const { social, me } = socialUser(context);
  social.sendMessage(me, context.params[0], await bodyOf(context));
});
api.delete("/api/social/threads/:id/messages/:message", (context) => {
  const { social, me } = socialUser(context);
  social.deleteMessage(me, context.params[0], context.params[1]);
});
api.patch("/api/social/threads/:id", async (context) => {
  const { social, me } = socialUser(context);
  social.updateThread(me, context.params[0], await bodyOf(context));
});
api.get("/api/social/threads/:id/photo", (context) => {
  const { social, me } = socialUser(context);
  return new FileReply(social.threadPhoto(me, context.params[0]));
});
api.post("/api/social/threads/:id/read", (context) => {
  const { social, me } = socialUser(context);
  social.markRead(me, context.params[0]);
});
api.get("/api/social/photos/:id", (context) => {
  const { social, me } = socialUser(context);
  return new FileReply(social.photo(me, context.params[0]));
});
api.put("/api/social/friends/:person", async (context) => {
  const { social, me } = socialUser(context);
  social.friend(
    me,
    decodeURIComponent(context.params[0]),
    (await bodyOf(context)).action,
  );
});
api.put("/api/social/blocks/:person", async (context) => {
  const { social, me } = socialUser(context);
  social.block(
    me,
    decodeURIComponent(context.params[0]),
    (await bodyOf(context)).blocked,
  );
});
api.post("/api/social/reports", async (context) => {
  const { social, me } = socialUser(context);
  social.report(me, await bodyOf(context));
});

// L’annuaire reflète les décisions de l’administration : fiches suspendues ou refusées retirées.
api.get("/api/directory", ({ directory, admin }) => {
  const all = directory.all();
  return admin ? { ...all, professionals: admin.directory() } : all;
});
api.put(
  "/api/professionals/:id/favorite",
  async ({ directory, admin, params, body }) => {
    admin?.requireAvailableProfessional(params[0]);
    directory.favorite(params[0], (await body()).favorite);
  },
);
api.get(
  "/api/professionals/:id/slots",
  ({ directory, admin, params, query }) => {
    admin?.requireAvailableProfessional(params[0]);
    return directory.slots(
      params[0],
      query.get("date") || "",
      query.get("ignore") || undefined,
    );
  },
);
api.post(
  "/api/bookings",
  async ({ directory, admin, body }) => {
    const data = await body();
    admin?.requireAvailableProfessional(data.professional);
    return directory.create(data);
  },
  201,
);

// Signalements, recours, retours et suivi privé du compte connecté.
api.post(
  "/api/reports",
  async ({ admin, account, body }) =>
    requireAdmin(admin).submitReport(account!, await body()),
  201,
);
api.post(
  "/api/appeals",
  async ({ admin, account, body }) =>
    requireAdmin(admin).appeal(account!, await body()),
  201,
);
api.post(
  "/api/feedback",
  async ({ admin, account, body }) =>
    requireAdmin(admin).feedback(account!, await body()),
  201,
);
api.get("/api/support", ({ admin, account }) =>
  requireAdmin(admin).mine(account!),
);

// Administration : l’autorisation vient du rôle enregistré en base, jamais du client.
api.get("/api/admin/overview", ({ admin, account }) =>
  requireAdmin(admin).overview(account!),
);
api.get("/api/admin/analytics", ({ admin, account, query }) => {
  if (requireAdmin(admin).authorize(account!) !== "Administrateur")
    throw new ApiError(403, "Le pilotage est réservé à l’administrateur.");
  // Les foyers réels ne sont lus que pour la source « installation ».
  return analytics(query, () => requireAdmin(admin).households());
});
api.get(
  "/api/admin/pros/:id/documents/:document/file",
  ({ admin, account, params }) => {
    const file = requireAdmin(admin).proofFile(
      account!,
      decodeURIComponent(params[0]),
      decodeURIComponent(params[1]),
    );
    return new FileReply(file, {
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    });
  },
);
api.get("/api/admin/:resource", ({ admin, account, params, query }) => {
  const service = requireAdmin(admin);
  return service.list(account!, service.resource(params[0]), query);
});
api.post(
  "/api/admin/:resource",
  async ({ admin, account, params, body }) => {
    const service = requireAdmin(admin);
    return service.create(account!, service.resource(params[0]), await body());
  },
  201,
);
api.get("/api/admin/:resource/:id", ({ admin, account, params }) => {
  const service = requireAdmin(admin);
  return service.detail(
    account!,
    service.resource(params[0]),
    decodeURIComponent(params[1]),
  );
});
api.post(
  "/api/admin/:resource/:id/actions",
  async ({ admin, account, params, body }) => {
    const service = requireAdmin(admin);
    return service.act(
      account!,
      service.resource(params[0]),
      decodeURIComponent(params[1]),
      await body(),
    );
  },
);
api.patch("/api/bookings/:id", async ({ directory, params, body }) =>
  directory.update(params[0], await body()),
);

api.get("/api/sharing", ({ repository: { sharing } }) => ({
  people: sharing.allPeople(),
  shares: sharing.allShares(),
}));
api.post(
  "/api/people",
  async ({ repository, body }) =>
    repository.sharing.savePerson(null, await body()),
  201,
);
api.patch("/api/people/:id", async ({ repository, params, body }) =>
  repository.sharing.savePerson(params[0], await body()),
);
api.delete("/api/people/:id", ({ repository, params }) => {
  repository.sharing.deletePerson(params[0]);
});
api.post("/api/associations", async ({ repository, body }) =>
  repository.sharing.associate(await body()),
);
api.post(
  "/api/shares",
  async ({ repository, access, account, body }) => {
    const { shares, ...result } = repository.sharing.createShares(await body());
    if (access && account) access.publish(account, shares);
    return result;
  },
  201,
);
api.delete("/api/shares/:id", ({ repository, params }) => {
  repository.sharing.revoke(params[0]);
});

api.patch(
  "/api/received-shares/:id",
  async ({ repository, access, account, params, body }) => {
    const status = (await body()).status;
    return access && account && access.has(account, params[0])
      ? access.respond(account, params[0], status)
      : repository.receivedShares.respond(params[0], status);
  },
);
// Document reçu d’un autre compte, lu chez son propriétaire tant que l’accès est actif.
api.get("/api/received-shares/:id/file", ({ access, account, params }) => {
  if (!access || !account)
    throw new ApiError(404, "Cette route est introuvable.");
  const file = access.file(account, params[0]);
  return new FileReply(file, {
    "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
  });
});
api.patch("/api/notifications/:id", async ({ repository, params, body }) =>
  repository.notifications.setRead(params[0], (await body()).read),
);
api.post("/api/notifications/read-all", ({ repository }) =>
  repository.notifications.readAll(),
);

api.get("/api/dashboard", async (context) => {
  const { repository } = context;
  // Les notifications des communautés d’exemple arrivent dès la première visite.
  if (context.social) socialUser(context);
  await repository.emergency.upgradePublicLinks();
  const dashboard = repository.dashboard();
  // Invitations venues d’autres comptes, puis les exemples propres à l’espace.
  if (context.access && context.account)
    dashboard.receivedShares = [
      ...context.access.forRecipient(context.account),
      ...dashboard.receivedShares,
    ];
  return dashboard;
});
api.get("/api/animals", ({ repository }) => repository.allAnimals());
api.post(
  "/api/animals",
  async ({ repository, body }) => repository.createAnimal(await body()),
  201,
);
api.get("/api/animals/:id", ({ repository, params }) =>
  repository.animalRecord(params[0]),
);
api.patch("/api/animals/:id", async ({ repository, params, body }) =>
  repository.editAnimal(params[0], await body()),
);
api.delete("/api/animals/:id", ({ repository, params }) => {
  repository.deleteAnimal(params[0]);
});
api.get(
  "/api/animals/:id/photo",
  ({ repository, params }) => new FileReply(repository.animalPhoto(params[0])),
);

const existingAnimal = ({ repository, params }: WorkspaceContext) => {
  if (!repository.allAnimals().some((a) => a.id === params[0]))
    throw new ApiError(404, "Animal introuvable.");
  return params[0];
};
api.post(
  "/api/animals/:id/emergency/preview",
  async ({ repository, params, body }) =>
    repository.emergency.preview(params[0], await body()),
);
api.get("/api/animals/:id/emergency", (context) =>
  context.repository.emergency.get(existingAnimal(context)),
);
api.put("/api/animals/:id/emergency", async (context) =>
  context.repository.emergency.save(
    existingAnimal(context),
    await context.body(),
  ),
);
api.delete("/api/animals/:id/emergency", (context) => {
  const animal = existingAnimal(context);
  context.repository.emergency.remove(animal);
  if (context.auth && context.account)
    context.auth.revokePublicToken(context.account, animal);
});

api.post(
  "/api/events",
  async ({ repository, body }) => repository.saveEvent(null, await body()),
  201,
);
api.patch("/api/events/:id", async ({ repository, params, body }) =>
  repository.saveEvent(params[0], await body()),
);
api.delete("/api/events/:id", ({ repository, params }) => {
  repository.deleteEvent(params[0]);
});

api.post(
  "/api/reminders",
  async ({ repository, body }) => repository.addReminder(await body()),
  201,
);
api.patch("/api/reminders/:id", async ({ repository, params, body }) =>
  repository.setReminder(params[0], await body()),
);
api.delete("/api/reminders/:id", ({ repository, params }) => {
  repository.deleteReminder(params[0]);
});

api.post(
  "/api/documents",
  async ({ repository, body }) => repository.addDocument(await body()),
  201,
);
api.patch("/api/documents/:id", async ({ repository, params, body }) =>
  repository.editDocument(params[0], await body()),
);
api.delete("/api/documents/:id", ({ repository, params }) => {
  repository.deleteDocument(params[0]);
});
api.get("/api/documents/:id/file", ({ repository, params, query }) => {
  const file = repository.file(params[0]);
  const disposition = query.get("preview") === "1" ? "inline" : "attachment";
  return new FileReply(file, {
    "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
  });
});

async function readJson(request: IncomingMessage): Promise<Input> {
  if (!request.headers["content-type"]?.startsWith("application/json"))
    throw new ApiError(415, "Envoyez des données JSON.");
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES)
      throw new ApiError(413, "La requête dépasse la taille autorisée.");
    chunks.push(chunk);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString());
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new Error();
    return body;
  } catch {
    throw new ApiError(400, "Le JSON envoyé est invalide.");
  }
}

/** Les requêtes du navigateur doivent venir du frontend configuré. */
function checkOrigin(request: IncomingMessage) {
  const origin = request.headers.origin;
  const allowed = [
    ...LOCAL_ORIGINS,
    ...(process.env.ALLOWED_ORIGINS?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) ?? []),
  ];
  if (
    (origin && !allowed.includes(origin)) ||
    request.headers["sec-fetch-site"] === "cross-site"
  )
    throw new ApiError(403, "Origine non autorisée.");
}

function send(response: ServerResponse, status: number, result: unknown) {
  if (result === undefined) {
    response.writeHead(204);
    response.end();
  } else if (result instanceof FileReply) {
    response.writeHead(200, { "Content-Type": result.type, ...result.headers });
    response.end(Buffer.from(result.content));
  } else {
    response.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
    });
    response.end(JSON.stringify(result));
  }
}

export function createApi(
  db: Database,
  options: {
    authentication?: boolean;
    userDatabaseDirectory?: string;
    /** Envoi horaire des rappels arrivés à échéance (serveur réel, pas les tests). */
    reminders?: boolean;
    /** Base isolée des comptes vides, accessible par la connexion habituelle. */
    emptyDatabase?: Database;
    emptyUserDatabaseDirectory?: string;
  } = {},
) {
  function services(database: Database, directory?: string, empty = emptyStateMode()) {
    const auth = options.authentication === false
      ? null
      : authentication(
          database, directory, empty,
          options.emptyDatabase ? "anivaya_session" : undefined,
        );
    const social = auth && socialService(database, {
      notify: auth.notify,
      markRead: auth.markNotificationRead,
    }, empty);
    const admin = auth && adminService(database, auth, empty);
    const access = auth && sharedAccess(database, auth);
    if (auth && admin) {
      auth.hooks.security = admin.securityEvent;
      auth.hooks.login = admin.acceptInvitation;
    }
    const stopReminders = auth && options.reminders ? startReminderMail(auth) : undefined;
    return {
      db: database, auth, social, admin, access,
      close() {
        stopReminders?.();
        auth?.close();
      },
    };
  }
  const normal = services(db, options.userDatabaseDirectory);
  const empty = options.emptyDatabase
    ? services(options.emptyDatabase, options.emptyUserDatabaseDirectory, true)
    : null;

  /** Données de l’espace : la base vient de la session, jamais du client. */
  function workspace(request: IncomingMessage, account: Account | null, selected: typeof normal) {
    const { auth, db, social, access } = selected;
    const own = auth && account ? auth.workspace(account) : db;
    const publicURL =
      auth && account
        ? (animal: string) =>
            (process.env.PUBLIC_SITE_URL ||
              request.headers.origin ||
              "http://127.0.0.1:5173") +
            "/#urgence/" +
            auth.publicToken(account, animal)
        : undefined;
    return {
      account,
      repository: createRepository(own, publicURL),
      profile: profileRepository(own),
      directory: directoryRepository(own),
      social,
      access,
    };
  }

  const server = createServer(async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    try {
      checkOrigin(request);
      await Promise.all([normal.auth?.ready, empty?.auth?.ready]);
      const url = new URL(request.url || "/", "http://localhost");
      let parsedBody: Promise<Input> | undefined;
      const body = () => parsedBody ??= readJson(request);
      let selected = empty?.auth?.current(request) ? empty : normal;
      if (empty && request.method === "POST" && url.pathname === "/api/auth/login") {
        const data = await body();
        const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
        selected = emptyAccounts.some((account) => account.email === email) ? empty : normal;
      }
      // Les liens publics restent accessibles même après déconnexion.
      const publicToken = url.pathname.match(/^\/api\/public\/emergency\/([a-f0-9]{48})(?:\/|$)/)?.[1];
      if (publicToken) selected = empty?.auth?.publicOwner(publicToken) ? empty : normal;
      const { auth, admin } = selected;
      const context = {
        request,
        response,
        auth,
        admin,
        query: url.searchParams,
        body,
      };
      const publicRoute = open.match(request.method, url.pathname);
      if (publicRoute)
        return send(
          response,
          publicRoute.route.status,
          await publicRoute.route.handle({
            ...context,
            params: publicRoute.params,
          }),
        );
      const account = auth?.current(request) ?? null;
      if (auth && !account)
        throw new ApiError(401, "Connectez-vous pour accéder à votre espace.");
      const privateRoute = api.match(request.method, url.pathname);
      if (!privateRoute)
        throw new ApiError(404, "Cette route est introuvable.");
      send(
        response,
        privateRoute.route.status,
        await privateRoute.route.handle({
          ...context,
          ...workspace(request, account, selected),
          params: privateRoute.params,
        }),
      );
    } catch (error) {
      if (!(error instanceof ApiError)) console.error("Erreur API :", error);
      if (response.headersSent) return response.end();
      const known = error instanceof ApiError;
      send(response, known ? error.status : 500, {
        error: known
          ? error.message
          : "Le serveur ne peut pas traiter cette demande.",
        field: known ? error.field : undefined,
      });
    }
  });
  server.on("close", () => {
    normal.close();
    empty?.close();
  });
  return server;
}
