import type { Document, DialogProps } from "../../shared/types.ts";
import { errorMessage } from "../../shared/types.ts";
import SubmissionForm, {
  Field,
  AnimalSelectField,
  FormAlert,
} from "../../shared/forms/SubmissionForm.tsx";
import { useDialogAction } from "../../shared/hooks.ts";
import { api, fieldError, readFile } from "../../shared/services/api.ts";
import { animalName } from "../../shared/utils/format.ts";
import { downloadDocuments } from "./download.ts";

export function DocumentDetails({
  item,
  data,
  onClose,
  onOpenDialog,
}: DialogProps<Document>) {
  return (
    <>
      <h2 id="action-title" className="dialog-title">
        {item.name}
      </h2>
      <p className="dialog-copy">
        {animalName(data.animals, item.animal)} · {item.category}
      </p>
      {item.hasFile ? (
        <>
          {item.type === "application/pdf" ? (
            <iframe
              className="doc-preview pdf-preview"
              title={`Aperçu de ${item.name}`}
              src={`${item.url}?preview=1`}
            />
          ) : (
            <img
              className="doc-preview"
              src={`${item.url}?preview=1`}
              alt={`Aperçu de ${item.name}`}
            />
          )}
          <a
            className="button outline download-link"
            href={item.url || undefined}
            download={item.name}
          >
            Télécharger le document
          </a>
        </>
      ) : (
        <div className="empty">
          <p>
            Il s’agit d’un document d’exemple : aucun fichier réel n’est
            associé.
          </p>
          <button
            className="button outline"
            onClick={() => onOpenDialog("edit-document", item)}
          >
            Associer un fichier
          </button>
        </div>
      )}
      <div className="dialog-actions">
        <button
          className="button"
          onClick={() => onOpenDialog("share-document", item)}
        >
          Partager ce document
        </button>
        <button className="button outline close-action" onClick={onClose}>
          Fermer
        </button>
      </div>
    </>
  );
}

export function DocumentForm({
  data,
  item,
  ...props
}: DialogProps<Partial<Document>>) {
  const editing = Boolean(item?.id);
  return (
    <SubmissionForm
      {...props}
      title={editing ? "Modifier le document" : "Ajouter un document"}
      description={
        editing
          ? "Modifiez son nom ou l’animal auquel il est associé."
          : "Le fichier sera enregistré dans votre base locale. Utilisez un fichier de test."
      }
      successMessage={editing ? "Document modifié." : "Document enregistré."}
      submitLabel={editing ? "Enregistrer" : "Ajouter"}
      disabled={!data.animals.length}
      onSubmit={async (values, form) => {
        if (!values.name?.trim())
          throw fieldError("name", "Renseignez le nom du document.");
        if (!values.animal)
          throw fieldError(
            "animal",
            "Ajoutez d’abord un animal à votre foyer.",
          );
        const candidate = form.get("file");
        const file = candidate instanceof File ? candidate : null;
        if (editing && !file?.size) {
          await api.editDocument(item.id!, values);
          return;
        }
        if (
          !file?.size ||
          !["application/pdf", "image/jpeg", "image/png"].includes(file.type)
        )
          throw fieldError("file", "Choisissez un PDF, JPEG ou PNG.");
        if (file.size > 10 * 1024 * 1024)
          throw fieldError("file", "Le fichier dépasse 10 Mo.");
        const body = {
          name: values.name.trim(),
          category: values.category,
          animal: values.animal,
          type: file.type,
          content: await readFile(file),
        };
        if (editing) await api.editDocument(item.id!, body);
        else await api.addDocument(body);
      }}
    >
      {({ error, invalid }) => (
        <>
          <Field name="name" label="Nom du document" error={error}>
            <input
              id="name"
              name="name"
              defaultValue={item?.name || ""}
              maxLength={120}
              required
              {...invalid("name")}
            />
          </Field>
          <AnimalSelectField
            animals={data.animals}
            defaultValue={item?.animal}
            error={error}
            invalid={invalid}
          />
          <Field name="category" label="Catégorie">
            <select
              id="category"
              name="category"
              defaultValue={item?.category || "Santé"}
            >
              {["Santé", "Identité", "Assurance", "Autre"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </Field>
          <Field
            name="file"
            label={editing ? "Remplacer le fichier (facultatif)" : "Fichier"}
            error={error}
          >
            <input
              id="file"
              name="file"
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              required={!editing}
              {...invalid("file")}
            />
            <p className="field-help">PDF, JPEG ou PNG · 10 Mo maximum</p>
          </Field>
        </>
      )}
    </SubmissionForm>
  );
}

export function DeleteDocument({
  item,
  data,
  onClose,
  onSaved,
  busy,
  setBusy,
}: DialogProps<Document>) {
  const { error, run } = useDialogAction(setBusy);
  return (
    <>
      <h2 id="action-title" className="dialog-title">
        Supprimer ce document ?
      </h2>
      <p className="dialog-copy">
        « {item.name} » sera retiré du carnet de{" "}
        {animalName(data.animals, item.animal)}. Le fichier d’origine sur votre
        ordinateur sera conservé. Les partages de ce document seront révoqués.
      </p>
      <FormAlert message={error} />
      <div className="dialog-actions">
        <button className="button outline" onClick={onClose} disabled={busy}>
          Annuler
        </button>
        <button
          className="button danger"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await api.deleteDocument(item.id);
              await onSaved("Document retiré du carnet.");
            })
          }
        >
          {busy ? "Suppression…" : "Supprimer le document"}
        </button>
      </div>
    </>
  );
}

