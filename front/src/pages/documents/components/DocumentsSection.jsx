import Icon from "../../../shared/ui/Icon.jsx";
import { animalName } from "../../../shared/utils/format.js";
export default function DocumentsSection({
  documents,
  animals,
  overview,
  onAdd,
  onAction,
}) {
  return (
    <section className="panel" aria-labelledby="documents-title">
      <div className="section-head">
        <h2 id="documents-title">Documents récents</h2>
        {overview && (
          <a className="subtle" href="#documents">
            Voir tous →
          </a>
        )}
      </div>
      <div className="documents-list">
        {documents.map((document) => (
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
                {animalName(animals, document.animal)} ·{" "}
                {document.example ? "Exemple" : "Fichier enregistré"}
              </small>
            </div>
            <div className="doc-actions">
              {[
                ["document", "eye", "Voir"],
                ["edit-document", "edit", "Modifier"],
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
      {!documents.length && (
        <p className="empty">Aucun document. Ajoutez votre premier document.</p>
      )}
      <button className="button outline" onClick={onAdd}>
        + Ajouter un document
      </button>
    </section>
  );
}
