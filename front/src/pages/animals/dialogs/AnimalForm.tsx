import type { Animal, DialogProps } from "../../../shared/types.ts";
import SubmissionForm from "../../../shared/forms/SubmissionForm.tsx";
import { useState } from "react";
import Field from "../../../shared/ui/Field.tsx";
import { api, readFile } from "../../../shared/services/api.ts";

const fields: Record<string, [string, string | string[]]> = {
  name: ["Nom de l’animal", "text"],
  species: ["Espèce", ["Chien", "Chat"]],
  breed: ["Race", "text"],
  dob: ["Date de naissance", "date"],
  weight: ["Poids déclaré (kg)", "number"],
  coat: ["Robe", "text"],
  identifier: ["Identifiant", "text"],
  sex: ["Sexe", ["Non renseigné", "Femelle", "Mâle"]],
  neutered: ["Stérilisation", ["Non renseignée", "Oui", "Non"]],
};
export default function AnimalForm({
  item,
  ...props
}: DialogProps<Partial<Animal>>) {
  const editing = Boolean(item?.id);
  const order = editing
    ? [
        "name",
        "species",
        "breed",
        "sex",
        "dob",
        "weight",
        "coat",
        "neutered",
        "identifier",
      ]
    : Object.keys(fields);
  const [today] = useState(() =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()),
  );
  return (
    <SubmissionForm
      {...props}
      title={editing ? "Modifier le profil" : "Ajouter un animal"}
      description={
        editing
          ? "Modifiez les informations de son profil."
          : "Créez un profil de démonstration. Utilisez des informations fictives."
      }
      successMessage={editing ? "Profil modifié." : "Animal ajouté au foyer."}
      submitLabel={editing ? "Enregistrer" : "Ajouter"}
      onSubmit={async (values, form) => {
        if (!values.name?.trim())
          throw Object.assign(new Error("Renseignez le nom de votre animal."), {
            field: "name",
          });
        const file = form.get("photo");
        const body: import("../../../../../shared/models.ts").AnimalInput = {
          ...values,
        };
        if (file instanceof File && file.size) {
          if (
            !["image/jpeg", "image/png"].includes(file.type) ||
            file.size > 2097152
          )
            throw Object.assign(
              new Error("Choisissez un JPEG ou PNG de moins de 2 Mo."),
              { field: "photo" },
            );
          body.photo = { type: file.type, content: await readFile(file) };
        }
        if (editing) await api.editAnimal(item.id!, body);
        else await api.addAnimal(body);
      }}
    >
      {({ error, invalid }) => (
        <div className={editing ? "record-form-grid" : "animal-add-fields"}>
          {order.map((name) => {
            const [label, type] = fields[name];
            const options = Array.isArray(type) ? type : null;
            const caption = !editing
              ? name === "name"
                ? `${label} *`
                : options
                  ? label
                  : `${label} (facultatif)`
              : label;
            return (
              <Field key={name} name={name} label={caption} error={error}>
                {options ? (
                  <select
                    id={name}
                    name={name}
                    defaultValue={item?.[name as keyof Animal] || options[0]}
                    {...invalid(name)}
                  >
                    {options.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={name}
                    name={name}
                    type={typeof type === "string" ? type : undefined}
                    defaultValue={item?.[name as keyof Animal] || ""}
                    required={name === "name"}
                    maxLength={name === "name" ? 40 : 100}
                    min={type === "number" ? "0.1" : undefined}
                    max={
                      type === "number"
                        ? "200"
                        : type === "date"
                          ? today
                          : undefined
                    }
                    step={type === "number" ? "0.1" : undefined}
                    {...invalid(name)}
                  />
                )}
              </Field>
            );
          })}
          <Field
            name="photo"
            label={
              editing ? "Remplacer la photo (facultatif)" : "Photo (facultatif)"
            }
            error={error}
          >
            <input
              id="photo"
              name="photo"
              type="file"
              accept="image/jpeg,image/png"
              {...invalid("photo")}
            />
            <p className="field-help">
              JPEG ou PNG · 2 Mo maximum. Seul le nom est obligatoire.
            </p>
          </Field>
        </div>
      )}
    </SubmissionForm>
  );
}
