import type { IncomingMessage } from "node:http";
import type { Database, Input } from "../database/types.ts";
import { createServer } from "node:http";
import { ApiError } from "./validation.ts";
import { createRepository } from "./repository.ts";

async function readJson(request: IncomingMessage): Promise<Input> {
  let size = 0;
  const chunks: Buffer[] = [];
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
export function createApi(db: Database) {
  const repository = createRepository(db);
  return createServer(async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    const json = (status: number, data: unknown) => {
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
      const path = new URL(request.url || "/", "http://localhost").pathname;
      const method = request.method;
      if (path === "/api/sharing" && method === "GET")
        return json(200, {
          people: repository.sharing.allPeople(),
          shares: repository.sharing.allShares(),
        });
      if (path === "/api/people" && method === "POST")
        return json(
          201,
          repository.sharing.savePerson(null, await readJson(request)),
        );
      const personRoute = path.match(/^\/api\/people\/([^/]+)$/);
      if (personRoute && method === "PATCH")
        return json(
          200,
          repository.sharing.savePerson(
            personRoute[1],
            await readJson(request),
          ),
        );
      if (personRoute && method === "DELETE") {
        repository.sharing.deletePerson(personRoute[1]);
        response.writeHead(204);
        return response.end();
      }
      if (path === "/api/associations" && method === "POST")
        return json(200, repository.sharing.associate(await readJson(request)));
      if (path === "/api/shares" && method === "POST")
        return json(
          201,
          repository.sharing.createShares(await readJson(request)),
        );
      const shareRoute = path.match(/^\/api\/shares\/([^/]+)$/);
      if (shareRoute && method === "DELETE") {
        repository.sharing.revoke(shareRoute[1]);
        response.writeHead(204);
        return response.end();
      }
      if (method === "GET" && path === "/api/health")
        return json(200, { status: "ok" });
      if (method === "GET" && path === "/api/dashboard")
        return json(200, repository.dashboard());
      if (method === "GET" && path === "/api/animals")
        return json(200, repository.allAnimals());
      const petRoute = path.match(/^\/api\/animals\/([^/]+)$/);
      const previewRoute = path.match(
        /^\/api\/animals\/([^/]+)\/emergency\/preview$/,
      );
      if (previewRoute && method === "POST")
        return json(
          200,
          await repository.emergency.preview(
            previewRoute[1],
            await readJson(request),
          ),
        );
      const sheetRoute = path.match(/^\/api\/animals\/([^/]+)\/emergency$/);
      if (sheetRoute) {
        if (!repository.allAnimals().some((a) => a.id === sheetRoute[1]))
          throw new ApiError(404, "Animal introuvable.");
        if (method === "GET")
          return json(200, repository.emergency.get(sheetRoute[1]));
        if (method === "PUT")
          return json(
            200,
            await repository.emergency.save(
              sheetRoute[1],
              await readJson(request),
            ),
          );
        if (method === "DELETE") {
          repository.emergency.remove(sheetRoute[1]);
          response.writeHead(204);
          return response.end();
        }
      }
      if (petRoute && method === "GET") {
        const data = repository.dashboard(),
          pet = data.animals.find((a) => a.id === petRoute[1]);
        if (!pet) throw new ApiError(404, "Cet animal est introuvable.");
        return json(200, {
          pet,
          events: data.events.filter((e) => e.animal === pet.id),
          reminders: data.reminders.filter((r) => r.animal === pet.id),
          documents: data.documents.filter((d) => d.animal === pet.id),
          people: data.people.filter((p) => p.animals.includes(pet.id)),
          shares: data.shares.filter((s) =>
            data.documents.some((d) => d.id === s.doc && d.animal === pet.id),
          ),
        });
      }
      if (petRoute && method === "PATCH")
        return json(
          200,
          repository.editAnimal(petRoute[1], await readJson(request)),
        );
      if (petRoute && method === "DELETE") {
        repository.deleteAnimal(petRoute[1]);
        response.writeHead(204);
        return response.end();
      }
      const photoRoute = path.match(/^\/api\/animals\/([^/]+)\/photo$/);
      if (photoRoute && method === "GET") {
        const photo = repository.animalPhoto(photoRoute[1]);
        response.writeHead(200, { "Content-Type": photo.type });
        return response.end(Buffer.from(photo.photo));
      }
      if (path === "/api/events" && method === "POST")
        return json(201, repository.saveEvent(null, await readJson(request)));
      const eventRoute = path.match(/^\/api\/events\/([^/]+)$/);
      if (eventRoute && method === "PATCH")
        return json(
          200,
          repository.saveEvent(eventRoute[1], await readJson(request)),
        );
      if (eventRoute && method === "DELETE") {
        repository.deleteEvent(eventRoute[1]);
        response.writeHead(204);
        return response.end();
      }
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
      if (reminder && method === "DELETE") {
        repository.deleteReminder(reminder[1]);
        response.writeHead(204);
        return response.end();
      }
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
          "Content-Disposition": `${new URL(request.url || "/", "http://localhost").searchParams.get("preview") === "1" ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(row.name)}`,
        });
        return response.end(Buffer.from(row.content));
      }
      throw new ApiError(404, "Cette route est introuvable.");
    } catch (error) {
      if (!(error instanceof ApiError)) console.error("Erreur API :", error);
      if (!response.headersSent)
        json(error instanceof ApiError ? error.status : 500, {
          error:
            error instanceof ApiError
              ? error.message
              : "Le serveur ne peut pas traiter cette demande.",
          field: error instanceof ApiError ? error.field : undefined,
        });
      else response.end();
    }
  });
}
