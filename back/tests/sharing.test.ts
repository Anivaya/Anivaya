import type { AddressInfo } from "node:net";
import type {
  Dashboard,
  Reminder,
  Person,
  Share,
  ShareResult,
} from "../../shared/models.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../database/connection.ts";
import { createApi } from "../api/app.ts";

test("Partage : sélection multiple, associations, validation, révocation et persistance", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "anivaya-sharing-"));
  const path = join(directory, "test.sqlite");
  let db = openDatabase(path),
    server = createApi(db);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  let base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const request = (route: string, method = "GET", body?: unknown) =>
    fetch(base + route, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  const call = async <T = unknown>(
    route: string,
    method = "GET",
    body?: unknown,
    status = 200,
  ): Promise<T> => {
    const response = await request(route, method, body);
    const payload = response.status === 204 ? null : await response.json();
    assert.equal(response.status, status, JSON.stringify(payload));
    return payload as T;
  };
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });
  const initial = await call<Dashboard>("/dashboard");
  const docs = initial.documents.map((d) => d.id),
    animals = initial.animals.map((a) => a.id);
  const p1 = await call<Person>(
    "/people",
    "POST",
    {
      name: "Alice",
      email: " ALICE@example.test ",
      animals: [animals[0]],
      note: "Garde occasionnelle",
    },
    201,
  );
  const p2 = await call<Person>(
    "/people",
    "POST",
    { name: "Sam", email: "sam@example.test", animals: [] },
    201,
  );
  const phone = await call<Person>(
    "/people",
    "POST",
    { name: "Téléphone seul", phone: "0600000000" },
    201,
  );
  assert.equal(p1.email, "alice@example.test");
  await call(
    "/people",
    "POST",
    { name: "Doublon", email: "Alice@example.test" },
    400,
  );
  await call("/people", "POST", { name: "Sans coordonnées" }, 400);
  await call("/people", "PATCH", { name: "Invalide" }, 404);
  await call(
    `/people/${p1.id}`,
    "PATCH",
    { name: "Changement refusé", animals: ["absent"] },
    400,
  );
  assert.equal(
    (await call<{ people: Person[]; shares: Share[] }>("/sharing")).people.find(
      (p) => p.id === p1.id,
    )!.name,
    "Alice",
  );
  await call("/associations", "POST", {
    people: [p1.id, p2.id],
    animals,
    mode: "add",
  });
  assert.equal(
    (await call<{ people: Person[]; shares: Share[] }>("/sharing")).people.find(
      (p) => p.id === p2.id,
    )!.animals.length,
    2,
  );
  await call(
    "/associations",
    "POST",
    { people: [p1.id], animals: [animals[0], "absent"], mode: "remove" },
    400,
  );
  assert.equal(
    (await call<{ people: Person[]; shares: Share[] }>("/sharing")).people.find(
      (p) => p.id === p1.id,
    )!.animals.length,
    2,
  );
  await call(
    "/shares",
    "POST",
    { documents: docs, people: [p1.id, phone.id], until: "2099-01-01" },
    400,
  );
  assert.equal(
    (await call<{ people: Person[]; shares: Share[] }>("/sharing")).shares
      .length,
    0,
  );
  await call(
    "/shares",
    "POST",
    { documents: docs, people: [p1.id], until: "2020-01-01" },
    400,
  );
  await call(
    "/shares",
    "POST",
    { documents: docs, people: [p1.id], until: "2099-02-31" },
    400,
  );
  const shared = await call<ShareResult>(
    "/shares",
    "POST",
    { documents: docs, people: [p1.id, p2.id], until: "2099-01-01" },
    201,
  );
  assert.equal(shared.created, docs.length * 2);
  await call(
    "/shares",
    "POST",
    { documents: docs, people: [p1.id, p2.id], until: "2099-01-02" },
    400,
  );
  await call("/associations", "POST", {
    people: [p1.id],
    animals: [animals[0]],
    mode: "remove",
  });
  assert.equal(
    (
      await call<{ people: Person[]; shares: Share[] }>("/sharing")
    ).shares.filter((s) => s.status === "active").length,
    docs.length * 2,
  );
  await call(`/people/${p1.id}`, "PATCH", {
    email: "new-address@example.test",
  });
  await call(`/people/${p1.id}`, "DELETE", undefined, 204);
  let shares = (await call<{ people: Person[]; shares: Share[] }>("/sharing"))
    .shares;
  assert.ok(
    shares
      .filter((s) => s.person === p1.id)
      .every((s) => s.status === "revoked"),
  );
  const active = shares.find((s) => s.person === p2.id);
  assert.ok(active);
  await call(`/shares/${active.id}`, "DELETE", undefined, 204);
  const mixed = await call<ShareResult>(
    "/shares",
    "POST",
    { documents: docs, people: [p2.id], until: "2099-01-01" },
    201,
  );
  assert.equal(mixed.created, 1);
  assert.equal(mixed.skipped, docs.length - 1);
  const manual = await call<ShareResult>(
    "/shares",
    "POST",
    {
      documents: [docs[0]],
      recipient: "Contact ponctuel",
      email: "contact@example.test",
      until: initial.today,
    },
    201,
  );
  assert.equal(manual.created, 1);
  db.prepare(
    "UPDATE document_shares SET until='2000-01-01' WHERE email='contact@example.test'",
  ).run();
  assert.equal(
    (await call<{ people: Person[]; shares: Share[] }>("/sharing")).shares.find(
      (s) => s.email === "contact@example.test",
    )!.status,
    "expired",
  );
  const reminder = await call<Reminder>(
    "/reminders",
    "POST",
    {
      name: "Contrôle",
      animal: animals[0],
      date: "2099-02-01",
      repeat: "Chaque mois",
      notice: "3 jours avant",
      note: "Apporter le carnet",
    },
    201,
  );
  await call(`/reminders/${reminder.id}`, "PATCH", {
    animal: animals[1],
    notice: "7 jours avant",
    note: "Note modifiée",
  });
  await call(
    `/reminders/${reminder.id}`,
    "PATCH",
    { name: "Refusé", notice: "Jamais" },
    400,
  );
  await call(`/reminders/${reminder.id}`, "PATCH", { done: true });
  await new Promise((resolve) => server.close(resolve));
  db.close();
  db = openDatabase(path);
  server = createApi(db);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const reopened = await call<Dashboard>("/dashboard");
  assert.equal(reopened.people.length, 2);
  assert.equal(reopened.shares.length, docs.length * 2 + 2);
  const saved = reopened.reminders.find((r) => r.id === reminder.id);
  assert.ok(saved);
  assert.equal(saved.animal, animals[1]);
  assert.equal(saved.notice, "7 jours avant");
  assert.equal(saved.note, "Note modifiée");
  assert.equal(saved.done, true);
  assert.equal(saved.name, "Contrôle");
  await call(`/documents/${docs[0]}`, "DELETE", undefined, 204);
  assert.ok(
    !(
      await call<{ people: Person[]; shares: Share[] }>("/sharing")
    ).shares.some((s) => s.doc === docs[0]),
  );
  assert.equal(
    db
      .prepare(
        "SELECT count(*) AS n FROM document_shares WHERE doc=? AND revoked=0",
      )
      .get(docs[0])!.n,
    0,
  );
  await call(
    "/shares",
    "POST",
    { documents: [docs[0]], people: [p2.id], until: "2099-01-01" },
    400,
  );
});
