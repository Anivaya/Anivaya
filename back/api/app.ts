import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Database, Input } from "../database/types.ts";
import type { Account, Authentication } from "./auth.ts";
import { authentication, demoCredentials } from "./auth.ts";
import { directoryRepository } from "./directory.ts";
import { profileRepository } from "./profile.ts";
import { createRepository } from "./repository.ts";
import { ApiError } from "./validation.ts";

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

// Routes accessibles sans session.
const open = router<RequestContext>();
open.get("/api/health", () => ({ status: "ok" }));
open.get("/api/auth/demo", () => demoCredentials);
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
open.get("/api/auth/session", ({ auth, request }) => {
  const sessions = requireAuth(auth);
  const account = sessions.current(request);
  return account ? sessions.user(account) : null;
});
open.get(/^\/api\/public\/emergency\/(.+)$/, ({ auth, params }) => {
  const [, token, photo] = params[0].match(/^([a-f0-9]{48})(\/photo)?$/) ?? [];
  const owner = token ? auth?.publicOwner(token) : null;
  if (!owner) throw new ApiError(404, "Fiche indisponible.");
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

api.get("/api/directory", ({ directory }) => directory.all());
api.put(
  "/api/professionals/:id/favorite",
  async ({ directory, params, body }) => {
    directory.favorite(params[0], (await body()).favorite);
  },
);
api.get("/api/professionals/:id/slots", ({ directory, params, query }) =>
  directory.slots(
    params[0],
    query.get("date") || "",
    query.get("ignore") || undefined,
  ),
);
api.post(
  "/api/bookings",
  async ({ directory, body }) => directory.create(await body()),
  201,
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
  async ({ repository, body }) => repository.sharing.createShares(await body()),
  201,
);
api.delete("/api/shares/:id", ({ repository, params }) => {
  repository.sharing.revoke(params[0]);
});

api.get("/api/dashboard", async ({ repository }) => {
  await repository.emergency.upgradePublicLinks();
  return repository.dashboard();
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
  options: { authentication?: boolean; userDatabaseDirectory?: string } = {},
) {
  const auth =
    options.authentication === false
      ? null
      : authentication(db, options.userDatabaseDirectory);

  /** Données de l’espace : la base vient de la session, jamais du client. */
  function workspace(request: IncomingMessage, account: Account | null) {
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
    };
  }

  const server = createServer(async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    try {
      checkOrigin(request);
      await auth?.ready;
      const url = new URL(request.url || "/", "http://localhost");
      const context = {
        request,
        response,
        auth,
        query: url.searchParams,
        body: () => readJson(request),
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
          ...workspace(request, account),
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
  server.on("close", () => auth?.close());
  return server;
}
