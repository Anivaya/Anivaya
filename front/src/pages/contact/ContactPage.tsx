import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Profile } from "../../../../shared/account.ts";
import Tabs from "../../shared/ui/Tabs.tsx";

const contactTabs = [
  ["contact", "Contact"],
  ["service", "Le service"],
  ["donnees", "Vos données"],
] as const;
type ContactTab = (typeof contactTabs)[number][0];
const subjects = [
  "Mon compte",
  "Mes animaux et documents",
  "Les partages",
  "Une réservation",
  "Un problème technique",
  "Une suggestion",
  "Une autre question",
];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type Field = "name" | "email" | "subject" | "message";

/** Page publique : en-tête du site, sans la barre de l’espace connecté. */
export function PublicContactPage({ tab }: { tab?: string }) {
  return (
    <div className="service-public">
      <header className="service-public-header">
        <a className="brand" href="#accueil" aria-label="Anivaya, accueil">
          <img src="/images/logo.png" alt="Anivaya" width="88" height="77" />
        </a>
        <nav aria-label="Navigation principale">
          <a href="#accueil">Accueil</a>
          <a href="#contact" aria-current="page">
            Contact
          </a>
        </nav>
        <a className="button" href="#connexion">
          Se connecter / S’inscrire
        </a>
      </header>
      <main className="app-content secondary-page" id="dashboard-content">
        <ContactPage initialTab={tab} />
      </main>
    </div>
  );
}

