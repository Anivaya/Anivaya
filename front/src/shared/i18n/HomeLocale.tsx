import { createContext, useContext } from "react";
import type { Translator } from "../../../../shared/translations.ts";
import { translateMessage } from "../../../../shared/translations.ts";

// Root provider selects the API catalogue for home or personal-account pages.
export const HomeLocale = createContext<Translator>((text, values) =>
  translateMessage({}, text, values),
);
export function useHomeText() {
  return useContext(HomeLocale);
}
export const useText = useHomeText;
