import { animalName, fullDate } from "../../../shared/utils/format.js";
import CloseDialogButton from "../../../shared/ui/CloseDialogButton.jsx";
export default function ReminderDetails({ item, data, onClose }) {
  const animals = data.animals;
  const closeButton = <CloseDialogButton onClose={onClose} />;
  return (
    <>
      <h2 id="action-title" className="dialog-title">
        {item.name}
      </h2>
      <p className="dialog-copy">
        Rappel pour {animalName(animals, item.animal)}
      </p>
      <div className="detail-meta">
        <div>
          <small>Date prévue</small>
          <strong>{fullDate(item.date)}</strong>
        </div>
        <div>
          <small>Statut</small>
          <strong>{item.done ? "Terminé" : "À faire"}</strong>
        </div>
      </div>
      <p className="dialog-copy">
        Aucune notification réelle n’est envoyée pour le moment.
      </p>
      {closeButton}
    </>
  );
}
