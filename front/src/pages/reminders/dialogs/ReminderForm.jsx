import SubmissionForm from "../../../shared/forms/SubmissionForm.jsx";
import Field from "../../../shared/ui/Field.jsx";
import AnimalSelectField from "../../animals/components/AnimalSelectField.jsx";
import { api } from "../../../shared/services/api.js";

export default function ReminderForm({ data, item, ...props }) {
  return (
    <SubmissionForm
      {...props}
      title="Ajouter un rappel"
      description="Choisissez une date à suivre pour votre animal."
      successMessage="Rappel ajouté."
      disabled={!data.animals.length}
      onSubmit={async (values) => {
        if (!values.name?.trim())
          throw Object.assign(new Error("Renseignez un intitulé."), {
            field: "name",
          });
        if (!values.animal)
          throw Object.assign(
            new Error("Ajoutez d’abord un animal à votre foyer."),
            { field: "animal" },
          );
        if (!values.date)
          throw Object.assign(new Error("Choisissez une date."), {
            field: "date",
          });
        await api.addReminder(values);
      }}
    >
      {({ error, invalid }) => (
        <>
          <Field name="name" label="Intitulé" error={error}>
            <input
              id="name"
              name="name"
              maxLength={80}
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
          <Field name="date" label="Date" error={error}>
            <input
              id="date"
              name="date"
              type="date"
              required
              {...invalid("date")}
            />
          </Field>
        </>
      )}
    </SubmissionForm>
  );
}
