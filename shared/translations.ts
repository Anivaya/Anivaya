import { publicSection } from "./public-routes.ts";
export type Language = "fr" | "en";
export type TranslationScope = "home" | "particular" | "admin";
export type Translator = (
  text: string | null | undefined,
  values?: readonly (string | number | null | undefined)[],
) => string;
export interface TranslationCatalogue {
  language: Language;
  scope: TranslationScope;
  version: string;
  messages: Record<string, string>;
}

/** Only the template is translated. Interpolated names and user content are untouched. */
export function translateMessage(
  messages: Record<string, string>,
  source: string | null | undefined,
  values: readonly (string | number | null | undefined)[] = [],
) {
  if (!source) return "";
  // These are validation messages with numeric limits, never user-provided names.
  for (const [pattern, key] of [
    [
      /^Renseignez un champ valide \((\d+) caractères maximum\)\.$/,
      "Renseignez un champ valide ({0} caractères maximum).",
    ],
    [
      /^Utilisez au maximum (\d+) caractères\.$/,
      "Utilisez au maximum {0} caractères.",
    ],
  ] as const) {
    const match = pattern.exec(source);
    if (match && Object.hasOwn(messages, key))
      return messages[key].replace("{0}", match[1]);
  }
  const template = Object.hasOwn(messages, source) ? messages[source] : source;
  return template.replace(/\{(\d+)\}/g, (token, index: string) =>
    Number(index) >= values.length
      ? token
      : String(values[Number(index)] ?? ""),
  );
}
const personalPages = new Set([
  "espace",
  "animaux",
  "documents",
  "rappels",
  "profil",
  "annuaire",
  "reservations",
  "partage",
  "communautes",
  "notifications",
  "contact",
  "informations",
  "urgence",
]);
/**
 * Pages ouvertes sans session : compte (connexion, inscription, mot de passe,
 * désinscription) et versions publiques de Contact et Informations. Elles partagent
 * le catalogue de l’espace personnel, déjà en mémoire après la connexion.
 */
const publicPages = new Set([
  "invitation",
  "connexion",
  "inscription",
  "reinitialisation",
  "mot-de-passe",
  "desinscription",
  "contact",
  "informations",
]);
export function translationScope(
  hash: string,
  personalSession = true,
): TranslationScope | null {
  const page = hash.replace(/^#/, "").split(/[/?]/)[0] || "accueil";
  return publicSection(hash) !== null
    ? "home"
    : page === "admin"
      ? "admin"
      : publicPages.has(page) || (personalSession && personalPages.has(page))
        ? "particular"
        : null;
}
