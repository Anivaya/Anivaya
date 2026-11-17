import { usePublicAvailability } from "../../shared/publicAvailability.ts";
import { useText } from "../../shared/i18n/HomeLocale.tsx";

export default function LegalContent() {
  const { legal: content } = usePublicAvailability();
  const tr = useText();
  if (!content) return null;
  return <>
    <h1>{tr("Informations légales")}</h1>
    {content.sections.map(section => <section key={section.id}>
      <h2 id={section.id}>{section.title}</h2>
      {section.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
    </section>)}
  </>;
}
