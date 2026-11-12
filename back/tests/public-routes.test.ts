import test from "node:test";
import assert from "node:assert/strict";
import { publicSection, publicView } from "../../shared/public-routes.ts";
import { translationScope } from "../../shared/translations.ts";
import { pageTitle } from "../../front/src/shared/layout/pageTitle.ts";

test("direct public links and legacy links resolve the same view before content loads", () => {
  for (const section of ["fonctionnalites", "tarifs", "faq", "professionnels", "cliniques", "entreprises", "mentions-legales", "confidentialite", "cookies"]) {
    assert.equal(publicSection(`#${section}`), section);
    assert.equal(publicSection(`#accueil/${section}`), section);
    assert.equal(translationScope(`#${section}`, false), "home");
    assert.equal(pageTitle(`#${section}`), pageTitle(`#accueil/${section}`));
  }
  for (const section of ["mentions-legales", "confidentialite", "cookies"])
    assert.equal(publicView(section), "informations-legales");
  assert.equal(pageTitle("#confidentialite", undefined, "en"), "Anivaya · Privacy");
  assert.equal(publicSection("#liste-attente"), "inscription");
  assert.equal(publicSection("#accueil/bienvenue"), "inscription");
  assert.equal(publicSection("#accueil/questions"), "faq");
});

test("public destinations do not capture account, directory or unknown routes", () => {
  for (const hash of ["#inscription", "#partage", "#annuaire", "#admin/professionnels", "#informations", "#contact", "#confidentialite/invalide", "#toString", "#__proto__"])
    assert.equal(publicSection(hash), null, hash);
  assert.equal(pageTitle("#inscription"), "Anivaya · Inscription");
  assert.equal(publicSection(""), "accueil");
});
