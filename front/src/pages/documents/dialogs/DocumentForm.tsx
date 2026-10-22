import type { Document, DialogProps } from "../../../shared/types.ts";
import SubmissionForm from "../../../shared/forms/SubmissionForm.tsx";
import Field from "../../../shared/ui/Field.tsx";
import AnimalSelectField from "../../animals/components/AnimalSelectField.tsx";
import { api, readFile } from "../../../shared/services/api.ts";

export default function DocumentForm({
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
          throw Object.assign(new Error("Renseignez le nom du document."), {
            field: "name",
          });
        if (!values.animal)
          throw Object.assign(
            new Error("Ajoutez d’abord un animal à votre foyer."),
            { field: "animal" },
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
          throw Object.assign(new Error("Choisissez un PDF, JPEG ou PNG."), {
            field: "file",
          });
        if (file.size > 10 * 1024 * 1024)
          throw Object.assign(new Error("Le fichier dépasse 10 Mo."), {
            field: "file",
          });
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
          {
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
          }
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
          {
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
          }
        </>
      )}
    </SubmissionForm>
  );
}
