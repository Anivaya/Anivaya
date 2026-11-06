import { useEffect, useRef } from "react";
import type { AuthUser } from "../../../../shared/account.ts";
import LandingContent from "./LandingContent.tsx";
import { mountLanding } from "./landing-motion.ts";
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
  useEffect(() => (host.current ? mountLanding(host.current) : undefined), []);
  return (
    <div className="landing-v2 js" ref={host}>
      {accountDeleted && (
        <div className="account-deleted-notice" role="status">
          <p>
            Votre compte a été supprimé. Vos données ont été effacées et votre
            session est fermée.
          </p>
          <button type="button" onClick={onDismiss}>
            Fermer
          </button>
        </div>
      )}
      <LandingContent user={user} onLogout={onLogout} />
    </div>
  );
}
