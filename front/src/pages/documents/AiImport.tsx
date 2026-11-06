import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { Dashboard } from "../../shared/types.ts";
import Icon from "../../shared/ui/Icon.tsx";
import Modal from "../../shared/ui/Modal.tsx";
import { adminApi } from "../../shared/services/admin.ts";
import { api, readFile } from "../../shared/services/api.ts";
import { errorMessage } from "../../shared/types.ts";
import ImportFeedback from "./ImportFeedback.tsx";

/**
 * Import assisté par IA : le document est lu par l’API Claude, la personne vérifie
 * chaque champ, puis le document, l’identité, l’événement et le rappel choisis sont
 * enregistrés dans le carnet.
 */
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

export default function AiImport({
  data,
  animal,
  onClose,
  onSaved,
}: {
  data: Dashboard;
  /** Carnet d’origine : l’animal est alors imposé. */
  animal?: string;
  onClose: () => void;
  /** Après enregistrement : recharge l’espace, ferme et confirme. */
  onSaved: (message: string) => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [target, setTarget] = useState(animal ?? "");
  const [source, setSource] = useState<Source | null>(null);
  const [values, setValues] = useState<Values | null>(null);
  /** L’IA a-t-elle trouvé des informations lisibles dans le document ? */
  const [readable, setReadable] = useState(true);
  /** Carnet où l’import a été enregistré (nouveau ou existant). */
  const [savedAnimal, setSavedAnimal] = useState<string | null>(null);
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

  async function extract() {
    if (busy) return;
    if (!source?.file) return fail("Choisissez un fichier à importer.", "file");
    if (!target)
      return fail("Choisissez un animal ou créez un nouveau profil.", "target");
    setError(null);
    // Même document et même animal : on retrouve la vérification déjà commencée.
    const key = JSON.stringify([target, source.name, source.file.size]);
    if (key === signature.current && values) return setStep(1);
    setBusy(true);
    setProgress("Lecture du document par l’IA… Cela peut prendre une minute.");
    try {
      const found = await api.extractDocument({
        type: source.file.type,
        content: await readFile(source.file),
      });
      signature.current = key;
      setReadable(found.readable);
      const pet = creating ? undefined : targetAnimal;
      setValues({
        title: found.title || source.name.replace(/.[a-z0-9]+$/i, ""),
        category: found.category,
        date: found.date,
        name: found.name || pet?.name || "",
        species: found.species || pet?.species || "Chien",
        breed: found.breed,
        sex: found.sex,
        dob: found.dob,
        identifier: found.identifier,
        eventType: found.eventType,
        note: found.note,
        reminderName: found.reminderName,
        reminderDate: found.reminderDate,
      });
      setOptions({
        identity: creating,
        event: Boolean(found.note && found.date),
        reminder: Boolean(found.reminderName && found.reminderDate >= today()),
      });
      setVerified(false);
      setStep(1);
    } catch (failure) {
      fail(errorMessage(failure), "file");
      // L’échec est signalé à l’assistance pour le suivi des imports.
      void adminApi
        .registerImport({
          name: source.name,
          kind: "Fichier",
          status: "Échoué",
          issue: errorMessage(failure),
        })
        .catch(() => {});
    } finally {
      setBusy(false);
      setProgress("");
    }
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
    if (busy || !values || !source?.file) return;
    const invalid = validate(values);
    if (invalid) return fail(...invalid);
    setError(null);
    setBusy(true);
    setProgress("Enregistrement dans le carnet…");
    const v = values;
    // Identité : seuls les champs remplis sont envoyés, les autres restent inchangés.
    const identity = Object.fromEntries(
      (["name", "species", "breed", "sex", "dob", "identifier"] as const)
        .filter((key) => v[key].trim() && v[key] !== "Non renseigné")
        .map((key) => [key, v[key].trim()]),
    );
    try {
      let pet = target;
      if (creating) pet = (await api.addAnimal(identity)).id;
      else if (options.identity) await api.editAnimal(target, identity);
      await api.addDocument({
        name: v.title.trim(),
        animal: pet,
        category: v.category,
        type: source.file.type,
        content: await readFile(source.file),
      });
      if (options.event)
        await api.saveEvent(undefined, {
          animal: pet,
          type: v.eventType,
          date: v.date,
          note: v.note.trim(),
        });
      if (options.reminder)
        await api.addReminder({
          name: v.reminderName.trim(),
          animal: pet,
          date: v.reminderDate,
        });
      setSavedAnimal(pet);
      setDirty(false);
      try {
        const started = await adminApi.registerImport({
          name: v.title.trim(),
          kind: "Fichier",
          status: "Terminé",
        });
        setTracking({ id: started.id });
      } catch (failure) {
        setTracking({ error: errorMessage(failure) });
      }
      setStep(2);
    } catch (failure) {
      fail(errorMessage(failure));
    } finally {
      setBusy(false);
      setProgress("");
    }
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
            <strong>Lecture par l’IA</strong>
            <p>
              Le document est analysé par l’IA pour préremplir les champs. Rien
              n’est enregistré avant votre vérification.
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
              {source?.file
                ? `${source.name} · ${(source.file.size / 1048576).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} Mo`
                : "Aucun fichier sélectionné"}
            </p>
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
            <button
              type="button"
              className="button outline cancel"
              onClick={askClose}
            >
              Annuler
            </button>
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={() => void extract()}
            >
              {busy ? "Analyse…" : "Analyser le document"}
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
              <SourcePreview source={source} />
              <p className="ai-muted">
                Le document sera enregistré dans le carnet après validation.
              </p>
            </aside>
            <form noValidate onSubmit={submit}>
              <div className="ai-notice">
                <strong>
                  {readable
                    ? "Informations proposées par l’IA"
                    : "Aucune information lisible"}
                </strong>
                <p>
                  {readable
                    ? "Comparez chaque champ au document et corrigez-le si besoin avant de valider."
                    : "L’IA n’a rien pu lire de fiable. Complétez les champs vous-même ou choisissez une photo plus nette."}
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
                    data-resize-none
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
                  className="button outline icon-back"
                  aria-label="Revenir au choix du document"
                  onClick={() => {
                    setError(null);
                    setStep(0);
                  }}
                >
                  <Icon name="back" />
                </button>
                <button type="submit" className="button" disabled={busy}>
                  {busy ? "Enregistrement…" : "Valider et enregistrer"}
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
              Import enregistré pour{" "}
              {creating || options.identity ? values.name : targetAnimal?.name}
            </h3>
            <ul>
              <li>Document « {values.title.trim()} » ajouté au carnet.</li>
              {options.identity && (
                <li>
                  {creating ? "Profil créé" : "Identité mise à jour"} avec les
                  informations validées.
                </li>
              )}
              {options.event && <li>Événement ajouté au suivi.</li>}
              {options.reminder && <li>Rappel ajouté aux échéances.</li>}
            </ul>
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
            {savedAnimal && (
              <a
                className="button outline"
                href={`#animaux/${savedAnimal}/documents`}
                onClick={() =>
                  void onSaved("Import enregistré dans le carnet.")
                }
              >
                Voir le carnet
              </a>
            )}
            <button
              type="button"
              className="button"
              onClick={() => void onSaved("Import enregistré dans le carnet.")}
            >
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

/** Aperçu du fichier choisi, visible uniquement dans cette fenêtre. */
function SourcePreview({ source }: { source: Source }) {
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
  return null;
}
