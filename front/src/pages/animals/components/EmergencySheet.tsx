import { useText } from "../../../shared/i18n/HomeLocale.tsx";
import type { ReactNode } from "react";
import type {
  Actions,
  Animal,
  EmergencySheet,
  EmergencySettings,
} from "../../../shared/types.ts";
import { errorMessage } from "../../../shared/types.ts";
import { useEffect, useState } from "react";
import { api } from "../../../shared/services/api.ts";
import { svgImage } from "../../../shared/utils/format.ts";
import Modal from "../../../shared/ui/Modal.tsx";
import Icon from "../../../shared/ui/Icon.tsx";
import Portrait from "./AnimalPortrait.tsx";

const defaults: EmergencySettings = {
  active: true,
  photo: true,
  details: true,
  notes: false,
  contact: true,
  vet: false,
};
const labels: Record<keyof EmergencySettings, [string, string]> = {
  active: [
    "Activer la fiche publique",
    "Activez pour préparer un QR, puis sauvegardez votre configuration.",
  ],
  photo: ["Photo de l’animal", "Photo ou illustration du profil."],
  details: ["Race et sexe", "Pour aider à reconnaître l’animal."],
  notes: [
    "Consignes essentielles déclarées",
    "Comportement et consignes renseignés dans les habitudes.",
  ],
  contact: [
    "Contact principal",
    "Coordonnées enregistrées dans les habitudes de l’animal.",
  ],
  vet: [
    "Contact vétérinaire",
    "Coordonnées du vétérinaire enregistrées dans le carnet.",
  ],
};

