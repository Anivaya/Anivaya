import { useText } from "../../shared/i18n/HomeLocale.tsx";
import { useCallback, useEffect, useState } from "react";
import type { AuthUser, Profile } from "../../../../shared/account.ts";
import type { AdminOverview } from "../../../../shared/admin.ts";
import { roleResources } from "../../../../shared/admin.ts";
import { adminApi } from "../../shared/services/admin.ts";
import Sidebar, { AccountMenu } from "../../shared/layout/Sidebar.tsx";
import Icon from "../../shared/ui/Icon.tsx";
import Tabs from "../../shared/ui/Tabs.tsx";
import ProfilePage from "../profile/ProfilePage.tsx";
import MfaPanel from "../profile/MfaPanel.tsx";
import { errorMessage } from "../../shared/types.ts";
import { adminPages } from "./config.ts";
import AdminCollection from "./AdminCollection.tsx";
import AdminDashboard from "./AdminDashboard.tsx";
import AdminPreview from "./AdminPreview.tsx";
import AdminAnalytics from "./AdminAnalytics.tsx";

const navigationOrder = [
  "dashboard",
  "utilisateurs",
  "professionnels",
  "moderation",
  "assistance",
  "equipe",
  "publications",
  "pilotage",
  "historique",
];

export default function AdminWorkspace({
  user,
  route,
  onLogout,
  onProfileChanged,
  onAccountDeleted,
}: {
  user: AuthUser;
  route: string;
  onLogout: () => Promise<void>;
  onProfileChanged: (p: Profile) => Promise<void>;
  onAccountDeleted: () => void;
}) {
  const tr = useText();
  const [path, query = ""] = route.split("?"),
    [, rawPage = "dashboard", section] = path.split("/");
  const page =
    (
      {
        annonces: "publications",
        contenus: "publications",
        reservations: "professionnels",
        parametres: "profil",
      } as Record<string, string>
    )[rawPage] || rawPage;
  const config = adminPages[page];
  const [overview, setOverview] = useState<AdminOverview | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [menu, setMenu] = useState(false),
    [alerts, setAlerts] = useState(false);
  const closeMenu = useCallback(() => setMenu(false), []);
  useEffect(() => {
    const close = () => setAlerts(false);
    window.addEventListener("hashchange", close);
    return () => window.removeEventListener("hashchange", close);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    adminApi
      .overview(controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) {
          setOverview(next);
          setError("");
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorMessage(e));
      });
    return () => controller.abort();
  }, [retry]);
  const role = overview?.role || user.adminRole;
  const allowed = role ? roleResources[role] : [];
  const tabs = config?.tabs.filter(([r]) => allowed.includes(r)) || [];
  const tab =
    tabs.find(([r]) => r === section)?.[0] ||
    (rawPage === "contenus" ? "library" : tabs[0]?.[0]);
  const denied =
    !role ||
    (!!config?.tabs.length && !tabs.length) ||
    (page === "pilotage" && role !== "Administrateur");
  const collectionPath = `admin/${page}/${tab}`;
  const setQuery = useCallback(
    (q: string) => {
      window.location.hash = `${collectionPath}${q ? "?" + q : ""}`;
    },
    [collectionPath],
  );
  const refresh = () => setRetry((n) => n + 1);
  return (
    <div className="workspace admin-workspace">
      <a
        className="skip-link"
        href="#admin-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("admin-content")?.focus();
        }}
      >
        {tr("Aller au contenu")}
      </a>
      <Sidebar
        page={page}
        profile={user.profile}
        onLogout={onLogout}
        open={menu}
        onClose={closeMenu}
      >
        <a
          className="app-brand"
          href="#admin/dashboard"
          aria-label={tr("Anivaya, administration")}
        >
          <img
            src="/images/logo-anivaya-wordmark.png"
            alt=""
            width="1353"
            height="1162"
          />
        </a>
        <nav className="side-nav" aria-label={tr("Administration")}>
          {Object.entries(adminPages)
            .sort(
              ([a], [b]) =>
                navigationOrder.indexOf(a) - navigationOrder.indexOf(b),
            )
            .filter(
              ([id, p]) =>
                !["profil", "notifications", "parametres"].includes(id) &&
                (id !== "pilotage" || role === "Administrateur") &&
                (!p.tabs.length || p.tabs.some(([r]) => allowed.includes(r))),
            )
            .map(([id, p]) => (
              <a
                key={id}
                href={`#admin/${id}`}
                aria-current={page === id ? "page" : undefined}
              >
                <Icon name={p.icon} />
                {tr(p.title)}
              </a>
            ))}
        </nav>
        {/* Ordinateur : menu du compte en bas de la barre latérale ; tablette et mobile : dans l’en-tête. */}
        <div className="side-bottom admin-side-bottom">
          <AccountMenu
            profile={user.profile}
            onLogout={onLogout}
            profileHref="#admin/profil"
            roleLabel={role || "Mon compte"}
          />
        </div>
      </Sidebar>
      <div className="app-main">
        <header className="admin-topbar">
          {/* Sur tablette et mobile : bouton menu à gauche. */}
          <button
            className="admin-menu menu-toggle"
            aria-label={tr("Ouvrir la navigation")}
            aria-expanded={menu}
            aria-controls="main-sidebar"
            onClick={() => setMenu(true)}
          >
            <Icon name="menu" />
          </button>
          <AccountMenu
            profile={user.profile}
            onLogout={onLogout}
            profileHref="#admin/profil"
            roleLabel={role || "Mon compte"}
            mobile
          />
          <nav aria-label={tr("Fil d’Ariane")}>
            <a href="#admin/dashboard">{tr("Administration")}</a>
            <span> / {tr(config?.title || "Page introuvable")}</span>
          </nav>
          <div>
            {allowed.includes("alerts") && (
              <button
                className="admin-alert-trigger"
                aria-label={tr("Notifications de l’équipe, {0} non lues", [
                  overview?.unread || 0,
                ])}
                aria-haspopup="dialog"
                onClick={() => setAlerts(true)}
              >
                <Icon name="bell" />
                {!!overview?.unread && (
                  <span className="admin-unread">{overview.unread}</span>
                )}
              </button>
            )}
          </div>
        </header>
        <main id="admin-content" className="admin-content" tabIndex={-1}>
          {new URLSearchParams(query).get("from") === "dashboard" && (
            <a className="admin-back" href="#admin/dashboard">
              <Icon name="back" />
              <span className="sr-only">{tr("Retour au tableau de bord")}</span>
            </a>
          )}
          <div className="admin-heading">
            <div>
              <h1>{tr(config?.title || "Page introuvable")}</h1>
              <p>
                {tr(
                  config?.intro || "Cette page d’administration n’existe pas.",
                )}
              </p>
            </div>
            {role === "Administrateur" && page === "dashboard" && (
              <a
                className="button outline admin-heading-link"
                href="#admin/pilotage"
              >
                <Icon name="chart" />
                {tr("Voir le pilotage")}
              </a>
            )}
          </div>
          {error && (
            <div className="admin-error" role="alert">
              <p>{tr(error)}</p>
              <button className="button outline" onClick={refresh}>
                {tr("Réessayer")}
              </button>
            </div>
          )}
          {!config || denied ? (
            <section className="admin-panel admin-empty">
              <h2>{denied ? tr("Accès réservé") : tr("Page introuvable")}</h2>
              <p>
                {denied
                  ? tr("Votre rôle ne permet pas d’accéder à cette rubrique.")
                  : tr("Revenez au tableau de bord pour continuer.")}
              </p>
              <a
                className="button"
                href={role ? "#admin/dashboard" : "#espace"}
              >
                {tr("Revenir à mon espace")}
              </a>
            </section>
          ) : !overview && !error ? (
            <div className="admin-empty" role="status">
              {tr("Chargement de l’administration…")}
            </div>
          ) : (
            overview && (
              <>
                {page === "dashboard" && (
                  <AdminDashboard overview={overview} onChanged={refresh} />
                )}
                {page === "pilotage" && <AdminAnalytics />}
                {page === "profil" && (
                  // Une seule ligne d’onglets, comme dans l’espace particulier ;
                  // la sécurité ajoute les sessions de l’équipe à la double authentification.
                  <ProfilePage
                    embedded
                    profile={user.profile}
                    demo={user.demo}
                    initialTab={section === "security" ? "securite" : section}
                    onSaved={onProfileChanged}
                    onDeleted={onAccountDeleted}
                    security={
                      <>
                        <MfaPanel />
                        {allowed.includes("security") && (
                          <AdminCollection
                            resource="security"
                            role={role!}
                            query={query}
                            onQuery={(q) => {
                              window.location.hash = `admin/profil/security${q ? "?" + q : ""}`;
                            }}
                            onChanged={refresh}
                          />
                        )}
                      </>
                    }
                  />
                )}
                {!!tabs.length && tab && (
                  <>
                    <Tabs
                      animated
                      label={config.title}
                      // Les retours et imports en attente sont comptés sur leur onglet.
                      tabs={tabs.map(([key, label]) => {
                        const waiting = overview.attention.find(
                          (a) => a.resource === key,
                        )?.count;
                        return [
                          key,
                          ["feedback", "imports"].includes(key) && waiting
                            ? `${tr(label)} (${waiting})`
                            : label,
                        ] as const;
                      })}
                      active={tab}
                      onChange={(next) => {
                        window.location.hash = `admin/${page}/${next}`;
                      }}
                    />
                    {tabs.map(([key]) => (
                      <section
                        key={key}
                        id={`panel-${key}`}
                        role="tabpanel"
                        aria-labelledby={`tab-${key}`}
                        hidden={tab !== key}
                      >
                        {tab === key && (
                          <AdminCollection
                            key={key}
                            role={role!}
                            resource={key}
                            query={query}
                            onQuery={setQuery}
                            onChanged={refresh}
                          />
                        )}
                      </section>
                    ))}
                  </>
                )}
              </>
            )
          )}
        </main>
        {alerts && role && (
          <AdminPreview
            indicator={{
              id: "alerts",
              label: "Notifications non lues",
              resource: "alerts",
              query: "status=Non+lue",
              count: overview?.unread || 0,
              icon: "bell",
            }}
            role={role}
            onClose={() => setAlerts(false)}
            onChanged={refresh}
          />
        )}
      </div>
    </div>
  );
}
