import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { openDatabase } from "../database/connection.ts";
import { createApi } from "../api/app.ts";
import { translationCatalogue } from "../../shared/translations/catalogue.ts";
import {
  translateMessage,
  translationScope,
} from "../../shared/translations.ts";
import { notificationText } from "../../shared/translations/notification.ts";

test("public translation API supplies FR/EN catalogues, defaults and validates parameters", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "anivaya-translations-"));
  const db = openDatabase(join(directory, "central.sqlite"));
  const server = createApi(db, {
    userDatabaseDirectory: join(directory, "accounts"),
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/translations`;
  for (const scope of ["home", "particular"] as const) {
    for (const language of ["fr", "en"] as const) {
      const response = await fetch(`${base}?scope=${scope}&lang=${language}`);
      assert.equal(response.status, 200);
      assert.deepEqual(
        await response.json(),
        translationCatalogue(scope, language),
      );
      assert.equal(response.headers.get("set-cookie"), null);
    }
  }
  assert.deepEqual(
    await (await fetch(base)).json(),
    translationCatalogue("home", "fr"),
  );
  for (const query of [
    "lang=de",
    "scope=admin",
    "scope=../../private",
    "lang=en%27",
  ]) {
    assert.equal((await fetch(`${base}?${query}`)).status, 400);
  }
});

test("names matching interface keys are preserved in greetings, document actions and notifications", () => {
  const messages = translationCatalogue("particular", "en").messages;
  const tr = (
    source: string | null | undefined,
    values?: readonly (string | number | null | undefined)[],
  ) => translateMessage(messages, source, values);
  assert.equal(tr("Bonjour {0},", ["Partage"]), "Hello Partage,");
  assert.equal(
    tr("Ouvrir le document {0} pour {1}", ["Documents", "Rappels"]),
    "Open document Documents for Rappels",
  );
  assert.equal(tr("Bonjour {0},", ["<b>{1} $&</b>"]), "Hello <b>{1} $&</b>,");
  assert.equal(
    notificationText(
      { category: "social", title: "Un message de Partage", text: "" },
      "title",
      tr,
    ),
    "A message from Partage",
  );
  assert.equal(
    notificationText(
      {
        category: "shares",
        title: "Partage vous partage « Documents »",
        text: "",
      },
      "title",
      tr,
    ),
    "Partage is sharing “Documents” with you",
  );
  assert.equal(
    notificationText(
      { category: "reminders", title: "Documents · Rappels", text: "" },
      "title",
      tr,
    ),
    "Documents · Rappels",
  );
  assert.equal(
    tr("Renseignez un champ valide (80 caractères maximum)."),
    "Enter a valid value (maximum 80 characters).",
  );
  assert.equal(
    notificationText(
      { category: "documents", title: "Partage", text: "Documents" },
      "title",
      tr,
    ),
    "Partage",
  );
  assert.equal(
    notificationText(
      { category: "documents", title: "Partage", text: "Documents" },
      "text",
      tr,
    ),
    "Documents",
  );
  assert.equal(
    translateMessage({}, "Bonjour {0},", ["Camille"]),
    "Bonjour Camille,",
  );
});

test("translation scope excludes administration and sign-in while retaining home and personal routes", () => {
  for (const page of [
    "espace",
    "animaux/nala",
    "documents",
    "rappels",
    "partage",
    "communautes",
    "annuaire",
    "reservations",
    "profil",
    "notifications",
    "contact",
    "informations",
  ]) {
    assert.equal(translationScope("#" + page), "particular");
    assert.equal(translationScope("#" + page, false), null);
  }
  assert.equal(translationScope("#accueil/pro-inscription", false), "home");
  assert.equal(translationScope("#admin/profil"), null);
  assert.equal(translationScope("#connexion"), null);
});

test("personal interface static keys are covered and translated options retain explicit API values", () => {
  const messages = translationCatalogue("particular", "en").messages;
  const folders = [
    "dashboard",
    "animals",
    "reminders",
    "documents",
    "sharing",
    "directory",
    "profile",
    "notifications",
    "communities",
    "contact",
  ];
  const root = new URL("../../front/src/", import.meta.url);
  const files = folders.flatMap((folder) =>
    readdirSync(new URL(`pages/${folder}/`, root), { recursive: true })
      .filter((file) => String(file).endsWith(".tsx"))
      .map((file) => `pages/${folder}/${String(file).replaceAll("\\", "/")}`),
  );
  files.push(
    "App.tsx",
    "shared/forms/SubmissionForm.tsx",
    "shared/ui/CollectionFilters.tsx",
    "shared/ui/EmptyState.tsx",
    "shared/ui/Tabs.tsx",
  );
  for (const file of files) {
    const source = readFileSync(new URL(file, root), "utf8");
    for (const match of source.matchAll(/\btr\(\s*("(?:[^"\\]|\\.)*")/g)) {
      const key = JSON.parse(match[1]) as string;
      assert.ok(Object.hasOwn(messages, key), `${file}: ${key}`);
    }
    for (const match of source.matchAll(
      /<option\b([^>]*)>([\s\S]*?)<\/option>/g,
    )) {
      if (match[2].includes("tr("))
        assert.match(
          match[1],
          /\bvalue=/,
          `${file}: translated option must retain its API value`,
        );
    }
    assert.doesNotMatch(
      source,
      /\btr\((?:animal|pet|person|document|p|a|doc|d)\.name\)/,
      `${file}: never translate entity names`,
    );
  }
});
