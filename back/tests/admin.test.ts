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
import type {
  AdminRecord,
  AdminList,
  AdminOverview,
} from "../../shared/admin.ts";
import type { AdminAnalytics } from "../../shared/analytics.ts";
import type { AuthUser, DirectoryData } from "../../shared/account.ts";

test("Administration : rôles, dossiers réels, publication, modération, concurrence et persistance", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "anivaya-admin-tests-")),
    path = join(directory, "central.sqlite");
  let db = openDatabase(path),
    server = createApi(db, {
      userDatabaseDirectory: join(directory, "accounts"),
    }),
    base = "";
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
  async function login(email: string) {
    const res = await req("/auth/login", "POST", {
      email,
      password: DEMO_PASSWORD,
    });
    assert.equal(res.status, 200, await res.clone().text());
    return {
      cookie: res.headers.get("set-cookie")!.split(";")[0],
      user: (await res.json()) as AuthUser,
    };
  }
  async function register(email: string) {
    const res = await req("/auth/register", "POST", {
      email,
      name: email.split("@")[0],
      password: DEMO_PASSWORD,
      confirmPassword: DEMO_PASSWORD,
      adminRole: "Administrateur",
    });
    assert.equal(res.status, 201);
    return {
      cookie: res.headers.get("set-cookie")!.split(";")[0],
      user: (await res.json()) as AuthUser,
    };
  }
  const admin = await login("admin@anivaya.fr"),
    regular = await login("test@gmail.com"),
    vet = await register("vet@example.test"),
    support = await register("support@example.test");
  const list = (r: string, cookie = admin.cookie, query = "") =>
    json<AdminList>(`/admin/${r}${query}`, "GET", undefined, cookie);
  const act = (
    r: string,
    row: AdminRecord,
    action: string,
    data: Record<string, unknown> = {},
    cookie = admin.cookie,
    status = 200,
  ) =>
    json<AdminRecord>(
      `/admin/${r}/${row.id}/actions`,
      "POST",
      { version: row.version, action, note: "Motif de test vérifié", ...data },
      cookie,
      status,
    );
  let article: AdminRecord, report: AdminRecord, appeal: AdminRecord;
  await t.test(
    "les indicateurs et les aperçus utilisent les mêmes dossiers et permissions",
    async () => {
      const overview = await json<AdminOverview>(
        "/admin/overview",
        "GET",
        undefined,
        admin.cookie,
      );
      for (const indicator of overview.indicators) {
        const preview = await list(
          indicator.resource,
          admin.cookie,
          "?" + indicator.query + "&pageSize=5",
        );
        assert.equal(indicator.count, preview.total);
        assert.ok(preview.items.length <= 5);
      }
      assert.ok(overview.indicators.some((i) => i.id === "active-users"));
      assert.ok(overview.indicators.some((i) => i.id === "validated-pros"));
      assert.equal(
        overview.pending.find((g) => g.resource === "pros")!.total,
        (await list("pros", admin.cookie, "?scope=pending")).total,
      );
      const pro = (await list("pros")).items[0];
      assert.equal(
        (
          await json<AdminRecord>(
            `/admin/pros/${pro.id}`,
            "GET",
            undefined,
            admin.cookie,
          )
        ).id,
        pro.id,
      );
      await json(
        `/admin/pros/${pro.id}`,
        "GET",
        undefined,
        regular.cookie,
        403,
      );
    },
  );
  await t.test(
    "refuse les accès anonymes, les rôles forgés et les actions hors périmètre",
    async () => {
      assert.equal((await req("/admin/overview")).status, 401);
      assert.equal(
        (await req("/admin/users", "GET", undefined, regular.cookie)).status,
        403,
      );
      assert.equal(vet.user.adminRole, undefined);
      await json(
        "/admin/team",
        "POST",
        { email: "vet@example.test", role: "Vétérinaire référent" },
        admin.cookie,
        201,
      );
      await json(
        "/admin/team",
        "POST",
        { email: "support@example.test", role: "Support" },
        admin.cookie,
        201,
      );
      assert.equal(
        (await req("/admin/history", "GET", undefined, support.cookie)).status,
        403,
      );
      const me = (await list("team")).items.find(
        (a) => a.id === admin.user.id,
      )!;
      await act(
        "team",
        me,
        "save",
        { role: "Support", status: "Actif" },
        admin.cookie,
        409,
      );
      assert.equal(
        (
          await req(
            "/account",
            "DELETE",
            { confirmation: "SUPPRIMER" },
            admin.cookie,
          )
        ).status,
        409,
      );
    },
  );
  await t.test(
    "enregistre un contact, le retrouve en assistance et conserve la réponse privée",
    async () => {
      await json(
        "/public/contact",
        "POST",
        {
          name: "Test",
          email: "test@gmail.com",
          subject: "Document inaccessible",
          message: "Je ne peux pas ouvrir mon document.",
        },
        regular.cookie,
        201,
      );
      const ticket = (await list("tickets", support.cookie)).items[0];
      assert.equal(ticket.name, "Document inaccessible");
      await act(
        "tickets",
        ticket,
        "reply",
        {
          status: "Résolu",
          note: "Le document est disponible dans votre carnet.",
        },
        support.cookie,
      );
      const own = await json<AdminRecord[]>(
        "/support",
        "GET",
        undefined,
        regular.cookie,
      );
      assert.equal(own[0].status, "Résolu");
      assert.equal(own[0].history!.at(-1)!.actor, "Équipe Anivaya");
      assert.equal(
        (await json<AdminRecord[]>("/support", "GET", undefined, vet.cookie))
          .length,
        0,
      );
      await act(
        "tickets",
        ticket,
        "reply",
        { status: "Ouvert" },
        support.cookie,
        409,
      );
    },
  );
  await t.test(
    "impose une relecture distincte, publie la version validée et préserve le guide pendant sa révision",
    async () => {
      article = await json<AdminRecord>(
        "/admin/library",
        "POST",
        {
          name: "Préparer un relais",
          summary: "Les informations utiles.",
          body: "Préparez les contacts et les documents de votre animal.",
        },
        admin.cookie,
        201,
      );
      await act("library", article, "publish", {}, admin.cookie, 409);
      article = await act("library", article, "submit");
      await act(
        "library",
        article,
        "review",
        { status: "Validé" },
        admin.cookie,
        403,
      );
      article = await act(
        "library",
        article,
        "review",
        { status: "Validé" },
        vet.cookie,
      );
      await act("library", article, "publish", {}, vet.cookie, 403);
      article = await act("library", article, "publish");
      let published = await json<{ guides: { id: string; version: number }[] }>(
        "/public/resources",
      );
      assert.equal(
        published.guides.find((g) => g.id === article.id)?.version,
        1,
      );
      article = await act("library", article, "version");
      published = await json("/public/resources");
      assert.equal(
        published.guides.find((g) => g.id === article.id)?.version,
        1,
      );
      await act(
        "library",
        article,
        "save",
        { name: "Attaque", summary: "Sans droit", body: "Interdit" },
        support.cookie,
        403,
      );
    },
  );
  await t.test(
    "modère les professionnels de l'annuaire, reçoit un recours lié au bon compte",
    async () => {
      const pro = (await list("pros")).items[0];
      const filed = await json<{ id: string }>(
        "/reports",
        "POST",
        {
          targetType: "pros",
          target: pro.id,
          name: "Information à vérifier",
          message: "La présentation ne semble pas correspondre à la fiche.",
        },
        regular.cookie,
        201,
      );
      report = await json<AdminRecord>(
        `/admin/reports/${filed.id}`,
        "GET",
        undefined,
        admin.cookie,
      );
      report = await act("reports", report, "decide", {
        status: "Fiche suspendue",
      });
      const directory = await json<DirectoryData>(
        "/directory",
        "GET",
        undefined,
        regular.cookie,
      );
      assert.equal(
        directory.professionals.some((p) => p.id === pro.id),
        false,
      );
      await json(
        `/professionals/${pro.id}/slots?date=2099-01-01`,
        "GET",
        undefined,
        regular.cookie,
        409,
      );
      await json(
        "/bookings",
        "POST",
        { professional: pro.id },
        regular.cookie,
        409,
      );
      await json(
        `/professionals/${pro.id}/favorite`,
        "PUT",
        { favorite: true },
        regular.cookie,
        409,
      );
      await json(
        "/appeals",
        "POST",
        {
          reference: report.reference,
          message: "Je souhaite apporter une précision.",
        },
        vet.cookie,
        404,
      );
      appeal = await json<AdminRecord>(
        "/appeals",
        "POST",
        {
          reference: report.reference,
          message: "Je souhaite apporter une précision.",
        },
        regular.cookie,
        201,
      );
      await json(
        "/appeals",
        "POST",
        { reference: report.reference, message: "Nouvelle précision." },
        regular.cookie,
        409,
      );
      appeal = await act("appeals", appeal, "decide", {
        status: "Réexamen demandé",
      });
      assert.equal(
        (
          await json<AdminRecord>(
            `/admin/reports/${report.id}`,
            "GET",
            undefined,
            admin.cookie,
          )
        ).status,
        "À traiter",
      );
    },
  );
  await t.test(
    "valide la pagination, filtre côté serveur et suspend immédiatement les sessions",
    async () => {
      const first = await list("users", admin.cookie, "?pageSize=2&page=1");
      assert.equal(first.items.length, 2);
      assert.ok(first.total > 2);
      const filtered = await list(
        "users",
        admin.cookie,
        "?q=vet%40example.test&page=999",
      );
      assert.equal(filtered.total, 1);
      assert.equal(filtered.page, 1);
      await act(
        "users",
        filtered.items[0],
        "save",
        { status: "Suspendu" },
        support.cookie,
        403,
      );
      await act("users", filtered.items[0], "save", { status: "Suspendu" });
      assert.equal(
        (await req("/dashboard", "GET", undefined, vet.cookie)).status,
        401,
      );
      assert.equal(
        (
          await req("/auth/login", "POST", {
            email: "vet@example.test",
            password: DEMO_PASSWORD,
          })
        ).status,
        403,
      );
    },
  );
  await t.test(
    "conserve dossiers et journal après réouverture de la base",
    async () => {
      const history = (await list("history")).total;
      assert.ok(history >= 10);
      await new Promise<void>((resolve) => server.close(() => resolve()));
      db.close();
      db = openDatabase(path);
      server = createApi(db, {
        userDatabaseDirectory: join(directory, "accounts"),
      });
      await start();
      assert.equal((await list("history")).total, history);
      assert.equal((await list("appeals")).items[0].status, "Réexamen demandé");
      assert.equal(
        (
          await json<{ guides: { id: string }[] }>("/public/resources")
        ).guides.some((g) => g.id === article.id),
        true,
      );
    },
  );
  await t.test(
    "le pilotage mesure les foyers de l’installation, filtre les cohortes et refuse le support",
    async () => {
      // L’ouverture de l’administration ajoute les foyers d’exemple datés.
      await json("/admin/overview", "GET", undefined, admin.cookie);
      const actual = await json<AdminAnalytics>(
        "/admin/analytics",
        "GET",
        undefined,
        admin.cookie,
      );
      assert.equal(actual.available, true);
      assert.ok(actual.channels.includes("Partenaire vétérinaire"));
      assert.equal(actual.retention.length, 3);
      assert.ok(actual.cohorts.reduce((n, c) => n + c.households, 0) >= 24);
      const filtered = await json<AdminAnalytics>(
        "/admin/analytics?zone=Lyon&channel=Partenaire+v%C3%A9t%C3%A9rinaire",
        "GET",
        undefined,
        admin.cookie,
      );
      assert.equal(
        filtered.cohorts.reduce((n, c) => n + c.households, 0),
        2,
      );
      await json("/admin/analytics", "GET", undefined, support.cookie, 403);
    },
  );
  await t.test(
    "un retour crée un ticket lié au bon compte et les notifications sont propres à chaque membre",
    async () => {
      const feedback = await json<AdminRecord>(
        "/feedback",
        "POST",
        {
          name: "Date à corriger",
          category: "Information incorrecte",
          message: "La date de l’exemple ne correspond pas.",
        },
        regular.cookie,
        201,
      );
      const ticket = await act(
        "feedback",
        feedback,
        "ticket",
        {},
        support.cookie,
      );
      assert.equal(ticket.feedbackId, feedback.id);
      const updated = await json<AdminRecord>(
        `/admin/feedback/${feedback.id}`,
        "GET",
        undefined,
        support.cookie,
      );
      assert.equal(updated.ticketId, ticket.id);
      const privateRows = await json<AdminRecord[]>(
        "/support",
        "GET",
        undefined,
        regular.cookie,
      );
      assert.ok(privateRows.some((r) => r.id === ticket.id));
      const alerts = await list("alerts", support.cookie);
      assert.ok(
        alerts.items.some(
          (r) => r.id === ticket.id && r.resource === "tickets",
        ),
      );
      await json(
        "/admin/alerts/all/actions",
        "POST",
        { action: "read-all" },
        support.cookie,
        204,
      );
      assert.equal(
        (await list("alerts", support.cookie, "?status=Non+lue")).total,
        0,
      );
      assert.ok(
        (await list("alerts", admin.cookie, "?status=Non+lue")).total > 0,
      );
    },
  );
  await t.test(
    "les contrôles des justificatifs conservent leur historique et un brouillon supprimé disparaît",
    async () => {
      let pro = (await list("pros")).items[0];
      const controls = pro.documents![0].history?.length ?? 0;
      pro = await act("pros", pro, "proof", {
        document: pro.documents![0].id,
        status: "À corriger",
        applicable: true,
        expires: "",
      });
      assert.equal(pro.documents![0].history!.length, controls + 1);
      const draft = await json<AdminRecord>(
        "/admin/announcements",
        "POST",
        {
          name: "Brouillon temporaire",
          audience: "Tous",
          message: "Texte de vérification",
        },
        admin.cookie,
        201,
      );
      await json(
        `/admin/announcements/${draft.id}/actions`,
        "POST",
        {
          action: "delete",
          version: draft.version,
          note: "Brouillon créé pour ce test",
        },
        admin.cookie,
        204,
      );
      await json(
        `/admin/announcements/${draft.id}`,
        "GET",
        undefined,
        admin.cookie,
        404,
      );
    },
  );
  await t.test(
    "la modification des coordonnées est réservée à l’administrateur et synchronisée avec le compte",
    async () => {
      const person = await register("coordinates@example.test");
      let row = (
        await list("users", admin.cookie, "?q=coordinates%40example.test")
      ).items[0];
      await act(
        "users",
        row,
        "edit",
        {
          name: "Coordonnées modifiées",
          email: "coordinates-new@example.test",
        },
        support.cookie,
        403,
      );
      row = await act("users", row, "edit", {
        name: "Coordonnées modifiées",
        email: "coordinates-new@example.test",
      });
      assert.equal(row.email, "coordinates-new@example.test");
      const profile = await json<AuthUser>(
        "/auth/session",
        "GET",
        undefined,
        person.cookie,
      );
      assert.equal(profile.profile.email, "coordinates-new@example.test");
      assert.equal(profile.profile.name, "Coordonnées modifiées");
      await login("coordinates-new@example.test");
      await act(
        "users",
        row,
        "edit",
        { name: "Doublon", email: "support@example.test" },
        admin.cookie,
        409,
      );
    },
  );
  await t.test(
    "supprimer un guide retire aussi sa version publique et reste réservé à l’administrateur",
    async () => {
      const current = await json<AdminRecord>(
        `/admin/library/${article.id}`,
        "GET",
        undefined,
        admin.cookie,
      );
      await act("library", current, "delete", {}, support.cookie, 403);
      await act("library", current, "delete", {}, admin.cookie, 204);
      await json(
        `/admin/library/${current.id}`,
        "GET",
        undefined,
        admin.cookie,
        404,
      );
      const resources = await json<{ guides: { id: string }[] }>(
        "/public/resources",
      );
      assert.equal(
        resources.guides.some((g) => g.id === current.id),
        false,
      );
    },
  );
  await t.test(
    "les tris s’appliquent avant pagination et l’édition professionnelle conserve sa décision",
    async () => {
      const asc = await list(
        "pros",
        admin.cookie,
        "?sort=name&direction=asc&pageSize=2",
      );
      const desc = await list(
        "pros",
        admin.cookie,
        "?sort=name&direction=desc&pageSize=2",
      );
      assert.equal(asc.items[0].name, "Bulle de poils");
      assert.equal(desc.items[0].name, "La Maison des pattes");
      const row = asc.items[0];
      const changed = await json<AdminRecord>(
        `/admin/pros/${row.id}/actions`,
        "POST",
        {
          action: "edit",
          version: row.version,
          name: row.name,
          email: "contact@example.test",
          city: row.city,
          category: row.category,
          body: "Présentation actualisée",
        },
        admin.cookie,
      );
      assert.equal(changed.email, "contact@example.test");
      assert.equal(changed.status, row.status);
      assert.deepEqual(changed.documents, row.documents);
      await act(
        "pros",
        changed,
        "edit",
        {
          name: row.name,
          email: "wrong",
          city: row.city,
          category: row.category,
        },
        admin.cookie,
        400,
      );
      await act(
        "pros",
        changed,
        "edit",
        {
          name: row.name,
          email: "contact@example.test",
          city: row.city,
          category: row.category,
        },
        support.cookie,
        403,
      );
      const history = (
        await list(
          "history",
          admin.cookie,
          "?sort=name&direction=asc&pageSize=50",
        )
      ).items.map((r) => r.name);
      assert.deepEqual(
        history,
        [...history].sort((a, b) =>
          a.toLowerCase() < b.toLowerCase()
            ? -1
            : a.toLowerCase() > b.toLowerCase()
              ? 1
              : 0,
        ),
      );
      const alerts = (
        await list(
          "alerts",
          admin.cookie,
          "?sort=name&direction=asc&pageSize=50",
        )
      ).items.map((r) => r.name);
      assert.deepEqual(
        alerts,
        [...alerts].sort((a, b) => a.localeCompare(b, "fr")),
      );
    },
  );
});
