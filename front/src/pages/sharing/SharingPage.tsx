import EmptyState from "../../shared/ui/EmptyState.tsx";
import type { PageProps, Actions, Animal, Person } from "../../shared/types.ts";
import { useState } from "react";
import PageHeading from "../../shared/layout/PageHeading.tsx";
import Icon from "../../shared/ui/Icon.tsx";
import ReceivedShares from "./ReceivedShares.tsx";
import {
  animalName,
  fullDate,
  matches,
  shareLabels,
} from "../../shared/utils/format.ts";

export default function SharingPage({
  data,
  actions,
  params: [section, animal = ""],
}: PageProps) {
  const peopleTab = section === "personnes";
  const receivedTab = section === "recus";
  const hasContent =
    (receivedTab ? data.receivedShares : peopleTab ? data.people : data.shares)
      .length > 0;
  const pending = data.receivedShares.filter(
    (s) => s.state === "pending",
  ).length;
  return (
    <div className="sharing-page">
      <PageHeading
        title="Partage"
        hasContent={hasContent}
        description="Les bonnes informations, aux personnes que vous choisissez."
        actionLabel="Partager des documents"
        showPlus={false}
        onAction={() =>
          actions.openDialog("share-documents", { animal: animal || undefined })
        }
      />
      <nav className="page-tabs" aria-label="Sections du partage">
        {[
          ["partages", "Documents partagés"],
          ["recus", "Partage avec moi" + (pending ? ` (${pending})` : "")],
          ["personnes", "Personnes de confiance"],
        ].map(([key, label]) => (
          <a
            key={key}
            href={`#partage/${key}${animal && key !== "recus" ? `/${animal}` : ""}`}
            aria-current={
              (receivedTab ? "recus" : peopleTab ? "personnes" : "partages") ===
              key
                ? "page"
                : undefined
            }
          >
            {label}
          </a>
        ))}
      </nav>
      {receivedTab ? (
        <>
          {hasContent && (
            <div className="sharing-summary">
              <span>{pending} invitation(s) en attente</span>
              <span>
                {
                  data.receivedShares.filter((s) => s.state === "accepted")
                    .length
                }{" "}
                accès actif(s)
              </span>
            </div>
          )}
          <ReceivedShares shares={data.receivedShares} actions={actions} />
        </>
      ) : (
        <>
          {hasContent && (
            <div className="sharing-summary">
              <span>{data.people.length} personne(s)</span>
              <span>
                {data.shares.filter((s) => s.status === "active").length}{" "}
                partage(s) actif(s)
              </span>
            </div>
          )}
          <SharingContent
            key={`${peopleTab}-${animal}`}
            data={data}
            actions={actions}
            peopleTab={peopleTab}
            initialAnimal={animal}
          />
        </>
      )}
      {hasContent && (
        <p className="share-note">
          Les documents sont partagés en lecture seule, jusqu’à la date choisie.
          Vous pouvez retirer un accès à tout moment.
        </p>
      )}
    </div>
  );
}