export default function EmergencySheet({
  pet,
  saved,
  actions,
  startEditing = false,
}: {
  pet: Animal;
  saved?: EmergencySheet;
  actions: Actions;
  startEditing?: boolean;
}) {
  const tr = useText();
  const [enlarged, setEnlarged] = useState(false);
  const [editing, setEditing] = useState(startEditing || !saved);
  const [settings, setSettings] = useState(saved?.settings || defaults);
  const [result, setResult] = useState<{
    key: string;
    value?: EmergencySheet;
    error?: string;
  } | null>(null);
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
  const sheet = (editing ? current?.value?.snapshot : saved?.snapshot) || {
    name: pet.name,
  };
  const remove = () =>
    actions.openDialog("delete-record-item", {
      entity: "emergency",
      id: pet.id,
      name: "la fiche et son QR",
    });
  const downloads = sheet.qrSvg && (
    <>
      <a
        className="button outline"
        href={svgImage(sheet.qrSvg)}
        download={`anivaya-qr-${pet.id}.svg`}
      >
        {tr("Télécharger le QR")}
      </a>
      <button className="button outline" onClick={() => window.print()}>
        {tr("Imprimer")}
      </button>
    </>
  );
  const qr = sheet.qrSvg && (
    <button
      type="button"
      className="qr-wrap qr-enlarge"
      onClick={() => setEnlarged(true)}
      aria-label={tr("Agrandir le QR de {0}", [pet.name])}
    >
      <img src={svgImage(sheet.qrSvg)} alt={tr("QR de {0}", [pet.name])} />
    </button>
  );

  async function save() {
    setBusy(true);
    setError("");
    try {
      await api.saveEmergency(pet.id, settings);
      await actions.saved("Fiche et QR enregistrés.");
      window.location.hash = `animaux/${pet.id}/apercu`;
    } catch (failure) {
      setError(errorMessage(failure));
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
              <span className="badge">{tr("Fiche d’urgence sauvegardée")}</span>
              <div className="saved-title-line">
                <h1>{sheet.name}</h1>
                <div className="saved-tools">
                  <button
                    className="icon-btn"
                    title={tr("Modifier")}
                    aria-label={tr("Modifier la fiche d’urgence")}
                    onClick={() => {
                      setSettings(saved.settings);
                      setEditing(true);
                    }}
                  >
                    <Icon name="edit" />
                  </button>
                  <button
                    className="icon-btn delete"
                    title={tr("Supprimer")}
                    aria-label={tr("Supprimer la fiche d’urgence")}
                    onClick={remove}
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              </div>
              <p className="muted">{sheet.details || tr(sheet.species)}</p>
              <p className="muted sheet-identifier">
                {tr("Identifiant : ")}
                {pet.identifier || tr("Non renseigné")}
              </p>
            </div>
          </div>
          {sheet.notes && (
            <section className="saved-section">
              <h2>{tr("Consignes")}</h2>
              <p className="muted emergency-notes">{sheet.notes}</p>
            </section>
          )}
          {(sheet.contact || sheet.vet) && (
            <section className="saved-section">
              <h2>{tr("Contacts")}</h2>
              {[
                ["Contact principal", sheet.contact],
                ["Vétérinaire habituel", sheet.vet],
              ]
                .filter(([, value]) => value)
                .map(([label, value]) => (
                  <dl key={label}>
                    <div className="datum">
                      <dt>{tr(label)}</dt>
                      <dd>{value}</dd>
                    </div>
                  </dl>
                ))}
            </section>
          )}
          <div className="saved-qr-section">
            <h2>{tr("Son QR code")}</h2>
            {qr}
            <p className="muted">
              {sheet.qrSvg
                ? tr(
                    "Ce QR ouvre la fiche publique avec les informations sélectionnées.",
                  )
                : tr(
                    "La fiche est désactivée. Modifiez-la pour préparer un nouveau QR.",
                  )}
            </p>
            <div className="actions">
              {downloads}
              {sheet.payload?.startsWith("http") && (
                <a
                  className="button"
                  href={sheet.payload}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {tr("Voir la fiche publique")}
                </a>
              )}
            </div>
          </div>
        </section>
      ) : (
        <>
          <div className="emergency-welcome">
            <h1>{tr("Sa fiche d’urgence")}</h1>
            <p className="muted">
              {tr("Choisissez ce qu’une personne qui retrouve ")}
              {pet.name}
              {tr(" pourra consulter.")}
            </p>
          </div>
          <div className="grid">
            <section className="panel">
              <h2>{tr("Informations visibles")}</h2>
              {(
                Object.entries(labels) as [
                  keyof EmergencySettings,
                  [string, string],
                ][]
              ).map(([key, [label, help]]) => (
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
                      {tr(label)}
                      <small>{tr(help)}</small>
                    </label>
                  </div>
                  {key === "photo" && (
                    <div className="emergency-information">
                      <span className="muted">
                        {tr(
                          "Toujours inclus : nom et espèce. L’identification complète, les documents privés et l’adresse du foyer sont exclus.",
                        )}
                      </span>
                    </div>
                  )}
                </div>
              ))}
              <p className="note">
                {tr(
                  "Ces choix concernent uniquement la fiche d’urgence. Ils ne donnent jamais accès au carnet complet.",
                )}
              </p>
            </section>
            <div className="stack">
              <section className="panel qr-panel" aria-busy={loading}>
                <h2>
                  {tr("Le QR de ")}
                  {pet.name}
                </h2>
                {!settings.active && (
                  <span className="active-status">
                    {tr("Fiche désactivée")}
                  </span>
                )}
                {settings.active ? (
                  <>
                    {loading ? (
                      <div className="qr-loading" role="status">
                        <span className="qr-spinner" />
                        {tr("Mise à jour du QR…")}
                      </div>
                    ) : current?.error ? (
                      <div className="empty">
                        <p role="alert">{tr(current.error)}</p>
                        <button
                          className="button outline"
                          onClick={() => setRetry((n) => n + 1)}
                        >
                          {tr("Réessayer")}
                        </button>
                      </div>
                    ) : (
                      qr
                    )}
                    <p className="muted">
                      {tr(
                        "Le QR ouvre sa fiche publique. Sauvegardez pour publier vos choix de visibilité.",
                      )}
                    </p>
                    <div className="actions">
                      <button
                        className="button"
                        disabled={busy || loading || !sheet.qrSvg}
                        onClick={save}
                      >
                        {busy ? tr("Sauvegarde…") : tr("Sauvegarder")}
                      </button>
                      {downloads}
                      {saved && (
                        <button
                          className="button danger"
                          onClick={remove}
                          disabled={busy}
                        >
                          {tr("Supprimer")}
                        </button>
                      )}
                    </div>
                    {sheet.payload && (
                      <details>
                        <summary className="muted toggle-summary">
                          {tr("Voir le contenu du QR")}
                        </summary>
                        <pre className="qr-payload">{sheet.payload}</pre>
                      </details>
                    )}
                  </>
                ) : (
                  <>
                    <p className="empty">
                      {tr(
                        "La fiche est désactivée. Enregistrez ce choix pour retirer l’accès public.",
                      )}
                    </p>
                    <button className="button" disabled={busy} onClick={save}>
                      {busy
                        ? tr("Sauvegarde…")
                        : tr("Sauvegarder la désactivation")}
                    </button>
                  </>
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
                    {tr("Annuler les modifications")}
                  </button>
                )}
                {error && (
                  <p className="form-error" role="alert">
                    {tr(error)}
                  </p>
                )}
              </section>
              <p className="note">
                {tr(
                  "La désactivation retire l’accès public, y compris avec un QR déjà téléchargé. Pour scanner depuis un autre appareil, le site doit être hébergé à une adresse accessible.",
                )}
              </p>
            </div>
          </div>
        </>
      )}
      {enlarged && sheet.qrSvg && (
        <QrDialog
          name={pet.name}
          qrSvg={sheet.qrSvg}
          onClose={() => setEnlarged(false)}
        >
          {downloads}
        </QrDialog>
      )}
      {sheet.qrSvg && (
        <div className="qr-print">
          <h1>{sheet.name}</h1>
          <p>{sheet.details || tr(sheet.species)}</p>
          {sheet.notes && <p className="emergency-notes">{sheet.notes}</p>}
          <p>{sheet.contact}</p>
          <p>{sheet.vet}</p>
          <img src={svgImage(sheet.qrSvg)} alt={tr("QR à imprimer")} />
          <p>{tr("Anivaya · Fiche d’urgence")}</p>
        </div>
      )}
    </>
  );
}

/** QR agrandi, avec les actions propres à l’écran qui l’ouvre. */
export function QrDialog({
  name,
  qrSvg,
  onClose,
  children,
}: {
  name: string;
  qrSvg: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const tr = useText();
  return (
    <Modal className="qr-dialog" busy={false} onClose={onClose}>
      <h2 id="action-title">
        {tr("Le QR de ")}
        {name}
      </h2>
      <img
        className="large-qr"
        src={svgImage(qrSvg)}
        alt={tr("QR de {0}", [name])}
      />
      <div className="dialog-actions">{children}</div>
    </Modal>
  );
}
