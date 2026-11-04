import { useEffect, useRef } from "react";

const homeLinks = [
  ["accueil", "Accueil"],
  ["accueil/quotidien", "Le quotidien"],
  ["accueil/fonctionnement", "Comment ça marche"],
  ["accueil/engagement", "Notre engagement"],
  ["accueil/prochainement", "Autour de vous"],
  ["accueil/questions", "Questions"],
  ["contact", "Nous contacter"],
  ["informations", "Informations du service"],
];
/** Pages de connexion et de mot de passe : accueil, contact et informations du service. */
const accountLinks = [
  ["accueil", "Accueil"],
  ["contact", "Nous contacter"],
  ["informations", "Informations du service"],
];

export default function PublicHeader({
  activeSection,
  account = false,
  menuLogin = false,
}: {
  activeSection?: string;
  /** En-tête des pages de compte : navigation réduite, sans bouton de connexion sur mobile. */
  account?: boolean;
  /** Ajoute « Se connecter » au menu mobile, juste sous « Accueil » (le bouton y est masqué). */
  menuLogin?: boolean;
}) {
  const links = account ? accountLinks : homeLinks;
  const menuLinks = menuLogin
    ? [links[0], ["connexion", "Se connecter"], ...links.slice(1)]
    : links;
  const menu = useRef<HTMLDetailsElement>(null);
  // Le menu ouvert se ferme d’un clic ailleurs ou avec Échap.
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (menu.current?.open && !menu.current.contains(event.target as Node))
        menu.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !menu.current?.open) return;
      menu.current.open = false;
      menu.current.querySelector("summary")?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  return (
    <header className="header wrap" id="haut">
      <a className="brand" href="#accueil" aria-label="Anivaya, accueil">
        <img src="/images/logo.png" alt="Anivaya" width="88" height="77" />
      </a>
      <nav aria-label="Navigation principale">
        {links.map(([href, label]) => (
          <a
            key={href}
            href={"#" + href}
            aria-current={
              !account &&
              href.startsWith("accueil") &&
              activeSection === (href.split("/")[1] || "accueil")
                ? "location"
                : undefined
            }
          >
            {label}
          </a>
        ))}
      </nav>
      <a className="button auth-entry" href="#connexion">
        Se connecter / S’inscrire
      </a>
      <details className="mobile-menu" ref={menu}>
        <summary>Menu</summary>
        <nav aria-label="Navigation mobile">
          {menuLinks.map(([href, label]) => (
            <a
              key={href}
              href={"#" + href}
              onClick={(e) =>
                e.currentTarget.closest("details")?.removeAttribute("open")
              }
            >
              {label}
            </a>
          ))}
        </nav>
      </details>
    </header>
  );
}
