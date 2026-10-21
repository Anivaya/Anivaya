import SubmissionForm from "../../../shared/forms/SubmissionForm.jsx";
import Field from "../../../shared/ui/Field.jsx";
import AnimalSelectField from "../../animals/components/AnimalSelectField.jsx";
import { api, readFile } from "../../../shared/services/api.js";

export default function DocumentForm({ data, item, ...props }) {
  const editing = Boolean(item);
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
      onSubmit={async (values) => {
        if (editing && !values.name?.trim())
          throw Object.assign(new Error("Renseignez le nom du document."), {
            field: "name",
          });
        if (!values.animal)
          throw Object.assign(
            new Error("Ajoutez d’abord un animal à votre foyer."),
            { field: "animal" },
          );
        if (editing) {
          await api.editDocument(item.id, values);
          return;
        }
        const file = values.file;
        if (
          !file?.size ||
          !["application/pdf", "image/jpeg", "image/png"].includes(file.type)
        )
          throw Object.assign(new Error("Choisissez un PDF, JPEG ou PNG."), {
            field: "file",
          });
        if (file.size > 10 * 1024 * 1024)
          throw Object.assign(new Error("Le fichier dépasse 10 Mo."), {
            field: "file",
          });
        await api.addDocument({
          name: file.name,
          animal: values.animal,
          type: file.type,
          content: await readFile(file),
        });
      }}
    >
      {({ error, invalid }) => (
        <>
          {editing && (
            <Field name="name" label="Nom du document" error={error}>
              <input
                id="name"
                name="name"
                defaultValue={item.name}
                maxLength={120}
                required
                {...invalid("name")}
              />
            </Field>
          )}
          <AnimalSelectField
            animals={data.animals}
            defaultValue={item?.animal}
            error={error}
            invalid={invalid}
          />
          {!editing && (
            <Field name="file" label="Fichier" error={error}>
              <input
                id="file"
                name="file"
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                required
                {...invalid("file")}
              />
              <p className="field-help">PDF, JPEG ou PNG · 10 Mo maximum</p>
            </Field>
          )}
        </>
      )}
    </SubmissionForm>
  );
}
