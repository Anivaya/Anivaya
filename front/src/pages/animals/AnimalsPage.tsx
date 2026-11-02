import type { Animal, PageProps } from "../../shared/types.ts";
import AnimalRecordPage from "./AnimalRecordPage.tsx";
import PageHeading from "../../shared/layout/PageHeading.tsx";
import { AiImportButton } from "../documents/AiImport.tsx";
import Icon from "../../shared/ui/Icon.tsx";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

const OVERVIEW_SIZE = 2;
const PAGE_SIZE = 6;
/** Au-delà de la durée du glissement (450 ms dans animals.css). */
const SLIDE_TIMEOUT_MS = 1000;

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
        secondary={
          <AiImportButton onClick={() => actions.openDialog("ai-import")} />
        }
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
  const scrollable = animals.length > (overview ? OVERVIEW_SIZE : PAGE_SIZE);
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
      ) : scrollable ? (
        <AnimalCarousel animals={animals} overview={overview} onOpen={onOpen} />
      ) : (
        <AnimalGrid animals={animals} overview={overview} onOpen={onOpen} />
      )}
    </section>
  );
}

function AnimalGrid({
  animals,
  start = 0,
  overview,
  onOpen,
}: {
  animals: Animal[];
  /** Rang du premier animal dans la liste complète (pages du carrousel). */
  start?: number;
  overview?: boolean;
  onOpen: (animal: Animal) => void;
}) {
  return (
    <div className="animal-grid">
      {animals.map((animal, i) => (
        <AnimalCard
          key={animal.id}
          animal={animal}
          rank={start + i}
          onOpen={onOpen}
          overview={overview}
        />
      ))}
    </div>
  );
}

/**
 * Rail de fiches qui glisse dans le sens de la flèche, en boucle.
 * Vue d’ensemble : deux fiches visibles, une fiche par clic.
 * Mes animaux : une page de six fiches par clic.
 */
function AnimalCarousel({
  animals,
  overview,
  onOpen,
}: {
  animals: Animal[];
  overview?: boolean;
  onOpen: (animal: Animal) => void;
}) {
  const [position, setPosition] = useState(0);
  // Pendant un glissement, le rail contient aussi l’élément qui sort.
  const [slide, setSlide] = useState<{
    first: number;
    direction: "next" | "previous";
  } | null>(null);
  useEffect(() => {
    // Sécurité si la fin d’animation n’est jamais signalée (onglet masqué) : les flèches restent utilisables.
    if (!slide) return;
    const timer = setTimeout(() => setSlide(null), SLIDE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [slide]);
  const perView = overview ? OVERVIEW_SIZE : 1;
  const units = overview
    ? animals.length
    : Math.ceil(animals.length / PAGE_SIZE);
  const current = position % units;
  function move(step: 1 | -1) {
    if (slide) return;
    const target = (current + step + units) % units;
    setSlide({
      first: step > 0 ? current : target,
      direction: step > 0 ? "next" : "previous",
    });
    setPosition(target);
  }
  const first = slide ? slide.first : current;
  const leaving = slide && (slide.direction === "next" ? 0 : perView);
  const slides = Array.from(
    { length: perView + (slide ? 1 : 0) },
    (_, offset) => (first + offset) % units,
  );
  const unit = overview ? "Fiche" : "Page";
  return (
    <div className="animal-carousel">
      <button
        type="button"
        className="carousel-arrow previous"
        onClick={() => move(-1)}
        aria-label={`${unit} précédente`}
      >
        <Icon name="chevron-left" />
      </button>
      <div className="carousel-viewport">
        <div
          className={`carousel-track${slide ? ` slide-${slide.direction}` : ""}`}
          style={{ "--per-view": perView } as CSSProperties}
          onAnimationEnd={(event) => {
            if (event.target === event.currentTarget) setSlide(null);
          }}
        >
          {slides.map((index, offset) => (
            <div
              key={index}
              className="carousel-slide"
              inert={offset === leaving}
            >
              {overview ? (
                <AnimalCard
                  animal={animals[index]}
                  rank={index}
                  onOpen={onOpen}
                  overview
                />
              ) : (
                <AnimalGrid
                  animals={animals.slice(
                    index * PAGE_SIZE,
                    (index + 1) * PAGE_SIZE,
                  )}
                  start={index * PAGE_SIZE}
                  onOpen={onOpen}
                />
              )}
            </div>
          ))}
        </div>
      </div>
      <button
        type="button"
        className="carousel-arrow next"
        onClick={() => move(1)}
        aria-label={`${unit} suivante`}
      >
        <Icon name="chevron-right" />
      </button>
    </div>
  );
}

function AnimalCard({
  animal,
  rank,
  onOpen,
  overview,
}: {
  animal: Animal;
  /** Rang dans la liste complète : la couleur (or / bleu) suit l’animal, pas sa position à l’écran. */
  rank: number;
  onOpen: (animal: Animal) => void;
  overview?: boolean;
}) {
  const label = overview ? "Ouvrir la fiche" : "Ouvrir le carnet";
  return (
    <article className={"animal-card" + (rank % 2 ? " accent-blue" : "")}>
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
