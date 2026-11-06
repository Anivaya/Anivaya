import LanguageMenu from "../ui/LanguageMenu.tsx";
import Icon from "../ui/Icon.tsx";
import { useAdminView } from "./AdminViewContext.ts";
import { useEffect, useRef, useState } from "react";
import { wordmark } from "./brand.ts";
const links = [
  ["accueil", "Accueil"],
  ["accueil/professionnels", "Professionnels"],
  ["accueil/cliniques", "Cliniques"],
  ["accueil/entreprises", "Entreprises"],
  ["accueil/faq", "FAQ"],
];
export default function PublicHeader(_props: {
  activeSection?: string;
  account?: boolean;
  menuLogin?: boolean;
}) {
  const isAdmin = useAdminView();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    const overflow = document.body.style.overflow;
    if (open) document.body.style.overflow = "hidden";
    const resize = () => {
      if (innerWidth > 1100) setOpen(false);
      if (nav.current) nav.current.inert = !open && innerWidth <= 1100;
    };
    resize();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        setOpen(false);
        toggle.current?.focus();
      }
      if (e.key === "Tab" && open) {
        const last = nav.current?.querySelector<HTMLAnchorElement>(".nav__cta");
        if (e.shiftKey && document.activeElement === toggle.current) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          toggle.current?.focus();
        }
      }
    };
    const close = () => setOpen(false);
    window.addEventListener("resize", resize);
    window.addEventListener("hashchange", close);
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("resize", resize);
      window.removeEventListener("hashchange", close);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div className="landing-v2 js public-header-shell">
      <header className="site-header" id="haut">
        <div className="wrap site-header__inner">
          <a
            className="brand"
            href="#accueil"
            aria-label="Anivaya, retour à l'accueil"
          >
            <img
              className="brand__picto"
              src="/images/logo.png"
              alt=""
              width="48"
              height="48"
            />
            <img
              className="brand__word"
              src={wordmark}
              alt="Anivaya"
              width="520"
              height="85"
            />
          </a>
          <button
            className="menu-btn"
            ref={toggle}
            type="button"
            aria-expanded={open}
            aria-controls="public-menu"
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setOpen(!open)}
          >
            <svg className="ic ic--open" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <svg
              className="ic ic--close"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
          <nav
            ref={nav}
            className={"nav" + (open ? " is-open" : "")}
            id="public-menu"
            aria-label="Navigation principale"
          >
            <ul className="nav__links">
              {links.map(([href, label]) => (
                <li key={href}>
                  <a href={"#" + href} onClick={() => setOpen(false)}>
                    {label}
                  </a>
                </li>
              ))}
              {!isAdmin && (
                <li className="mobile-help-nav">
                  <a href="#contact" onClick={() => setOpen(false)}>
                    Nous contacter
                  </a>
                </li>
              )}
              {!isAdmin && (
                <li className="mobile-help-nav">
                  <a href="#informations" onClick={() => setOpen(false)}>
                    <Icon name="info" />
                    Informations du service
                  </a>
                </li>
              )}
            </ul>
            <div className="public-guest-actions">
              <LanguageMenu variant="public" />
              <a
                className="btn btn--primary btn--sm nav__cta"
                href="#connexion"
                onClick={() => setOpen(false)}
              >
                Se connecter / S’inscrire
              </a>
            </div>
          </nav>
        </div>
      </header>
    </div>
  );
}
