import type { AddressInfo } from "node:net";
import type {
  Dashboard,
  Animal,
  AnimalEvent,
  Document,
  Reminder,
  EmergencySheet,
  Notification,
} from "../../shared/models.ts";
type AnimalRecord = { pet: Animal; events: AnimalEvent[] };
import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../database/connection.ts";
import { createApi } from "../api/app.ts";

test("API : données, validation, fichiers et persistance SQLite", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "anivaya-test-"));
  const path = join(directory, "test.sqlite");
  let db = openDatabase(path);
  let server = createApi(db, { authentication: false });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  let base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const request = (route: string, method = "GET", body?: unknown) =>
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
  const initial = (await (await request("/dashboard")).json()) as Dashboard;
  assert.equal(initial.household.firstName, "Camille");
  assert.equal(initial.animals.length, 2);

  // Notifications d’exemple : la plus récente d’abord, trois non lues.
  assert.deepEqual(
    initial.notifications.map((n) => n.id),
    ["rappel-nala", "rendez-vous", "partage", "documents", "bienvenue"],
  );
  assert.equal(initial.notifications.filter((n) => !n.read).length, 3);
  const read = (await (
    await request("/notifications/rappel-nala", "PATCH", { read: true })
  ).json()) as Notification;
  assert.equal(read.read, true);
  assert.equal(
    (
      (await (
        await request("/notifications/bienvenue", "PATCH", { read: false })
      ).json()) as Notification
    ).read,
    false,
  );
  assert.equal(
    (await request("/notifications/bienvenue", "PATCH", { read: "oui" }))
      .status,
    400,
  );
  assert.equal(
    (await request("/notifications/absente", "PATCH", { read: true })).status,
    404,
  );
  const allRead = (await (
    await request("/notifications/read-all", "POST", {})
  ).json()) as Notification[];
  assert.ok(allRead.length === 5 && allRead.every((n) => n.read));
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
  const pet = (await (
    await request("/animals", "POST", {
      name: "Rio",
      species: "Chien",
      description: "Test",
    })
  ).json()) as Animal;
  const reminder = (await (
    await request("/reminders", "POST", {
      name: "Promenade",
      animal: pet.id,
      date: "2026-12-02",
    })
  ).json()) as Reminder;
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
  const doc = (await (
    await request("/documents", "POST", {
      name: "test.pdf",
      animal: pet.id,
      type: "application/pdf",
      content: content.toString("base64"),
    })
  ).json()) as Document & { content?: unknown };
  assert.ok(doc.hasFile);
  assert.equal(doc.content, undefined);
  const filePreview = await request(`/documents/${doc.id}/file?preview=1`);
  assert.match(filePreview.headers.get("content-disposition")!, /^inline;/);
  assert.equal(filePreview.headers.get("content-type"), "application/pdf");
  assert.deepEqual(Buffer.from(await filePreview.arrayBuffer()), content);
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
  assert.equal(
    (await request("/animals/" + pet.id, "PATCH", { dob: "2099-01-01" }))
      .status,
    400,
  );
  assert.equal(
    (await request("/animals/" + pet.id, "PATCH", { weight: "-1" })).status,
    400,
  );
  await request("/animals/" + pet.id, "PATCH", {
    breed: "Labrador",
    dob: "2022-01-02",
    weight: "12",
    food: "Deux repas",
    medical: "SECRET MEDICAL",
    identifier: "SECRET IDENTIFIANT",
    contact: "Contact fictif",
  });
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6dVIAAAAASUVORK5CYII=",
    "base64",
  );
  assert.equal(
    (
      await request("/animals/" + pet.id, "PATCH", {
        photo: { type: "image/png", content: png.toString("base64") },
      })
    ).status,
    200,
  );
  assert.deepEqual(
    Buffer.from(
      await (await request("/animals/" + pet.id + "/photo")).arrayBuffer(),
    ),
    png,
  );
  const event = (await (
    await request("/events", "POST", {
      animal: pet.id,
      type: "Pesée",
      date: "2026-10-21",
      note: "12 kg",
    })
  ).json()) as AnimalEvent;
  assert.ok(event.id);
  await request("/events/" + event.id, "PATCH", {
    type: "Consultation",
    date: "2026-10-20",
    note: "Contrôle fictif",
  });
  await request("/reminders/" + reminder.id, "PATCH", {
    name: "Rappel modifié",
    date: "2026-12-03",
    repeat: "Chaque année",
  });
  const sheet = (await (
    await request("/animals/" + pet.id + "/emergency", "PUT", {
      active: true,
      photo: true,
      details: true,
      notes: false,
      contact: true,
      vet: false,
    })
  ).json()) as EmergencySheet;
  assert.ok(sheet.snapshot.qrSvg?.includes("<svg"));
  assert.ok(!JSON.stringify(sheet.snapshot).includes("SECRET"));
  const preview = (await (
    await request(`/animals/${pet.id}/emergency/preview`, "POST", {
      ...sheet.settings,
      details: false,
      contact: false,
      photo: false,
    })
  ).json()) as EmergencySheet;
  assert.equal(preview.snapshot.details, "");
  assert.equal(preview.snapshot.contact, "");
  assert.equal(preview.snapshot.photo, null);
  assert.notEqual(preview.snapshot.qrSvg, sheet.snapshot.qrSvg);
  assert.deepEqual(
    await (await request(`/animals/${pet.id}/emergency`)).json(),
    sheet,
    "Preview must not modify the saved sheet",
  );
  const inactive = (await (
    await request(`/animals/${pet.id}/emergency/preview`, "POST", {
      ...sheet.settings,
      active: false,
    })
  ).json()) as EmergencySheet;
  assert.equal(inactive.snapshot.qrSvg, undefined);
  assert.equal(
    (
      await request(`/animals/${pet.id}/emergency/preview`, "POST", {
        active: "yes",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        "/animals/missing/emergency/preview",
        "POST",
        sheet.settings,
      )
    ).status,
    404,
  );
  const record = (await (
    await request("/animals/" + pet.id)
  ).json()) as AnimalRecord;
  assert.equal(record.pet.breed, "Labrador");
  assert.equal(record.events[0].note, "Contrôle fictif");
  await new Promise((resolve) => server.close(resolve));
  db.close();
  db = openDatabase(path);
  server = createApi(db, { authentication: false });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const saved = (await (await request("/dashboard")).json()) as Dashboard;
  assert.equal(saved.animals.length, 3);
  assert.equal(
    saved.reminders.find((item) => item.id === reminder.id)!.done,
    true,
  );
  assert.equal(
    saved.documents.find((item) => item.id === doc.id)!.name,
    "Carnet test",
  );
  await request(`/documents/${doc.id}`, "DELETE");
  assert.equal((await request(`/documents/${doc.id}/file`)).status, 404);
  assert.ok(
    db.prepare("SELECT deleted_at FROM documents WHERE id = ?").get(doc.id)!
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

  assert.equal(
    ((await (await request("/animals/" + pet.id)).json()) as AnimalRecord).pet
      .food,
    "Deux repas",
  );
  assert.equal(
    (
      (await (
        await request("/animals/" + pet.id + "/emergency")
      ).json()) as EmergencySheet
    ).snapshot.contact,
    "Contact fictif",
  );
  await request("/events/" + event.id, "DELETE");
  await request("/reminders/" + reminder.id, "DELETE");
  await request("/animals/" + pet.id, "DELETE");
  assert.equal((await request("/animals/" + pet.id)).status, 404);
  const afterDelete = (await (await request("/dashboard")).json()) as Dashboard;
  assert.ok(!afterDelete.animals.some((a) => a.id === pet.id));
  assert.ok(!afterDelete.events.some((e) => e.animal === pet.id));
  assert.ok(!afterDelete.reminders.some((e) => e.animal === pet.id));
  assert.ok(
    db.prepare("SELECT deleted_at FROM animals WHERE id=?").get(pet.id)!
      .deleted_at,
  );
});
