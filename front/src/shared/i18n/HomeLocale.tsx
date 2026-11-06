import { createContext, useContext } from "react";

// Shared menus and footer stay in French outside the home pages for now.
// The English catalogue is loaded with HomePage, not with the account screens.
export const HomeLocale = createContext<(text: string) => string>(
  (text) => text,
);
export function useHomeText() {
  return useContext(HomeLocale);
}
