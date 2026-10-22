import type { Reminder, DialogProps } from "../../../shared/types.ts";
import SubmissionForm from "../../../shared/forms/SubmissionForm.tsx";
import Field from "../../../shared/ui/Field.tsx";
import AnimalSelectField from "../../animals/components/AnimalSelectField.tsx";
import { api } from "../../../shared/services/api.ts";
export default function ReminderForm({
  data,
  item = {},
  ...props
}: DialogProps<Partial<Reminder>>) {
  return (
    <SubmissionForm
      {...props}
      title={item.id ? "Modifier le rappel" : "Ajouter un rappel"}
      description="Choisissez une date à suivre pour votre animal. Aucune notification réelle n’est envoyée."
      submitLabel={item.id ? "Enregistrer" : "Ajouter"}
      successMessage={item.id ? "Rappel modifié." : "Rappel ajouté."}
      disabled={!data.animals.length}
      onSubmit={(values) =>
        item.id ? api.editReminder(item.id, values) : api.addReminder(values)
      }
    >
      {({ error, invalid }) => (
        <>
          <Field name="name" label="Intitulé" error={error}>
            <input
              id="name"
              name="name"
              maxLength={80}
              required
              defaultValue={item.name || ""}
              {...invalid("name")}
            />
          </Field>
          <AnimalSelectField
            animals={data.animals}
            defaultValue={item.animal}
            error={error}
            invalid={invalid}
          />
          <Field name="date" label="Date" error={error}>
            <input
              id="date"
              name="date"
              type="date"
              required
              defaultValue={item.date || ""}
              {...invalid("date")}
            />
          </Field>
          <div className="field-grid">
            {(
              [
                [
                  "repeat",
                  "Répétition",
                  ["Aucune", "Chaque semaine", "Chaque mois", "Chaque année"],
                ],
                [
                  "notice",
                  "Prévenir",
                  [
                    "Le jour même",
                    "1 jour avant",
                    "3 jours avant",
                    "7 jours avant",
                  ],
                ],
              ] as [string, string, string[]][]
            ).map(([name, label, values]) => (
              <Field key={name} name={name} label={label} error={error}>
                <select
                  id={name}
                  name={name}
                  defaultValue={item[name as "repeat" | "notice"] || values[0]}
                  {...invalid(name)}
                >
                  {values.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
          <Field name="note" label="Note (facultatif)" error={error}>
            <textarea
              id="note"
              name="note"
              maxLength={1000}
              rows={3}
              defaultValue={item.note || ""}
              {...invalid("note")}
            />
          </Field>
        </>
      )}
    </SubmissionForm>
  );
}
