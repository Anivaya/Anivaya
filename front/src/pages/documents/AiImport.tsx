import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { Animal, Dashboard } from "../../shared/types.ts";
import Icon from "../../shared/ui/Icon.tsx";
import Modal from "../../shared/ui/Modal.tsx";
import { adminApi } from "../../shared/services/admin.ts";
import { errorMessage } from "../../shared/types.ts";
import ImportFeedback from "./ImportFeedback.tsx";

/**
 * Import assisté par IA, en démonstration : aucun fichier n’est envoyé ni analysé,
 * et rien n’est enregistré. Le parcours (document, vérification, récapitulatif)
 * sera branché sur le serveur plus tard.
 */
type Scenario = "consultation" | "identity" | "unreadable";
interface Source {
  name: string;
  file?: File;
  url?: string;
}
interface Values {
  title: string;
  category: string;
  date: string;
  name: string;
  species: string;
  breed: string;
  sex: string;
  dob: string;
  identifier: string;
  eventType: string;
  note: string;
  reminderName: string;
  reminderDate: string;
}
type Option = "identity" | "event" | "reminder";

const STEPS = ["Document", "Vérification", "Enregistrement"];
const TITLES = [
  "Importer un document",
  "Vérifier les informations",
  "Import terminé",
];
const SCENARIOS: [Scenario, string, string][] = [
  ["consultation", "Compte rendu de consultation", "Consultation — exemple"],
  ["identity", "Document d’identification", "Identification — exemple"],
  ["unreadable", "Document illisible", "Document illisible — exemple"],
];
const FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const PNG = [137, 80, 78, 71, 13, 10, 26, 10];
const identityFields: [keyof Values, string, string[] | "date" | "text"][] = [
  ["name", "Nom de l’animal", "text"],
  ["species", "Espèce", ["Chien", "Chat"]],
  ["breed", "Race", "text"],
  ["sex", "Sexe", ["Non renseigné", "Femelle", "Mâle"]],
  ["dob", "Date de naissance", "date"],
  ["identifier", "Identifiant", "text"],
];
const today = () => new Date().toLocaleDateString("en-CA");

/** Bouton d’ouverture, placé à côté des ajouts d’animal ou de document. */
export function AiImportButton({
  onClick,
  icon = true,
}: {
  onClick: () => void;
  icon?: boolean;
}) {
  return (
    <button
      type="button"
      className="button outline ai-launch"
      onClick={onClick}
    >
      {icon && <Icon name="file" />}
      Importer avec l’IA
    </button>
  );
}

/** Vérifie la signature du fichier : le type annoncé doit correspondre au contenu. */
async function validSignature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (file.type === "application/pdf")
    return String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  if (file.type === "image/png") return PNG.every((v, i) => bytes[i] === v);
  return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
}

/** Valeurs « extraites » : fictives pour un exemple, vides pour un vrai fichier. */
function suggestions(
  scenario: Scenario,
  example: boolean,
  title: string,
  animal: Animal | undefined,
): Values {
  const fictional = example && scenario !== "unreadable";
  const consultation = fictional && scenario === "consultation";
  return {
    title,
    category: fictional && scenario === "identity" ? "Identité" : "Santé",
    date: fictional ? "2026-10-12" : "",
    name: fictional ? animal?.name || "Rio" : "",
    species: fictional ? animal?.species || "Chien" : "Chien",
    breed: fictional ? animal?.breed || "Croisé" : "",
    sex: fictional ? animal?.sex || "Mâle" : "Non renseigné",
    dob: fictional ? animal?.dob || "2024-05-16" : "",
    identifier: fictional ? animal?.identifier || "EXEMPLE-RIO-003" : "",
    eventType: "Consultation",
    note: consultation
      ? "Visite de suivi — compte rendu fictif à confirmer."
      : "",
    reminderName: consultation ? "Préparer le prochain rendez-vous" : "",
    reminderDate: consultation ? "2026-11-15" : "",
  };
}

