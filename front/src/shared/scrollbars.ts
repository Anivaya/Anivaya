/** Sur tous les écrans, seule la barre du défilement principal apparaît pendant le geste. */
export function startResponsiveScrollbars() {
  const active = new Map<HTMLElement, number>();
  const className = "page-is-scrolling";

  function hide(element: HTMLElement) {
    window.clearTimeout(active.get(element));
    active.delete(element);
    element.classList.remove(className);
  }
  function reset() {
    for (const element of active.keys()) hide(element);
  }
  function pageScroller(event: Event) {
    if (event.target === document) return document.documentElement;
    const target = event.target;
    // L’accueil possède son propre conteneur principal. Les formulaires, tableaux,
    // onglets, conversations et fenêtres ne déclenchent jamais la barre de page.
    return target instanceof HTMLElement && target.matches("[data-page-scroll]")
      ? target
      : null;
  }
  function onScroll(event: Event) {
    const element = pageScroller(event);
    if (!element) return;
    window.clearTimeout(active.get(element));
    element.classList.add(className);
    // Repli pour les navigateurs sans scrollend ; renouvelé pendant l’inertie tactile.
    active.set(element, window.setTimeout(() => hide(element), 900));
  }
  function onScrollEnd(event: Event) {
    const element = pageScroller(event);
    if (element) hide(element);
  }

  document.addEventListener("scroll", onScroll, { capture: true, passive: true });
  document.addEventListener("scrollend", onScrollEnd, { capture: true, passive: true });
  window.addEventListener("hashchange", reset);
  window.addEventListener("resize", reset);
  return () => {
    reset();
    document.removeEventListener("scroll", onScroll, true);
    document.removeEventListener("scrollend", onScrollEnd, true);
    window.removeEventListener("hashchange", reset);
    window.removeEventListener("resize", reset);
  };
}