/** Contact, présentation du service et données ; dans l’espace, le formulaire reprend le profil. */
export default function ContactPage({
  profile,
  initialTab,
}: {
  profile?: Profile;
  initialTab?: string;
}) {
  const [tab, setTab] = useState<ContactTab>(
    contactTabs.some(([key]) => key === initialTab)
      ? (initialTab as ContactTab)
      : "contact",
  );
  const empty = {
    name: profile?.name ?? "",
    email: profile?.email ?? "",
    subject: "",
    message: "",
  };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [sent, setSent] = useState(false);
  // Élément à focaliser une fois le nouvel état affiché (succès, formulaire, message).
  const focusNext = useRef<string | null>(null);
  useEffect(() => {
    if (!focusNext.current) return;
    document.getElementById(focusNext.current)?.focus();
    focusNext.current = null;
  });

  function change(field: Field, value: string) {
    setForm({ ...form, [field]: value });
    setErrors({ ...errors, [field]: undefined });
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    const found: Partial<Record<Field, string>> = {};
    if (!form.name.trim()) found.name = "Indiquez votre nom.";
    if (!EMAIL.test(form.email.trim()))
      found.email = "Indiquez une adresse e-mail valide.";
    if (!form.subject) found.subject = "Choisissez un sujet.";
    if (form.message.trim().length < 10)
      found.message = "Ajoutez quelques précisions : au moins 10 caractères.";
    setErrors(found);
    const first = (Object.keys(found) as Field[])[0];
    if (first) {
      document.getElementById("contact-" + first)?.focus();
      return;
    }
    setSent(true);
    setForm(empty);
    focusNext.current = "contact-success";
  }
  const invalid = (field: Field) => ({
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": `contact-${field}-error${field === "message" ? " message-help" : ""}`,
  });
  const error = (field: Field) => (
    <p
      className="profile-inline-error"
      id={`contact-${field}-error`}
      role="alert"
    >
      {errors[field]}
    </p>
  );

  return (
    <div className="profile-page">
      <div className="welcome">
        <div>
          <h1>Un coup de patte ?</h1>
          <p>
            Une question sur Anivaya, votre compte ou vos documents ? Retrouvez
            les réponses utiles et contactez-nous.
          </p>
        </div>
      </div>
      <Tabs
        label="Contact et informations"
        tabs={contactTabs}
        active={tab}
        onChange={setTab}
      />
      <section
        id="panel-contact"
        role="tabpanel"
        aria-labelledby="tab-contact"
        hidden={tab !== "contact"}
      >
        <div className="contact-grid">
          <aside className="contact-guidance">
            <h2>Parlons de votre quotidien.</h2>
            <p>
              Précisez la page concernée et ce que vous souhaitez faire : cela
              nous aidera à comprendre votre demande.
            </p>
            <div className="contact-note">
              <strong>Pour la santé de votre animal</strong>
              <p>
                Ce formulaire concerne le service Anivaya. Pour une question
                médicale ou une urgence, contactez un vétérinaire.
              </p>
            </div>
            <h3>Avant de nous écrire</h3>
            <details>
              <summary>Où retrouver mes documents ?</summary>
              <p>
                Dans votre espace, ouvrez Documents ou le carnet de l’animal
                concerné.
              </p>
            </details>
            <details>
              <summary>Comment gérer un partage ?</summary>
              <p>
                La page Partage regroupe vos partages et vos personnes de
                confiance.
              </p>
            </details>
            <details>
              <summary>J’ai oublié mon mot de passe.</summary>
              <p>
                <a href="#reinitialisation">Demander une réinitialisation</a>
              </p>
            </details>
          </aside>
          <div className="profile-panel">
            {sent ? (
              <div id="contact-success" tabIndex={-1} role="status">
                <h2>Votre demande est prête.</h2>
                <p>
                  L’envoi a été simulé. Aucun message n’a été transmis à une
                  équipe.
                </p>
                <button
                  className="button outline"
                  type="button"
                  onClick={() => {
                    setSent(false);
                    focusNext.current = "contact-name";
                  }}
                >
                  Écrire un autre message
                </button>
              </div>
            ) : (
              <form noValidate onSubmit={submit}>
                <h2>Votre message</h2>
                <div className="profile-fields">
                  <div className="field">
                    <label htmlFor="contact-name">Votre nom</label>
                    <input
                      id="contact-name"
                      autoComplete="name"
                      maxLength={120}
                      value={form.name}
                      onChange={(e) => change("name", e.target.value)}
                      {...invalid("name")}
                    />
                    {error("name")}
                  </div>
                  <div className="field">
                    <label htmlFor="contact-email">Adresse e-mail</label>
                    <input
                      id="contact-email"
                      type="email"
                      autoComplete="email"
                      maxLength={120}
                      value={form.email}
                      onChange={(e) => change("email", e.target.value)}
                      {...invalid("email")}
                    />
                    {error("email")}
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="contact-subject">
                    Votre demande concerne
                  </label>
                  <select
                    id="contact-subject"
                    value={form.subject}
                    onChange={(e) => change("subject", e.target.value)}
                    {...invalid("subject")}
                  >
                    <option value="">Choisir un sujet</option>
                    {subjects.map((subject) => (
                      <option key={subject}>{subject}</option>
                    ))}
                  </select>
                  {error("subject")}
                </div>
                <div className="field">
                  <label htmlFor="contact-message">Votre message</label>
                  <textarea
                    id="contact-message"
                    rows={6}
                    maxLength={2000}
                    placeholder="Décrivez votre question en quelques mots…"
                    value={form.message}
                    onChange={(e) => change("message", e.target.value)}
                    {...invalid("message")}
                  />
                  <p className="field-help" id="message-help">
                    10 à 2 000 caractères. N’indiquez pas de mot de passe ni de
                    données bancaires.
                  </p>
                  {error("message")}
                </div>
                <p className="field-help">
                  L’envoi de messages n’est pas encore configuré : votre message
                  n’est ni envoyé ni conservé.
                </p>
                <button className="button" type="submit">
                  Simuler l’envoi du message
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
      <section
        id="panel-service"
        role="tabpanel"
        aria-labelledby="tab-service"
        hidden={tab !== "service"}
      >
        <div className="profile-panel">
          <h2>Anivaya, à leurs côtés au quotidien.</h2>
          <p>
            Un espace pour rassembler les informations de vos animaux, préparer
            leurs rendez-vous et faciliter le relais avec les personnes qui
            prennent soin d’eux.
          </p>
          <div className="service-features">
            <div>
              <h3>Leur dossier</h3>
              <p>
                Carnet, documents et rappels réunis autour de chaque animal.
              </p>
            </div>
            <div>
              <h3>Les bonnes personnes</h3>
              <p>
                Partage des informations choisies, personnes de confiance et
                annuaire des professionnels.
              </p>
            </div>
            <div>
              <h3>L’essentiel en cas de besoin</h3>
              <p>
                Une fiche d’urgence et un QR code, avec une consultation
                publique facultative.
              </p>
            </div>
          </div>
        </div>
        <div className="profile-panel">
          <h2>À propos de cette version</h2>
          <p>
            Les comptes, les animaux, les documents et les partages sont
            réellement enregistrés. Les réservations, les paiements, les
            notifications et les envois de messages sont simulés : rien n’est
            transmis à un service externe.
          </p>
          <p>
            Les coordonnées de l’éditeur, les conditions d’utilisation et les
            modalités du service seront précisées avant son ouverture au public.
          </p>
        </div>
      </section>
      <section
        id="panel-donnees"
        role="tabpanel"
        aria-labelledby="tab-donnees"
        hidden={tab !== "donnees"}
      >
        <div className="profile-panel">
          <h2>Vous choisissez ce que vous partagez.</h2>
          <p>
            La fiche publique présente les informations sélectionnées lors de sa
            configuration. Vous pouvez modifier son contenu, la désactiver ou la
            supprimer pour révoquer son lien.
          </p>
          <h3>Dans cette version</h3>
          <p>
            Chaque compte dispose de sa propre base de données. Les mots de
            passe sont hachés et la session est conservée dans un cookie
            sécurisé, valable 24 heures au maximum. Les documents et photos
            importés restent dans votre espace.
          </p>
          <h3>Avant le lancement</h3>
          <p>
            Une politique de confidentialité complète précisera les données
            traitées, leurs durées de conservation, leurs destinataires et les
            moyens d’exercer vos droits.
          </p>
          <button
            type="button"
            className="button outline"
            onClick={() => {
              setTab("contact");
              setSent(false);
              setForm({ ...form, subject: "Une autre question" });
              focusNext.current = "contact-message";
            }}
          >
            Poser une question sur mes données
          </button>
        </div>
      </section>
    </div>
  );
}
