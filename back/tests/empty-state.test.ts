import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { openDatabase } from "../database/connection.ts";
import { createApi } from "../api/app.ts";
import { DEMO_PASSWORD, emptyAccounts } from "../api/auth.ts";
import { adminResources } from "../../shared/admin.ts";
import type { AdminList } from "../../shared/admin.ts";
import type { AuthUser, DirectoryData } from "../../shared/account.ts";
import type { Dashboard } from "../../shared/models.ts";
import type { SocialData } from "../../shared/social.ts";

for (const integrated of [false, true])
test(`États vides ${integrated ? "avec comptes habituels" : "seuls"} : droits, isolation et redémarrage`, async () => {
  const previous = process.env.ANIVAYA_EMPTY_STATE;
  process.env.ANIVAYA_EMPTY_STATE = integrated ? "0" : "1";
  const directory = mkdtempSync(join(tmpdir(), "anivaya-empty-"));
  try {
    for (let restart = 0; restart < 2; restart++) {
      const db = openDatabase(join(directory, "central.sqlite"));
      const emptyDb = integrated ? openDatabase(join(directory, "empty", "central.sqlite"), false, true) : db;
      const server = createApi(db, {
        userDatabaseDirectory: join(directory, "accounts"),
        emptyDatabase: integrated ? emptyDb : undefined,
        emptyUserDatabaseDirectory: join(directory, "empty", "accounts"),
      });
      try {
        server.listen(0, "127.0.0.1");
        await once(server, "listening");
        const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
        const read = async <T>(path: string, cookie: string): Promise<T> => {
          const response = await fetch(base + path, { headers: { Cookie: cookie } });
          assert.equal(response.status, 200, path);
          return await response.json() as T;
        };
        for (const account of emptyAccounts) {
          const login = await fetch(base + "/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: account.email, password: DEMO_PASSWORD }),
          });
          assert.equal(login.status, 200);
          const user = await login.json() as AuthUser;
          const admin = account.id === "empty-admin";
          assert.equal(user.adminRole, admin ? "Administrateur" : undefined);
          const cookie = login.headers.get("set-cookie")!.split(";")[0];
          assert.ok(cookie.startsWith(integrated ? "anivaya_session=" : "anivaya_empty_session="));
          assert.equal((await read<AuthUser>("/auth/session", cookie)).id, account.id);
          if (integrated) {
            const regularLogin = await fetch(base + "/auth/login", {
              method: "POST",
              headers: { "Content-Type": "application/json", Cookie: cookie },
              body: JSON.stringify({ email: "test@gmail.com", password: DEMO_PASSWORD }),
            });
            assert.equal(regularLogin.status, 200);
            const regularCookie = regularLogin.headers.get("set-cookie")!.split(";")[0];
            const [regularDashboard, emptyDashboard] = await Promise.all([
              read<Dashboard>("/dashboard", regularCookie),
              read<Dashboard>("/dashboard", cookie),
            ]);
            assert.equal(regularDashboard.animals.length, 2);
            assert.equal(emptyDashboard.animals.length, 0);
            const invalid = await fetch(base + "/auth/login", {
              method: "POST",
              headers: { "Content-Type": "application/json", Cookie: regularCookie },
              body: JSON.stringify({ email: account.email, password: "incorrect" }),
            });
            assert.equal(invalid.status, 401);
            assert.equal((await read<AuthUser>("/auth/session", regularCookie)).id, "demo");
          }
          const dashboard = await read<Dashboard>("/dashboard", cookie);
          for (const [key, value] of Object.entries(dashboard))
            if (Array.isArray(value)) assert.equal(value.length, 0, key);
          const social = await read<SocialData>("/social", cookie);
          for (const key of ["communities", "events", "threads", "friends"] as const)
            assert.deepEqual(social[key], [], key);
          const directoryData = await read<DirectoryData>("/directory", cookie);
          for (const [key, value] of Object.entries(directoryData))
            if (Array.isArray(value)) assert.equal(value.length, 0, key);
          if (!admin) {
            assert.equal((await fetch(base + "/admin/overview", { headers: { Cookie: cookie } })).status, 403);
            continue;
          }
          await read("/admin/overview", cookie);
          await read("/admin/analytics", cookie);
          for (const resource of adminResources) {
            const essentials = ["users", "team", "security"].includes(resource);
            const data = await read<AdminList>(`/admin/${resource}${essentials ? "?q=aucun-resultat" : ""}`, cookie);
            assert.deepEqual(data.items, [], resource);
          }
          assert.equal((await read<AdminList>("/admin/users", cookie)).items.length, 2);
          assert.equal((await read<AdminList>("/admin/team", cookie)).items.length, 1);
        }
        assert.equal(emptyDb.prepare("SELECT count(*) AS n FROM accounts").get<{ n: number }>()!.n, 2);
        assert.equal(emptyDb.prepare("SELECT count(*) AS n FROM admin_records").get<{ n: number }>()!.n, 0);
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
        db.close();
        if (integrated) emptyDb.close();
      }
    }
  } finally {
    if (previous === undefined) delete process.env.ANIVAYA_EMPTY_STATE;
    else process.env.ANIVAYA_EMPTY_STATE = previous;
    rmSync(directory, { recursive: true, force: true });
  }
});
