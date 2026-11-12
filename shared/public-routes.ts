/** Public destinations share the landing renderer, without an intermediate home route. */
const destinations: Record<string, string> = {
  fonctionnalites: "fonctionnalites",
  tarifs: "tarifs",
  faq: "faq",
  "liste-attente": "inscription",
  professionnels: "professionnels",
  cliniques: "cliniques",
  entreprises: "entreprises",
  "informations-legales": "informations-legales",
  "mentions-legales": "mentions-legales",
  confidentialite: "confidentialite",
  cookies: "cookies",
};
const aliases: Record<string, string> = {
  quotidien: "fonctionnalites",
  fonctionnement: "comment",
  engagement: "sante",
  prochainement: "bientot",
  questions: "faq",
  bienvenue: "inscription",
  moments: "partage",
};
export function publicSection(hash: string): string | null {
  const [page, section] = (hash.replace(/^#/, "").split("?")[0] || "accueil").split("/");
  if (page === "accueil") return Object.hasOwn(aliases, section) ? aliases[section] : section || "accueil";
  return !section && Object.hasOwn(destinations, page) ? destinations[page] : null;
}
/** Resolve the containing view even before its asynchronously loaded headings exist. */
export function publicView(section: string): string {
  if (["informations-legales", "mentions-legales", "confidentialite", "cookies"].includes(section))
    return "informations-legales";
  if (section === "professionnels" || section.startsWith("pro-")) return "professionnels";
  if (section === "cliniques" || section.startsWith("clinique-")) return "cliniques";
  if (section === "entreprises" || section.startsWith("entreprise-")) return "entreprises";
  return "accueil";
}
