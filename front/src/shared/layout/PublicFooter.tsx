import { useHomeText } from "../i18n/HomeLocale.tsx";
import { useAdminView } from "./AdminViewContext.ts";
/** Pied commun issu de la nouvelle maquette. */
const year = new Date().getFullYear();
export default function PublicFooter() {
  const t = useHomeText();
  const isAdmin = useAdminView();
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
                  alt={t("Anivaya")}
                  width="520"
                  height="85"
                />
              </div>
              <p className="footer__slogan">
                {t("Toute leur vie, à vos côtés.")}
              </p>
            </div>
            <div className="footer__col">
              <h2>{t("Particuliers")}</h2>
              <ul>
                <li>
                  <a href="#fonctionnalites">{t("Fonctionnalités")}</a>
                </li>
                <li>
                  <a href="#tarifs">{t("Tarifs")}</a>
                </li>
                <li>
                  <a href="#faq">{t("Questions fréquentes")}</a>
                </li>
                <li>
                  <a href="#liste-attente">{t("Liste d'attente")}</a>
                </li>
              </ul>
            </div>
            <div className="footer__col">
              <h2>{t("Professionnels")}</h2>
              <ul>
                <li>
                  <a href="#professionnels">{t("Prestataires")}</a>
                </li>
                <li>
                  <a href="#cliniques">{t("Cliniques vétérinaires")}</a>
                </li>
                <li>
                  <a href="#entreprises">
                    {t("Entreprises et partenaires")}
                  </a>
                </li>
              </ul>
            </div>
            <div className="footer__col">
              <h2>{t("Informations")}</h2>
              <ul>
                {!isAdmin && (
                  <li>
                    <a href="#informations">{t("Informations du service")}</a>
                  </li>
                )}
                <li>
                  <a href="#mentions-legales">
                    {t("Mentions légales")}
                  </a>
                </li>
                <li>
                  <a href="#confidentialite">{t("Confidentialité")}</a>
                </li>
                <li>
                  <a href="#cookies">{t("Cookies")}</a>
                </li>
              </ul>
            </div>
            <nav aria-label={t("Contact")}>
              <h2>{t("Contact")}</h2>
              <ul>
                {!isAdmin && (
                  <li>
                    <a href="#contact">{t("Nous contacter")}</a>
                  </li>
                )}
                <li>
                  <a href="mailto:contact@anivaya.fr">
                    {t("contact@anivaya.fr")}
                  </a>
                </li>
              </ul>
            </nav>
          </div>
          <div className="footer__bottom">
            <p>
              © <span>{year}</span> Anivaya
            </p>
            <p>
              {t(
                "Anivaya ne fournit ni diagnostic ni prescription vétérinaire.",
              )}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
