import { useText } from "../../shared/i18n/HomeLocale.tsx";
import EmptyState from "../../shared/ui/EmptyState.tsx";
import type {
  PageProps,
  DialogKind,
  Animal,
  Document,
  Share,
  OpenDialog,
} from "../../shared/types.ts";
import { useEffect, useRef, useState } from "react";
import PageHeading from "../../shared/layout/PageHeading.tsx";
import { AiImportButton } from "./AiImport.tsx";
import Icon from "../../shared/ui/Icon.tsx";
import CollectionFilters from "../../shared/ui/CollectionFilters.tsx";
import { animalName, matches } from "../../shared/utils/format.ts";
import { downloadDocuments } from "./download.ts";

/** Actions d’une ligne, dans l’ordre d’affichage ; « download » télécharge sans fenêtre. */
const rowActions: [DialogKind | "download", string, string][] = [
  ["document", "eye", "Voir"],
  ["edit-document", "edit", "Modifier"],
  ["share-document", "share", "Partager"],
  ["download", "download", "Télécharger"],
  ["delete-document", "trash", "Supprimer"],
];

export default function DocumentsPage({ data, actions }: PageProps) {
  const tr = useText();
  return (
    <>
      <PageHeading
        title={tr("Mes documents")}
        description={tr("Les documents de vos animaux, au même endroit.")}
        actionLabel={tr("Ajouter un document")}
        onAction={() => actions.add("document")}
        secondary={
          <AiImportButton onClick={() => actions.openDialog("ai-import")} />
        }
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
  const tr = useText();
  const [search, setSearch] = useState(""),
    [animal, setAnimal] = useState(""),
    [category, setCategory] = useState("");
  // Sélection de la page Documents : conservée en filtrant, sans les documents supprimés.
  const [picked, setPicked] = useState<string[]>([]);
  const selected = picked.filter((id) => documents.some((d) => d.id === id));
  const filtered = documents.filter(
    (d) =>
      (!animal || d.animal === animal) &&
      (!category || d.category === category) &&
      matches(d.name, search),
  );
  function download(document: Document) {
    if (!document.hasFile)
      return onAction("download-documents", { documents: [document.id] });
    // En cas d’échec, la fenêtre explique le problème et propose de réessayer.
    downloadDocuments([document]).catch(() =>
      onAction("download-documents", { documents: [document.id] }),
    );
  }
  return (
    <section className="panel" aria-labelledby="documents-title">
      <div className="section-head">
        <h2 id="documents-title">
          {overview ? tr("Documents récents") : tr("Vos documents")}
        </h2>
        {overview && documents.length > 0 && (
          <a className="subtle" href="#documents">
            {tr("Voir tous →")}
          </a>
        )}
      </div>
      {!overview && documents.length > 0 && (
        <CollectionFilters
          search={search}
          onSearch={setSearch}
          animal={animal}
          onAnimal={setAnimal}
          animals={animals}
          filter={category}
          onFilter={setCategory}
          label={tr("Filtrer par catégorie")}
          options={[
            ["", "Toutes les catégories"],
            ...[...new Set(documents.map((d) => d.category))].map(
              (c): [string, string] => [c, c],
            ),
          ]}
        />
      )}
      {!overview && filtered.length > 0 && (
        <BatchBar
          visible={filtered.map((d) => d.id)}
          selected={selected}
          onChange={setPicked}
          onAction={(kind) => onAction(kind, { documents: selected })}
        />
      )}
      <div className={"documents-list" + (overview ? " recent-documents" : "")}>
        {filtered.map((document) => {
          const owner = animalName(animals, document.animal);
          const activeShares = shares.filter(
            (s) => s.doc === document.id && s.status === "active",
          ).length;
          return (
            <div
              className={"document-row" + (overview ? "" : " selectable")}
              key={document.id}
            >
              {!overview && (
                <input
                  type="checkbox"
                  className="document-select"
                  checked={selected.includes(document.id)}
                  onChange={(e) =>
                    setPicked(
                      e.target.checked
                        ? [...selected, document.id]
                        : selected.filter((id) => id !== document.id),
                    )
                  }
                  aria-label={tr("Sélectionner {0}", [document.name])}
                />
              )}
              <button
                className="row-hit"
                onClick={() => onAction("document", document)}
                aria-label={tr("Ouvrir le document {0} pour {1}", [
                  document.name,
                  owner,
                ])}
              />
              <span className="doc-icon">
                <Icon name="file" />
              </span>
              <div className="doc-text">
                <strong>{document.name}</strong>
                <small>
                  {owner} · {tr(document.category)} ·{" "}
                  {document.example
                    ? tr("Sans fichier")
                    : tr("Fichier enregistré")}
                </small>
                {activeShares > 0 && (
                  <small>
                    {activeShares}
                    {tr(" partage(s) actif(s)")}
                  </small>
                )}
              </div>
              <div className="doc-actions">
                {rowActions.map(([kind, icon, label]) => (
                  <button
                    key={kind}
                    className={icon === "trash" ? "delete-action" : ""}
                    onClick={() =>
                      kind === "download"
                        ? download(document)
                        : onAction(kind, document)
                    }
                    title={tr(label)}
                    aria-label={`${tr(label)} ${document.name}`}
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
        <EmptyState
          kind="documents"
          compact={overview}
          filtered={documents.length > 0}
        />
      )}
      <button className="button outline" onClick={onAdd}>
        {tr("+ Ajouter un document")}
      </button>
    </section>
  );
}

/** Actions groupées de la page Documents ; la case générale vaut pour les documents affichés. */
function BatchBar({
  visible,
  selected,
  onChange,
  onAction,
}: {
  visible: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  onAction: (
    kind: "share-documents" | "download-documents" | "delete-documents",
  ) => void;
}) {
  const tr = useText();
  const all = useRef<HTMLInputElement>(null);
  const shown = visible.filter((id) => selected.includes(id)).length;
  useEffect(() => {
    if (all.current)
      all.current.indeterminate = shown > 0 && shown < visible.length;
  }, [shown, visible.length]);
  const plural = selected.length > 1 ? "s" : "";
  const hidden = selected.length - shown;
  const actions = [
    ["share-documents", "share", "Partager"],
    ["download-documents", "download", "Télécharger"],
    ["delete-documents", "trash", "Supprimer"],
  ] as const;
  return (
    <div className="document-batch">
      <label
        title={
          hidden
            ? tr("{0} document(s) sélectionné(s) hors des filtres", [hidden])
            : undefined
        }
      >
        <input
          ref={all}
          type="checkbox"
          checked={visible.length > 0 && shown === visible.length}
          disabled={!visible.length}
          onChange={(e) =>
            onChange(
              e.target.checked
                ? [...new Set([...selected, ...visible])]
                : selected.filter((id) => !visible.includes(id)),
            )
          }
          aria-label={tr(
            "Sélectionner ou désélectionner les {0} documents affichés",
            [visible.length],
          )}
        />
        <span role="status">
          {selected.length
            ? tr("{0} élément{1} sélectionné{2}", [
                selected.length,
                plural,
                plural,
              ])
            : tr("Tout sélectionner")}
        </span>
      </label>
      <div className="document-batch-actions doc-actions">
        {actions.map(([kind, icon, label]) => (
          <button
            key={kind}
            type="button"
            className={icon === "trash" ? "delete-action" : ""}
            disabled={!selected.length}
            onClick={() => onAction(kind)}
            title={tr(label)}
            aria-label={tr("{0} les documents sélectionnés", [tr(label)])}
          >
            <Icon name={icon} />
          </button>
        ))}
      </div>
    </div>
  );
}
