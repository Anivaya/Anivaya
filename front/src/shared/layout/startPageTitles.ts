import { pageTitle } from "./pageTitle.ts";

/** Un propriétaire unique du titre, indépendant du chargement des pages. */
export function startPageTitles() {
  const update = () => {
    const target = document.getElementById(
      location.hash.replace(/^#accueil\/?/, ""),
    );
    const language = document.documentElement.lang;
    document.title = pageTitle(
      location.hash,
      target?.closest(".view")?.id,
      language,
    );
  };
  update();
  window.addEventListener("hashchange", update);
  window.addEventListener("anivaya-page-title", update);
  window.addEventListener("anivaya-language-changed", update);
  window.addEventListener("storage", update);
  return () => {
    window.removeEventListener("hashchange", update);
    window.removeEventListener("anivaya-page-title", update);
    window.removeEventListener("anivaya-language-changed", update);
    window.removeEventListener("storage", update);
  };
}
