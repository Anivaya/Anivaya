import { useLanguage } from "../language.ts";

/** Build-time flag is public; security and feature restrictions live in the API. */
export default function TestingNotice() {
  const [language] = useLanguage();
  if (import.meta.env.VITE_TESTING_PREVIEW !== "1") return null;
  return (
    <aside className="testing-notice" aria-label={language === "en" ? "Data notice" : "Information sur les données"}>
      <span>{language === "en"
        ? "Use fictional data only."
        : "Utilisez uniquement des données fictives."}</span>
    </aside>
  );
}
