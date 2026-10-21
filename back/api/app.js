import { createServer } from "node:http";
import { ApiError } from "./validation.js";
import { createRepository } from "./repository.js";

async function readJson(request) {
  let size = 0;
  const chunks = [];
  if (!request.headers["content-type"]?.startsWith("application/json"))
    throw new ApiError(415, "Envoyez des données JSON.");
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 14 * 1024 * 1024)
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
export function createApi(db) {
  const repository = createRepository(db);
  return createServer(async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    const json = (status, data) => {
      response.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
      });
      response.end(JSON.stringify(data));
    };
    try {
      // Local demonstration only. No cross-origin sharing and no browser access from a remote website.
      const origin = request.headers.origin;
      if (
        origin &&
        ![
          "http://127.0.0.1:5173",
          "http://localhost:5173",
          "http://127.0.0.1:3001",
          "http://localhost:3001",
        ].includes(origin)
      )
        throw new ApiError(403, "Origine non autorisée.");
      const path = new URL(request.url, "http://localhost").pathname;
      const method = request.method;
      if (method === "GET" && path === "/api/health")
        return json(200, { status: "ok" });
      if (method === "GET" && path === "/api/dashboard")
        return json(200, repository.dashboard());
      if (method === "POST" && path === "/api/animals")
        return json(201, repository.addAnimal(await readJson(request)));
      if (method === "POST" && path === "/api/reminders")
        return json(201, repository.addReminder(await readJson(request)));
      if (method === "POST" && path === "/api/documents")
        return json(201, repository.addDocument(await readJson(request)));
      const reminder = path.match(/^\/api\/reminders\/([^/]+)$/);
      if (reminder && method === "PATCH")
        return json(
          200,
          repository.setReminder(reminder[1], await readJson(request)),
        );
      const document = path.match(/^\/api\/documents\/([^/]+)$/);
      if (document && method === "PATCH")
        return json(
          200,
          repository.editDocument(document[1], await readJson(request)),
        );
      if (document && method === "DELETE") {
        repository.deleteDocument(document[1]);
        response.writeHead(204);
        return response.end();
      }
      const file = path.match(/^\/api\/documents\/([^/]+)\/file$/);
      if (file && method === "GET") {
        const row = repository.file(file[1]);
        response.writeHead(200, {
          "Content-Type": row.type,
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(row.name)}`,
        });
        return response.end(Buffer.from(row.content));
      }
      throw new ApiError(404, "Cette route est introuvable.");
    } catch (error) {
      if (!(error instanceof ApiError)) console.error("Erreur API :", error);
      if (!response.headersSent)
        json(error.status || 500, {
          error: error.status
            ? error.message
            : "Le serveur ne peut pas traiter cette demande.",
          field: error.field,
        });
      else response.end();
    }
  });
}
