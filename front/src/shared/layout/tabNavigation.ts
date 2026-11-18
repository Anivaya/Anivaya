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

/** Met à jour un filtre ou un tri sans déplacer la page ni son focus. */
export function navigateWithinPage(hash: string) {
  target = hash.startsWith("#") ? hash : `#${hash}`;
  window.location.hash = target;
}

/** Le changement d’adresse en cours reste-t-il dans le contenu de la page ? */
export const isTabNavigation = () =>
  !!target && target === window.location.hash;
