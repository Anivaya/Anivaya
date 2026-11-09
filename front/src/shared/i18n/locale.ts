import { getLanguage } from "../language.ts";
import { translationScope } from "../../../../shared/translations.ts";

/** Display formatting only; machine-readable dates and API values stay unchanged. */
export const uiLocale = () =>
  typeof location !== "undefined" &&
  translationScope(location.hash) &&
  getLanguage() === "en"
    ? "en-GB"
    : "fr-FR";
