import Icon from "../../../shared/ui/Icon.jsx";
import { useState } from "react";
import CollectionFilters from "../../../shared/ui/CollectionFilters.jsx";
import { animalName } from "../../../shared/utils/format.js";
export default function DocumentsSection({
  documents,
  animals,
  overview,
  onAdd,
  onAction,
  shares = [],
}) {
  const [search, setSearch] = useState(""),
    [animal, setAnimal] = useState(""),
    [category, setCategory] = useState("");
  const filtered = documents.filter(
    (d) =>
      (!animal || d.animal === animal) &&
      (!category || d.category === category) &&
      d.name
        .toLocaleLowerCase("fr")
        .includes(search.trim().toLocaleLowerCase("fr")),
  );
  return (
    <section className="panel" aria-labelledby="documents-title">
      <div className="section-head">
        <h2 id="documents-title">
          {overview ? "Documents récents" : "Vos documents"}
        </h2>
        {overview && (
          <a className="subtle" href="#documents">
            Voir tous →
          </a>
        )}
      </div>
      {!overview && (
        <CollectionFilters
          search={search}
          onSearch={setSearch}
          animal={animal}
          onAnimal={setAnimal}
          animals={animals}
          filter={category}
          onFilter={setCategory}
          label="Filtrer par catégorie"
          options={[
            ["", "Toutes les catégories"],
            ...[...new Set(documents.map((d) => d.category))].map((c) => [
              c,
              c,
            ]),
          ]}
        />
      )}
      <div className="documents-list">
        {filtered.map((document) => (
          <div className="document-row" key={document.id}>
            <button
              className="row-hit"
              onClick={() => onAction("document", document)}
              aria-label={`Ouvrir le document ${document.name} pour ${animalName(animals, document.animal)}`}
            />
            <span className="doc-icon">
              <Icon name="file" />
            </span>
            <div className="doc-text">
              <strong>{document.name}</strong>
              <small>
                {animalName(animals, document.animal)} · {document.category} ·{" "}
                {document.example ? "Exemple" : "Fichier enregistré"}
              </small>
              {shares.some(
                (s) => s.doc === document.id && s.status === "active",
              ) && (
                <small>
                  {
                    shares.filter(
                      (s) => s.doc === document.id && s.status === "active",
                    ).length
                  }{" "}
                  partage(s) actif(s)
                </small>
              )}
            </div>
            <div className="doc-actions">
              {[
                ["document", "eye", "Voir"],
                ["edit-document", "edit", "Modifier"],
                ["share-document", "share", "Partager"],
                ["delete-document", "trash", "Supprimer"],
              ].map(([kind, icon, label]) => (
                <button
                  key={kind}
                  className={icon === "trash" ? "delete-action" : ""}
                  onClick={() => onAction(kind, document)}
                  title={label}
                  aria-label={`${label} ${document.name}`}
                >
                  <Icon name={icon} />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {!filtered.length && (
        <p className="empty">
          {documents.length
            ? "Aucun document pour ces filtres."
            : "Aucun document. Ajoutez votre premier document."}
        </p>
      )}
      <button className="button outline" onClick={onAdd}>
        + Ajouter un document
      </button>
    </section>
  );
}
