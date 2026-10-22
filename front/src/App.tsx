import type {
  Actions,
  DialogState,
  Reminder,
  PageProps,
} from "./shared/types.ts";
import { errorMessage } from "./shared/types.ts";
import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import { api } from "./shared/services/api.ts";
import { useDashboard } from "./shared/hooks/useDashboard.ts";
import Sidebar from "./shared/layout/Sidebar.tsx";
import ActionDialog from "./app/ActionDialog.tsx";
import DashboardPage from "./pages/dashboard/DashboardPage.tsx";
import AnimalsPage from "./pages/animals/AnimalsPage.tsx";
import RemindersPage from "./pages/reminders/RemindersPage.tsx";
import DocumentsPage from "./pages/documents/DocumentsPage.tsx";
import SharingPage from "./pages/sharing/SharingPage.tsx";
import "./css/dashboard.css";
import "./css/animals.css";
import "./css/documents.css";
import "./css/fonts.css";
import "./css/record.css";
import "./css/sharing.css";
import "./css/collections.css";
const pageComponents: Record<string, ComponentType<PageProps>> = {
  espace: DashboardPage,
  animaux: AnimalsPage,
  rappels: RemindersPage,
  documents: DocumentsPage,
  partage: SharingPage,
};

const pages: Record<string, [string, string]> = {
  partage: [
    "Partage",
    "Les bonnes informations, aux personnes que vous choisissez.",
  ],
  espace: ["Vue d’ensemble", "Tout pour prendre soin de vos compagnons."],
  animaux: ["Mes animaux", "Un carnet pour chacun de vos compagnons."],
  rappels: ["Mes rappels", "Retrouvez les échéances que vous avez choisies."],
  documents: [
    "Mes documents",
    "Les documents de vos animaux, au même endroit.",
  ],
};
const currentPage = () =>
  Object.hasOwn(pages, window.location.hash.slice(1).split("/")[0])
    ? window.location.hash.slice(1).split("/")[0]
    : "espace";

export default function App() {
  const [route, setRoute] = useState(() => window.location.hash);
  const page = currentPage();
  const [modal, setModal] = useState<DialogState | null>(null);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const { data, loading, error, reload } = useDashboard();
  useEffect(() => {
    function navigate() {
      setRoute(window.location.hash);
      document.getElementById("dashboard-content")?.focus();
      window.scrollTo(0, 0);
    }
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, []);
  useEffect(() => {
    document.title = "Anivaya";
  }, [page]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
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
  const household = data?.household;
  const add: Actions["add"] = (kind, animal) =>
    setModal({ kind: `add-${kind}`, item: animal ? { animal } : undefined });
  const Page = pageComponents[page];
  const actions: Actions = {
    add,
    openAnimal: (item) =>
      page === "animaux"
        ? (window.location.hash = `animaux/${item.id}/apercu`)
        : setModal({ kind: "animal", item }),
    openRecord: (item) => {
      window.location.hash = `animaux/${item.id}/apercu`;
      setModal(null);
    },
    openDialog: (kind, item) => setModal({ kind, item }),
    saved: async (message) => {
      await reload().catch(() => {});
      setNotice(message);
    },
    openReminder: (item) => setModal({ kind: "reminder", item }),
    openDocument: (kind, item) => setModal({ kind, item }),
    toggleReminder,
  };
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
        <Sidebar
          page={page}
          household={household}
          onPublic={() => setModal({ kind: "public" })}
        />
        <div className="app-main">
          <header className="app-top">
            <strong>Mon espace</strong>
            <small>/ {pages[page][0]}</small>
            <button
              className="demo-label"
              onClick={() => setModal({ kind: "public" })}
            >
              Voir le site public ↗
            </button>
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
            {data && (
              <Page
                data={data}
                actions={actions}
                pending={pending}
                route={route}
              />
            )}
            <p className="app-foot">
              Espace de démonstration · Connexion simulée · Données fictives.
              <br />
              Vos ajouts sont enregistrés localement et conservés après
              actualisation. Aucune notification réelle n’est envoyée.
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
          onOpenDialog={actions.openDialog}
          onSaved={async (message) => {
            await reload().catch(() => {});
            setModal(null);
            setNotice(message);
          }}
        />
      )}
      <div className="toast" role="status" hidden={!notice}>
        {notice}
      </div>
    </>
  );
}
