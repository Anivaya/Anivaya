import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { openDatabase } from "../database/connection.ts";
import { createApi } from "../api/app.ts";
import { DEMO_PASSWORD } from "../api/auth.ts";
import type { AuthUser } from "../../shared/account.ts";
import type { Dashboard } from "../../shared/models.ts";
import type { AdminList } from "../../shared/admin.ts";
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
        assert.equal((await read<Dashboard>("/dashboard", cookie)).animals.length, isEmpty ? 0 : 2);
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
        const registration = await request("/auth/register", "POST", {
          email: "preview-owner@example.net", name: "Preview Owner", password: DEMO_PASSWORD, confirmPassword: DEMO_PASSWORD,
        }, cookies.get("demo-admin"));
        assert.equal(registration.status, 201, await registration.clone().text());
        registeredId = (await registration.json() as AuthUser).id;
        cookies.set("registered", registration.headers.get("set-cookie")!.split(";")[0]);
      }
      assert.equal((await read<AuthUser>("/auth/session", cookies.get("registered")!)).id, registeredId);
      assert.equal((await read<Dashboard>("/dashboard", cookies.get("registered")!)).animals.length, 0);
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