export default function AiImport({
  data,
  animal,
  onClose,
}: {
  data: Dashboard;
  /** Carnet d’origine : l’animal est alors imposé. */
  animal?: string;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const [target, setTarget] = useState(animal ?? "");
  const [scenario, setScenario] = useState<Scenario>("consultation");
  const [source, setSource] = useState<Source | null>(null);
  const [values, setValues] = useState<Values | null>(null);
  const [options, setOptions] = useState<Record<Option, boolean>>({
    identity: false,
    event: false,
    reminder: false,
  });
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<{ text: string; field?: string } | null>(
    null,
  );
  const [progress, setProgress] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [dragging, setDragging] = useState(false);
  const signature = useRef("");
  const timer = useRef<number | undefined>(undefined);
  const creating = target === "new";
  const targetAnimal = data.animals.find((a) => a.id === target);

  // Libère l’aperçu local et la préparation en cours à la fermeture.
  const sourceUrl = source?.url;
  useEffect(
    () => () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    },
    [sourceUrl],
  );
  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Le titre de l’étape reçoit le focus à chaque changement d’étape.
  useEffect(() => {
    document.getElementById("action-title")?.focus();
  }, [step]);

  function fail(text: string, field?: string) {
    setError({ text, field });
    if (field) document.getElementById("ai-" + field)?.focus();
  }

  async function selectFile(files: FileList | null) {
    if (busy || !files) return;
    if (files.length !== 1)
      return fail("Sélectionnez un seul fichier pour cet import.");
    const file = files[0];
    if (!FILE_TYPES.includes(file.type) || !file.size || file.size > 10485760)
      return fail(
        "Choisissez un PDF, JPEG ou PNG non vide, de 10 Mo maximum.",
        "file",
      );
    setBusy(true);
    setProgress("Vérification du fichier…");
    try {
      if (!(await validSignature(file)))
        return fail(
          "Le contenu ne correspond pas à un PDF, JPEG ou PNG valide. Choisissez un autre fichier.",
          "file",
        );
      setSource({ name: file.name, file, url: URL.createObjectURL(file) });
      setDirty(true);
      setError(null);
    } catch {
      fail("Impossible de lire ce fichier. Sélectionnez-le de nouveau.");
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  function useExample() {
    if (busy) return;
    setSource({ name: SCENARIOS.find(([key]) => key === scenario)![2] });
    setDirty(true);
    setError(null);
  }

  function extract() {
    if (busy) return;
    if (!source)
      return fail(
        "Choisissez un fichier ou utilisez un exemple intégré.",
        "file",
      );
    if (!target)
      return fail("Choisissez un animal ou créez un nouveau profil.", "target");
    setError(null);
    // Même document et même animal : on retrouve la vérification déjà commencée.
    const key = JSON.stringify([target, source.name, !source.file, scenario]);
    if (key === signature.current && values) return setStep(1);
    setBusy(true);
    setProgress("Préparation de la vérification…");
    timer.current = window.setTimeout(() => {
      setBusy(false);
      setProgress("");
      signature.current = key;
      setValues(suggestions(scenario, !source.file, source.name, targetAnimal));
      setOptions({ identity: creating, event: false, reminder: false });
      setVerified(false);
      setStep(1);
    }, 450);
  }

  function change(name: keyof Values, value: string) {
    setValues((v) => v && { ...v, [name]: value });
    setVerified(false);
    setDirty(true);
  }

  function validate(v: Values): [string, string] | null {
    if (!v.title.trim()) return ["Donnez un nom au document.", "title"];
    if (options.identity && !v.name.trim())
      return ["Indiquez le nom de l’animal.", "name"];
    if (options.identity && v.dob && v.dob > today())
      return ["La date de naissance ne peut pas être dans le futur.", "dob"];
    if (options.event && (!v.date || !v.note.trim()))
      return [
        "Renseignez la date du document et les informations de suivi.",
        !v.date ? "date" : "note",
      ];
    if (options.reminder && (!v.reminderName.trim() || !v.reminderDate))
      return [
        "Renseignez un intitulé et une date pour le rappel.",
        !v.reminderName.trim() ? "reminderName" : "reminderDate",
      ];
    if (options.reminder && v.reminderDate < today())
      return [
        "Choisissez une date de rappel à partir d’aujourd’hui.",
        "reminderDate",
      ];
    if (!verified)
      return [
        "Vérifiez les informations, puis cochez la confirmation.",
        "verified",
      ];
    return null;
  }

  // Suivi de l’import par l’assistance : identifiant du dossier, ou raison de l’absence de suivi.
  const [tracking, setTracking] = useState<{ id?: string; error?: string }>({});
  async function submit(event: FormEvent) {
    event.preventDefault();
    const invalid = values && validate(values);
    if (invalid) return fail(...invalid);
    setError(null);
    setDirty(false);
    setBusy(true);
    try {
      const started = await adminApi.registerImport({
        name: values!.title.trim(),
        kind: source?.file ? "Fichier" : "Exemple intégré",
      });
      setTracking({ id: started.id });
    } catch (failure) {
      setTracking({ error: errorMessage(failure) });
    } finally {
      setBusy(false);
    }
    setStep(2);
  }

  function askClose() {
    if (!dirty || step === 2) return onClose();
    window.clearTimeout(timer.current);
    if (busy) {
      setBusy(false);
      setProgress("Préparation interrompue. Vous pouvez reprendre.");
    }
    setDiscard(true);
  }

  const invalid = (field: string) => error?.field === field || undefined;
  function field(name: keyof Values, label: string, kind: string[] | string) {
    const props = {
      id: "ai-" + name,
      value: values![name],
      "aria-invalid": invalid(name),
      "aria-describedby": "ai-error",
    };
    return (
      <div className="field" key={name}>
        <label htmlFor={props.id}>
          {label}
          {name === "title" || (name === "name" && options.identity)
            ? " *"
            : ""}
        </label>
        {Array.isArray(kind) ? (
          <select {...props} onChange={(e) => change(name, e.target.value)}>
            {kind.map((choice) => (
              <option key={choice}>{choice}</option>
            ))}
          </select>
        ) : (
          <input
            {...props}
            type={kind}
            maxLength={150}
            max={name === "dob" ? today() : undefined}
            onChange={(e) => change(name, e.target.value)}
          />
        )}
      </div>
    );
  }

  return (
    <Modal busy={false} onClose={askClose} header={false} className="ai-import">
      <div className="ai-heading">
        <div>
          <p className="ai-eyebrow">IMPORT ASSISTÉ · DÉMONSTRATION</p>
          <h2 id="action-title" tabIndex={-1}>
            {TITLES[step]}
          </h2>
        </div>
        <button
          type="button"
          className="close"
          onClick={askClose}
          aria-label="Fermer l’import"
        >
          <Icon name="close" />
        </button>
      </div>
      <Stepper step={step} />

      {step === 0 && (
        <>
          <p className="ai-muted">
            Une photo ou un PDF pour préparer les informations du carnet, puis
            les vérifier ensemble.
          </p>
          <div className="ai-notice">
            <strong>Extraction IA simulée</strong>
            <p>
              Aucun fichier n’est envoyé ni analysé par une IA. L’exemple
              contient des données fictives ; avec votre fichier, les champs
              seront à renseigner.
            </p>
          </div>
          <div
            className={`ai-upload${dragging ? " dragover" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void selectFile(e.dataTransfer.files);
            }}
          >
            <Icon name="file" />
            <strong>Choisissez votre document</strong>
            <label className="ai-file-label" htmlFor="ai-file">
              Sélectionner un fichier ou le déposer ici
            </label>
            <input
              id="ai-file"
              type="file"
              accept={FILE_TYPES.join(",")}
              aria-invalid={invalid("file")}
              aria-describedby="ai-file-help ai-error"
              onChange={(e) => {
                void selectFile(e.target.files);
                e.target.value = "";
              }}
            />
            <p id="ai-file-help" className="ai-muted">
              PDF, JPEG ou PNG · 10 Mo maximum · Un fichier à la fois
            </p>
            <p role="status">
              {source
                ? source.file
                  ? `${source.name} · ${(source.file.size / 1048576).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} Mo`
                  : source.name
                : "Aucun fichier sélectionné"}
            </p>
          </div>
          <div className="ai-example">
            <div className="field">
              <label htmlFor="ai-scenario">
                Exemple intégré pour la démonstration
              </label>
              <select
                id="ai-scenario"
                value={scenario}
                onChange={(e) => setScenario(e.target.value as Scenario)}
              >
                {SCENARIOS.map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="button outline"
              onClick={useExample}
            >
              Utiliser cet exemple
            </button>
          </div>
          <div className="field">
            <label htmlFor="ai-target">Associer à un animal *</label>
            <select
              id="ai-target"
              value={target}
              disabled={Boolean(animal)}
              aria-invalid={invalid("target")}
              aria-describedby="ai-error"
              onChange={(e) => {
                setTarget(e.target.value);
                setDirty(true);
              }}
            >
              <option value="">Choisir un animal</option>
              {data.animals.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
              {!animal && <option value="new">Créer un nouvel animal</option>}
            </select>
          </div>
          <p id="ai-error" className="ai-error" role="alert">
            {error?.text}
          </p>
          <p className="ai-muted" role="status">
            {progress}
          </p>
          <div className="ai-actions">
            <button type="button" className="button outline" onClick={askClose}>
              Annuler
            </button>
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={extract}
            >
              Continuer vers la vérification
            </button>
          </div>
        </>
      )}

      {step === 1 && values && source && (
        <>
          <p className="ai-muted">
            Vérifiez le document à gauche et choisissez ce que vous souhaitez
            enregistrer.
          </p>
          <div className="ai-review-grid">
            <aside className="ai-source-panel">
              <h3>Document source</h3>
              <p className="ai-filename">{source.name}</p>
              <SourcePreview
                source={source}
                scenario={scenario}
                values={values}
              />
              <p className="ai-muted">
                {source.file
                  ? "Fichier local, visible uniquement dans cette fenêtre."
                  : "Exemple intégré, sans valeur médicale."}
              </p>
            </aside>
            <form noValidate onSubmit={submit}>
              <div className="ai-notice">
                <strong>
                  {source.file
                    ? "Saisie à compléter"
                    : scenario === "unreadable"
                      ? "Aucune information extraite"
                      : "Suggestions de démonstration"}
                </strong>
                <p>
                  {source.file
                    ? "Votre fichier n’a pas été analysé. Renseignez uniquement les informations que vous y lisez."
                    : scenario === "unreadable"
                      ? "Complétez manuellement ou revenez au choix du document."
                      : "Ces informations sont fictives. Corrigez-les avant de valider."}
                </p>
              </div>
              <h3>Le document</h3>
              <p className="ai-muted">
                {creating
                  ? "Un nouveau carnet sera créé."
                  : `Carnet destinataire : ${targetAnimal?.name ?? "Animal"}`}
              </p>
              {field("title", "Nom du document", "text")}
              {field("category", "Catégorie", [
                "Santé",
                "Identité",
                "Assurance",
                "Autre",
              ])}
              {field("date", "Date du document (facultatif)", "date")}
              <OptionBlock
                checked={options.identity}
                disabled={creating}
                label={
                  creating
                    ? "Créer le profil de l’animal"
                    : "Mettre à jour son identité"
                }
                hint={
                  creating
                    ? "Le nom est obligatoire."
                    : "Seuls les champs remplis seront remplacés. Les autres informations seront conservées."
                }
                onChange={(on) => setOptions({ ...options, identity: on })}
              >
                <div className="ai-fields">
                  {identityFields.map(([name, label, kind]) =>
                    field(name, label, kind),
                  )}
                </div>
              </OptionBlock>
              <OptionBlock
                checked={options.event}
                label="Ajouter un événement à son suivi"
                onChange={(on) => setOptions({ ...options, event: on })}
              >
                {field("eventType", "Type d’événement", [
                  "Consultation",
                  "Vaccination déclarée",
                  "Pesée",
                  "Autre",
                ])}
                <div className="field">
                  <label htmlFor="ai-note">Informations à conserver *</label>
                  <textarea
                    id="ai-note"
                    maxLength={1000}
                    value={values.note}
                    aria-invalid={invalid("note")}
                    aria-describedby="ai-error"
                    onChange={(e) => change("note", e.target.value)}
                  />
                </div>
                <p className="ai-muted">
                  L’événement utilisera la date du document.
                </p>
              </OptionBlock>
              <OptionBlock
                checked={options.reminder}
                label="Créer un rappel"
                hint="Aucune échéance n’est ajoutée automatiquement."
                onChange={(on) => setOptions({ ...options, reminder: on })}
              >
                {field("reminderName", "Intitulé du rappel", "text")}
                {field("reminderDate", "Date du rappel", "date")}
              </OptionBlock>
              <label className="ai-check ai-confirm">
                <input
                  id="ai-verified"
                  type="checkbox"
                  checked={verified}
                  aria-invalid={invalid("verified")}
                  aria-describedby="ai-error"
                  onChange={(e) => setVerified(e.target.checked)}
                />
                <span>
                  J’ai vérifié les informations et les éléments à enregistrer.
                </span>
              </label>
              <p id="ai-error" className="ai-error" role="alert">
                {error?.text}
              </p>
              <div className="ai-actions">
                <button
                  type="button"
                  className="button outline"
                  onClick={() => {
                    setError(null);
                    setStep(0);
                  }}
                >
                  Retour au document
                </button>
                <button type="submit" className="button">
                  Valider et enregistrer
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {step === 2 && values && (
        <>
          <div className="ai-success">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="m7 12 3 3 7-7" />
            </svg>
            <h3>
              Import vérifié pour{" "}
              {creating || options.identity ? values.name : targetAnimal?.name}
            </h3>
            <ul>
              <li>
                Document « {values.title.trim()} » prêt à être enregistré.
              </li>
              {options.identity && (
                <li>
                  {creating ? "Profil à créer" : "Identité à mettre à jour"}{" "}
                  avec les informations validées.
                </li>
              )}
              {options.event && <li>Événement à ajouter au suivi.</li>}
              {options.reminder && <li>Rappel à ajouter aux échéances.</li>}
            </ul>
            <p className="ai-notice">
              Démonstration : rien n’a encore été ajouté à votre espace.
              L’enregistrement sera disponible avec l’import réel.
            </p>
            {tracking.error ? (
              <p className="ai-muted" role="status">
                Le suivi de cet import n’a pas pu être enregistré pour
                l’assistance : {tracking.error}
              </p>
            ) : (
              <p className="ai-muted">
                Cet import est suivi par l’assistance Anivaya. Vous pouvez lui
                laisser un retour.
              </p>
            )}
            <ImportFeedback importId={tracking.id} />
          </div>
          <div className="ai-actions">
            {!creating && targetAnimal && (
              <a
                className="button outline"
                href={`#animaux/${targetAnimal.id}/documents`}
                onClick={onClose}
              >
                Voir le carnet
              </a>
            )}
            <button type="button" className="button" onClick={onClose}>
              Terminer
            </button>
          </div>
        </>
      )}

      {discard && (
        <div
          className="ai-warning"
          role="alertdialog"
          aria-label="Abandonner l’import"
        >
          <p>
            Abandonner cet import ? Les informations non enregistrées seront
            perdues.
          </p>
          <div className="ai-actions">
            <button
              type="button"
              className="button outline"
              autoFocus
              onClick={() => setDiscard(false)}
            >
              Continuer l’import
            </button>
            <button type="button" className="button danger" onClick={onClose}>
              Abandonner
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Étapes, avec un trait doré qui glisse sous l’étape en cours. */
function Stepper({ step }: { step: number }) {
  const track = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const place = () => {
      const label = track.current?.querySelector(
        "[aria-current] .ai-step-label",
      );
      if (!track.current || !bar.current || !label) return;
      const outer = track.current.getBoundingClientRect();
      const inner = label.getBoundingClientRect();
      bar.current.style.width = inner.width + "px";
      bar.current.style.transform = `translateX(${inner.left - outer.left}px)`;
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(track.current!);
    return () => observer.disconnect();
  }, [step]);
  return (
    <div className="ai-stepper" ref={track}>
      <ol className="ai-steps" aria-label="Étapes de l’import">
        {STEPS.map((label, i) => (
          <li key={label} aria-current={i === step ? "step" : undefined}>
            <span className="ai-step-label">
              {i + 1}. {label}
            </span>
          </li>
        ))}
      </ol>
      <span className="ai-step-indicator" ref={bar} aria-hidden="true" />
    </div>
  );
}

function OptionBlock({
  checked,
  disabled,
  label,
  hint,
  onChange,
  children,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  hint?: string;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <section className="ai-option">
      <label className="ai-check">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>
          {label}
          {hint && <small>{hint}</small>}
        </span>
      </label>
      {checked && children}
    </section>
  );
}

/** Aperçu du fichier choisi, ou document fictif pour un exemple intégré. */
function SourcePreview({
  source,
  scenario,
  values,
}: {
  source: Source;
  scenario: Scenario;
  values: Values;
}) {
  // L’aperçu fictif reste celui de l’extraction, même si les champs sont corrigés.
  const [shown] = useState(values);
  if (source.file && source.url)
    return source.file.type.startsWith("image/") ? (
      <img
        className="ai-preview"
        src={source.url}
        alt="Aperçu du document à vérifier"
      />
    ) : (
      <>
        <iframe
          className="ai-preview ai-pdf"
          src={source.url}
          title="Aperçu du PDF importé"
        />
        <a href={source.url} download={source.name}>
          Télécharger le fichier pour le consulter
        </a>
      </>
    );
  if (scenario === "unreadable")
    return (
      <div className="ai-paper">
        <h3>Document illisible</h3>
        <p>Aucune information exploitable dans cet exemple.</p>
        <p>
          Vous pouvez changer de document ou compléter les champs vous-même.
        </p>
      </div>
    );
  return (
    <div className="ai-paper">
      <small>ANIVAYA · DOCUMENT FICTIF</small>
      <h3>
        {scenario === "identity"
          ? "Identification de l’animal"
          : "Compte rendu de consultation"}
      </h3>
      <p>
        <strong>{shown.name}</strong>
        <br />
        {shown.species} · {shown.breed}
      </p>
      <dl>
        <dt>Identifiant</dt>
        <dd>{shown.identifier}</dd>
        <dt>Date du document</dt>
        <dd>12 octobre 2026</dd>
      </dl>
      {scenario === "consultation" && (
        <p>
          Visite de suivi à confirmer.
          <br />
          Prochain rendez-vous : 15 novembre 2026.
        </p>
      )}
      <p className="ai-muted">
        Exemple de démonstration, sans valeur médicale.
      </p>
    </div>
  );
}
