import type { ComponentType } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AuthUser, Profile } from "../../shared/account.ts";
import type {
  Actions,
  Animal,
  Dashboard,
  DialogControls,
  DialogKind,
  DialogState,
  Document,
  OpenDialog,
  PageProps,
  Reminder,
} from "./shared/types.ts";
import { errorMessage } from "./shared/types.ts";
import { api } from "./shared/services/api.ts";
import { useDashboard } from "./shared/hooks.ts";
import Sidebar, { AccountMenu, SIDEBAR_ID } from "./shared/layout/Sidebar.tsx";
import Modal from "./shared/ui/Modal.tsx";
import HomePage from "./pages/home/HomePage.tsx";
import AuthPage from "./pages/auth/AuthPage.tsx";
import PublicEmergencyPage from "./pages/animals/PublicEmergencyPage.tsx";
import DashboardPage from "./pages/dashboard/DashboardPage.tsx";
import AnimalsPage from "./pages/animals/AnimalsPage.tsx";
import RemindersPage from "./pages/reminders/RemindersPage.tsx";
import DocumentsPage from "./pages/documents/DocumentsPage.tsx";
import SharingPage from "./pages/sharing/SharingPage.tsx";
import ProfilePage from "./pages/profile/ProfilePage.tsx";
import DirectoryPage from "./pages/directory/DirectoryPage.tsx";
import NotificationsPage from "./pages/notifications/NotificationsPage.tsx";
import CommunitiesPage from "./pages/communities/CommunitiesPage.tsx";
import ContactPage, {
  PublicContactPage,
} from "./pages/contact/ContactPage.tsx";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage.tsx";
import Icon from "./shared/ui/Icon.tsx";
import {
  AnimalDetails,
  AnimalForm,
  RecordAction,
} from "./pages/animals/AnimalDialogs.tsx";
import {
  ReminderDetails,
  ReminderForm,
} from "./pages/reminders/ReminderDialogs.tsx";
import {
  DocumentDetails,
  DocumentForm,
  DeleteDocument,
  DownloadDocuments,
  DeleteDocuments,
} from "./pages/documents/DocumentDialogs.tsx";
import SharingDialog from "./pages/sharing/SharingDialogs.tsx";
import AiImport from "./pages/documents/AiImport.tsx";
import AdminWorkspace from "./pages/admin/AdminWorkspace.tsx";

/** Pages de l’espace connecté : titre du fil d’Ariane et contenu tiré du dashboard. */
const workspacePages: Record<
  string,
  { title: string; Page?: ComponentType<PageProps> }
> = {
  espace: { title: "Vue d’ensemble", Page: DashboardPage },
  animaux: { title: "Mes animaux", Page: AnimalsPage },
  rappels: { title: "Mes rappels", Page: RemindersPage },
  documents: { title: "Mes documents", Page: DocumentsPage },
  partage: { title: "Partage", Page: SharingPage },
  annuaire: { title: "Professionnels" },
  reservations: { title: "Professionnels" },
  profil: { title: "Gestion de profil" },
  notifications: { title: "Notifications", Page: NotificationsPage },
  contact: { title: "Contact et informations" },
  communautes: { title: "Communautés" },
};
/** Pages secondaires, plus étroites que le tableau de bord. */
const secondaryPages = new Set(["notifications", "contact"]);

