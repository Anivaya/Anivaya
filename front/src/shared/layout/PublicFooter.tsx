/** Pied commun issu de la nouvelle maquette. */
const year = new Date().getFullYear();
export default function PublicFooter() {
  return (
    <div className="landing-v2 shared-footer">
      <footer className="site-footer on-dark">
        <div className="wrap">
          <div className="footer__grid">
            <div>
              <div className="footer__brand">
                <span className="footer__badge">
                  <img
                    src="/images/home/fa6d728ddfeec1fc.webp"
                    alt=""
                    width="320"
                    height="242"
                  />
                </span>
                <img
                  className="footer__word"
                  src="/images/home/cec3fbfb49bc119f.webp"
                  alt="Anivaya"
                  width="520"
                  height="85"
                />
              </div>
              <p className="footer__slogan">Toute leur vie, à vos côtés.</p>
            </div>
            <div className="footer__col">
              <h2>Particuliers</h2>
              <ul>
                <li>
                  <a href="#accueil/fonctionnalites">Fonctionnalités</a>
                </li>
                <li>
                  <a href="#accueil/tarifs">Tarifs</a>
                </li>
                <li>
                  <a href="#accueil/faq">Questions fréquentes</a>
                </li>
                <li>
                  <a href="#accueil/inscription">Liste d'attente</a>
                </li>
              </ul>
            </div>
            <div className="footer__col">
              <h2>Professionnels</h2>
              <ul>
                <li>
                  <a href="#accueil/professionnels">Prestataires</a>
                </li>
                <li>
                  <a href="#accueil/cliniques">Cliniques vétérinaires</a>
                </li>
                <li>
                  <a href="#accueil/entreprises">Entreprises et partenaires</a>
                </li>
              </ul>
            </div>
            <div className="footer__col">
              <h2>Informations</h2>
              <ul>
                <li>
                  <a href="#informations">Informations du service</a>
                </li>
                <li>
                  <a href="#accueil/mentions-legales">Mentions légales</a>
                </li>
                <li>
                  <a href="#accueil/confidentialite">Confidentialité</a>
                </li>
                <li>
                  <a href="#accueil/cookies">Cookies</a>
                </li>
              </ul>
            </div>
            <nav aria-label="Contact">
              <h2>Contact</h2>
              <ul>
                <li>
                  <a href="#contact">Nous contacter</a>
                </li>
                <li>
                  <a href="mailto:contact@anivaya.fr">contact@anivaya.fr</a>
                </li>
              </ul>
            </nav>
          </div>
          <div className="footer__bottom">
            <p>
              © <span>{year}</span> Anivaya
            </p>
            <p>Anivaya ne fournit ni diagnostic ni prescription vétérinaire.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
