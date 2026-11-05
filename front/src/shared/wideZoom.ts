/**
 * Écrans plus larges que 1440 px : la page affiche la mise en page de 1440 px, agrandie pour
 * remplir la largeur.
 *
 * Le zoom CSS ne change pas la largeur que voient les règles @media ni matchMedia : elles
 * continuent de lire la vraie largeur de l’écran. Ce module les fait donc évaluer sur la
 * largeur zoomée (1440 px) :
 * - dans les feuilles de style, chaque condition de largeur (min-width / max-width) est
 *   remplacée par une condition toujours vraie ou toujours fausse ;
 * - matchMedia renvoie, pour les requêtes de largeur, une liste qui suit cette même largeur.
 * --zoom compense les hauteurs d’écran (vh) des CSS, que le zoom agrandirait aussi.
 */
const WIDE = 1440;
const BASE = 1440;
const WIDTH_FEATURE = /\(\s*(min|max)-width\s*:\s*([\d.]+)px\s*\)/g;
const ALWAYS = "(min-width: 0px)";
const NEVER = "(max-width: 0px)";

/** Largeur sur laquelle la page se met en page (celle de l’écran, ou 1440 px une fois zoomée). */
function layoutWidth() {
  return window.innerWidth > WIDE ? BASE : window.innerWidth;
}

const fits = (kind: string, value: number, width: number) =>
  kind === "min" ? width >= value : width <= value;

/* Feuilles de style : réécriture des conditions de largeur. */
const originals = new WeakMap<CSSMediaRule, string>();
function rewriteRules(rules: CSSRuleList, width: number | null) {
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSMediaRule) {
      const source = originals.get(rule) ?? rule.media.mediaText;
      if (WIDTH_FEATURE.test(source)) {
        WIDTH_FEATURE.lastIndex = 0;
        if (!originals.has(rule)) originals.set(rule, source);
        const next =
          width === null
            ? source
            : source.replace(WIDTH_FEATURE, (_, kind: string, value: string) =>
                fits(kind, Number(value), width) ? ALWAYS : NEVER,
              );
        if (rule.media.mediaText !== next) rule.media.mediaText = next;
      }
      WIDTH_FEATURE.lastIndex = 0;
    }
    if ("cssRules" in rule && (rule as CSSGroupingRule).cssRules)
      rewriteRules((rule as CSSGroupingRule).cssRules, width);
  }
}
function rewriteSheets() {
  const width = window.innerWidth > WIDE ? BASE : null;
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      rewriteRules(sheet.cssRules, width);
    } catch {
      // Feuille pas encore chargée ou d’une autre origine : elle sera reprise au chargement.
    }
  }
}

/* matchMedia : les requêtes de largeur suivent la largeur de mise en page. */
type Listener = (event: MediaQueryListEvent) => void;
const lists = new Set<{ refresh: () => void }>();
function widthQuery(query: string): MediaQueryList {
  const evaluate = () => {
    const width = layoutWidth();
    // Chaque partie séparée par une virgule : vraie si toutes ses conditions de largeur le sont.
    return query.split(",").some((part) => {
      const features = [...part.matchAll(WIDTH_FEATURE)];
      return features.every(([, kind, value]) =>
        fits(kind, Number(value), width),
      );
    });
  };
  let matches = evaluate();
  const listeners = new Set<Listener>();
  const list = {
    media: query,
    get matches() {
      return matches;
    },
    onchange: null as Listener | null,
    addEventListener: (_: string, listener: Listener) =>
      listeners.add(listener),
    removeEventListener: (_: string, listener: Listener) =>
      listeners.delete(listener),
    addListener: (listener: Listener) => listeners.add(listener),
    removeListener: (listener: Listener) => listeners.delete(listener),
    dispatchEvent: () => true,
    refresh() {
      const next = evaluate();
      if (next === matches) return;
      matches = next;
      const event = { matches, media: query } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
      list.onchange?.(event);
    },
  };
  lists.add(list);
  return list as unknown as MediaQueryList;
}
const nativeMatchMedia = window.matchMedia.bind(window);
window.matchMedia = (query: string) => {
  WIDTH_FEATURE.lastIndex = 0;
  const isWidth = WIDTH_FEATURE.test(query);
  WIDTH_FEATURE.lastIndex = 0;
  return isWidth ? widthQuery(query) : nativeMatchMedia(query);
};

function apply() {
  const root = document.documentElement;
  const zoom = window.innerWidth > WIDE ? window.innerWidth / BASE : 1;
  root.style.zoom = zoom > 1 ? String(zoom) : "";
  root.style.setProperty("--zoom", String(zoom));
  rewriteSheets();
  lists.forEach((list) => list.refresh());
}

export function startWideZoom() {
  apply();
  window.addEventListener("resize", apply);
  window.addEventListener("load", rewriteSheets);
  // Feuilles ajoutées ou rechargées plus tard (chargement, rechargement à chaud en développement).
  new MutationObserver(rewriteSheets).observe(document.head, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  document.addEventListener(
    "load",
    (event) => {
      if (event.target instanceof HTMLLinkElement) rewriteSheets();
    },
    true,
  );
}
