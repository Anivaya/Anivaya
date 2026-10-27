import { useState } from "react";
import type { FormEvent } from "react";
import type { ExportCategory } from "../../../../shared/account.ts";
import { exportCategories } from "../../../../shared/account.ts";
import { api } from "../../shared/services/api.ts";
import { errorMessage } from "../../shared/types.ts";
import Modal from "../../shared/ui/Modal.tsx";

const categoryLabels: Record<ExportCategory, [string, string]> = {
  profile: [
    "Profil et préférences",
    "Vos coordonnées et vos choix de notifications.",
  ],
  animals: [
    "Animaux et carnets",
    "Identités, informations du carnet, événements et fiches d’urgence enregistrées.",
  ],
  documents: [
    "Documents et rappels",
    "Informations des documents et liste des échéances.",
  ],
  sharing: [
    "Partages et personnes de confiance",
    "Partages envoyés, contacts associés et état des invitations reçues.",
  ],
  bookings: ["Réservations", "Rendez-vous, statuts et paiements simulés."],
  social: [
    "Communautés et messagerie",
    "Vos adhésions, participations, relations et messages envoyés (sans les photos ni les messages des autres).",
  ],
};

/** Télécharge un objet sous forme de fichier JSON. */
function downloadJson(data: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json;charset=utf-8",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/** Onglet « Exportation » : choix des catégories puis fichier JSON. */
export function ExportPanel() {
  const [selected, setSelected] = useState<ExportCategory[]>([]);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string }>();
  async function submit(categories: ExportCategory[]) {
    setBusy(true);
    setFeedback(undefined);
    try {
      downloadJson(
        await api.exportData(categories),
        `anivaya-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`,
      );
      setFeedback({
        ok: true,
        text: "Téléchargement lancé. Retrouvez le fichier JSON dans les téléchargements de votre navigateur.",
      });
    } catch (failure) {
      setFeedback({ ok: false, text: errorMessage(failure) });
    } finally {
      setBusy(false);
    }
  }
  const partial =
    selected.length > 0 && selected.length < exportCategories.length;
  return (
    <form
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        void submit(selected);
      }}
      aria-busy={busy}
    >
      <section className="profile-panel">
        <h2>Que souhaitez-vous récupérer ?</h2>
        <p className="muted">
          Choisissez les catégories à inclure dans votre fichier.
        </p>
        {exportCategories.map((key) => (
          <label className="export-choice" key={key}>
            <input
              type="checkbox"
              checked={selected.includes(key)}
              onChange={(e) => {
                setFeedback(undefined);
                setSelected(
                  e.target.checked
                    ? [...selected, key]
                    : selected.filter((k) => k !== key),
                );
              }}
            />
            <span>
              <strong>{categoryLabels[key][0]}</strong>
              <small>{categoryLabels[key][1]}</small>
            </span>
          </label>
        ))}
        <p className="field-help">
          Les données de votre espace sont exportées ; les exemples sont
          signalés. Cet export ne remplace pas une sauvegarde des fichiers
          d’origine.
        </p>
      </section>
      <section className="profile-panel">
        <h2>Un fichier JSON</h2>
        <p>
          Ce format rassemble vos informations dans un fichier structuré,
          lisible avec un éditeur de texte.
        </p>
        <ul className="export-notes">
          <li>
            Documents : noms, catégories et informations enregistrées ; les
            fichiers PDF ou photos d’origine ne sont pas inclus.
          </li>
          <li>
            Partages reçus : informations sur les invitations et leur état ;
            aucun contenu appartenant aux autres propriétaires.
          </li>
          <li>Aucun mot de passe ni information bancaire.</li>
        </ul>
        <p className="field-help">
          Le fichier peut contenir vos coordonnées et celles de vos proches.
          Conservez-le dans un endroit personnel.
        </p>
      </section>
      {feedback && (
        <p
          className={`profile-feedback ${feedback.ok ? "success" : "error"}`}
          role={feedback.ok ? "status" : "alert"}
        >
          {feedback.text}
        </p>
      )}
      <div className="export-actions">
        {partial && (
          <button type="submit" className="button outline" disabled={busy}>
            Exporter mes données ({selected.length})
          </button>
        )}
        <button
          type="button"
          id="export-all"
          className="button"
          disabled={busy}
          onClick={() => submit([...exportCategories])}
        >
          Exporter toutes mes données
        </button>
      </div>
    </form>
  );
}

/** Onglet « Suppression du compte », confirmé par une case et le mot SUPPRIMER. */
export function DeletionPanel({
  demo,
  onExportFirst,
  onDeleted,
}: {
  demo: boolean;
  onExportFirst: () => void;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [consent, setConsent] = useState(false);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ready = consent && word.trim() === "SUPPRIMER";
  function close() {
    setOpen(false);
    setConsent(false);
    setWord("");
    setError("");
  }
  async function confirm() {
    if (!ready) return;
    setBusy(true);
    setError("");
    try {
      await api.deleteAccount(word.trim());
      onDeleted();
    } catch (failure) {
      setError(errorMessage(failure));
      setBusy(false);
    }
  }
  return (
    <>
      <section
        className="profile-panel account-danger"
        aria-labelledby="delete-account-title"
      >
        <h2 id="delete-account-title">Supprimer mon compte</h2>
        <p>
          Cette action efface votre profil, vos animaux, documents, rappels,
          partages, réservations et fiches d’urgence, puis ferme votre session.
          Pensez à exporter vos données avant de continuer.
        </p>
        <button
          className="button danger"
          type="button"
          onClick={() => setOpen(true)}
        >
          Supprimer mon compte
        </button>
        <p className="field-help security-note">
          {demo
            ? "Compte de démonstration : son espace d’exemple sera recréé et ses identifiants resteront utilisables."
            : "La suppression est définitive : votre compte et votre espace ne pourront pas être récupérés."}
        </p>
      </section>
      {open && (
        <Modal busy={busy} onClose={close}>
          <h2 id="action-title">Supprimer votre compte ?</h2>
          <p className="muted">
            Votre profil, vos animaux, documents, rappels, partages,
            réservations et fiches d’urgence seront effacés. Les fiches
            publiques et leurs QR codes cesseront de fonctionner. Les fichiers
            déjà téléchargés sur votre appareil sont conservés.
          </p>
          <p>
            <button
              type="button"
              className="button outline"
              onClick={() => {
                close();
                onExportFirst();
              }}
            >
              Exporter mes données avant de continuer
            </button>
          </p>
          <label className="delete-consent">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>Je comprends que mes données seront effacées.</span>
          </label>
          <div className="field">
            <label htmlFor="delete-word">
              Saisissez SUPPRIMER pour confirmer
            </label>
            <input
              id="delete-word"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={word}
              onChange={(e) => setWord(e.target.value)}
              aria-describedby="delete-error"
            />
          </div>
          <p className="profile-inline-error" id="delete-error" role="alert">
            {error}
          </p>
          <div className="dialog-actions">
            <button
              type="button"
              className="button outline"
              disabled={busy}
              onClick={close}
            >
              Conserver mon compte
            </button>
            <button
              type="button"
              className="button danger"
              disabled={!ready || busy}
              onClick={confirm}
            >
              {busy ? "Suppression…" : "Supprimer mon compte"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
