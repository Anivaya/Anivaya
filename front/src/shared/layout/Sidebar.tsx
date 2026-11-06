import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Profile } from "../../../../shared/account.ts";
import Icon from "../ui/Icon.tsx";
import LanguageMenu from "../ui/LanguageMenu.tsx";
import { useHomeText } from "../i18n/HomeLocale.tsx";
import { useAdminView } from "./AdminViewContext.ts";
import { initials } from "../utils/format.ts";
const navigation = [
  ["espace", "home", "Vue d’ensemble"],
  ["annuaire", "medical", "Professionnels"],
  ["rappels", "reminder", "Rappels"],
  ["animaux", "paw", "Mes animaux"],
  ["documents", "file", "Documents"],
  ["partage", "share", "Partage"],
  ["communautes", "people", "Communautés"],
];
export const SIDEBAR_ID = "main-sidebar";

/**
 * Barre latérale. Sur tablette et mobile, elle devient un panneau ouvert par le bouton
 * menu de l’en-tête (`open`), refermé par un lien, Échap ou un clic à côté.
 * `children` remplace le contenu habituel (navigation de l’administration).
 */
export default function Sidebar({
  page,
  profile,
  onLogout,
  open = false,
  onClose,
  children,
}: {
  page: string;
  profile: Profile;
  onLogout: () => Promise<void>;
  open?: boolean;
  onClose: () => void;
  children?: ReactNode;
}) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const narrow = matchMedia("(max-width:1024px)");
    if (!narrow.matches) {
      onClose();
      return;
    }
    const trigger = document.activeElement;
    const main =
      panel.current?.parentElement?.querySelector<HTMLElement>(".app-main");
    const wasInert = main?.inert ?? false;
    const overflow = document.body.style.overflow;
    if (main) main.inert = true;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("a")?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Tab") {
        const items = Array.from(
          panel.current?.querySelectorAll<HTMLElement>(
            'a[href],button:not(:disabled),[tabindex="0"]',
          ) || [],
        ).filter((el) => el.getClientRects().length);
        const first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    const resized = () => {
      if (!narrow.matches) onClose();
    };
    narrow.addEventListener("change", resized);
    window.addEventListener("hashchange", onClose);
    document.addEventListener("keydown", key);
    return () => {
      if (main) main.inert = wasInert;
      document.body.style.overflow = overflow;
      narrow.removeEventListener("change", resized);
      window.removeEventListener("hashchange", onClose);
      document.removeEventListener("keydown", key);
      if (trigger instanceof HTMLElement && trigger.isConnected)
        trigger.focus();
    };
  }, [open, onClose]);
  return (
    <>
      {open && (
        <div
          className="sidebar-backdrop"
          aria-hidden="true"
          onClick={onClose}
        />
      )}
      <aside
        className={"sidebar" + (open ? " open" : "")}
        id={SIDEBAR_ID}
        ref={panel}
        onClick={(e) => {
          if (e.target instanceof Element && e.target.closest("a")) onClose();
        }}
      >
        {children ?? (
          <SidebarContent page={page} profile={profile} onLogout={onLogout} />
        )}
      </aside>
    </>
  );
}

function SidebarContent({
  page,
  profile,
  onLogout,
}: {
  page: string;
  profile: Profile;
  onLogout: () => Promise<void>;
}) {
  return (
    <>
      <a
        className="app-brand"
        href="#espace"
        aria-label="Anivaya — Vue d’ensemble"
      >
        <img
          src="/images/logo-anivaya-wordmark.png"
          alt=""
          width="1353"
          height="1162"
        />
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
    </>
  );
}

/**
 * Menu du compte : dans la barre latérale et, sur tablette et mobile, dans l’en-tête
 * (`mobile`), y compris dans l’administration.
 */
export function AccountMenu({
  profile,
  onLogout,
  mobile = false,
  profileHref = "#profil",
  roleLabel = "Mon compte",
}: {
  profile: Profile;
  onLogout: () => Promise<void>;
  mobile?: boolean;
  /** Page de profil ouverte depuis le menu (celle de l’administration, par exemple). */
  profileHref?: string;
  /** Texte sous le nom : rôle d’équipe dans l’administration. */
  roleLabel?: string;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const isAdmin = useAdminView();
  const t = useHomeText();
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
        aria-label={t("Ouvrir le menu du compte de ") + profile.name}
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
          <small>{t(roleLabel)}</small>
        </span>
      </button>
      {open && (
        <section
          className="account-popup"
          id={id}
          aria-label={t("Compte utilisateur")}
        >
          <div className="account-identity">
            <strong>{profile.name}</strong>
            <span>{profile.email}</span>
          </div>
          <div className="account-actions">
            <a
              href={
                !location.hash || location.hash.startsWith("#accueil")
                  ? profileHref.startsWith("#admin")
                    ? "#admin/dashboard"
                    : "#espace"
                  : "#accueil"
              }
              onClick={() => setOpen(false)}
            >
              <Icon name="home" />
              {t(
                !location.hash || location.hash.startsWith("#accueil")
                  ? "Espace " +
                      (roleLabel === "Mon compte" ? "Particulier" : roleLabel)
                  : "Accueil",
              )}
            </a>
            <LanguageMenu />
            <a
              href={profileHref}
              aria-current={location.hash === profileHref ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              <Icon name="settings" />
              {t("Gestion de profil")}
            </a>
            {!isAdmin && (
              <a
                className="mobile-help-link"
                href="#contact"
                onClick={() => setOpen(false)}
              >
                <Icon name="headset" />
                {t("Nous contacter")}
              </a>
            )}
            {!isAdmin && (
              <a
                className="mobile-help-link"
                href="#informations"
                onClick={() => setOpen(false)}
              >
                <Icon name="info" />
                {t("Informations du service")}
              </a>
            )}
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
              {t(busy ? "Déconnexion…" : "Se déconnecter")}
            </button>
            {error && <p role="alert">{t(error)}</p>}
          </div>
        </section>
      )}
    </div>
  );
}
