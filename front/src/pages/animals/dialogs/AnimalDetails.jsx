import Icon from "../../../shared/ui/Icon.jsx";
import CloseDialogButton from "../../../shared/ui/CloseDialogButton.jsx";
export default function AnimalDetails({ item, data, onClose }) {
  const closeButton = <CloseDialogButton onClose={onClose} />;
  return (
    <>
      <h2 id="action-title" className="dialog-title">
        Le carnet de {item.name}
      </h2>
      <p className="dialog-copy">
        Profil de démonstration · Informations déclaratives
      </p>
      <div className="detail-meta">
        <div>
          <small>Espèce</small>
          <strong>{item.species}</strong>
        </div>
        <div>
          <small>Informations</small>
          <strong>{item.description}</strong>
        </div>
      </div>
      <div className="demo-row">
        <Icon name="calendar" />
        <div>
          <small>Rappels à suivre</small>
          <strong>
            {
              data.reminders.filter(
                (reminder) => reminder.animal === item.id && !reminder.done,
              ).length
            }{" "}
            échéance(s)
          </strong>
        </div>
      </div>
      <div className="demo-row">
        <Icon name="file" />
        <div>
          <small>Documents du carnet</small>
          <strong>
            {
              data.documents.filter((document) => document.animal === item.id)
                .length
            }{" "}
            document(s)
          </strong>
        </div>
      </div>
      {closeButton}
    </>
  );
}
