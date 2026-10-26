import type {
  PageProps,
  DialogKind,
  Animal,
  Document,
  Share,
  OpenDialog,
} from "../../shared/types.ts";
import { useState } from "react";
import PageHeading from "../../shared/layout/PageHeading.tsx";
import Icon from "../../shared/ui/Icon.tsx";
import CollectionFilters from "../../shared/ui/CollectionFilters.tsx";
import { animalName, matches } from "../../shared/utils/format.ts";

const rowActions: [DialogKind, string, string][] = [
  ["document", "eye", "Voir"],
  ["edit-document", "edit", "Modifier"],
  ["share-document", "share", "Partager"],
  ["delete-document", "trash", "Supprimer"],
];

export default function DocumentsPage({ data, actions }: PageProps) {
  return (
    <>
      <PageHeading
        title="Mes documents"
        description="Les documents de vos animaux, au même endroit."
        actionLabel="Ajouter un document"
        onAction={() => actions.add("document")}
      />
      <DocumentsSection
        shares={data.shares}
        documents={data.documents}
        animals={data.animals}
        onAdd={() => actions.add("document")}
        onAction={actions.openDialog}
      />
    </>
  );
}

export function DocumentsSection({
  documents,
  animals,
  overview,
  onAdd,
  onAction,
  shares = [],
}: {
  documents: Document[];
  animals: Animal[];
  overview?: boolean;
  onAdd: () => void;
  onAction: OpenDialog;
  shares?: Share[];
}) {
  const [search, setSearch] = useState(""),
    [animal, setAnimal] = useState(""),
    [category, setCategory] = useState("");
  const filtered = documents.filter(
    (d) =>
      (!animal || d.animal === animal) &&
      (!category || d.category === category) &&
      matches(d.name, search),
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
            ...[...new Set(documents.map((d) => d.category))].map(
              (c): [string, string] => [c, c],
            ),
          ]}
        />
      )}
      <div className={"documents-list" + (overview ? " recent-documents" : "")}>
        {filtered.map((document) => {
          const owner = animalName(animals, document.animal);
          const activeShares = shares.filter(
            (s) => s.doc === document.id && s.status === "active",
          ).length;
          return (
            <div className="document-row" key={document.id}>
              <button
                className="row-hit"
                onClick={() => onAction("document", document)}
                aria-label={`Ouvrir le document ${document.name} pour ${owner}`}
              />
              <span className="doc-icon">
                <Icon name="file" />
              </span>
              <div className="doc-text">
                <strong>{document.name}</strong>
                <small>
                  {owner} · {document.category} ·{" "}
                  {document.example ? "Exemple" : "Fichier enregistré"}
                </small>
                {activeShares > 0 && (
                  <small>{activeShares} partage(s) actif(s)</small>
                )}
              </div>
              <div className="doc-actions">
                {rowActions.map(([kind, icon, label]) => (
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
          );
        })}
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
