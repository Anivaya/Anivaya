import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { openDatabase } from "../database/connection.ts";
import { createApi } from "../api/app.ts";
import { totp } from "../api/mfa.ts";
import { DEMO_PASSWORD } from "../api/auth.ts";

test("TOTP : vecteurs de la RFC 6238 pour SHA-1", () => {
  const secret = Buffer.from("12345678901234567890");
  for (const [seconds, expected] of [
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ] as const)
    assert.equal(totp(secret, seconds * 1000, 8), expected);
});
function decode32(value: string) {
  let bits = "";
  for (const char of value)
    bits += "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
      .indexOf(char)
      .toString(2)
      .padStart(5, "0");
  return Buffer.from(bits.match(/.{8}/g)!.map((n) => parseInt(n, 2)));
}
test("Double authentification : confirmation, chiffrement, anti-rejeu et secours à usage unique", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "anivaya-mfa-test-")),
    db = openDatabase(join(root, "central.sqlite")),
    server = createApi(db, { userDatabaseDirectory: join(root, "accounts") });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise<void>((r) => server.close(() => r()));
    db.close();
    rmSync(root, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  let cookie = "";
  const call = (path: string, body?: unknown) =>
    fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: body ? JSON.stringify(body) : undefined,
    });
  const credentials = { email: "admin@anivaya.fr", password: DEMO_PASSWORD };
  const login = await call("/auth/login", credentials);
  assert.equal(login.status, 200);
  cookie = login.headers.get("set-cookie")!.split(";")[0];
  assert.equal(
    (await call("/account/mfa", { action: "setup", password: "wrong" })).status,
    400,
  );
  const setup = await call("/account/mfa", {
    action: "setup",
    password: DEMO_PASSWORD,
  });
  assert.equal(setup.status, 200);
  const data = (await setup.json()) as { secret: string; qr: string };
  assert.match(data.qr, /^data:image\/png;base64,/);
  const stored = db
    .prepare("SELECT secret FROM account_mfa WHERE account='demo-admin'")
    .get<{ secret: string }>()!.secret;
  assert.ok(!stored.includes(data.secret));
  const code = totp(decode32(data.secret));
  const enabled = await call("/account/mfa", {
    action: "enable",
    password: DEMO_PASSWORD,
    mfaCode: code,
  });
  assert.equal(enabled.status, 200);
  const { codes } = (await enabled.json()) as { codes: string[] };
  assert.equal(codes.length, 8);
  const recovery = db
    .prepare("SELECT recovery FROM account_mfa WHERE account='demo-admin'")
    .get<{ recovery: string }>()!.recovery;
  assert.ok(!recovery.includes(codes[0]));
  assert.equal((await call("/auth/login", credentials)).status, 401);
  assert.equal(
    (await call("/auth/login", { ...credentials, mfaCode: code })).status,
    401,
  );
  const recovered = await call("/auth/login", {
    ...credentials,
    mfaCode: codes[0],
  });
  assert.equal(recovered.status, 200);
  cookie = recovered.headers.get("set-cookie")!.split(";")[0];
  assert.equal(
    (await call("/auth/login", { ...credentials, mfaCode: codes[0] })).status,
    401,
  );
  assert.deepEqual(await (await call("/account/mfa")).json(), {
    enabled: true,
    recoveryRemaining: 7,
  });
  assert.equal(
    (
      await call("/account/mfa", {
        action: "disable",
        password: DEMO_PASSWORD,
        mfaCode: codes[1],
      })
    ).status,
    200,
  );
  assert.equal((await call("/auth/login", credentials)).status, 200);
});
