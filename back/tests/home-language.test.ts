import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { homeText } from "../../front/src/shared/i18n/home-text.ts";
import { homeEnglish } from "../../front/src/shared/i18n/home.en.ts";
import { pageTitle } from "../../front/src/shared/layout/pageTitle.ts";
import { validateLead } from "../../shared/lead-validation.ts";

test("home copy has English entries and preserves the French source", () => {
  for (const [french, english] of Object.entries(homeEnglish)) {
    if (french.trim())
      assert.ok(english.trim(), `Empty translation: ${french}`);
    assert.equal(homeText(french, "fr"), french);
  }
  // Catch missing entries when static copy is added to a translated component.
  for (const file of [
    "pages/home/LandingContent.tsx",
    "pages/home/LandingForm.tsx",
    "pages/home/HomePage.tsx",
    "shared/layout/PublicFooter.tsx",
    "shared/layout/Sidebar.tsx",
    "shared/ui/LanguageMenu.tsx",
  ]) {
    const source = readFileSync(
      new URL(`../../front/src/${file}`, import.meta.url),
      "utf8",
    );
    for (const match of source.matchAll(/\bt\(\s*("(?:[^"\\]|\\.)*")/g)) {
      const text = JSON.parse(match[1]) as string;
      // Brand names and punctuation do not require translation.
      if (!/[a-zÀ-ÿ]/i.test(text) || text.trim() === "Anivaya") continue;
      assert.ok(Object.hasOwn(homeEnglish, text), `${file}: ${text}`);
    }
  }
});

test("every lead form exposes translated validation without changing API values", () => {
  for (const kind of [
    "liste-attente",
    "pro",
    "clinique",
    "entreprise",
    "invalid",
  ]) {
    const cases = [
      { kind },
      {
        kind,
        name: "x".repeat(121),
        email: "invalid",
        postalCode: "abc",
        phone: "invalid",
        profile: "invalid",
        activity: "invalid",
        organizationType: "invalid",
        animals: ["invalid"],
        plan: "invalid",
        message: "x".repeat(1501),
      },
    ];
    for (const input of cases) {
      const snapshot = structuredClone(input);
      for (const error of Object.values(validateLead(input))) {
        assert.notEqual(homeText(error, "en"), error, error);
        assert.equal(homeText(error, "fr"), error);
      }
      assert.deepEqual(input, snapshot);
    }
  }
});

test("only public home titles switch to English", () => {
  assert.equal(pageTitle("#accueil", undefined, "en"), "Anivaya · Home");
  assert.equal(
    pageTitle("#accueil/pro-inscription", undefined, "en"),
    "Anivaya · Professionals",
  );
  assert.equal(
    pageTitle("#accueil/mentions-legales", undefined, "en"),
    "Anivaya · Legal notice",
  );
  assert.equal(
    pageTitle("#accueil/bloc-12", "cliniques", "en"),
    "Anivaya · Clinics",
  );
  assert.equal(
    pageTitle("#profil", undefined, "en"),
    "Anivaya · Gestion de profil",
  );
  assert.equal(pageTitle("#accueil"), "Anivaya · Accueil");
});
