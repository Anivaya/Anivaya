import { useCallback, useEffect, useRef } from "react";
import type { AuthUser } from "../../../../shared/account.ts";
import LandingContent from "./LandingContent.tsx";
import { mountLanding } from "./landing-motion.ts";
import { useLanguage } from "../../shared/language.ts";
import { HomeLocale } from "../../shared/i18n/HomeLocale.tsx";
import { homeText } from "../../shared/i18n/home-text.ts";
export default function HomePage({
  user,
  onLogout,
  accountDeleted,
  onDismiss,
}: {
  user?: AuthUser | null;
  onLogout: () => Promise<void>;
  section?: string;
  accountDeleted?: boolean;
  onDismiss?: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [language] = useLanguage();
  const t = useCallback((text: string) => homeText(text, language), [language]);
  useEffect(() => (host.current ? mountLanding(host.current) : undefined), []);
  useEffect(() => {
    // Update imperative navigation labels after React has translated the headings.
    host.current?.dispatchEvent(new Event("anivaya-home-language"));
  }, [language]);
  return (
    <HomeLocale.Provider value={t}>
      <div className="landing-v2 js" ref={host} lang={language}>
        {accountDeleted && (
          <div className="account-deleted-notice" role="status">
            <p>
              {t(
                "Votre compte a été supprimé. Vos données ont été effacées et votre session est fermée.",
              )}
            </p>
            <button type="button" onClick={onDismiss}>
              {t("Fermer")}
            </button>
          </div>
        )}
        <LandingContent user={user} onLogout={onLogout} />
      </div>
    </HomeLocale.Provider>
  );
}
