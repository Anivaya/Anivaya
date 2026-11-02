import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { openDatabase } from "../database/connection.ts";
import { createApi } from "../api/app.ts";
import { DEMO_PASSWORD } from "../api/auth.ts";
import type { AdminList, AdminRecord } from "../../shared/admin.ts";
import type { AuthUser } from "../../shared/account.ts";
import type { Animal, EmergencySheet } from "../../shared/models.ts";

const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

test("Administration : invitations, suppressions, fiches publiques, imports, sécurité et justificatifs", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "anivaya-admin-ext-")),
    db = openDatabase(join(directory, "central.sqlite")),
    server = createApi(db, {
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
  const req = (url: string, method = "GET", body?: unknown, cookie = "") =>
    fetch(base + url, {
      method,
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  async function json<T>(
    url: string,
    method = "GET",
    body?: unknown,
    cookie = "",
    status = 200,
  ): Promise<T> {
    const res = await req(url, method, body, cookie);
    const value = res.status === 204 ? undefined : await res.json();
    assert.equal(res.status, status, JSON.stringify(value));
    return value as T;
  }
  async function session(
    url: string,
    body: Record<string, unknown>,
    status = 200,
  ) {
    const res = await req(url, "POST", body);
    assert.equal(res.status, status, await res.clone().text());
    return {
      cookie: res.headers.get("set-cookie")?.split(";")[0] ?? "",
      user: (await res.json()) as AuthUser,
    };
  }
  const login = (email: string) =>
    session("/auth/login", { email, password: DEMO_PASSWORD });
  const register = (email: string) =>
    session(
      "/auth/register",
      {
        email,
        name: email.split("@")[0],
        password: DEMO_PASSWORD,
        confirmPassword: DEMO_PASSWORD,
      },
      201,
    );
  const admin = await login("admin@anivaya.fr"),
    regular = await login("test@gmail.com");
  const list = (r: string, query = "", cookie = admin.cookie) =>
    json<AdminList>(`/admin/${r}${query}`, "GET", undefined, cookie);
  const act = (
    r: string,
    row: AdminRecord,
    action: string,
    data: Record<string, unknown> = {},
    status = 200,
    cookie = admin.cookie,
  ) =>
    json<AdminRecord>(
      `/admin/${r}/${row.id}/actions`,
      "POST",
      { version: row.version, action, note: "Motif de test", ...data },
      cookie,
      status,
    );

  await t.test("le jeu de démonstration est en place", async () => {
    const pros = await list("pros", "?pageSize=50");
    const tilleuls = pros.items.find((p) => p.id === "tilleuls")!;
    assert.equal(tilleuls.status, "Validé");
    assert.equal(tilleuls.level, "Dossier vérifié");
    assert.equal(
      pros.items.find((p) => p.id === "maison")!.level,
      "Pièces à compléter",
    );
    assert.ok((await list("reports")).total >= 3);
    assert.ok((await list("deletions", "?scope=pending")).total >= 1);
    assert.ok((await list("security", "?scope=pending")).total >= 1);
    assert.ok(
      (await list("team")).items.some(
        (m) => m.invitation && m.status === "Invité",
      ),
    );
    const resources = await json<{ guides: { id: string }[] }>(
      "/public/resources",
    );
    assert.ok(resources.guides.some((g) => g.id === "guide-relais"));
  });

  await t.test(
    "une invitation devient un accès à la première connexion",
    async () => {
      const invitation = await json<AdminRecord>(
        "/admin/team",
        "POST",
        { email: "invitee@example.test", role: "Modérateur" },
        admin.cookie,
        201,
      );
      assert.equal(invitation.status, "Invité");
      assert.equal(invitation.invitation, true);
      await json(
        "/admin/team",
        "POST",
        { email: "invitee@example.test", role: "Support" },
        admin.cookie,
        409,
      );
      const renewed = await act("team", invitation, "renew");
      assert.ok(renewed.expiresAt! >= invitation.expiresAt!);
      const invitee = await register("invitee@example.test");
      assert.equal(invitee.user.adminRole, "Modérateur");
      const team = await list("team", "?pageSize=50");
      assert.ok(!team.items.some((m) => m.id === invitation.id));
      assert.equal(
        team.items.find((m) => m.id === invitee.user.id)!.role,
        "Modérateur",
      );
      const cancelled = await json<AdminRecord>(
        "/admin/team",
        "POST",
        { email: "later@example.test", role: "Support" },
        admin.cookie,
        201,
      );
      await json(
        `/admin/team/${cancelled.id}/actions`,
        "POST",
        { version: 1, action: "cancel", note: "Erreur d’adresse" },
        admin.cookie,
        204,
      );
    },
  );

  await t.test(
    "une demande de suppression est traitée par l’administration",
    async () => {
      const person = await register("leaving@example.test");
      await json(
        "/account/deletion-request",
        "POST",
        { message: "Je n’utilise plus le service." },
        person.cookie,
        201,
      );
      await json("/account/deletion-request", "POST", {}, person.cookie, 409);
      const request = (await list("deletions", "?scope=pending")).items.find(
        (d) => d.email === "leaving@example.test",
      )!;
      assert.equal(request.status, "À traiter");
      const done = await act("deletions", request, "delete");
      assert.equal(done.status, "Traitée");
      assert.equal(done.email, "");
      assert.equal(
        (await req("/dashboard", "GET", undefined, person.cookie)).status,
        401,
      );
      await session(
        "/auth/login",
        { email: "leaving@example.test", password: DEMO_PASSWORD },
        401,
      );
      const other = await register("staying@example.test");
      await json("/account/deletion-request", "POST", {}, other.cookie, 201);
      const second = (await list("deletions", "?scope=pending")).items.find(
        (d) => d.email === "staying@example.test",
      )!;
      assert.equal(
        (await act("deletions", second, "decline")).status,
        "Refusée",
      );
      assert.equal(
        (await req("/dashboard", "GET", undefined, other.cookie)).status,
        200,
      );
    },
  );

  await t.test(
    "une fiche publique signalée peut être masquée puis rétablie, avec sanction",
    async () => {
      const owner = await login("test2@gmail.com");
      const pet = (
        await json<Animal[]>("/animals", "GET", undefined, owner.cookie)
      )[0];
      const sheet = await json<EmergencySheet>(
        `/animals/${pet.id}/emergency`,
        "PUT",
        {
          active: true,
          photo: false,
          details: true,
          notes: false,
          contact: true,
          vet: false,
        },
        owner.cookie,
      );
      const token = sheet.snapshot
        .payload!.split("/#urgence/")[1]
        .split("?")[0];
      await json(`/public/emergency/${token}`);
      await json(
        `/public/emergency/${token}/report`,
        "POST",
        { message: "Le texte public contient une publicité." },
        owner.cookie,
        400,
      );
      const filed = await json<{ reference: string }>(
        `/public/emergency/${token}/report`,
        "POST",
        {
          name: "Publicité sur une fiche",
          message: "Le texte public contient une publicité.",
        },
        "",
        201,
      );
      let report = (await list("reports", "?pageSize=50")).items.find(
        (r) => r.reference === filed.reference,
      )!;
      assert.equal(report.targetType, "users");
      const context = await json<AdminRecord>(
        `/admin/reports/${report.id}`,
        "GET",
        undefined,
        admin.cookie,
      );
      assert.ok(context.choices!.includes("Profil masqué"));
      assert.equal(context.sanctionable, true);
      await act(
        "reports",
        report,
        "decide",
        { status: "Classé sans suite", accountAction: "Avertir le compte" },
        400,
      );
      report = await act("reports", report, "decide", {
        status: "Profil masqué",
        accountAction: "Avertir le compte",
      });
      assert.equal(report.accountAction, "Avertir le compte");
      assert.equal((await req(`/public/emergency/${token}`)).status, 451);
      const account = await json<AdminRecord>(
        `/admin/users/${owner.user.id}`,
        "GET",
        undefined,
        admin.cookie,
      );
      assert.equal(account.visibility, "Masqué");
      assert.ok(
        account.history!.some(
          (h) => h.action === "Avertissement après signalement",
        ),
      );
      report = await act("reports", report, "reopen");
      report = await act("reports", report, "decide", {
        status: "Profil rétabli",
      });
      assert.equal((await req(`/public/emergency/${token}`)).status, 200);
    },
  );

  await t.test(
    "un import validé est suivi, relancé et converti en ticket",
    async () => {
      const started = await json<{ id: string; status: string }>(
        "/imports",
        "POST",
        { name: "Carnet de santé — photo", kind: "Fichier" },
        regular.cookie,
        201,
      );
      assert.equal(started.status, "À analyser");
      await json(
        "/feedback",
        "POST",
        {
          name: "Rappel manquant",
          category: "Difficulté rencontrée",
          message: "Le rappel proposé n’a pas été retrouvé.",
          importId: started.id,
        },
        regular.cookie,
        201,
      );
      await json(
        "/feedback",
        "POST",
        {
          name: "x",
          category: "Suggestion",
          message: "y",
          importId: "inconnu",
        },
        regular.cookie,
        404,
      );
      let row = await json<AdminRecord>(
        `/admin/imports/${started.id}`,
        "GET",
        undefined,
        admin.cookie,
      );
      row = await act("imports", row, "retry");
      assert.equal(row.status, "Échoué");
      const ticket = await act("imports", row, "incident", {
        name: "Incident import",
      });
      assert.equal(ticket.importId, started.id);
      assert.equal(ticket.category, "Import IA");
      row = await json<AdminRecord>(
        `/admin/imports/${started.id}`,
        "GET",
        undefined,
        admin.cookie,
      );
      assert.equal(row.ticketId, ticket.id);
      assert.equal(row.status, "Pris en charge");
    },
  );

  await t.test(
    "les tentatives de connexion répétées créent une alerte à examiner",
    async () => {
      for (let i = 0; i < 5; i++)
        await session(
          "/auth/login",
          { email: "test3@gmail.com", password: "mauvais-mot-de-passe" },
          401,
        );
      const alert = (await list("security", "?scope=pending")).items.find(
        (s) =>
          s.name === "Tentatives de connexion répétées" &&
          s.message?.includes("test3@gmail.com") &&
          s.id !== "security-attempts",
      )!;
      assert.ok(alert, "alerte attendue");
      assert.ok(
        (await list("alerts", "?status=Non+lue")).items.some(
          (a) => a.id === alert.id,
        ),
      );
      const reviewed = await act("security", alert, "review");
      assert.equal(reviewed.status, "Examiné");
      await act("security", reviewed, "review", {}, 409);
    },
  );

  await t.test("un justificatif reçu est conservé et consultable", async () => {
    let pro = await json<AdminRecord>(
      "/admin/pros/maison",
      "GET",
      undefined,
      admin.cookie,
    );
    const missing = pro.documents!.find((d) => d.status === "Manquant")!;
    pro = await act("pros", pro, "proof-file", {
      document: missing.id,
      fileName: "attestation.png",
      file: { type: "image/png", content: PNG },
    });
    const received = pro.documents!.find((d) => d.id === missing.id)!;
    assert.equal(received.file, true);
    assert.equal(received.status, "À examiner");
    const file = await fetch(
      `${base}/admin/pros/maison/documents/${missing.id}/file`,
      {
        headers: { Cookie: admin.cookie },
      },
    );
    assert.equal(file.status, 200);
    assert.equal(file.headers.get("content-type"), "image/png");
    await json(
      `/admin/pros/maison/documents/${missing.id}/file`,
      "GET",
      undefined,
      regular.cookie,
      403,
    );
    await act(
      "pros",
      pro,
      "proof-file",
      { document: missing.id, file: { type: "text/plain", content: "abc" } },
      400,
    );
  });

  await t.test(
    "la diffusion d’une annonce compte ses destinataires",
    async () => {
      const draft = await json<AdminRecord>(
        "/admin/announcements",
        "POST",
        { name: "Bienvenue", audience: "Tous", message: "Bonne découverte." },
        admin.cookie,
        201,
      );
      const published = await act("announcements", draft, "publish");
      assert.ok((published.recipients ?? 0) >= 4);
    },
  );
});
