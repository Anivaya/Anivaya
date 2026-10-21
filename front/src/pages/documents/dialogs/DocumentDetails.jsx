import { animalName } from "../../../shared/utils/format.js";
import CloseDialogButton from "../../../shared/ui/CloseDialogButton.jsx";
export default function DocumentDetails({ item, data, onClose }) {
  const animals = data.animals;
  const closeButton = <CloseDialogButton onClose={onClose} />;
  return (
    <>
      <h2 id="action-title" className="dialog-title">
        {item.name}
      </h2>
      <p className="dialog-copy">
        Carnet de {animalName(animals, item.animal)}
      </p>
      {item.example ? (
        <p className="empty">
          Il s’agit d’un document d’exemple : aucun fichier réel n’est associé.
        </p>
      ) : (
        <>
          <p className="dialog-copy">
            Ce fichier est enregistré dans votre base locale.
          </p>
          <a className="button outline" href={item.url} download={item.name}>
            Télécharger le document
          </a>
        </>
      )}
      {closeButton}
    </>
  );
}
