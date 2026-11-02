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
  const profileTab =
    section === "security" ? "admin-security" : "admin-profile";
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
  useEffect(() => {
    document.title = `${config?.title || "Page introuvable"} · Administration Anivaya`;
    // Le titre de l’application revient en quittant l’administration.
    return () => {
      document.title = "Anivaya";
    };
  }, [config]);
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
        Aller au contenu
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
          aria-label="Anivaya, administration"
        >
          <img
            src="/images/logo-anivaya-wordmark.png"
            alt=""
            width="1353"
            height="1162"
          />
        </a>
        <nav className="side-nav" aria-label="Administration">
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
                {p.title}
              </a>
            ))}
        </nav>
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
          <nav aria-label="Fil d’Ariane">
            <a href="#admin/dashboard">Administration</a>
            <span> / {config?.title || "Page introuvable"}</span>
          </nav>
          <div>
            {allowed.includes("alerts") && (
              <button
                className="admin-alert-trigger"
                aria-label={`Notifications de l’équipe, ${overview?.unread || 0} non lues`}
                aria-haspopup="dialog"
                onClick={() => setAlerts(true)}
              >
                <Icon name="bell" />
                {!!overview?.unread && (
                  <span className="admin-unread">{overview.unread}</span>
                )}
              </button>
            )}
            {/* Sur tablette et mobile : bouton menu à droite de la cloche. */}
            <button
              className="admin-menu button outline"
              aria-label="Ouvrir la navigation"
              aria-expanded={menu}
              aria-controls="main-sidebar"
              onClick={() => setMenu(true)}
            >
              ☰
            </button>
          </div>
        </header>
        <main id="admin-content" className="admin-content" tabIndex={-1}>
          {new URLSearchParams(query).get("from") === "dashboard" && (
            <a className="admin-back" href="#admin/dashboard">
              ← Retour au tableau de bord
            </a>
          )}
          <div className="admin-heading">
            <div>
              <h1>{config?.title || "Page introuvable"}</h1>
              <p>
                {config?.intro || "Cette page d’administration n’existe pas."}
              </p>
            </div>
            {role === "Administrateur" && page === "dashboard" && (
              <a className="button outline" href="#admin/pilotage">
                <Icon name="chart" />
                Voir le pilotage
              </a>
            )}
          </div>
          {error && (
            <div className="admin-error" role="alert">
              <p>{error}</p>
              <button className="button outline" onClick={refresh}>
                Réessayer
              </button>
            </div>
          )}
          {!config || denied ? (
            <section className="admin-panel admin-empty">
              <h2>{denied ? "Accès réservé" : "Page introuvable"}</h2>
              <p>
                {denied
                  ? "Votre rôle ne permet pas d’accéder à cette rubrique."
                  : "Revenez au tableau de bord pour continuer."}
              </p>
              <a
                className="button"
                href={role ? "#admin/dashboard" : "#espace"}
              >
                Revenir à mon espace
              </a>
            </section>
          ) : !overview && !error ? (
            <div className="admin-empty" role="status">
              Chargement de l’administration…
            </div>
          ) : (
            overview && (
              <>
                {page === "dashboard" && (
                  <AdminDashboard overview={overview} onChanged={refresh} />
                )}
                {page === "pilotage" && <AdminAnalytics />}
                {page === "profil" && (
                  <>
                    <Tabs
                      animated
                      label="Profil administrateur"
                      tabs={
                        [
                          ["admin-profile", "Profil"],
                          ["admin-security", "Sécurité"],
                        ] as const
                      }
                      active={profileTab}
                      onChange={(next) => {
                        window.location.hash = `admin/profil/${next === "admin-security" ? "security" : "profile"}${query ? "?" + query : ""}`;
                      }}
                    />
                    <section
                      role="tabpanel"
                      id={`panel-${profileTab}`}
                      aria-labelledby={`tab-${profileTab}`}
                    >
                      {profileTab === "admin-profile" ? (
                        <ProfilePage
                          embedded
                          profile={user.profile}
                          demo={user.demo}
                          onSaved={onProfileChanged}
                          onDeleted={onAccountDeleted}
                        />
                      ) : (
                        <>
                          <MfaPanel />
                          {allowed.includes("security") && (
                            <AdminCollection
                              resource="security"
                              role={role!}
                              query=""
                              onQuery={(q) => {
                                window.location.hash = `admin/parametres/security?${q}`;
                              }}
                              onChanged={refresh}
                            />
                          )}
                        </>
                      )}
                    </section>
                  </>
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
                            ? `${label} (${waiting})`
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
