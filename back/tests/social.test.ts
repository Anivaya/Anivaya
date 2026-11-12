import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { openDatabase } from "../database/connection.ts";
import { createApi } from "../api/app.ts";
import { demoCredentials } from "../api/auth.ts";
import type { Dashboard } from "../../shared/models.ts";
import type { SocialData } from "../../shared/social.ts";
import type { AdminRecord } from "../../shared/admin.ts";

test("Communautés : échanges entre comptes, accès, blocages et notifications", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "anivaya-social-"));
  const db = openDatabase(join(directory, "central.sqlite"));
  const server = createApi(db, {
    userDatabaseDirectory: join(directory, "accounts"),
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });
  const request = (
    route: string,
    method = "GET",
    body?: unknown,
    cookie = "",
  ) =>
    fetch(base + route, {
      method,
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  async function call<T = unknown>(
    route: string,
    cookie: string,
    method = "GET",
    body?: unknown,
    status?: number,
  ): Promise<T> {
    const response = await request(route, method, body, cookie);
    const payload = response.status === 204 ? null : await response.json();
    // Sans statut attendu : un succès (200 ou 204 pour une action sans contenu).
    assert.equal(
      response.status,
      status ?? (response.status === 204 ? 204 : 200),
      JSON.stringify(payload),
    );
    return payload as T;
  }
  const login = async (email: string) => {
    const response = await request("/auth/login", "POST", {
      email,
      password: demoCredentials.password,
    });
    assert.equal(response.status, 200);
    return response.headers.get("set-cookie")!.split(";")[0];
  };
  const first = await login("test@gmail.com");
  const second = await login("test2@gmail.com");
  const social = (cookie: string) => call<SocialData>("/social", cookie);

  // Exemples : test ne voit que les discussions auxquelles il appartient.
  let view = await social(first);
  assert.equal(view.me, "demo");
  assert.equal(view.communities.length, 3);
  assert.equal(view.events.length, 3);
  assert.deepEqual(view.threads.map((x) => x.kind).sort(), [
    "community",
    "direct",
    "event",
    "private",
  ]);
  const direct = view.threads.find((x) => x.kind === "direct")!;
  assert.equal(direct.name, "test2");
  const dashboard = await call<Dashboard>("/dashboard", first);
  const socialNotices = dashboard.notifications.filter(
    (n) => n.category === "social",
  );
  assert.ok(socialNotices.some((n) => n.id === "social-friend-demo-3"));
  assert.ok(socialNotices.some((n) => n.id === "social-thread-" + direct.id));

  // Message, notification chez le destinataire, puis accusé de lecture.
  await call(`/social/threads/${direct.id}/messages`, first, "POST", {
    text: "Rendez-vous à 10 h.",
  });
  let other = await social(second);
  const received = other.threads.find((x) => x.id === direct.id)!;
  assert.equal(received.messages.at(-1)!.text, "Rendez-vous à 10 h.");
  assert.ok(received.unread >= 1);
  const notice = (
    await call<Dashboard>("/dashboard", second)
  ).notifications.find((n) => n.id === "social-thread-" + direct.id)!;
  assert.equal(notice.read, false);
  assert.equal(notice.href, "#communautes/messagerie/" + direct.id);
  await call(`/social/threads/${direct.id}/read`, second, "POST", {});
  other = await social(second);
  assert.equal(other.threads.find((x) => x.id === direct.id)!.unread, 0);
  view = await social(first);
  const sent = view.threads.find((x) => x.id === direct.id)!;
  assert.equal(sent.latestRead, true);
  assert.equal(
    (await call<Dashboard>("/dashboard", second)).notifications.find(
      (n) => n.id === notice.id,
    )!.read,
    true,
  );

  // Seul l’auteur supprime son message ; une discussion inaccessible renvoie 404.
  const mine = sent.messages.at(-1)!;
  await call(
    `/social/threads/${direct.id}/messages/${mine.id}`,
    second,
    "DELETE",
    undefined,
    403,
  );
  const tf = (await social(second)).threads.find((x) => x.ref === "chats")!;
  await call(`/social/threads/${tf.id}/read`, first, "POST", {}, 404);

  // Photo jointe : visible par les membres seulement.
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]).toString(
    "base64",
  );
  await call(`/social/threads/${direct.id}/messages`, first, "POST", {
    text: "",
    photo: { type: "image/png", content: png },
  });
  const photo = (await social(first)).threads
    .find((x) => x.id === direct.id)!
    .messages.at(-1)!.photo!;
  assert.equal(
    (await request(photo.slice(4), "GET", undefined, second)).status,
    200,
  );
  const third = await login("test3@gmail.com");
  assert.equal(
    (await request(photo.slice(4), "GET", undefined, third)).status,
    404,
  );

  // Bloquer masque la discussion privée et retire l’amitié ; débloquer la rend.
  await call("/social/blocks/demo", second, "PUT", { blocked: true });
  assert.ok(!(await social(first)).threads.some((x) => x.id === direct.id));
  await call(
    `/social/threads/${direct.id}/messages`,
    first,
    "POST",
    { text: "Encore là ?" },
    403,
  );
  await call("/social/blocks/demo", second, "PUT", { blocked: false });
  assert.ok((await social(first)).threads.some((x) => x.id === direct.id));

  // Amitié reçue dans les exemples : test3 → test.
  await call("/social/friends/demo-3", first, "PUT", { action: "accept" });
  assert.equal(
    (await social(first)).friends.find((f) => f.from === "demo-3")!.status,
    "accepted",
  );
  await call(
    "/social/friends/demo-3",
    first,
    "PUT",
    { action: "request" },
    409,
  );

  // Communauté : création, adhésion, passation au départ du créateur, suppression.
  const { id: group } = await call<{ id: string }>(
    "/social/communities",
    first,
    "POST",
    {
      name: "Club test",
      city: "Paris",
      topic: "Entraide",
      description: "Un groupe de test.",
    },
    201,
  );
  await call(`/social/communities/${group}/join`, second, "POST", {});
  const groupEdit = { name: "Club renommé", city: "Paris", topic: "Entraide", description: "Description actualisée." };
  await call(`/social/communities/${group}`, second, "PATCH", groupEdit, 403);
  await call(`/social/communities/${group}`, first, "PATCH", groupEdit);
  assert.equal((await social(second)).communities.find(g => g.id === group)!.name, groupEdit.name);
  await call(`/social/communities/${group}`, second, "DELETE", undefined, 403);
  await call(`/social/communities/${group}/leave`, first, "POST", {});
  assert.equal(
    (await social(second)).communities.find((g) => g.id === group)!.owner,
    "demo-2",
  );
  await call(`/social/communities/${group}`, second, "DELETE");
  assert.ok(!(await social(first)).communities.some((g) => g.id === group));

  // Événement : places limitées, date passée refusée, l’organisateur annule.
  const future = new Date(Date.now() + 86400000).toISOString();
  const eventInput = {
    name: "Petit groupe",
    city: "Paris",
    place: "Square",
    date: future,
    capacity: 1,
    community: "",
    description: "Une place.",
  };
  await call(
    "/social/events",
    first,
    "POST",
    { ...eventInput, date: "2020-01-01T10:00" },
    400,
  );
  const { id: outing } = await call<{ id: string }>(
    "/social/events",
    first,
    "POST",
    eventInput,
    201,
  );
  await call(
    `/social/events/${outing}/participation`,
    second,
    "POST",
    { join: true },
    409,
  );
  await call(`/social/events/${outing}/cancel`, second, "POST", {}, 403);
  await call(`/social/events/${outing}`, second, "PATCH", { ...eventInput, capacity: 2 }, 403);
  await call(`/social/events/${outing}`, first, "PATCH", { ...eventInput, capacity: 2 });
  await call(`/social/events/${outing}/participation`, second, "POST", { join: true });
  assert.ok((await social(first)).events.find(e => e.id === outing)!.participants.includes("demo-2"));
  await call(`/social/events/${outing}/participation`, second, "POST", { join: false });
  await call(`/social/events/${outing}/cancel`, first, "POST", {});
  assert.ok(
    (await social(first)).events.find((e) => e.id === outing)!.cancelled,
  );

  // Renommer et changer la photo : groupe privé (membres) ou organisateur seulement.
  const groupThread = (await social(second)).threads.find(
    (x) => x.kind === "private",
  )!;
  await call(`/social/threads/${groupThread.id}`, second, "PATCH", {
    name: "Les voisins",
    photo: { type: "image/png", content: png },
  });
  const renamed = (await social(first)).threads.find(
    (x) => x.id === groupThread.id,
  )!;
  assert.equal(renamed.name, "Les voisins");
  assert.equal(
    (await request(renamed.photo!.slice(4), "GET", undefined, first)).status,
    200,
  );
  const canal = (await social(first)).threads.find((x) => x.ref === "canal")!;
  await call(
    `/social/threads/${canal.id}`,
    first,
    "PATCH",
    { name: "Autre" },
    403,
  );
  await call(
    `/social/threads/${direct.id}`,
    first,
    "PATCH",
    { name: "Nous" },
    403,
  );

  // Groupe privé : invitation réservée au créateur, départ et retrait immédiat de l’accès.
  const { id: privateGroup } = await call<{ id: string }>("/social/threads", first, "POST", {
    name: "Groupe de vérification", people: ["demo-2"],
  }, 201);
  await call(`/social/threads/${privateGroup}/members`, second, "POST", { people: ["demo-3"] }, 403);
  await call(`/social/threads/${privateGroup}/members`, first, "POST", { people: ["demo-3"] });
  assert.ok((await social(third)).threads.some(thread => thread.id === privateGroup));
  await call(`/social/threads/${privateGroup}/leave`, third, "POST", {});
  assert.ok(!(await social(third)).threads.some(thread => thread.id === privateGroup));
  await call(`/social/threads/${privateGroup}/read`, third, "POST", {}, 404);
  await call("/social/reports", second, "POST", { type: "message", target: mine.id, reason: "Autre" });
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM social_reports WHERE target=?").get<{ n: number }>(mine.id)!.n, 1);
  const admin = await login("admin@anivaya.fr");
  const reportId = "social-report-" + db.prepare("SELECT id FROM social_reports WHERE target=?").get<{ id: string }>(mine.id)!.id;
  const report = await call<AdminRecord>(`/admin/reports/${reportId}`, admin);
  assert.equal(report.account, "demo-2");
  assert.equal(report.target, "demo");
  assert.equal(report.kind, "Message");
  assert.match(report.message!, /Rendez-vous à 10 h\./);
  await call(`/admin/reports/${reportId}`, second, "GET", undefined, 403);
  await call("/social/reports", third, "POST", { type: "message", target: mine.id, reason: "Autre" }, 404);

  // Export et suppression du compte : le membre disparaît des communautés.
  const exported = await call<{ data: { social: { messages: unknown[] } } }>(
    "/export?categories=social",
    first,
  );
  assert.ok(exported.data.social.messages.length >= 2);
  await call(`/social/threads/${direct.id}/messages/${mine.id}`, first, "DELETE");
  assert.match((await call<AdminRecord>(`/admin/reports/${reportId}`, admin)).message!, /Rendez-vous à 10 h\./);
  assert.ok(!(await social(second)).threads.find(thread => thread.id === direct.id)!.messages.some(message => message.id === mine.id));
  await call("/account", third, "DELETE", { confirmation: "SUPPRIMER" });
  view = await social(first);
  assert.ok(!view.people.some((p) => p.id === "demo-3"));
  assert.ok(!view.communities.some((g) => g.members.includes("demo-3")));
});
