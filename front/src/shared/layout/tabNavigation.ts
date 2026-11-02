/**
 * Onglets de page (`.page-tabs a`) qui changent l’adresse, comme Partage et Communautés :
 * passer d’un onglet à l’autre ne remonte pas la page et laisse le focus sur l’onglet.
 */
let target = "";
document.addEventListener(
  "click",
  (event) => {
    const link =
      event.target instanceof Element
        ? event.target.closest<HTMLAnchorElement>(".page-tabs a[href^='#']")
        : null;
    target = link ? link.hash : "";
  },
  true,
);
// Remis à zéro après tous les écouteurs du changement d’adresse.
window.addEventListener("hashchange", () => setTimeout(() => (target = "")));

/** Le changement d’adresse en cours vient-il d’un onglet de page ? */
export const isTabNavigation = () =>
  !!target && target === window.location.hash;
