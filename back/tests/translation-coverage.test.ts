import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { IncomingMessage } from "node:http";
import { translationCatalogue } from "../../shared/translations/catalogue.ts";
import { publicEnglish } from "../../shared/translations/public.en.ts";
import { PASSWORD_RULE, passwordProblem } from "../../shared/account.ts";
import { clientAddress } from "../api/validation.ts";

const front = fileURLToPath(new URL("../../front/src/", import.meta.url));

/** Textes écrits en dur dans les appels `tr(...)`, y compris dans une condition. */
function interfaceTexts(source: string) {
  const texts: string[] = [];
  for (const start of source.matchAll(/\btr\(/g)) {
    // Arguments de l’appel, jusqu’à la parenthèse fermante correspondante.
    let depth = 1,
      index = start.index + 3,
      quote = "";
    for (; index < source.length && depth; index++) {
      const character = source[index];
      if (quote) {
        if (character === "\\") index++;
        else if (character === quote) quote = "";
      } else if (character === '"' || character === "'" || character === "`")
        quote = character;
      else if (character === "(") depth++;
      else if (character === ")") depth--;
    }
    const call = source.slice(start.index + 3, index - 1);
    for (const match of call.matchAll(/"((?:[^"\\]|\\.)*)"/g)) {
      const text = JSON.parse(`"${match[1]}"`) as string;
      // Les valeurs techniques (identifiants, clés, routes) ne sont pas du texte d’interface.
      if (/[a-zà-ÿ]/i.test(text) && !/^[a-z0-9_:./#-]+$/.test(text))
        texts.push(text);
    }
  }
  return texts;
}

function sources(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory()
      ? sources(path)
      : /\.tsx?$/.test(name)
        ? [path]
        : [];
  });
}

test("every interface text has an English entry in the catalogue of its page", () => {
  const admin = translationCatalogue("admin", "en").messages;
  const particular = translationCatalogue("particular", "en").messages;
  let checked = 0;
  for (const path of sources(front)) {
    const file = relative(front, path).replaceAll("\\", "/");
    // Seule l’administration reçoit son catalogue ; les autres pages partagent celui du compte.
    const messages = file.startsWith("pages/admin/") ? admin : particular;
    for (const text of interfaceTexts(readFileSync(path, "utf8"))) {
      assert.ok(Object.hasOwn(messages, text), `${file}: ${text}`);
      checked++;
    }
  }
  assert.ok(checked > 1000);
});

test("pages open without a session and API-defined states are translated", () => {
  const messages = translationCatalogue("particular", "en").messages;
  for (const file of [
    "pages/auth/AuthPage.tsx",
    "pages/auth/ResetPasswordPage.tsx",
    "pages/auth/UnsubscribePage.tsx",
    "shared/layout/PublicHeader.tsx",
  ]) {
    const source = readFileSync(join(front, file), "utf8");
    assert.match(source, /\buseText\(\)/, file);
    assert.ok(interfaceTexts(source).length, file);
  }
  // La règle de mot de passe et son erreur viennent du code partagé avec l’API.
  for (const text of [
    PASSWORD_RULE,
    passwordProblem("a")!,
    "Équipe Anivaya",
    "À traiter",
    "À examiner",
    "Traitée",
    "Refusée",
    "Classé sans suite",
    "Réexamen demandé",
  ])
    assert.notEqual(messages[text] ?? text, text, text);
  for (const [source, translated] of Object.entries(publicEnglish)) {
    assert.ok(translated.trim(), source);
    assert.deepEqual(
      translated.match(/\{\d+\}/g)?.sort(),
      source.match(/\{\d+\}/g)?.sort(),
      source,
    );
  }
});

test("rate limits use the proxy-supplied address only when the proxy is trusted", (t) => {
  const previous = process.env.TRUST_PROXY;
  t.after(() => {
    if (previous === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = previous;
  });
  const request = (forwarded?: string, remoteAddress = "10.0.0.1") =>
    ({
      headers: forwarded ? { "x-forwarded-for": forwarded } : {},
      socket: { remoteAddress },
    }) as unknown as IncomingMessage;

  delete process.env.TRUST_PROXY;
  // Sans proxy déclaré, l’en-tête est falsifiable : seule l’adresse de connexion compte.
  assert.equal(clientAddress(request("203.0.113.7")), "10.0.0.1");
  assert.equal(clientAddress(request()), "10.0.0.1");

  process.env.TRUST_PROXY = "1";
  assert.equal(clientAddress(request("203.0.113.7")), "203.0.113.7");
  // Le proxy ajoute l’adresse réelle en dernier ; ce qui précède vient du client.
  assert.equal(
    clientAddress(request("198.51.100.1, 203.0.113.7")),
    "203.0.113.7",
  );
  assert.equal(clientAddress(request()), "10.0.0.1");
  assert.equal(clientAddress(request(" , ")), "10.0.0.1");
});