function SharingContent({
  data,
  actions,
  peopleTab,
  initialAnimal,
}: {
  data: PageProps["data"];
  actions: Actions;
  peopleTab: boolean;
  initialAnimal: string;
}) {
  const [search, setSearch] = useState(""),
    [animal, setAnimal] = useState(initialAnimal),
    [status, setStatus] = useState("");
  const people = data.people.filter(
    (p) =>
      (!animal || p.animals.includes(animal)) &&
      matches(`${p.name} ${p.email} ${p.phone}`, search),
  );
  const shares = data.shares.flatMap((share) => {
    const doc = data.documents.find((d) => d.id === share.doc);
    return doc &&
      (!animal || doc.animal === animal) &&
      (!status || share.status === status) &&
      matches(`${doc.name} ${share.recipient} ${share.email}`, search)
      ? [{ share, doc }]
      : [];
  });
  if (!(peopleTab ? data.people : data.shares).length)
    return (
      <EmptyState
        kind={peopleTab ? "people" : "documents"}
        title={
          peopleTab ? "Aucune personne de confiance" : "Aucun document partagé"
        }
        description={
          peopleTab
            ? "Vos proches et professionnels de confiance apparaîtront ici."
            : "Les documents que vous partagez apparaîtront ici."
        }
        className="sharing-panel"
      />
    );
  return (
    <section className="sharing-panel">
      <div className="sharing-heading">
        <h2>
          {peopleTab ? "Vos personnes de confiance" : "Vos documents partagés"}
        </h2>
        {peopleTab && (
          <div className="row-buttons">
            <button
              className="button outline"
              onClick={() => actions.openDialog("associate-people", { animal })}
            >
              Associer aux animaux
            </button>
            <button
              className="button"
              onClick={() => actions.openDialog("add-person", { animal })}
            >
              Ajouter une personne
            </button>
          </div>
        )}
      </div>
      <div className="share-filters">
        <input
          aria-label="Rechercher"
          placeholder="Personne ou document…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Filtrer par animal"
          value={animal}
          onChange={(e) => setAnimal(e.target.value)}
        >
          <option value="">Tous les animaux</option>
          {data.animals.map((a) => (
            <option value={a.id} key={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        {!peopleTab && (
          <select
            aria-label="Filtrer par statut"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Tous les statuts</option>
            <option value="active">Actifs</option>
            <option value="expired">Expirés</option>
            <option value="revoked">Révoqués</option>
          </select>
        )}
      </div>
      {peopleTab ? (
        people.length ? (
          <PeopleList
            people={people}
            animals={data.animals}
            actions={actions}
          />
        ) : (
          <EmptyState kind="people" className="share-empty" filtered />
        )
      ) : (
        <>
          {shares.map(({ share: s, doc }) => (
            <article className="access-row" key={s.id}>
              <span className="doc-icon">
                <Icon name="file" />
              </span>
              <div className="person-info">
                <h3>{doc.name}</h3>
                <p>
                  {animalName(data.animals, doc.animal)} · {s.recipient} ·{" "}
                  {s.email}
                </p>
                <p>Lecture seule · Jusqu’au {fullDate(s.until)}</p>
                <span
                  className={`access-state ${s.status !== "active" ? "off" : ""}`}
                >
                  {shareLabels[s.status]}
                </span>
              </div>
              <div className="row-buttons">
                <button
                  aria-label={`Voir le partage de ${doc.name} avec ${s.recipient}`}
                  onClick={() => actions.openDialog("share-details", s)}
                >
                  <Icon name="eye" />
                </button>
                {s.status === "active" && (
                  <button
                    className="red"
                    aria-label={`Révoquer le partage de ${doc.name} avec ${s.recipient}`}
                    title="Révoquer"
                    onClick={() => actions.openDialog("revoke-share", s)}
                  >
                    <Icon name="close" />
                  </button>
                )}
              </div>
            </article>
          ))}
          {!shares.length && (
            <EmptyState kind="documents" className="share-empty" filtered />
          )}
        </>
      )}
    </section>
  );
}

/** Liste des personnes de confiance, aussi affichée dans le carnet d’un animal. */
export function PeopleList({
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
      <EmptyState
        kind="people"
        compact
        title="Aucune personne de confiance"
        description="Les contacts associés à ce carnet apparaîtront ici."
      />
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
          <p>
            {animal
              ? person.note
              : person.animals.length
                ? person.animals
                    .map((id) => animalName(animals, id))
                    .join(" · ")
                : "Aucun animal associé"}
          </p>
        )}
      </div>
      {!compact && (
        <div className="row-buttons">
          {!animal && (
            <button
              aria-label={`Associer ${person.name} à des animaux`}
              title="Associer aux animaux"
              onClick={() =>
                actions.openDialog("associate-people", { person: person.id })
              }
            >
              <Icon name="paw" />
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
