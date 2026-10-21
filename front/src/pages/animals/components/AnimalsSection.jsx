import AnimalCard from "./AnimalCard.jsx";
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
            <AnimalCard key={animal.id} animal={animal} onOpen={onOpen} />
          ))}
        </div>
      )}
    </section>
  );
}
