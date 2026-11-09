import { homeEnglish } from "./home.en.ts";
import { particularEnglish } from "./particular.en.ts";
import type {
  Language,
  TranslationScope,
  TranslationCatalogue,
} from "../translations.ts";

const english = {
  home: homeEnglish,
  particular: { ...homeEnglish, ...particularEnglish },
};
const french = Object.fromEntries(
  Object.entries(english).map(([scope, messages]) => [
    scope,
    Object.fromEntries(Object.keys(messages).map((key) => [key, key])),
  ]),
) as Record<TranslationScope, Record<string, string>>;
export function translationCatalogue(
  scope: TranslationScope,
  language: Language,
): TranslationCatalogue {
  return {
    scope,
    language,
    version: "2026-11-09.1",
    messages: language === "en" ? english[scope] : french[scope],
  };
}
