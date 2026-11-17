import { usePublicAvailability } from "../publicAvailability.ts";
import { useLanguage } from "../language.ts";

export default function TestingNotice() {
  const { testingPreview } = usePublicAvailability();
  const [language] = useLanguage();
  if (!testingPreview) return null;
  return (
    <aside className="testing-notice" aria-label={language === "en" ? "Data notice" : "Information sur les données"}>
      <span>{language === "en"
        ? "Use fictional data only."
        : "Utilisez uniquement des données fictives."}</span>
    </aside>
  );
}