export default function App() {
  const sessionVersion = useRef(0);
  const [route, setRoute] = useState(
    () => window.location.hash.slice(1) || "accueil",
  );
  const [user, setUser] = useState<AuthUser | null>(null),
    [loading, setLoading] = useState(true),
    [deletedNotice, setDeletedNotice] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const navigate = () => {
      setRoute(window.location.hash.slice(1) || "accueil");
      window.scrollTo(0, 0);
    };
    const expired = () => {
      sessionVersion.current++;
      setUser(null);
      window.location.hash = "connexion";
    };
    window.addEventListener("hashchange", navigate);
    window.addEventListener("anivaya-session-expired", expired);
    return () => {
      window.removeEventListener("hashchange", navigate);
      window.removeEventListener("anivaya-session-expired", expired);
    };
  }, []);
  useEffect(() => {
    // Une connexion ou une déconnexion survenue entre-temps rend cette réponse obsolète.
    const controller = new AbortController();
    const version = sessionVersion.current;
    api
      .session(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted && version === sessionVersion.current)
          setUser(value);
      })
      .catch((e) => {
        if (!controller.signal.aborted && version === sessionVersion.current)
          setError(errorMessage(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);
  const [page, ...params] = route.split("/");
  const homeSection = page === "accueil" ? params[0] : undefined;
  const authenticated = (value: AuthUser) => {
    sessionVersion.current++;
    setLoading(false);
    setUser(value);
    setError("");
    // Un membre de l’équipe arrive sur son tableau de bord d’administration.
    window.location.hash = value.adminRole ? "admin/dashboard" : "espace";
  };
  const logout = async () => {
    await api.logout();
    sessionVersion.current++;
    setUser(null);
    window.location.hash = "connexion";
  };
  /** Le serveur a déjà fermé la session : retour à l’accueil avec une confirmation. */
  const accountDeleted = () => {
    sessionVersion.current++;
    setUser(null);
    setDeletedNotice(true);
    window.location.hash = "accueil";
  };
  if (page === "urgence")
    return (
      <PublicEmergencyPage key={route} token={params[0]?.split("?")[0] || ""} />
    );
  if (page === "accueil")
    return (
      <HomePage
        section={homeSection}
        accountDeleted={deletedNotice}
        onDismiss={() => setDeletedNotice(false)}
      />
    );
  if (page === "reinitialisation")
    return (
      <ResetPasswordPage
        // Recréée quand la session arrive, pour proposer l’e-mail du compte.
        key={`${route}-${user?.id ?? ""}`}
        fromProfile={params[0] === "profil"}
        email={user?.profile.email}
      />
    );
  if (page === "connexion" || page === "inscription")
    return (
      <AuthPage
        register={page === "inscription"}
        onAuthenticated={authenticated}
      />
    );
  if (loading)
    return (
      <div className="session-screen" role="status">
        Chargement de votre espace…
      </div>
    );
  if (error)
    return (
      <div className="session-screen" role="alert">
        <p>{error}</p>
        <button className="button" onClick={() => window.location.reload()}>
          Réessayer
        </button>
      </div>
    );
  if (!user)
    return page === "contact" ? (
      <PublicContactPage tab={params[0]} />
    ) : (
      <AuthPage register={false} onAuthenticated={authenticated} />
    );
  if (page === "admin")
    return (
      <AdminWorkspace
        key={user.id}
        user={user}
        route={route}
        onLogout={logout}
        onProfileChanged={async (profile) => setUser({ ...user, profile })}
        onAccountDeleted={accountDeleted}
      />
    );
  return (
    <Workspace
      key={user.id}
      user={user}
      page={Object.hasOwn(workspacePages, page) ? page : "espace"}
      params={params}
      onLogout={logout}
      onProfileChanged={async (profile) => setUser({ ...user, profile })}
      onAccountDeleted={accountDeleted}
    />
  );
}

function Workspace({
  user,
  page,
  params,
  onLogout,
  onProfileChanged,
  onAccountDeleted,
}: {
  user: AuthUser;
  page: string;
  params: string[];
  onLogout: () => Promise<void>;
  onProfileChanged: (profile: Profile) => Promise<void>;
  onAccountDeleted: () => void;
}) {
  const [modal, setModal] = useState<DialogState | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const { data, loading, error, reload } = useDashboard();
  useEffect(() => {
    const focusContent = () =>
      document.getElementById("dashboard-content")?.focus();
    window.addEventListener("hashchange", focusContent);
    return () => window.removeEventListener("hashchange", focusContent);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  /** Recharge l’espace après une modification, ferme la fenêtre et confirme. */
  async function refresh(message = "") {
    await reload().catch(() => {});
    setModal(null);
    setNotice(message);
  }
  async function toggleReminder(reminder: Reminder) {
    setPending(reminder.id);
    try {
      await api.setReminder(reminder.id, !reminder.done);
      await reload();
      setNotice(
        reminder.done ? "Rappel remis à faire." : "Rappel marqué comme fait.",
      );
    } catch (failure) {
      setNotice(errorMessage(failure));
    } finally {
      setPending(null);
    }
  }
  const openDialog: OpenDialog = (kind, item) => setModal({ kind, item });
  const actions: Actions = {
    add: (kind, animal) =>
      openDialog(`add-${kind}`, animal ? { animal } : undefined),
    openAnimal: (item) =>
      page === "animaux"
        ? (window.location.hash = `animaux/${item.id}/apercu`)
        : openDialog("animal", item),
    openRecord: (item) => {
      window.location.hash = `animaux/${item.id}/apercu`;
      setModal(null);
    },
    openDialog,
    saved: refresh,
    toggleReminder,
  };
  const { title, Page } = workspacePages[page];
  const unread = data?.notifications.filter((n) => !n.read).length ?? 0;
  return (
    <>
      <a
        className="skip"
        href="#dashboard-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("dashboard-content")?.focus();
        }}
      >
        Aller au contenu
      </a>
      <div
        className={`workspace ${page !== "espace" ? "section-mode" : ""} ${page === "documents" ? "documents-mode" : ""}`}
      >
        <Sidebar
          page={page}
          profile={user.profile}
          onLogout={onLogout}
          open={menuOpen}
          onClose={closeMenu}
        />
        <div className="app-main">
          <header className="app-top">
            {/* Sur tablette et mobile : bouton menu à gauche, à la place du logo. */}
            <button
              type="button"
              className="menu-toggle"
              aria-label="Ouvrir le menu de navigation"
              aria-expanded={menuOpen}
              aria-controls={SIDEBAR_ID}
              onClick={() => setMenuOpen(true)}
            >
              <Icon name="menu" />
            </button>
            <strong className="top-title">Mon espace</strong>
            <small>/ {title}</small>
            <a
              href="#notifications"
              className="notification-bell"
              title="Centre de notifications"
              aria-label={
                "Notifications" + (unread ? `, ${unread} non lues` : "")
              }
              aria-current={page === "notifications" ? "page" : undefined}
            >
              <Icon name="bell" />
              {unread > 0 && (
                <span className="notification-count" aria-hidden="true">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </a>
            <AccountMenu profile={user.profile} onLogout={onLogout} mobile />
          </header>
          <main
            className={
              "app-content" +
              (secondaryPages.has(page) ? " secondary-page" : "")
            }
            id="dashboard-content"
            tabIndex={-1}
            aria-busy={loading}
          >
            {loading && !data && (
              <p className="empty" role="status">
                Chargement de votre espace…
              </p>
            )}
            {error && (
              <div className="empty error-panel" role="alert">
                <p>{error}</p>
                <button
                  className="button outline"
                  onClick={() => reload().catch(() => {})}
                >
                  Réessayer
                </button>
              </div>
            )}
            {data && Page && (
              <Page
                data={data}
                actions={actions}
                pending={pending}
                params={params}
              />
            )}
            {page === "profil" && (
              <ProfilePage
                profile={user.profile}
                demo={user.demo}
                initialTab={params[0]}
                onDeleted={onAccountDeleted}
                onSaved={async (profile) => {
                  await onProfileChanged(profile);
                  await reload();
                }}
              />
            )}
            {page === "communautes" && <CommunitiesPage params={params} />}
            {page === "contact" && (
              <ContactPage
                key={params[0] ?? ""}
                profile={user.profile}
                initialTab={params[0]}
              />
            )}
            {data && (page === "annuaire" || page === "reservations") && (
              <DirectoryPage
                animals={data.animals}
                profile={user.profile}
                reservations={page === "reservations"}
              />
            )}
          </main>
          <footer className="connected-help">
            <a href="#contact">Contact et informations du service</a>
          </footer>
        </div>
      </div>
      {modal && data && (
        <ActionDialog
          key={`${modal.kind}-${modal.item?.id || "new"}`}
          modal={modal}
          data={data}
          onClose={() => setModal(null)}
          onOpenRecord={actions.openRecord}
          onOpenDialog={openDialog}
          onSaved={refresh}
        />
      )}
      <div className="toast" role="status" hidden={!notice}>
        {notice}
      </div>
    </>
  );
}

const sharingDialogs = new Set<DialogKind>([
  "add-person",
  "edit-person",
  "delete-person",
  "remove-person",
  "associate-people",
  "share-document",
  "share-documents",
  "share-details",
  "revoke-share",
]);

/** Ouvre la fenêtre métier correspondant au type demandé. */
function ActionDialog({
  modal,
  data,
  onClose,
  onSaved,
  onOpenRecord,
  onOpenDialog,
}: {
  modal: DialogState;
  data: Dashboard;
  onClose: () => void;
  onSaved: DialogControls["onSaved"];
  onOpenRecord: Actions["openRecord"];
  onOpenDialog: OpenDialog;
}) {
  const [busy, setBusy] = useState(false);
  const { kind } = modal;
  if (kind === "ai-import")
    return (
      <AiImport data={data} animal={modal.item?.animal} onClose={onClose} />
    );
  const props = {
    kind,
    onOpenRecord,
    onOpenDialog,
    data,
    onClose,
    onSaved,
    busy,
    setBusy,
  };
  const item = modal.item || {};
  let content;
  switch (kind) {
    case "animal":
      content = <AnimalDetails {...props} item={item as Animal} />;
      break;
    case "add-animal":
    case "edit-animal":
      content = <AnimalForm {...props} item={item as Partial<Animal>} />;
      break;
    case "reminder":
      content = <ReminderDetails {...props} item={item as Reminder} />;
      break;
    case "record-reminder":
    case "add-reminder":
    case "edit-reminder":
      content = <ReminderForm {...props} item={item as Partial<Reminder>} />;
      break;
    case "document":
      content = <DocumentDetails {...props} item={item as Document} />;
      break;
    case "delete-document":
      content = <DeleteDocument {...props} item={item as Document} />;
      break;
    case "download-documents":
      content = <DownloadDocuments {...props} item={item} />;
      break;
    case "delete-documents":
      content = <DeleteDocuments {...props} item={item} />;
      break;
    case "add-document":
    case "edit-document":
      content = <DocumentForm {...props} item={item as Partial<Document>} />;
      break;
    case "record-event":
    case "edit-event":
    case "view-event":
    case "habits":
    case "delete-record-item":
      content = <RecordAction {...props} item={item} />;
      break;
    default:
      content = <SharingDialog {...props} item={item} />;
  }
  return (
    <Modal
      onClose={onClose}
      busy={busy}
      header={kind !== "animal"}
      className={
        kind === "animal"
          ? "animal-modal"
          : sharingDialogs.has(kind)
            ? "sharing-modal"
            : ""
      }
    >
      {content}
    </Modal>
  );
}
