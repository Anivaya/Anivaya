/** Environnement local isolé pour parcourir les états vides. */
export function emptyStateMode(enabled = process.env.ANIVAYA_EMPTY_STATE === "1") {
  if (enabled && process.env.NODE_ENV === "production")
    throw new Error("Le mode états vides est réservé au développement local.");
  return enabled;
}
