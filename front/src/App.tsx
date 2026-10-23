import type { ComponentType } from "react";
import { useEffect, useRef, useState } from "react";
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
import Sidebar, { AccountMenu } from "./shared/layout/Sidebar.tsx";
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
} from "./pages/documents/DocumentDialogs.tsx";
import SharingDialog from "./pages/sharing/SharingDialogs.tsx";

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
};

export default function App() {
  const sessionVersion = useRef(0);
  const [route, setRoute] = useState(
    () => window.location.hash.slice(1) || "accueil",
  );
  const [user, setUser] = useState<AuthUser | null>(null),
    [loading, setLoading] = useState(true),
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
  useEffect(() => {
    if (homeSection)
      requestAnimationFrame(() =>
        document
          .getElementById(homeSection)
          ?.scrollIntoView({ behavior: "smooth" }),
      );
  }, [homeSection]);
  const authenticated = (value: AuthUser) => {
    sessionVersion.current++;
    setLoading(false);
    setUser(value);
    setError("");
    window.location.hash = "espace";
  };
  const logout = async () => {
    await api.logout();
    sessionVersion.current++;
    setUser(null);
    window.location.hash = "connexion";
  };
  if (page === "urgence")
    return (
      <PublicEmergencyPage key={route} token={params[0]?.split("?")[0] || ""} />
    );
  if (page === "accueil") return <HomePage />;
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
    return <AuthPage register={false} onAuthenticated={authenticated} />;
  return (
    <Workspace
      key={user.id}
      user={user}
      page={Object.hasOwn(workspacePages, page) ? page : "espace"}
      params={params}
      onLogout={logout}
      onProfileChanged={async (profile) => setUser({ ...user, profile })}
    />
  );
}

function Workspace({
  user,
  page,
  params,
  onLogout,
  onProfileChanged,
}: {
  user: AuthUser;
  page: string;
  params: string[];
  onLogout: () => Promise<void>;
  onProfileChanged: (profile: Profile) => Promise<void>;
}) {
  const [modal, setModal] = useState<DialogState | null>(null);
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
  async function refresh(message: string) {
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
      <div className={`workspace ${page !== "espace" ? "section-mode" : ""}`}>
        <Sidebar page={page} profile={user.profile} onLogout={onLogout} />
        <div className="app-main">
          <header className="app-top">
            <strong>Mon espace</strong>
            <small>/ {title}</small>
            <AccountMenu profile={user.profile} onLogout={onLogout} mobile />
          </header>
          <main
            className="app-content"
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
                onSaved={async (profile) => {
                  await onProfileChanged(profile);
                  await reload();
                }}
              />
            )}
            {data && (page === "annuaire" || page === "reservations") && (
              <DirectoryPage
                animals={data.animals}
                profile={user.profile}
                reservations={page === "reservations"}
              />
            )}
            <p className="app-foot">
              {user.id === "demo"
                ? "Compte de démonstration · Données fictives. "
                : "Votre espace personnel. "}
              Vos modifications sont conservées. Les notifications et les
              paiements ne sont pas envoyés à un service externe.
            </p>
          </main>
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
