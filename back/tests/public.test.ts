import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { openDatabase } from "../database/connection.ts";
import { createApi } from "../api/app.ts";
import type { AuthUser, Profile } from "../../shared/account.ts";
import { pageTitle } from "../../front/src/shared/layout/pageTitle.ts";

test("Titres de toutes les familles de pages et des ancres publiques", () => {
  for (const [route, title] of [
    ["", "Accueil"],
    ["#connexion", "Connexion"],
    ["#inscription", "Inscription"],
    ["#animaux/nala/apercu", "Mes animaux"],
    ["#documents", "Mes documents"],
    ["#accueil/cliniques", "Cliniques"],
    ["#accueil/pro-inscription", "Professionnels"],
    ["#accueil/confidentialite", "Confidentialité"],
    ["#admin/pilotage?period=year", "Pilotage"],
    ["#contact/service", "Informations du service"],
    ["#desinscription/token", "Désinscription"],
  ])
    assert.equal(pageTitle(route), `Anivaya · ${title}`);
  assert.equal(
    pageTitle("#accueil/bloc-12", "professionnels"),
    "Anivaya · Professionnels",
  );
});

test("Liste d’attente : erreurs multiples, lien personnel, désinscription persistante et réinscription", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "anivaya-unsubscribe-"));
  const previousOutbox = process.env.MAIL_OUTBOX,
    previousSmtp = process.env.SMTP_HOST;
  delete process.env.SMTP_HOST;
  process.env.MAIL_OUTBOX = join(directory, "outbox");
  const db = openDatabase(join(directory, "central.sqlite"));
  const server = createApi(db, {
    userDatabaseDirectory: join(directory, "accounts"),
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/public`;
  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
    if (previousOutbox === undefined) delete process.env.MAIL_OUTBOX;
    else process.env.MAIL_OUTBOX = previousOutbox;
    if (previousSmtp === undefined) delete process.env.SMTP_HOST;
    else process.env.SMTP_HOST = previousSmtp;
    rmSync(directory, { recursive: true, force: true });
  });
  const post = (path: string, body: unknown) =>
    fetch(base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const input = {
    kind: "liste-attente",
    name: "Camille test",
    email: "consent@example.com",
    profile: "proprietaire",
    consent: true,
    requestId: randomUUID(),
  };
  const invalid = await post("/leads", {
    ...input,
    name: "",
    email: "incorrect",
    consent: false,
    postalCode: "abc",
  });
  assert.equal(invalid.status, 400);
  const problem = (await invalid.json()) as { fields: Record<string, string> };
  assert.deepEqual(Object.keys(problem.fields).sort(), [
    "consent",
    "email",
    "name",
    "postalCode",
  ]);
  assert.equal(
    db.prepare("SELECT count(*) n FROM public_leads").get<{ n: number }>()!.n,
    0,
  );
  const response = await post("/leads", input);
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), {
    accepted: true,
  });
  const mails = () => readdirSync(join(directory, "outbox"));
  const mail = readFileSync(join(directory, "outbox", mails()[0]), "utf8");
  const token = mail.match(/#desinscription\/([a-f0-9]{64})/)![1];
  assert.ok(token);
  assert.notEqual(
    db
      .prepare("SELECT token_hash FROM public_unsubscribe_tokens")
      .get<{ token_hash: string }>()!.token_hash,
    token,
  );
  await post("/leads", input);
  assert.equal(mails().length, 1, "un retry n’envoie pas un deuxième e-mail");
  const status = () =>
    db
      .prepare(
        "SELECT withdrawn_at FROM public_waitlist_subscriptions WHERE email=?",
      )
      .get<{ withdrawn_at: string | null }>(input.email)!.withdrawn_at;
  assert.equal(
    (await post("/unsubscribe", { token: "0".repeat(64) })).status,
    400,
  );
  assert.equal(status(), null);
  assert.equal((await post("/unsubscribe", { token })).status, 200);
  const date = status();
  assert.ok(date);
  await post("/unsubscribe", { token });
  assert.equal(status(), date);
  const ticket = db
    .prepare(
      "SELECT data FROM admin_records WHERE id=(SELECT id FROM public_leads WHERE request_id=?)",
    )
    .get<{ data: string }>(input.requestId)!;
  assert.ok(JSON.parse(ticket.data).consentWithdrawnAt);
  await post("/leads", input);
  assert.equal(
    status(),
    date,
    "un ancien retry ne réactive pas le consentement",
  );
  await post("/leads", { ...input, requestId: randomUUID() });
  assert.equal(
    status(),
    null,
    "une nouvelle inscription explicite réactive le consentement",
  );
  const known = await post("/unsubscribe-link", { email: input.email });
  const unknown = await post("/unsubscribe-link", {
    email: "unknown@example.com",
  });
  assert.equal(known.status, unknown.status);
  assert.deepEqual(
    await known.json(),
    await unknown.json(),
    "aucune énumération d’adresses",
  );
  assert.equal(mails().length, 3);
  await post("/unsubscribe", { token });
  const second = openDatabase(join(directory, "central.sqlite"));
  assert.ok(
    second
      .prepare(
        "SELECT withdrawn_at FROM public_waitlist_subscriptions WHERE email=?",
      )
      .get<{ withdrawn_at: string }>(input.email)!.withdrawn_at,
  );
  second.close();
});

test("Accueil : quatre formulaires, validation, doublons, suivi admin et persistance du code postal", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "anivaya-public-"));
  const path = join(directory, "central.sqlite");
  let db = openDatabase(path),
    server = createApi(db, {
      userDatabaseDirectory: join(directory, "accounts"),
    });
  let base = "";
  async function start() {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  }
  await start();
  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });
  const call = (
    path: string,
    body?: unknown,
    cookie = "",
    method = body ? "POST" : "GET",
  ) =>
    fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: body ? JSON.stringify(body) : undefined,
    });
  const common = {
    name: "Test accueil",
    email: "accueil@example.test",
    consent: true,
    postalCode: "01000",
  };
  const waitlist = {
    ...common,
    kind: "liste-attente",
    requestId: randomUUID(),
    profile: "proprietaire",
    animals: ["chien", "chat"],
    plan: "plus",
  };
  for (const [field, value] of [
    ["consent", false],
    ["email", "invalide"],
    ["postalCode", "abcde"],
    ["profile", "admin"],
    ["animals", ["lion"]],
    ["plan", "admin"],
  ] as const) {
    const response = await call("/public/leads", {
      ...waitlist,
      [field]: value,
    });
    assert.equal(response.status, 400);
    const error = (await response.json()) as { field: string };
    assert.equal(error.field, field);
  }
  assert.equal(
    db.prepare("SELECT count(*) AS n FROM public_leads").get<{ n: number }>()!
      .n,
    0,
  );
  for (const input of [
    waitlist,
    { ...common, kind: "pro", activity: "pet-sitter", requestId: randomUUID() },
    {
      ...common,
      kind: "clinique",
      organization: "Clinique test",
      phone: "0612345678",
      requestId: randomUUID(),
    },
    {
      ...common,
      kind: "entreprise",
      organization: "Entreprise test",
      organizationType: "cse",
      message: "Un pilote pour les salariés.",
      requestId: randomUUID(),
    },
  ]) {
    const response = await call("/public/leads", input);
    assert.equal(
      response.status,
      201,
      JSON.stringify(await response.clone().json()),
    );
    assert.deepEqual(await response.json(), { accepted: true });
  }
  await Promise.all([
    call("/public/leads", waitlist),
    call("/public/leads", { ...waitlist, requestId: randomUUID() }),
  ]);
  assert.equal(
    (await call("/public/leads", { ...waitlist, name: "Autre contenu" }))
      .status,
    409,
  );
  assert.equal(
    db.prepare("SELECT count(*) AS n FROM public_leads").get<{ n: number }>()!
      .n,
    4,
  );
  assert.equal(
    db
      .prepare(
        "SELECT count(*) AS n FROM admin_records WHERE resource='tickets' AND data LIKE '%accueil@example.test%'",
      )
      .get<{ n: number }>()!.n,
    4,
  );
  assert.equal((await call("/admin/tickets")).status, 401);
  assert.equal((await call("/public/leads")).status, 401);
  const signup = {
    name: "Compte postal",
    email: "postal@example.test",
    password: "CodePostal2026!",
    confirmPassword: "CodePostal2026!",
    postalCode: "01000",
  };
  assert.equal(
    (await call("/auth/register", { ...signup, postalCode: "12" })).status,
    400,
  );
  const response = await call("/auth/register", signup);
  assert.equal(response.status, 201);
  const cookie = response.headers.get("set-cookie")!.split(";")[0];
  const user = (await response.json()) as AuthUser;
  assert.equal(user.profile.postalCode, "01000");
  assert.equal(
    (
      await call(
        "/profile",
        { ...user.profile, postalCode: "ABCDE" },
        cookie,
        "PATCH",
      )
    ).status,
    400,
  );
  const saved = await call(
    "/profile",
    { ...user.profile, postalCode: "97100" },
    cookie,
    "PATCH",
  );
  assert.equal(saved.status, 200);
  assert.equal(((await saved.json()) as Profile).postalCode, "97100");
  const { postalCode: omitted, ...legacy } = user.profile;
  assert.equal(omitted, "01000");
  const preserved = await call("/profile", legacy, cookie, "PATCH");
  assert.equal(((await preserved.json()) as Profile).postalCode, "97100");
  await new Promise<void>((resolve) => server.close(() => resolve()));
  db.close();
  db = openDatabase(path);
  server = createApi(db, {
    userDatabaseDirectory: join(directory, "accounts"),
  });
  await start();
  assert.equal(
    db.prepare("SELECT count(*) AS n FROM public_leads").get<{ n: number }>()!
      .n,
    4,
  );
  const profile = await call("/profile", undefined, cookie);
  assert.equal(((await profile.json()) as Profile).postalCode, "97100");
});
