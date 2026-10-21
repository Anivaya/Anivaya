import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../database/connection.js";
import { createApi } from "../api/app.js";

test("API : données, validation, fichiers et persistance SQLite", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "anivaya-test-"));
  const path = join(directory, "test.sqlite");
  let db = openDatabase(path);
  let server = createApi(db);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  let base = `http://127.0.0.1:${server.address().port}/api`;
  const request = (route, method = "GET", body) =>
    fetch(base + route, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });
  const initial = await (await request("/dashboard")).json();
  assert.equal(initial.household.firstName, "Camille");
  assert.equal(initial.animals.length, 2);
  assert.equal(
    (await request("/animals", "POST", { name: "", species: "Chien" })).status,
    400,
  );
  assert.equal(
    (
      await request("/reminders", "POST", {
        name: "Invalide",
        animal: "nala",
        date: "2026-02-31",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/reminders", "POST", {
        name: "Invalide",
        animal: "absent",
        date: "2026-12-01",
      })
    ).status,
    400,
  );
  const pet = await (
    await request("/animals", "POST", {
      name: "Rio",
      species: "Chien",
      description: "Test",
    })
  ).json();
  const reminder = await (
    await request("/reminders", "POST", {
      name: "Promenade",
      animal: pet.id,
      date: "2026-12-02",
    })
  ).json();
  assert.equal(
    (await request(`/reminders/${reminder.id}`, "PATCH", { done: "true" }))
      .status,
    400,
  );
  assert.equal(
    (await request(`/reminders/${reminder.id}`, "PATCH", { done: true }))
      .status,
    200,
  );
  assert.equal(
    (
      await request("/documents", "POST", {
        name: "faux.png",
        animal: pet.id,
        type: "image/png",
        content: Buffer.from("pas une image").toString("base64"),
      })
    ).status,
    400,
  );
  const content = Buffer.from("%PDF-1.4\n% test Anivaya\n%%EOF");
  const doc = await (
    await request("/documents", "POST", {
      name: "test.pdf",
      animal: pet.id,
      type: "application/pdf",
      content: content.toString("base64"),
    })
  ).json();
  assert.ok(doc.hasFile);
  assert.equal(doc.content, undefined);
  assert.deepEqual(
    Buffer.from(
      await (await request(`/documents/${doc.id}/file`)).arrayBuffer(),
    ),
    content,
  );
  await request(`/documents/${doc.id}`, "PATCH", {
    name: "Carnet test",
    animal: "milo",
  });
  await new Promise((resolve) => server.close(resolve));
  db.close();
  db = openDatabase(path);
  server = createApi(db);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}/api`;
  const saved = await (await request("/dashboard")).json();
  assert.equal(saved.animals.length, 3);
  assert.equal(
    saved.reminders.find((item) => item.id === reminder.id).done,
    true,
  );
  assert.equal(
    saved.documents.find((item) => item.id === doc.id).name,
    "Carnet test",
  );
  await request(`/documents/${doc.id}`, "DELETE");
  assert.equal((await request(`/documents/${doc.id}/file`)).status, 404);
  assert.ok(
    db.prepare("SELECT deleted_at FROM documents WHERE id = ?").get(doc.id)
      .deleted_at,
  );
  assert.equal(
    (
      await fetch(base + "/dashboard", {
        headers: { Origin: "https://untrusted.example" },
      })
    ).status,
    403,
  );
  assert.equal((await request("/absent")).status, 404);
});
