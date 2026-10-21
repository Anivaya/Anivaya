import Icon from "../../../shared/ui/Icon.jsx";

export default function AnimalCard({ animal, onOpen }) {
  return (
    <article className="animal-card">
      <button
        type="button"
        className={`pet-picture animal-picture-button ${animal.style}`}
        onClick={() => onOpen(animal)}
        aria-label={`Ouvrir la fiche de ${animal.name} depuis sa photo`}
      >
        {animal.style === "new" && <Icon name="paw" />}
      </button>
      <div className="pet-card-body">
        <h3>{animal.name}</h3>
        <p>
          {animal.species} · {animal.description}
        </p>
        <button
          className="button"
          onClick={() => onOpen(animal)}
          aria-label={`Ouvrir le carnet de ${animal.name}`}
        >
          Ouvrir le carnet
        </button>
      </div>
    </article>
  );
}