/** Liste des documents concernés par une action groupée. */
function BatchList({
  documents,
  data,
}: { documents: Document[] } & Pick<DialogProps, "data">) {
  return (
    <ul className="batch-doc-list">
      {documents.map((d) => (
        <li key={d.id}>
          {d.name} · {animalName(data.animals, d.animal)}
        </li>
      ))}
    </ul>
  );
}
const selectedDocuments = (
  item: DialogProps["item"],
  data: DialogProps["data"],
) => data.documents.filter((d) => item.documents?.includes(d.id));

export function DownloadDocuments({
  item,
  data,
  onClose,
  busy,
  setBusy,
}: DialogProps) {
  const { error, run } = useDialogAction(setBusy);
  const documents = selectedDocuments(item, data);
  const available = documents.filter((d) => d.hasFile);
  const missing = documents.filter((d) => !d.hasFile);
  return (
    <>
      <h2 id="action-title" className="dialog-title">
        Télécharger les documents
      </h2>
      {available.length > 0 && (
        <>
          <p className="dialog-copy">
            {available.length} fichier(s) disponible(s)
            {available.length > 1 ? " réunis dans une archive ZIP" : ""}.
          </p>
          <BatchList documents={available} data={data} />
        </>
      )}
      {missing.length > 0 && (
        <div className="batch-unavailable">
          <strong>{missing.length} fichier(s) non disponible(s)</strong>
          <ul>
            {missing.map((d) => (
              <li key={d.id}>
                {d.name} — {d.example ? "sans fichier" : "fichier à associer"}
              </li>
            ))}
          </ul>
          <p>
            Fermez cette fenêtre et utilisez « Modifier » pour associer un
            fichier à ces documents.
          </p>
        </div>
      )}
      <FormAlert message={error} />
      <div className="dialog-actions">
        <button
          className="button outline close-action"
          onClick={onClose}
          disabled={busy}
        >
          Fermer
        </button>
        {available.length > 0 && (
          <button
            className="button"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await downloadDocuments(available);
                onClose();
              })
            }
          >
            {busy
              ? "Préparation…"
              : `Télécharger ${missing.length ? "les fichiers disponibles" : "les fichiers"} (${available.length})`}
          </button>
        )}
      </div>
    </>
  );
}

export function DeleteDocuments({
  item,
  data,
  onClose,
  onSaved,
  busy,
  setBusy,
}: DialogProps) {
  const { error, run } = useDialogAction(setBusy);
  const documents = selectedDocuments(item, data);
  return (
    <>
      <h2 id="action-title" className="dialog-title">
        Supprimer {documents.length} document(s) ?
      </h2>
      <BatchList documents={documents} data={data} />
      <p className="dialog-copy">
        Ils seront retirés de Documents et des carnets associés. Les partages de
        ces documents seront révoqués. Les fichiers d’origine sur votre appareil
        sont conservés.
      </p>
      <FormAlert message={error} />
      <div className="dialog-actions">
        <button className="button outline" onClick={onClose} disabled={busy}>
          Annuler
        </button>
        <button
          className="button danger"
          disabled={busy || !documents.length}
          onClick={() =>
            run(async () => {
              let deleted = 0;
              try {
                for (const d of documents) {
                  await api.deleteDocument(d.id);
                  deleted++;
                }
              } catch (failure) {
                if (!deleted) throw failure;
                // Suppression partielle : l’espace est rechargé et l’échec signalé.
                await onSaved(
                  `${deleted} document(s) supprimé(s). ${errorMessage(failure)}`,
                );
                return;
              }
              await onSaved(`${deleted} document(s) supprimé(s).`);
            })
          }
        >
          {busy ? "Suppression…" : "Supprimer les documents sélectionnés"}
        </button>
      </div>
    </>
  );
}
