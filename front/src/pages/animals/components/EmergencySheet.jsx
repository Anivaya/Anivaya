import { useEffect, useState } from "react";
import { api } from "../../../shared/services/api.js";
import { svgImage } from "../../../shared/utils/format.js";
import Icon from "../../../shared/ui/Icon.jsx";
import Portrait from "./AnimalPortrait.jsx";

const defaults = {
  active: true,
  photo: true,
  details: true,
  notes: false,
  contact: true,
  vet: false,
};
const labels = {
  active: [
    "Activer la fiche de démonstration",
    "Activez pour préparer un QR, puis sauvegardez votre configuration.",
  ],
  photo: ["Photo de l’animal", "Photo ou illustration du profil."],
  details: ["Race et sexe", "Pour aider à reconnaître l’animal."],
  notes: [
    "Consignes essentielles déclarées",
    "Comportement et consignes renseignés dans les habitudes.",
  ],
  contact: [
    "Contact principal fictif",
    "Aucun appel réel n’est effectué dans la démo.",
  ],
  vet: [
    "Contact vétérinaire fictif",
    "Coordonnées de démonstration uniquement.",
  ],
};

export default function EmergencySheet({
  pet,
  saved,
  actions,
  startEditing = false,
}) {
  const [editing, setEditing] = useState(startEditing || !saved);
  const [settings, setSettings] = useState(saved?.settings || defaults);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const settingsKey = JSON.stringify(settings);
  // An aborted or older request must never replace the QR for the latest choices.
  useEffect(() => {
    if (!editing) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api.previewEmergency(pet.id, settings, controller.signal).then(
        (value) => {
          if (!controller.signal.aborted)
            setResult({ key: settingsKey, value });
        },
        (failure) => {
          if (!controller.signal.aborted)
            setResult({ key: settingsKey, error: failure.message });
        },
      );
    }, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [pet.id, settings, settingsKey, editing, retry]);

  const current = result?.key === settingsKey ? result : null;
  const loading = editing && settings.active && !current;
  const sheet = editing ? current?.value?.snapshot : saved?.snapshot;
  const remove = () =>
    actions.openDialog("delete-record-item", {
      entity: "emergency",
      id: pet.id,
      name: "la fiche et son QR",
    });
  const downloads = sheet?.qrSvg && (
    <>
      <a
        className="button outline"
        href={svgImage(sheet.qrSvg)}
        download={`anivaya-qr-${pet.id}.svg`}
      >
        Télécharger le QR
      </a>
      <button className="button outline" onClick={() => window.print()}>
        Imprimer
      </button>
    </>
  );
  const qr = sheet?.qrSvg && (
    <div className="qr-wrap">
      <img
        src={svgImage(sheet.qrSvg)}
        alt={`QR de démonstration de ${pet.name}`}
      />
    </div>
  );

  async function save() {
    setBusy(true);
    setError("");
    try {
      await api.saveEmergency(pet.id, settings);
      await actions.saved("Fiche et QR enregistrés.");
      window.location.hash = `animaux/${pet.id}/apercu`;
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {saved && !editing ? (
        <section className="panel saved-card">
          <div className="saved-heading">
            {saved.settings.photo && (
              <Portrait
                pet={{ ...pet, photo: sheet.photo, style: sheet.style }}
              />
            )}
            <div>
              <span className="badge">Fiche d’urgence sauvegardée</span>
              <div className="saved-title-line">
                <h1>{sheet.name}</h1>
                <div className="saved-tools">
                  <button
                    className="icon-btn"
                    title="Modifier"
                    aria-label="Modifier la fiche d’urgence"
                    onClick={() => {
                      setSettings(saved.settings);
                      setEditing(true);
                    }}
                  >
                    <Icon name="edit" />
                  </button>
                  <button
                    className="icon-btn delete"
                    title="Supprimer"
                    aria-label="Supprimer la fiche d’urgence"
                    onClick={remove}
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              </div>
              <p className="muted">{sheet.details || sheet.species}</p>
              <p className="muted sheet-identifier">
                Identifiant : {pet.identifier || "Non renseigné"}
              </p>
            </div>
          </div>
          {sheet.notes && (
            <section className="saved-section">
              <h2>Consignes</h2>
              <p className="muted emergency-notes">{sheet.notes}</p>
            </section>
          )}
          {(sheet.contact || sheet.vet) && (
            <section className="saved-section">
              <h2>Contacts</h2>
              {[
                ["Contact principal", sheet.contact],
                ["Vétérinaire habituel", sheet.vet],
              ]
                .filter(([, value]) => value)
                .map(([label, value]) => (
                  <dl key={label}>
                    <div className="datum">
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  </dl>
                ))}
            </section>
          )}
          <div className="saved-qr-section">
            <h2>Son QR code</h2>
            {qr}
            <p className="muted">
              {sheet.qrSvg
                ? "QR de démonstration hors ligne, contenant uniquement les informations fictives sélectionnées."
                : "La fiche est désactivée. Modifiez-la pour préparer un nouveau QR."}
            </p>
            <div className="actions">{downloads}</div>
          </div>
        </section>
      ) : (
        <>
          <div className="emergency-welcome">
            <h1>Sa fiche d’urgence</h1>
            <p className="muted">
              Choisissez ce qu’une personne qui retrouve {pet.name} pourra
              consulter.
            </p>
          </div>
          <div className="grid">
            <section className="panel">
              <h2>Informations visibles</h2>
              {Object.entries(labels).map(([key, [label, help]]) => (
                <div className="visibility-option" key={key}>
                  <div className="switch-row">
                    <input
                      id={`visibility-${key}`}
                      type="checkbox"
                      checked={settings[key]}
                      disabled={busy || (!settings.active && key !== "active")}
                      onChange={(event) =>
                        setSettings({
                          ...settings,
                          [key]: event.target.checked,
                        })
                      }
                    />
                    <label htmlFor={`visibility-${key}`}>
                      {label}
                      <small>{help}</small>
                    </label>
                  </div>
                  {key === "photo" && (
                    <div className="switch-row">
                      <span className="muted">
                        Toujours inclus : nom et espèce. L’identification
                        complète, les documents privés et l’adresse du foyer
                        sont exclus.
                      </span>
                    </div>
                  )}
                </div>
              ))}
              <p className="note">
                Ces choix concernent uniquement la fiche d’urgence. Ils ne
                donnent jamais accès au carnet complet.
              </p>
            </section>
            <div className="stack">
              <section className="panel qr-panel" aria-busy={loading}>
                <h2>Le QR de {pet.name}</h2>
                <span className="active-status">
                  {settings.active
                    ? "Fiche de démonstration active"
                    : "Fiche désactivée"}
                </span>
                {settings.active ? (
                  <>
                    {loading ? (
                      <div className="qr-loading" role="status">
                        <span className="qr-spinner" />
                        Mise à jour du QR…
                      </div>
                    ) : current?.error ? (
                      <div className="empty">
                        <p role="alert">{current.error}</p>
                        <button
                          className="button outline"
                          onClick={() => setRetry((n) => n + 1)}
                        >
                          Réessayer
                        </button>
                      </div>
                    ) : (
                      qr
                    )}
                    <p className="muted">
                      QR lisible : il contient un texte fictif, sans lien web ni
                      coordonnées réelles. Le scanner affiche ce texte ; il
                      n’ouvre pas la page locale.
                    </p>
                    <div className="actions">
                      <button
                        className="button"
                        disabled={busy || loading || !sheet?.qrSvg}
                        onClick={save}
                      >
                        {busy ? "Sauvegarde…" : "Sauvegarder"}
                      </button>
                      {downloads}
                      {saved && (
                        <button
                          className="button danger"
                          onClick={remove}
                          disabled={busy}
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                    {sheet?.payload && (
                      <details>
                        <summary className="muted">
                          Voir le contenu du QR
                        </summary>
                        <pre className="qr-payload">{sheet.payload}</pre>
                      </details>
                    )}
                  </>
                ) : (
                  <p className="empty">
                    La fiche est désactivée. Réactivez-la pour générer son QR et
                    son aperçu.
                  </p>
                )}
                {saved && (
                  <button
                    className="text-button cancel-emergency"
                    disabled={busy}
                    onClick={() => {
                      setSettings(saved.settings);
                      setEditing(false);
                      setError("");
                    }}
                  >
                    Annuler les modifications
                  </button>
                )}
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
              </section>
              <p className="note">
                Une fiche accessible par QR sur téléphone nécessitera une
                adresse web publiée. Ce QR contient une copie des informations
                sélectionnées ; les QR déjà téléchargés restent lisibles.
              </p>
            </div>
          </div>
        </>
      )}
      {sheet?.qrSvg && (
        <div className="qr-print">
          <h1>{sheet.name}</h1>
          <p>{sheet.details || sheet.species}</p>
          {sheet.notes && <p className="emergency-notes">{sheet.notes}</p>}
          <p>{sheet.contact}</p>
          <p>{sheet.vet}</p>
          <img src={svgImage(sheet.qrSvg)} alt="QR à imprimer" />
          <p>Anivaya · QR de démonstration hors ligne</p>
        </div>
      )}
    </>
  );
}
