import Icon from "../../../shared/ui/Icon.jsx";
export default function AnimalsSection({ animals, overview, onOpen, onAdd }) {
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

function AnimalCard({ animal, onOpen, overview }) {
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
          aria-label={`${overview ? "Ouvrir la fiche" : "Ouvrir le carnet"} de ${animal.name}`}
        >
          {overview ? "Ouvrir la fiche" : "Ouvrir le carnet"}
        </button>
      </div>
    </article>
  );
}
