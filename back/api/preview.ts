/** Explicit testing deployment; never inferred from a missing production setting. */
export const testingPreview = () => process.env.ANIVAYA_TESTING_PREVIEW === "1";

export const limitedLaunch = () => process.env.ANIVAYA_LIMITED_LAUNCH === "1";
export const demoAccountsEnabled = () => testingPreview() ||
  (limitedLaunch() && process.env.ANIVAYA_DEMO_ACCOUNTS === "1");
export const emailFormsAvailable = () => !testingPreview() && process.env.MAIL_PROVIDER !== "disabled";
export function aiImportAvailable() {
  const model = process.env.OPENROUTER_MODEL?.trim();
  return Boolean(process.env.OPENROUTER_API_KEY?.trim() &&
    (process.env.NODE_ENV !== "production" || testingPreview() || (model && !model.endsWith(":free"))));
}

export function previewBlocksEmailRoute(path: string, method: string | undefined) {
  if (emailFormsAvailable()) return false;
  return path === "/api/internal/reminders" ||
    /\/password-reset(?:\/|$)/.test(path) ||
    (method !== "GET" && (/^\/api\/public\/(contact|leads|unsubscribe-link)$/.test(path) ||
      (testingPreview() && /^\/api\/admin\//.test(path))));
}
