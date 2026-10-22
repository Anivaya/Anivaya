import type { Actions, Animal, Person } from "../../../shared/types.ts";
import Icon from "../../../shared/ui/Icon.tsx";
import { animalName } from "../../../shared/utils/format.ts";
export default function PeopleList({
  people,
  animals,
  actions,
  animal,
  compact = false,
}: {
  people: Person[];
  animals: Animal[];
  actions: Actions;
  animal?: string;
  compact?: boolean;
}) {
  if (!people.length)
    return (
      <p className="share-empty">
        Aucune personne de confiance pour le moment.
      </p>
    );
  return people.map((person) => (
    <article className="person-card" key={person.id}>
      <span className="person-avatar" aria-hidden="true">
        {person.name.slice(0, 1).toLocaleUpperCase("fr")}
      </span>
      <div className="person-info">
        <h3>{person.name}</h3>
        <p>
          {person.role}
          {!compact && ` · ${person.email || person.phone}`}
        </p>
        {!compact && (
          <>
            <p>
              {animal
                ? person.note
                : person.animals.length
                  ? person.animals
                      .map((id) => animalName(animals, id))
                      .join(" · ")
                  : "Aucun animal associé"}
            </p>
          </>
        )}
      </div>
      {!compact && (
        <div className="row-buttons">
          {!animal && (
            <button
              onClick={() =>
                actions.openDialog("associate-people", { person: person.id })
              }
            >
              Associer
            </button>
          )}
          <button
            aria-label={`Modifier ${person.name}`}
            title="Modifier"
            onClick={() => actions.openDialog("edit-person", person)}
          >
            <Icon name="edit" />
          </button>
          <button
            className="red"
            aria-label={`${animal ? "Retirer" : "Supprimer"} ${person.name}`}
            title={animal ? "Retirer du carnet" : "Supprimer"}
            onClick={() =>
              actions.openDialog(animal ? "remove-person" : "delete-person", {
                ...person,
                animal,
              })
            }
          >
            <Icon name="trash" />
          </button>
        </div>
      )}
    </article>
  ));
}
