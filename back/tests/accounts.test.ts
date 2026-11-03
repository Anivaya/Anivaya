import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { openDatabase } from "../database/connection.ts";
import { createApi } from "../api/app.ts";
import { demoAccounts, demoCredentials } from "../api/auth.ts";
import type {
  AuthUser,
  DirectoryData,
  Booking,
  Profile,
} from "../../shared/account.ts";
import type {
  Animal,
  Dashboard,
  EmergencySheet,
  Document,
  ReceivedShare,
  ReceivedAnimal,
} from "../../shared/models.ts";

test("Comptes réels : sessions, isolation, profil, annuaire, réservations et QR public", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "anivaya-accounts-")),
    path = join(directory, "central.sqlite");
  let db = openDatabase(path),
    server = createApi(db, {
      userDatabaseDirectory: join(directory, "accounts"),
    }),
    base = "";
  async function start() {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    base =
      "http://127.0.0.1:" + (server.address() as AddressInfo).port + "/api";
  }
  await start();
  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
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
  let demo = "",
    alice = "",
    bob = "";
  let pet: Animal;
  let doc: Document;
  let aliceProfile: Profile;
  let booking: Booking;
  let publicRoute = "";
  let day = "";
  await t.test(
    "refuse l’accès anonyme et crée une session HttpOnly avec les identifiants affichés",
    async () => {
      assert.equal((await request("/dashboard")).status, 401);
      assert.equal(await json("/auth/session"), null);
      // Les identifiants des comptes de démonstration ne sont plus exposés par l’API.
      assert.ok((await request("/auth/demo")).status >= 400);
      assert.equal(
        (
          await request("/auth/login", "POST", {
            ...demoCredentials,
            password: "incorrect",
          })
        ).status,
        401,
      );
      const response = await request("/auth/login", "POST", demoCredentials);
      assert.equal(response.status, 200);
      const cookie = response.headers.get("set-cookie")!;
      assert.match(cookie, /HttpOnly/);
      assert.match(cookie, /SameSite=Strict/);
      demo = cookie.split(";")[0];
      const dashboard = await json<Dashboard>(
        "/dashboard",
        "GET",
        undefined,
        demo,
      );
      assert.equal(dashboard.animals.length, 2);
      assert.equal(
        (
          await fetch(base + "/auth/login", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Origin: "https://untrusted.example",
            },
            body: JSON.stringify(demoCredentials),
          })
        ).status,
        403,
      );
    },
  );
  await t.test(
    "inscrit deux comptes privés, garde les espaces vides et protège les mots de passe",
    async () => {
      const password = "  Mon mot de passe 2026!  ";
      const body = {
        name: "Alice Test",
        email: "alice@example.test",
        password,
        confirmPassword: password,
      };
      assert.equal(
        (
          await request("/auth/register", "POST", {
            ...body,
            password: "short",
            confirmPassword: "short",
          })
        ).status,
        400,
      );
      const a = await request("/auth/register", "POST", body);
      assert.equal(a.status, 201);
      alice = a.headers.get("set-cookie")!.split(";")[0];
      aliceProfile = ((await a.json()) as AuthUser).profile;
      const b = await request("/auth/register", "POST", {
        ...body,
        name: "Bob Test",
        email: "bob@example.test",
      });
      assert.equal(b.status, 201);
      bob = b.headers.get("set-cookie")!.split(";")[0];
      assert.equal((await request("/auth/register", "POST", body)).status, 409);
      for (const cookie of [alice, bob]) {
        const d = await json<Dashboard>("/dashboard", "GET", undefined, cookie);
        for (const values of [
          d.animals,
          d.documents,
          d.reminders,
          d.people,
          d.shares,
          d.events,
          d.emergencySheets,
        ])
          assert.equal(values.length, 0);
        assert.deepEqual(
          d.notifications.map((n) => [n.id, n.read]),
          [["bienvenue", false]],
        );
      }
      assert.notEqual(
        db
          .prepare("SELECT password FROM accounts WHERE email=?")
          .get<{ password: string }>(body.email)!.password,
        password,
      );
      assert.equal(
        (
          await request("/auth/login", "POST", {
            email: body.email,
            password: password.trim(),
          })
        ).status,
        401,
      );
      assert.equal(
        (await request("/auth/login", "POST", { email: body.email, password }))
          .status,
        200,
      );
      pet = await json<Animal>(
        "/animals",
        "POST",
        {
          name: "Pixel",
          species: "Chien",
          contact: "Alice · alice@example.test",
          identifier: "PRIVATE-ID-12345",
          behavior: "Approcher calmement",
          vet: "Private vet",
        },
        alice,
        201,
      );
      doc = await json<Document>(
        "/documents",
        "POST",
        {
          name: "Secret",
          animal: pet.id,
          category: "Autre",
          type: "application/pdf",
          content: Buffer.from("%PDF-1.4\nPrivate test document").toString(
            "base64",
          ),
        },
        alice,
        201,
      );
      for (const route of [
        "/animals/" + pet.id,
        "/animals/" + pet.id + "/photo",
        "/documents/" + doc.id + "/file",
      ])
        assert.equal((await request(route, "GET", undefined, bob)).status, 404);
      assert.equal(
        (await request("/animals/" + pet.id, "PATCH", { name: "Stolen" }, bob))
          .status,
        404,
      );
      assert.equal(
        (await json<Dashboard>("/dashboard", "GET", undefined, bob)).animals
          .length,
        0,
      );
    },
  );
  await t.test(
    "enregistre le profil et les préférences sans toucher au compte voisin",
    async () => {
      aliceProfile = await json<Profile>(
        "/profile",
        "PATCH",
        {
          ...aliceProfile,
          name: "Alice Nouvelle",
          city: "Lyon",
          notifications: {
            reminders: false,
            reservations: true,
            shares: false,
          },
        },
        alice,
      );
      assert.equal(
        (await json<Profile>("/profile", "GET", undefined, alice)).city,
        "Lyon",
      );
      assert.equal(
        (await json<Profile>("/profile", "GET", undefined, bob)).city,
        "",
      );
      assert.equal(
        (
          await request(
            "/profile",
            "PATCH",
            { ...aliceProfile, email: "bob@example.test" },
            alice,
          )
        ).status,
        409,
      );
      assert.equal(
        (
          await request(
            "/profile",
            "PATCH",
            {
              ...aliceProfile,
              photo: { type: "image/webp", content: "aW52YWxpZA==" },
            },
            alice,
          )
        ).status,
        400,
      );
      assert.equal(
        (await json<Dashboard>("/dashboard", "GET", undefined, alice)).household
          .firstName,
        "Alice",
      );
    },
  );
  await t.test(
    "favoris privés, paiement refusé sans réservation et conflit de créneau",
    async () => {
      const data = await json<DirectoryData>(
          "/directory",
          "GET",
          undefined,
          alice,
        ),
        pro = data.professionals[0];
      assert.equal(data.professionals.length, 6);
      const date = new Date(data.today + "T12:00:00Z");
      date.setUTCDate(date.getUTCDate() + 2);
      day = date.toISOString().slice(0, 10);
      assert.equal(
        (
          await request(
            "/professionals/" + pro.id + "/favorite",
            "PUT",
            { favorite: true },
            alice,
          )
        ).status,
        204,
      );
      assert.deepEqual(
        (await json<DirectoryData>("/directory", "GET", undefined, alice))
          .favorites,
        [pro.id],
      );
      assert.deepEqual(
        (await json<DirectoryData>("/directory", "GET", undefined, bob))
          .favorites,
        [],
      );
      const input = {
        professional: pro.id,
        animal: pet.id,
        service: 0,
        date: day,
        time: "09:00",
        contactName: "Alice Nouvelle",
        email: "alice@example.test",
        note: "Test",
      };
      assert.equal(
        (await json<DirectoryData>("/directory", "GET", undefined, alice))
          .bookings.length,
        0,
      );
      assert.equal(
        (await request("/bookings", "POST", input, bob)).status,
        400,
      );
      const competing = await Promise.all([
        request("/bookings", "POST", input, alice),
        request("/bookings", "POST", input, alice),
      ]);
      assert.deepEqual(competing.map((r) => r.status).sort(), [201, 409]);
      booking = (await competing
        .find((r) => r.status === 201)!
        .json()) as Booking;
      assert.equal(booking.price, pro.services[0].price);
      assert.equal(
        (
          await request(
            "/bookings/" + booking.id,
            "PATCH",
            { status: "cancelled" },
            bob,
          )
        ).status,
        404,
      );
      const slots = await json<{ time: string; available: boolean }[]>(
        "/professionals/" + pro.id + "/slots?date=" + day,
        "GET",
        undefined,
        alice,
      );
      assert.equal(slots.find((s) => s.time === "09:00")!.available, false);
      assert.equal(slots.find((s) => s.time === "12:00")!.available, false);
      assert.equal(
        (await request("/bookings", "POST", { ...input, time: "12:00" }, alice))
          .status,
        400,
      );
      booking = await json<Booking>(
        "/bookings/" + booking.id,
        "PATCH",
        { date: day, time: "10:30" },
        alice,
      );
      assert.equal(booking.time, "10:30");
    },
  );
  await t.test(
    "QR public limité aux champs sélectionnés, désactivation et suppression révoquent l’accès",
    async () => {
      const settings = {
        active: true,
        photo: false,
        details: false,
        notes: false,
        contact: true,
        vet: false,
      };
      const sheet = await json<EmergencySheet>(
        "/animals/" + pet.id + "/emergency",
        "PUT",
        settings,
        alice,
      );
      assert.match(
        sheet.snapshot.payload!,
        new RegExp("^http.*/#urgence/[a-f0-9]{48}"),
      );
      const token = sheet.snapshot
        .payload!.split("/#urgence/")[1]
        .split("?")[0];
      publicRoute = "/public/emergency/" + token;
      const publicSheet = await json<Record<string, unknown>>(publicRoute);
      assert.equal(publicSheet.name, "Pixel");
      assert.equal(publicSheet.contact, pet.contact);
      assert.equal(publicSheet.notes, "");
      assert.equal(publicSheet.vet, "");
      assert.ok(!JSON.stringify(publicSheet).includes(pet.identifier));
      assert.equal((await request(publicRoute + "/photo")).status, 404);
      const preview = await json<EmergencySheet>(
        "/animals/" + pet.id + "/emergency/preview",
        "POST",
        { ...settings, notes: true },
        alice,
      );
      assert.notEqual(preview.snapshot.payload, sheet.snapshot.payload);
      assert.equal(
        (await json<Record<string, unknown>>(publicRoute)).notes,
        "",
      );
      await json(
        "/animals/" + pet.id + "/emergency",
        "PUT",
        { ...settings, active: false },
        alice,
      );
      assert.equal((await request(publicRoute)).status, 410);
      await json("/animals/" + pet.id + "/emergency", "PUT", settings, alice);
      assert.equal((await request(publicRoute)).status, 200);
      assert.equal(
        (
          await request(
            "/animals/" + pet.id + "/emergency",
            "DELETE",
            undefined,
            alice,
          )
        ).status,
        204,
      );
      assert.equal((await request(publicRoute)).status, 404);
      const next = await json<EmergencySheet>(
        "/animals/" + pet.id + "/emergency",
        "PUT",
        settings,
        alice,
      );
      assert.notEqual(next.snapshot.payload, sheet.snapshot.payload);
      assert.equal((await request(publicRoute)).status, 404);
    },
  );
  await t.test(
    "persiste après réouverture, annule une réservation et invalide la session à la déconnexion",
    async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      db.close();
      db = openDatabase(path);
      server = createApi(db, {
        userDatabaseDirectory: join(directory, "accounts"),
      });
      await start();
      assert.equal(
        (await json<AuthUser>("/auth/session", "GET", undefined, alice)).profile
          .name,
        "Alice Nouvelle",
      );
      assert.equal(
        (await json<DirectoryData>("/directory", "GET", undefined, alice))
          .bookings[0].time,
        "10:30",
      );
      const cancelled = await json<Booking>(
        "/bookings/" + booking.id,
        "PATCH",
        { status: "cancelled" },
        alice,
      );
      assert.equal(cancelled.status, "cancelled");
      assert.ok(cancelled.cancelledAt);
      assert.equal(
        (
          await request(
            "/bookings/" + booking.id,
            "PATCH",
            { date: day, time: "14:00" },
            alice,
          )
        ).status,
        409,
      );
      assert.equal(
        (await request("/auth/logout", "POST", {}, alice)).status,
        204,
      );
      assert.equal(
        (await request("/dashboard", "GET", undefined, alice)).status,
        401,
      );
      assert.equal(await json("/auth/session", "GET", undefined, alice), null);
    },
  );
  await t.test(
    "comptes de démonstration isolés, partages reçus, export et suppression",
    async () => {
      const login = async (email: string, password: string) => {
        const response = await request("/auth/login", "POST", {
          email,
          password,
        });
        assert.equal(response.status, 200);
        return response.headers.get("set-cookie")!.split(";")[0];
      };
      // test2 a son propre espace d’exemple, distinct de celui de test.
      let second = await login(demoAccounts[1].email, demoCredentials.password);
      const user = await json<AuthUser>(
        "/auth/session",
        "GET",
        undefined,
        second,
      );
      assert.equal(user.profile.name, "test2");
      assert.equal(user.profile.email, "test2@gmail.com");
      let d = await json<Dashboard>("/dashboard", "GET", undefined, second);
      assert.equal(d.animals.length, 2);
      assert.equal(d.receivedShares.length, 6);
      assert.deepEqual(d.receivedShares.map((s) => s.state).sort(), [
        "accepted",
        "declined",
        "expired",
        "pending",
        "pending",
        "revoked",
      ]);
      // Le contenu n’est transmis qu’une fois l’accès actif.
      assert.ok(
        d.receivedShares.every((s) => (s.state === "accepted") === !!s.content),
      );
      const accepted = await json<ReceivedShare>(
        "/received-shares/received-trusted",
        "PATCH",
        { status: "accepted" },
        second,
      );
      assert.equal(accepted.state, "accepted");
      assert.equal((accepted.content as ReceivedAnimal).name, "Luna");
      for (const [id, status, code] of [
        ["received-trusted", "declined", 409],
        ["received-document", "maybe", 400],
        ["absent", "accepted", 404],
      ] as const)
        assert.equal(
          (await request("/received-shares/" + id, "PATCH", { status }, second))
            .status,
          code,
        );
      await json(
        "/animals",
        "POST",
        { name: "Temporaire", species: "Chat" },
        second,
        201,
      );
      // Supprimer un compte de démonstration recrée son espace d’exemple.
      assert.equal(
        (await request("/account", "DELETE", { confirmation: "oui" }, second))
          .status,
        400,
      );
      assert.equal(
        (
          await request(
            "/account",
            "DELETE",
            { confirmation: "SUPPRIMER" },
            second,
          )
        ).status,
        204,
      );
      assert.equal(
        (await request("/dashboard", "GET", undefined, second)).status,
        401,
      );
      second = await login(demoAccounts[1].email, demoCredentials.password);
      d = await json<Dashboard>("/dashboard", "GET", undefined, second);
      assert.equal(d.animals.length, 2);
      assert.equal(
        d.receivedShares.filter((s) => s.state === "pending").length,
        2,
      );

      // Export : seulement les catégories demandées, sans fichiers ni contenu tiers.
      const exported = await json<{
        categories: string[];
        originalFilesIncluded: boolean;
        data: { profile?: Profile; animals?: unknown };
      }>("/export?categories=profile,sharing", "GET", undefined, bob);
      assert.deepEqual(exported.categories, ["profile", "sharing"]);
      assert.equal(exported.data.profile!.email, "bob@example.test");
      assert.equal(exported.data.animals, undefined);
      assert.equal(exported.originalFilesIncluded, false);
      assert.equal(
        (await request("/export?categories=photos", "GET", undefined, bob))
          .status,
        400,
      );

      // Un compte personnel supprimé disparaît avec son espace.
      assert.equal(
        (
          await request(
            "/account",
            "DELETE",
            { confirmation: "SUPPRIMER" },
            bob,
          )
        ).status,
        204,
      );
      assert.equal(
        (
          await request("/auth/login", "POST", {
            email: "bob@example.test",
            password: "  Mon mot de passe 2026!  ",
          })
        ).status,
        401,
      );
      assert.equal(
        db
          .prepare("SELECT id FROM accounts WHERE email=?")
          .get("bob@example.test"),
        undefined,
      );
    },
  );
});
