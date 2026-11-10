import { useLanguage } from "../language.ts";

/** Build-time flag is public; security and feature restrictions live in the API. */
export default function TestingNotice() {
  const [language] = useLanguage();
  if (import.meta.env.VITE_TESTING_PREVIEW !== "1") return null;
  return (
    <aside className="testing-notice" aria-label={language === "en" ? "Testing preview" : "Version de test"}>
      <strong>{language === "en" ? "Anivaya · Testing preview" : "Anivaya · Version de test"}</strong>
      <span>{language === "en"
        ? "Use fictional data only. Emails, password recovery, contact forms, administration changes and online payments are unavailable."
        : "Utilisez uniquement des données fictives. E-mails, récupération du mot de passe, formulaires de contact, modifications administratives et paiement en ligne indisponibles."}</span>
    </aside>
  );
}
