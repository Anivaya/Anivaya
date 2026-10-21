import SubmissionForm from "../../../shared/forms/SubmissionForm.jsx";
import Field from "../../../shared/ui/Field.jsx";
import { api } from "../../../shared/services/api.js";

export default function AnimalForm(props) {
  return (
    <SubmissionForm
      {...props}
      title="Ajouter un animal"
      description="Créez un profil pour votre compagnon. Utilisez des données fictives pour cette démonstration."
      successMessage="Animal ajouté au foyer."
      onSubmit={async (values) => {
        if (!values.name?.trim())
          throw Object.assign(new Error("Renseignez le nom de votre animal."), {
            field: "name",
          });
        await api.addAnimal(values);
      }}
    >
      {({ error, invalid }) => (
        <>
          <Field name="name" label="Nom de l’animal" error={error}>
            <input
              id="name"
              name="name"
              maxLength={40}
              required
              {...invalid("name")}
            />
          </Field>
          <Field name="species" label="Espèce">
            <select id="species" name="species">
              <option>Chien</option>
              <option>Chat</option>
            </select>
          </Field>
          <Field name="description" label="Race ou précision (facultatif)">
            <input
              id="description"
              name="description"
              maxLength={70}
              placeholder="Ex. : Labrador, 2 ans"
            />
          </Field>
        </>
      )}
    </SubmissionForm>
  );
}
