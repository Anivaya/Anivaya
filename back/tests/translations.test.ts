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
import { adminEnglish } from "../../shared/translations/admin.en.ts";
import {
  translateMessage,
  translationScope,
} from "../../shared/translations.ts";
import { notificationText } from "../../shared/translations/notification.ts";
import {
  adminHistoryAction,
  actionLabel,
  adminRecordTitle,
  adminAssignee,
} from "../../shared/translations/admin.ts";
import { pageTitle } from "../../front/src/shared/layout/pageTitle.ts";

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
  for (const scope of ["home", "particular", "admin"] as const) {
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
    "scope=unknown",
    "scope=../../private",
    "lang=en%27",
  ]) {
    assert.equal((await fetch(`${base}?${query}`)).status, 400);
  }
  // Le catalogue est compressé, conservé par le navigateur et revalidé sans être renvoyé.
  const url = `${base}?scope=admin&lang=en`;
  const first = await fetch(url);
  const etag = first.headers.get("etag");
  assert.ok(etag);
  assert.equal(first.headers.get("cache-control"), "no-cache");
  assert.equal(first.headers.get("content-encoding"), "gzip");
  await first.arrayBuffer();
  const plain = await fetch(url, {
    headers: { "Accept-Encoding": "identity" },
  });
  assert.equal(plain.headers.get("content-encoding"), null);
  assert.equal(plain.headers.get("etag"), etag);
  assert.deepEqual(await plain.json(), translationCatalogue("admin", "en"));
  const unchanged = await fetch(url, { headers: { "If-None-Match": etag } });
  assert.equal(unchanged.status, 304);
  assert.equal(await unchanged.text(), "");
  const other = await fetch(`${base}?scope=home&lang=en`, {
    headers: { "If-None-Match": etag },
  });
  assert.equal(other.status, 200);
  await other.arrayBuffer();
  // Les autres réponses de l’API ne sont jamais mises en cache.
  const invalid = await fetch(`${base}?lang=de`);
  assert.equal(invalid.headers.get("cache-control"), "no-store");
  await invalid.arrayBuffer();
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

test("translation scope includes administration and the pages open without a session", () => {
  // Contact et Informations existent aussi en version publique.
  const open = new Set(["contact", "informations"]);
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
    assert.equal(
      translationScope("#" + page, false),
      open.has(page) ? "particular" : null,
    );
  }
  for (const page of [
    "connexion",
    "inscription",
    "reinitialisation",
    "mot-de-passe/jeton",
    "desinscription?token=jeton",
  ])
    assert.equal(translationScope("#" + page, false), "particular");
  assert.equal(translationScope("#inconnue", false), null);
  assert.equal(translationScope("#accueil/pro-inscription", false), "home");
  assert.equal(translationScope("#admin/profil"), "admin");
  assert.equal(
    translationScope("#admin/moderation/reports?status=À+traiter", false),
    "admin",
  );
});

test("admin copy, accessible actions, configuration and API option values are covered", () => {
  const messages = translationCatalogue("admin", "en").messages;
  const root = new URL("../../front/src/pages/admin/", import.meta.url);
  for (const file of readdirSync(root).filter((f) => f.endsWith(".tsx"))) {
    const source = readFileSync(new URL(file, root), "utf8");
    for (const match of source.matchAll(/\btr\(\s*("(?:[^"\\]|\\.)*")/g)) {
      const key = JSON.parse(match[1]) as string;
      assert.ok(Object.hasOwn(messages, key), `${file}: ${key}`);
    }
    for (const match of source.matchAll(
      /<option\b([^>]*)>([\s\S]*?)<\/option>/g,
    )) {
      if (match[2].includes("tr(")) assert.match(match[1], /\bvalue=/, file);
    }
    assert.doesNotMatch(
      source,
      /key=\{tr\(/,
      `${file}: locale must not remount fields`,
    );
    assert.doesNotMatch(
      source,
      /\btr\((?:d\.name|v\.title|row\.(?:message|body|note|assignee)|entry\.actor|proof\.fileName)\)/,
      file,
    );
  }
  const config = readFileSync(new URL("config.ts", root), "utf8");
  for (const match of config.matchAll(
    /(?:title|intro|description|label):\s*("(?:[^"\\]|\\.)*")/g,
  )) {
    const key = JSON.parse(match[1]) as string;
    assert.ok(Object.hasOwn(messages, key), key);
  }
  for (const [source, translated] of Object.entries(adminEnglish)) {
    if (source.trim()) assert.ok(translated.trim(), source);
    assert.deepEqual(
      translated.match(/\{\d+\}/g)?.sort(),
      source.match(/\{\d+\}/g)?.sort(),
      source,
    );
  }
});

test("admin audit actions and proof actions preserve names even when they match interface keys", () => {
  const messages = translationCatalogue("admin", "en").messages;
  const tr = (
    source: string | null | undefined,
    values?: readonly (string | number | null | undefined)[],
  ) => translateMessage(messages, source, values);
  assert.equal(
    actionLabel({ id: "proof:activity", label: "Vérifier : Documents" }, tr),
    "Verify: Documents",
  );
  assert.equal(adminHistoryAction("Création : Équipe", tr), "Created: Équipe");
  assert.equal(
    adminHistoryAction("save : Tableau de bord", tr),
    "Updated: Tableau de bord",
  );
  assert.equal(
    adminHistoryAction("Création : {0} $& <b>Test</b>", tr),
    "Created: {0} $& <b>Test</b>",
  );
  assert.equal(
    tr("Dossier : {0}. L’action sera enregistrée dans l’historique.", [
      "Modération",
    ]),
    "Record: Modération. This action will be recorded in the history.",
  );
  assert.equal(
    pageTitle("#admin/pilotage", undefined, "en"),
    "Anivaya · Analytics",
  );
  assert.equal(pageTitle("#admin/equipe", undefined, "fr"), "Anivaya · Équipe");
  const record = {
    id: "test",
    name: "Équipe",
    status: "Actif",
    version: 1,
    createdAt: "",
    updatedAt: "",
  };
  assert.equal(adminRecordTitle("users", record, tr), "Équipe");
  assert.equal(adminRecordTitle("imports", record, tr), "Équipe");
  assert.equal(adminRecordTitle("library", record, tr), "Équipe");
  assert.equal(
    adminRecordTitle("deletions", { ...record, name: "Demande de Équipe" }, tr),
    "Request from Équipe",
  );
  assert.equal(adminAssignee("Julien Moreau", tr), "Julien Moreau");
  assert.equal(adminAssignee("Modération", tr), "Modération");
  assert.equal(adminAssignee("Administrateur", tr), "Administrator");
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
