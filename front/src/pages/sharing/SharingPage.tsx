import type { PageProps } from "../../shared/types.ts";
import { useState } from "react";
import PageHeading from "../../shared/layout/PageHeading.tsx";
import Icon from "../../shared/ui/Icon.tsx";
import PeopleList from "./components/PeopleList.tsx";
import { animalName, fullDate } from "../../shared/utils/format.ts";
export default function SharingPage({ data, actions, route }: PageProps) {
  const parts = route.replace(/^#/, "").split("/");
  const peopleTab = parts[1] === "personnes";
  return (
    <div className="sharing-page">
      <PageHeading
        title="Partage"
        description="Les bonnes informations, aux personnes que vous choisissez."
        actionLabel="Partager des documents"
        showPlus={false}
        onAction={() =>
          actions.openDialog("share-documents", { animal: parts[2] })
        }
      />
      <nav className="sharing-tabs" aria-label="Sections du partage">
        {[
          ["partages", "Documents partagés"],
          ["personnes", "Personnes de confiance"],
        ].map(([key, label]) => (
          <a
            key={key}
            href={`#partage/${key}${parts[2] ? `/${parts[2]}` : ""}`}
            aria-current={
              peopleTab === (key === "personnes") ? "page" : undefined
            }
          >
            {label}
          </a>
        ))}
      </nav>
      <div className="sharing-summary">
        <span>{data.people.length} personne(s)</span>
        <span>
          {data.shares.filter((s) => s.status === "active").length} partage(s)
          actif(s)
        </span>
      </div>
      <SharingContent
        key={`${peopleTab}-${parts[2] || ""}`}
        data={data}
        actions={actions}
        peopleTab={peopleTab}
        initialAnimal={parts[2] || ""}
      />
      <p className="share-note">
        Partages en lecture seule simulés, conservés dans votre espace local.
        Aucun accès réel ni invitation n’est envoyé.
      </p>
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
  actions: PageProps["actions"];
  peopleTab: boolean;
  initialAnimal: string;
}) {
  const [search, setSearch] = useState(""),
    [animal, setAnimal] = useState(initialAnimal),
    [status, setStatus] = useState("");
  const q = search.trim().toLocaleLowerCase("fr");
  const people = data.people.filter(
    (p) =>
      (!animal || p.animals.includes(animal)) &&
      `${p.name} ${p.email} ${p.phone}`.toLocaleLowerCase("fr").includes(q),
  );
  const shares = data.shares.filter((s) => {
    const doc = data.documents.find((d) => d.id === s.doc)!;
    return (
      doc &&
      (!animal || doc.animal === animal) &&
      (!status || s.status === status) &&
      `${doc.name} ${s.recipient} ${s.email}`
        .toLocaleLowerCase("fr")
        .includes(q)
    );
  });
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
          placeholder="Rechercher une personne ou un document…"
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
          <div className="share-empty">
            <h3>
              {data.people.length
                ? "Aucune personne pour ces filtres"
                : "Entourez vos compagnons"}
            </h3>
            <p>
              Enregistrez un proche ou un professionnel, puis choisissez les
              animaux auxquels l’associer.
            </p>
            <button
              className="button outline"
              onClick={() => actions.openDialog("add-person", { animal })}
            >
              Ajouter une personne
            </button>
          </div>
        )
      ) : (
        <>
          {shares.map((s) => {
            const doc = data.documents.find((d) => d.id === s.doc)!;
            return (
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
                    {s.status === "active"
                      ? "Actif dans la démo"
                      : s.status === "expired"
                        ? "Expiré"
                        : "Révoqué"}
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
                      onClick={() => actions.openDialog("revoke-share", s)}
                    >
                      Révoquer
                    </button>
                  )}
                </div>
              </article>
            );
          })}
          {!shares.length && (
            <div className="share-empty">
              <h3>
                {data.shares.length
                  ? "Aucun partage pour ces filtres"
                  : "Vous choisissez ce que vous partagez"}
              </h3>
              <p>
                Sélectionnez vos documents et une ou plusieurs personnes. Chaque
                partage possède sa propre date de fin.
              </p>
              <button
                className="button outline"
                onClick={() =>
                  actions.openDialog("share-documents", { animal })
                }
              >
                Partager des documents
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
