export default function PublicHeader() {
  const links = [
    ["accueil", "Accueil"],
    ["accueil/quotidien", "Le quotidien"],
    ["accueil/fonctionnement", "Comment ça marche"],
    ["accueil/engagement", "Notre engagement"],
    ["accueil/questions", "Questions"],
  ];
  return (
    <header className="header wrap" id="haut">
      <a className="brand" href="#accueil" aria-label="Anivaya, accueil">
        <img src="/images/logo.png" alt="Anivaya" width="88" height="77" />
      </a>
      <nav aria-label="Navigation principale">
        {links.map(([href, label]) => (
          <a key={href} href={"#" + href}>
            {label}
          </a>
        ))}
      </nav>
      <a className="button auth-entry" href="#connexion">
        Se connecter / S’inscrire
      </a>
      <details className="mobile-menu">
        <summary>Menu</summary>
        <nav aria-label="Navigation mobile">
          {links.map(([href, label]) => (
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
