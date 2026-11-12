import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { openDatabase } from "../database/connection.ts";
import { createApi } from "../api/app.ts";
import { DEMO_PASSWORD } from "../api/auth.ts";
import type { AuthUser, DirectoryData } from "../../shared/account.ts";
import { directoryRepository } from "../api/directory.ts";
import type { Dashboard } from "../../shared/models.ts";
import type { AdminList, AdminRecord } from "../../shared/admin.ts";
import { adminResources } from "../../shared/admin.ts";

test("Preview demos: four logins, isolated admins, clean registrations and restart", async t => {
  const saved = { NODE_ENV: process.env.NODE_ENV, ANIVAYA_TESTING_PREVIEW: process.env.ANIVAYA_TESTING_PREVIEW };
  process.env.NODE_ENV = "production";
  delete process.env.ANIVAYA_TESTING_PREVIEW;
  assert.throws(() => openDatabase(":memory:", true, false, "preview-sample-central", "sample"));
  process.env.ANIVAYA_TESTING_PREVIEW = "1";
  assert.throws(() => openDatabase(":memory:", true, false, undefined, "sample"));
  assert.throws(() => openDatabase(":memory:", false, true));
  const root = mkdtempSync(join(tmpdir(), "anivaya-preview-demo-"));
  t.after(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep));
    rmSync(root, { recursive: true, force: true });
  });
  const cookies = new Map<string, string>();
  let registeredId = "";
  for (let restart = 0; restart < 2; restart++) {
    const db = openDatabase(join(root, "central.sqlite"));
    const demo = openDatabase(join(root, "sample.sqlite"), true, false, "preview-sample-central", "sample");
    const empty = openDatabase(join(root, "empty.sqlite"), false, true, "preview-empty-central", "empty");
    const server = createApi(db, {
      userDatabaseDirectory: join(root, "accounts"),
      demoDatabase: demo, demoUserDatabaseDirectory: join(root, "sample"),
      emptyDatabase: empty, emptyUserDatabaseDirectory: join(root, "empty"),
    });
    try {
      await server.ready;
      server.listen(0, "127.0.0.1"); await once(server, "listening");
      const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
      const request = (path: string, method = "GET", body?: unknown, cookie = "") => fetch(base + path, {
        method, headers: { "Content-Type": "application/json", Cookie: cookie },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      async function read<T>(path: string, cookie: string): Promise<T> {
        const response = await request(path, "GET", undefined, cookie);
        assert.equal(response.status, 200, await response.clone().text());
        return await response.json() as T;
      }
      for (const [email, id, isAdmin, isEmpty] of [
        ["test@gmail.com", "demo", false, false],
        ["admin@anivaya.fr", "demo-admin", true, false],
        ["test.vide@anivaya.test", "empty-test", false, true],
        ["admin.vide@anivaya.test", "empty-admin", true, true],
      ] as const) {
        const response = await request("/auth/login", "POST", { email, password: DEMO_PASSWORD }, cookies.get("demo") || "");
        assert.equal(response.status, 200, await response.clone().text());
        assert.match(response.headers.get("set-cookie")!, /; Secure/);
        const user = await response.json() as AuthUser;
        assert.equal(user.id, id);
        assert.equal(user.adminRole, isAdmin ? "Administrateur" : undefined);
        const cookie = response.headers.get("set-cookie")!.split(";")[0];
        cookies.set(id, cookie);
        assert.equal((await read<AuthUser>("/auth/session", cookie)).id, id);
        const dashboard = await read<Dashboard>("/dashboard", cookie);
        assert.equal(dashboard.animals.length, isEmpty ? 0 : 4);
        if (!isEmpty) {
          assert.equal(dashboard.documents.filter(doc => doc.id.startsWith("preview-doc-")).length, 4);
          for (const document of dashboard.documents.filter(doc => doc.id.startsWith("preview-doc-"))) {
            assert.ok(document.hasFile);
            const file = await request(`/documents/${document.id}/file?preview=1`, "GET", undefined, cookie);
            assert.equal(file.status, 200);
            assert.equal(file.headers.get("content-type"), "application/pdf");
            assert.match(file.headers.get("content-disposition")!, /^inline;/);
            const pdf = Buffer.from(await file.arrayBuffer()).toString("latin1");
            assert.ok(pdf.startsWith("%PDF-") && pdf.includes("%%EOF"));
          }
          assert.ok(dashboard.reminders.some(r => !r.done && r.date < dashboard.today));
          assert.ok(dashboard.reminders.some(r => !r.done && r.date === dashboard.today));
          assert.ok(dashboard.reminders.some(r => r.done));
          assert.ok(dashboard.reminders.some(r => r.repeat !== "Aucune"));
          assert.equal(dashboard.people.filter(p => p.id.startsWith("preview-person-")).length, 3);
          assert.deepEqual(dashboard.shares.filter(s => s.id.startsWith("preview-share-")).map(s => s.status).sort(), ["active", "expired", "revoked"]);
          const sheet = dashboard.emergencySheets.find(s => s.animal === "preview-oslo")!;
          assert.ok(sheet.snapshot.qrSvg && sheet.snapshot.payload?.startsWith("http"));
          assert.equal(dashboard.emergencySheets.find(s => s.animal === "preview-luna")!.settings.active, false);
          const token = new URL(sheet.snapshot.payload!).hash.split("/")[1].split("?")[0];
          const publicSheet = await read<{ name: string; contact: string }>(`/public/emergency/${token}`, "");
          assert.equal(publicSheet.name, "Oslo");
          assert.match(publicSheet.contact, /example\.test/);
          assert.equal((await request("/documents/preview-doc-consultation/file")).status, 401);
          if (restart && id === "demo")
            assert.equal(dashboard.documents.find(d => d.id === "preview-doc-consultation")!.name, "Nom conservé après redémarrage");
          if (!restart && id === "demo")
            assert.equal((await request("/documents/preview-doc-consultation", "PATCH", {
              name: "Nom conservé après redémarrage", animal: "preview-oslo", category: "Santé",
            }, cookie)).status, 200);
        } else {
          assert.equal(dashboard.documents.length, 0);
          assert.equal(dashboard.people.length, 0);
          assert.equal(dashboard.emergencySheets.length, 0);
        }
        await read("/directory", cookie);
        await read("/social", cookie);
        if (isAdmin) {
          await read("/admin/overview", cookie);
          await read("/admin/analytics", cookie);
          for (const resource of adminResources) await read(`/admin/${resource}`, cookie);
          assert.equal((await request("/admin/users", "POST", {}, cookie)).status, 503);
          if (isEmpty) assert.equal((await read<AdminList>("/admin/users", cookie)).items.length, 2);
        } else assert.equal((await request("/admin/overview", "GET", undefined, cookie)).status, 403);
      }
      if (!restart) {
        const reporterLogin = await request("/auth/login", "POST", { email: "test@gmail.com", password: DEMO_PASSWORD });
        assert.equal(reporterLogin.status, 200);
        cookies.set("demo", reporterLogin.headers.get("set-cookie")!.split(";")[0]);
        const reportResponse = await request("/social/reports", "POST", {
          type: "person", target: "demo-2", reason: "Autre",
        }, cookies.get("demo"));
        assert.equal(reportResponse.status, 204, await reportResponse.text());
        const report = demo.prepare("SELECT id FROM social_reports WHERE from_id='demo'").get<{ id: string }>()!;
        const detail = await read<AdminRecord>(`/admin/reports/social-report-${report.id}`, cookies.get("demo-admin")!);
        assert.equal(detail.account, "demo");
        assert.equal(detail.target, "demo-2");
        // Un dossier traité ne doit pas être rouvert au redémarrage.
        demo.prepare("UPDATE admin_records SET status='Classé sans suite' WHERE id=?").run(`social-report-${report.id}`);
        // Ancien signalement sans dossier admin, créé avant ce correctif.
        demo.prepare("INSERT INTO social_reports VALUES (?,?,?,?,?,?)")
          .run("legacy-camille", "demo-2", "person", "demo", "Autre", "2026-11-10T10:00:00.000Z");
        const registration = await request("/auth/register", "POST", {
          email: "preview-owner@example.net", name: "Preview Owner", password: DEMO_PASSWORD, confirmPassword: DEMO_PASSWORD,
        }, cookies.get("demo-admin"));
        assert.equal(registration.status, 201, await registration.clone().text());
        registeredId = (await registration.json() as AuthUser).id;
        cookies.set("registered", registration.headers.get("set-cookie")!.split(";")[0]);
      }
      if (restart) {
        const recovered = await read<AdminRecord>("/admin/reports/social-report-legacy-camille", cookies.get("demo-admin")!);
        assert.equal(recovered.account, "demo-2");
        assert.equal(recovered.status, "À traiter");
        const linked = demo.prepare("SELECT status FROM admin_records WHERE id LIKE 'social-report-%'").all<{ status: string }>();
        assert.deepEqual(linked.map(r => r.status).sort(), ["Classé sans suite", "À traiter"].sort());
        assert.equal((await request("/admin/reports/social-report-legacy-camille", "GET", undefined, cookies.get("empty-admin"))).status, 404);
      }
      assert.equal(empty.prepare("SELECT COUNT(*) AS n FROM admin_records WHERE id LIKE 'social-report-%'").get()!.n, 0);
      assert.equal(db.prepare("SELECT COUNT(*) AS n FROM admin_records WHERE id LIKE 'social-report-%'").get()!.n, 0);
      assert.equal((await read<AuthUser>("/auth/session", cookies.get("registered")!)).id, registeredId);
      assert.equal((await read<Dashboard>("/dashboard", cookies.get("registered")!)).animals.length, 0);
      const directory = await read<DirectoryData>("/directory", cookies.get("registered")!);
      assert.equal(directory.professionals.length, 3);
      assert.ok(directory.professionals.every(p => p.fictional && p.services.length > 0));
      const nextDay = new Date(directory.today + "T12:00:00Z");
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      const slots = await read<{ time: string; available: boolean }[]>(
        `/professionals/preview-veterinaire/slots?date=${nextDay.toISOString().slice(0, 10)}`,
        cookies.get("registered")!,
      );
      assert.ok(slots.some(slot => slot.available));
      assert.equal((await request("/professionals/preview-veterinaire/favorite", "PUT",
        { favorite: true }, cookies.get("registered"))).status, 204);
      assert.ok((await read<DirectoryData>("/directory", cookies.get("registered")!))
        .favorites.includes("preview-veterinaire"));
      assert.equal(db.prepare("SELECT count(*) AS n FROM professionals").get()!.n, 3);
      assert.deepEqual((await read<DirectoryData>("/directory", cookies.get("empty-test")!)).professionals, []);
      delete process.env.ANIVAYA_TESTING_PREVIEW;
      assert.deepEqual(directoryRepository(db).all().professionals, []);
      assert.throws(() => directoryRepository(db).slots("preview-veterinaire", "2026-11-20"), /introuvable/);
      process.env.ANIVAYA_TESTING_PREVIEW = "1";
      assert.equal((await request("/animals/luna", "GET", undefined, cookies.get("registered"))).status, 404);
      for (const id of ["demo-admin", "empty-admin"]) {
        const users = await read<AdminList>("/admin/users?q=preview-owner", cookies.get(id)!);
        assert.deepEqual(users.items, []);
      }
      assert.deepEqual(db.prepare("SELECT id FROM accounts").all().map(account => account.id), [registeredId]);
      assert.equal(db.prepare("SELECT count(*) AS n FROM admin_members").get()!.n, 0);
      assert.equal(db.prepare("SELECT count(*) AS n FROM animals").get()!.n, 0);
      assert.equal((await request("/auth/login", "POST", { email: "admin@anivaya.fr", password: "incorrect" })).status, 401);
      assert.equal((await request("/auth/password-reset", "POST", {})).status, 503);
    } finally {
      await new Promise<void>(r => server.close(() => r()));
      db.close(); demo.close(); empty.close();
    }
  }
});
