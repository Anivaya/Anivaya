import { pageTitle } from "./pageTitle.ts";

/** Un propriétaire unique du titre, indépendant du chargement des pages. */
export function startPageTitles() {
  const update = () => {
    const target = document.getElementById(
      location.hash.replace(/^#accueil\/?/, ""),
    );
    document.title = pageTitle(location.hash, target?.closest(".view")?.id);
  };
  update();
  window.addEventListener("hashchange", update);
  window.addEventListener("anivaya-page-title", update);
  return () => {
    window.removeEventListener("hashchange", update);
    window.removeEventListener("anivaya-page-title", update);
  };
}
