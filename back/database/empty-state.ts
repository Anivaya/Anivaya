import { demoAccountsEnabled } from "../api/preview.ts";
/** Environnement local isolé pour parcourir les états vides. */
export function emptyStateMode(enabled = process.env.ANIVAYA_EMPTY_STATE === "1", previewDemo = false) {
  if (enabled && process.env.NODE_ENV === "production" && !(previewDemo && demoAccountsEnabled()))
    throw new Error("Le mode états vides est réservé au développement local.");
  return enabled;
}
