import { animalName } from "../../../shared/utils/format.js";
export default function DocumentDetails({ item, data, onClose, onOpenDialog }) {
  return (
    <>
      <h2 id="action-title" className="dialog-title">
        {item.name}
      </h2>
      <p className="dialog-copy">
        {animalName(data.animals, item.animal)} · {item.category}
      </p>
      {item.hasFile ? (
        <>
          {item.type === "application/pdf" ? (
            <iframe
              className="doc-preview pdf-preview"
              title={`Aperçu de ${item.name}`}
              src={`${item.url}?preview=1`}
            />
          ) : (
            <img
              className="doc-preview"
              src={`${item.url}?preview=1`}
              alt={`Aperçu de ${item.name}`}
            />
          )}
          <a
            className="button outline download-link"
            href={item.url}
            download={item.name}
          >
            Télécharger le document
          </a>
        </>
      ) : (
        <div className="empty">
          <p>
            Il s’agit d’un document d’exemple : aucun fichier réel n’est
            associé.
          </p>
          <button
            className="button outline"
            onClick={() => onOpenDialog("edit-document", item)}
          >
            Associer un fichier
          </button>
        </div>
      )}
      <div className="dialog-actions">
        <button
          className="button"
          onClick={() => onOpenDialog("share-document", item)}
        >
          Partager ce document
        </button>
        <button className="button outline" onClick={onClose}>
          Fermer
        </button>
      </div>
    </>
  );
}
