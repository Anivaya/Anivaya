import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { LegalContent as Content } from "../../../../shared/legal.ts";
import { api } from "../../shared/services/api.ts";
import { useText } from "../../shared/i18n/HomeLocale.tsx";

/** Reviewed operator-provided text is rendered as plain text, never as HTML. */
export default function LegalContent({ children }: { children: ReactNode }) {
  const tr = useText();
  const [content, setContent] = useState<Content | null | undefined>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    api.legal(controller.signal).then(value => {
      if (!controller.signal.aborted) setContent(value);
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (content !== undefined || failed)
      window.dispatchEvent(new Event("anivaya-legal-ready"));
  }, [content, failed]);
  if (failed) return <p role="alert">{tr("Impossible de charger les informations légales. Réessayez plus tard.")}</p>;
  if (content === undefined) return <p role="status">{tr("Chargement…")}</p>;
  if (!content) return children;
  return <>
    <h1>{tr("Informations légales")}</h1>
    {content.sections.map(section => <section key={section.id}>
      <h2 id={section.id}>{section.title}</h2>
      {section.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
    </section>)}
  </>;
}
