import type { Animal, PageProps } from "../../shared/types.ts";
import AnimalRecordPage from "./AnimalRecordPage.tsx";
import PageHeading from "../../shared/layout/PageHeading.tsx";
import Icon from "../../shared/ui/Icon.tsx";

export default function AnimalsPage({
  data,
  actions,
  params: [id, tab],
  pending,
}: PageProps) {
  if (id)
    return (
      <AnimalRecordPage
        id={id}
        tab={tab}
        data={data}
        actions={actions}
        pending={pending}
      />
    );
  return (
    <>
      <PageHeading
        title="Mes animaux"
        description="Un carnet pour chacun de vos compagnons."
        actionLabel="Ajouter un animal"
        onAction={() => actions.add("animal")}
      />
      <div className="app-grid">
        <div className="app-left">
          <AnimalsSection
            animals={data.animals}
            onOpen={actions.openAnimal}
            onAdd={() => actions.add("animal")}
          />
        </div>
      </div>
    </>
  );
}

export function AnimalsSection({
  animals,
  overview,
  onOpen,
  onAdd,
}: {
  animals: Animal[];
  overview?: boolean;
  onOpen: (animal: Animal) => void;
  onAdd: () => void;
}) {
  return (
    <section aria-labelledby="animals-title">
      <div className="section-head">
        <h2 id="animals-title">Mes animaux</h2>
        {overview && (
          <a className="subtle" href="#animaux">
            Voir mes animaux →
          </a>
        )}
      </div>
      {!animals.length ? (
        <div className="empty">
          <p>Votre foyer n’a pas encore d’animal.</p>
          <button className="button" onClick={onAdd}>
            Ajouter un animal
          </button>
        </div>
      ) : (
        <div className="animal-grid">
          {animals.map((animal) => (
            <AnimalCard
              key={animal.id}
              animal={animal}
              onOpen={onOpen}
              overview={overview}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function AnimalCard({
  animal,
  onOpen,
  overview,
}: {
  animal: Animal;
  onOpen: (animal: Animal) => void;
  overview?: boolean;
}) {
  const label = overview ? "Ouvrir la fiche" : "Ouvrir le carnet";
  return (
    <article className="animal-card">
      <button
        type="button"
        className={`pet-picture animal-picture-button ${animal.style}`}
        onClick={() => onOpen(animal)}
        aria-label={`Ouvrir la fiche de ${animal.name} depuis sa photo`}
      >
        {animal.photo ? (
          <img className="animal-uploaded-photo" src={animal.photo} alt="" />
        ) : (
          animal.style === "new" && <Icon name="paw" />
        )}
      </button>
      <div className="pet-card-body">
        <h3>{animal.name}</h3>
        <p>
          {animal.species} · {animal.description}
        </p>
        <button
          className="button"
          onClick={() => onOpen(animal)}
          aria-label={`${label} de ${animal.name}`}
        >
          {label}
        </button>
      </div>
    </article>
  );
}
