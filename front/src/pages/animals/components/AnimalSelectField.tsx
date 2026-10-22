import type { Animal, ValidationState } from "../../../shared/types.ts";
import Field from "../../../shared/ui/Field.tsx";

export default function AnimalSelectField({
  animals,
  defaultValue,
  error,
  invalid,
}: ValidationState & { animals: Animal[]; defaultValue?: string }) {
  return (
    <Field name="animal" label="Animal" error={error}>
      <select
        id="animal"
        name="animal"
        defaultValue={defaultValue || animals[0]?.id || ""}
        {...invalid("animal")}
      >
        {!animals.length && <option value="">Aucun animal</option>}
        {animals.map((animal) => (
          <option key={animal.id} value={animal.id}>
            {animal.name}
          </option>
        ))}
      </select>
    </Field>
  );
}
