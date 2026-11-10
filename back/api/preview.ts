/** Explicit testing deployment; never inferred from a missing production setting. */
export const testingPreview = () => process.env.ANIVAYA_TESTING_PREVIEW === "1";

export function previewBlocksEmailRoute(path: string, method: string | undefined) {
  if (!testingPreview()) return false;
  return path === "/api/internal/reminders" ||
    /\/password-reset(?:\/|$)/.test(path) ||
    (method !== "GET" && (/^\/api\/public\/(contact|leads|unsubscribe-link)$/.test(path) ||
      /^\/api\/admin\//.test(path)));
}
