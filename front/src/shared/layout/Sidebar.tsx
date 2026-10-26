import { useEffect, useId, useRef, useState } from "react";
import type { Profile } from "../../../../shared/account.ts";
import Icon from "../ui/Icon.tsx";
import { initials } from "../utils/format.ts";
const navigation = [
  ["espace", "home", "Vue d’ensemble"],
  ["annuaire", "medical", "Professionnels"],
  ["animaux", "paw", "Mes animaux"],
  ["documents", "file", "Documents"],
  ["rappels", "reminder", "Rappels"],
  ["partage", "share", "Partage"],
];
export default function Sidebar({
  page,
  profile,
  onLogout,
}: {
  page: string;
  profile: Profile;
  onLogout: () => Promise<void>;
}) {
  return (
    <aside className="sidebar">
      <a
        className="app-brand"
        href="#espace"
        aria-label="Anivaya — Vue d’ensemble"
      >
        <img src="/images/logo.png" alt="Anivaya" width="78" height="69" />
      </a>
      <nav className="side-nav" aria-label="Navigation principale">
        {navigation.map(([id, icon, label]) => (
          <a
            key={id}
            href={`#${id}`}
            aria-current={
              page === id || (id === "annuaire" && page === "reservations")
                ? "page"
                : undefined
            }
          >
            <Icon name={icon} />
            {label}
          </a>
        ))}
      </nav>
      <div className="side-bottom">
        <AccountMenu profile={profile} onLogout={onLogout} />
      </div>
    </aside>
  );
}

/** Menu du compte : dans la barre latérale et, sur mobile, dans l’en-tête. */
export function AccountMenu({
  profile,
  onLogout,
  mobile = false,
}: {
  profile: Profile;
  onLogout: () => Promise<void>;
  mobile?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null),
    button = useRef<HTMLButtonElement>(null),
    id = useId();
  useEffect(() => {
    if (!open) return;
    function outside(e: PointerEvent) {
      if (e.target instanceof Node && !ref.current?.contains(e.target))
        setOpen(false);
    }
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  async function logout() {
    setBusy(true);
    try {
      await onLogout();
      setOpen(false);
    } catch {
      setError("Déconnexion impossible. Réessayez.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className={"account-menu" + (mobile ? " mobile-account" : "")}
      ref={ref}
    >
      <button
        type="button"
        ref={button}
        className="profile-link account-trigger"
        aria-label={"Ouvrir le menu du compte de " + profile.name}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <span className="profile-avatar">
          {profile.photo ? (
            <img src={profile.photo} alt="" />
          ) : (
            initials(profile.name)
          )}
        </span>
        <span className="profile-label">
          <strong>{profile.name}</strong>
          <small>Mon compte</small>
        </span>
      </button>
      {open && (
        <section
          className="account-popup"
          id={id}
          aria-label="Compte utilisateur"
        >
          <div className="account-identity">
            <strong>{profile.name}</strong>
            <span>{profile.email}</span>
          </div>
          <div className="account-actions">
            <a href="#profil" onClick={() => setOpen(false)}>
              <Icon name="settings" />
              Gestion de profil
            </a>
            <button
              className="account-signout"
              disabled={busy}
              onClick={() => {
                // Une page avec des modifications non enregistrées peut annuler l’événement
                // et appeler `logout` elle-même après confirmation.
                if (
                  window.dispatchEvent(
                    new CustomEvent("anivaya-before-logout", {
                      cancelable: true,
                      detail: logout,
                    }),
                  )
                )
                  void logout();
              }}
            >
              <Icon name="logout" />
              {busy ? "Déconnexion…" : "Se déconnecter"}
            </button>
            {error && <p role="alert">{error}</p>}
          </div>
        </section>
      )}
    </div>
  );
}
