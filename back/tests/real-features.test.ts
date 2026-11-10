import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { openDatabase } from "../database/connection.ts";
import { createApi } from "../api/app.ts";
import type { DirectoryData } from "../../shared/account.ts";
import type {
  Animal,
  Dashboard,
  Document,
  ReceivedDocument,
} from "../../shared/models.ts";

test("Fonctions réelles : mot de passe oublié, partage entre comptes et e-mails", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "anivaya-real-")),
    outbox = join(directory, "outbox");
  // Sans SMTP, chaque e-mail est déposé dans la boîte locale du test.
  delete process.env.SMTP_HOST;
  process.env.MAIL_OUTBOX = outbox;
  const db = openDatabase(join(directory, "central.sqlite"));
  const server = createApi(db, {
    userDatabaseDirectory: join(directory, "accounts"),
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base =
    "http://127.0.0.1:" + (server.address() as AddressInfo).port + "/api";
  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
    delete process.env.MAIL_OUTBOX;
    rmSync(directory, { recursive: true, force: true });
  });
  const request = (
    route: string,
    method = "GET",
    body?: unknown,
    cookie = "",
  ) =>
    fetch(base + route, {
      method,
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  async function json<T>(
    route: string,
    method = "GET",
    body?: unknown,
    cookie = "",
    status = 200,
  ): Promise<T> {
    const response = await request(route, method, body, cookie);
    const result = await response.json();
    assert.equal(response.status, status, JSON.stringify(result));
    return result as T;
  }
  /** E-mails déposés pour une adresse, du plus ancien au plus récent. */
  const mails = (to: string) => {
    try {
      return readdirSync(outbox)
        .sort()
        .map((file) => readFileSync(join(outbox, file), "utf8"))
        .filter((mail) => mail.includes(`To: ${to}`));
    } catch {
      return [];
    }
  };
  async function register(name: string, email: string, password: string) {
    const response = await request("/auth/register", "POST", {
      name,
      email,
      password,
      confirmPassword: password,
    });
    assert.equal(response.status, 201);
    return response.headers.get("set-cookie")!.split(";")[0];
  }
  // La session d’inscription d’Alice n’est pas réutilisée : elle se reconnecte après le changement de mot de passe.
  await register("Alice", "alice@anivaya-courrier.fr", "Solide-mot 1");
  const bob = await register("Bob", "bob@anivaya-courrier.fr", "Solide-mot 2");

  await t.test(
    "le lien reçu par e-mail change réellement le mot de passe",
    async () => {
      assert.equal(
        (
          await request("/auth/password-reset", "POST", {
            email: "alice@anivaya-courrier.fr",
          })
        ).status,
        204,
      );
      // Adresse inconnue : même réponse, aucun e-mail.
      assert.equal(
        (
          await request("/auth/password-reset", "POST", {
            email: "personne@anivaya-courrier.fr",
          })
        ).status,
        204,
      );
      const mail = mails("alice@anivaya-courrier.fr").at(-1)!;
      const token = mail.match(/#mot-de-passe\/([\w-]+)/)![1];
      assert.equal(
        (await json<{ valid: boolean }>(`/auth/password-reset/${token}`)).valid,
        true,
      );
      await json(
        "/auth/password-reset/confirm",
        "POST",
        { token, password: "court", confirmPassword: "court" },
        "",
        400,
      );
      assert.equal(
        (
          await request("/auth/password-reset/confirm", "POST", {
            token,
            password: "Nouveau-mot 1",
            confirmPassword: "Nouveau-mot 1",
          })
        ).status,
        204,
      );
      // Le lien ne sert qu’une fois ; l’ancien mot de passe ne fonctionne plus.
      assert.equal(
        (await json<{ valid: boolean }>(`/auth/password-reset/${token}`)).valid,
        false,
      );
      assert.equal(
        (
          await request("/auth/login", "POST", {
            email: "alice@anivaya-courrier.fr",
            password: "Solide-mot 1",
          })
        ).status,
        401,
      );
      assert.equal(
        (
          await request("/auth/login", "POST", {
            email: "alice@anivaya-courrier.fr",
            password: "Nouveau-mot 1",
          })
        ).status,
        200,
      );
    },
  );

  // Alice s’est reconnectée : nouvelle session.
  const aliceAgain = (
    await request("/auth/login", "POST", {
      email: "alice@anivaya-courrier.fr",
      password: "Nouveau-mot 1",
    })
  ).headers
    .get("set-cookie")!
    .split(";")[0];

  await t.test(
    "un document partagé arrive chez le destinataire, puis son accès est retiré",
    async () => {
      const pet = await json<Animal>(
        "/animals",
        "POST",
        { name: "Plume", species: "Chat" },
        aliceAgain,
        201,
      );
      const pdf = Buffer.from("%PDF-1.4\nCarnet de Plume").toString("base64");
      const doc = await json<Document>(
        "/documents",
        "POST",
        {
          name: "Carnet de Plume",
          animal: pet.id,
          category: "Santé",
          type: "application/pdf",
          content: pdf,
        },
        aliceAgain,
        201,
      );
      const until = new Date(Date.now() + 10 * 86400000)
        .toISOString()
        .slice(0, 10);
      await json(
        "/shares",
        "POST",
        {
          documents: [doc.id],
          until,
          recipient: "Bob",
          email: "bob@anivaya-courrier.fr",
        },
        aliceAgain,
        201,
      );
      assert.ok(
        mails("bob@anivaya-courrier.fr").some((m) =>
          m.includes("Carnet de Plume"),
        ),
      );
      let received = (
        await json<Dashboard>("/dashboard", "GET", undefined, bob)
      ).receivedShares;
      const invitation = received.find((s) => s.title === "Carnet de Plume")!;
      assert.equal(invitation.state, "pending");
      assert.equal(invitation.content, null);
      const accepted = await json<{ content: ReceivedDocument }>(
        `/received-shares/${invitation.id}`,
        "PATCH",
        { status: "accepted" },
        bob,
      );
      // L’adresse renvoyée inclut déjà /api.
      const direct = await fetch(
        base.replace(/\/api$/, "") + accepted.content.file,
        {
          headers: { Cookie: bob },
        },
      );
      assert.equal(direct.status, 200);
      assert.equal(direct.headers.get("content-type"), "application/pdf");
      // Un autre compte ne peut pas lire ce partage.
      assert.equal(
        (
          await request(
            `/received-shares/${invitation.id}/file`,
            "GET",
            undefined,
            aliceAgain,
          )
        ).status,
        404,
      );
      const { shares } = await json<{ shares: { id: string }[] }>(
        "/sharing",
        "GET",
        undefined,
        aliceAgain,
      );
      await request(`/shares/${shares[0].id}`, "DELETE", undefined, aliceAgain);
      received = (await json<Dashboard>("/dashboard", "GET", undefined, bob))
        .receivedShares;
      assert.equal(
        received.find((s) => s.id === invitation.id)!.state,
        "revoked",
      );
      assert.equal(
        (
          await request(
            `/received-shares/${invitation.id}/file`,
            "GET",
            undefined,
            bob,
          )
        ).status,
        403,
      );
    },
  );

  await t.test(
    "une personne non inscrite reçoit l’e-mail et retrouve le partage en créant son compte",
    async () => {
      const pet = (
        await json<Dashboard>("/dashboard", "GET", undefined, aliceAgain)
      ).animals.find((a) => a.name === "Plume")!;
      const doc = await json<Document>(
        "/documents",
        "POST",
        {
          name: "Ordonnance de Plume",
          animal: pet.id,
          category: "Santé",
          type: "application/pdf",
          content: Buffer.from("%PDF-1.4 Ordonnance").toString("base64"),
        },
        aliceAgain,
        201,
      );
      await json(
        "/shares",
        "POST",
        {
          documents: [doc.id],
          until: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
          recipient: "Chloé",
          email: "chloe@anivaya-courrier.fr",
        },
        aliceAgain,
        201,
      );
      const mail = mails("chloe@anivaya-courrier.fr").at(-1)!;
      assert.ok(mail.includes("Ordonnance de Plume"));
      assert.ok(mail.includes("#inscription"));
      const chloe = await register(
        "Chloé",
        "chloe@anivaya-courrier.fr",
        "Chloé-2026!",
      );
      const received = (
        await json<Dashboard>("/dashboard", "GET", undefined, chloe)
      ).receivedShares;
      assert.equal(
        received.find((s) => s.title === "Ordonnance de Plume")?.state,
        "pending",
      );
    },
  );

  await t.test(
    "la règle du mot de passe est appliquée à l’inscription",
    async () => {
      for (const password of [
        "Court-1",
        "sansmajuscule!",
        "SANSMINUSCULE!",
        "SansSpecial1",
      ])
        assert.equal(
          (
            await request("/auth/register", "POST", {
              name: "Règle",
              email: "regle@anivaya-courrier.fr",
              password,
              confirmPassword: password,
            })
          ).status,
          400,
          password,
        );
    },
  );

  await t.test(
    "une réservation envoie sa confirmation sans prétendre encaisser",
    async () => {
      const data = await json<DirectoryData>(
        "/directory",
        "GET",
        undefined,
        aliceAgain,
      );
      const pet = (
        await json<Dashboard>("/dashboard", "GET", undefined, aliceAgain)
      ).animals.find((a) => a.name === "Plume")!;
      const pro = data.professionals.find((p) => p.species.includes("Chat"))!;
      const date = new Date(data.today + "T12:00:00Z");
      date.setUTCDate(date.getUTCDate() + 3);
      const booking = await json<{ id: string }>(
        "/bookings",
        "POST",
        {
          professional: pro.id,
          animal: pet.id,
          service: 0,
          date: date.toISOString().slice(0, 10),
          time: "10:30",
          contactName: "Alice",
          email: "alice@anivaya-courrier.fr",
          note: "",
        },
        aliceAgain,
        201,
      );
      const received = mails("alice@anivaya-courrier.fr");
      assert.ok(received.some((m) => m.includes("Rendez-vous confirmé")));
      assert.ok(received.some((m) => m.includes("Aucun paiement en ligne effectué")));
      await json(
        `/bookings/${booking.id}`,
        "PATCH",
        { status: "cancelled" },
        aliceAgain,
      );
      assert.ok(
        mails("alice@anivaya-courrier.fr").some((m) =>
          m.includes("Aucun paiement en ligne ni remboursement effectué"),
        ),
      );
    },
  );
});
