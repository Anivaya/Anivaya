import { svgImage } from "../../../shared/utils/format.js";
import Portrait from "../components/AnimalPortrait.jsx";
import Icon from "../../../shared/ui/Icon.jsx";
export default function AnimalDetails({ item, data, onClose, onOpenRecord }) {
  const pet = data.animals.find((a) => a.id === item.id) || item;
  const saved = data.emergencySheets?.find((s) => s.animal === pet.id);
  const title = (name) => (
    <div className="animal-title-row">
      <h2 className="dialog-title" id="action-title">
        {name}
      </h2>
      <button
        className="close"
        onClick={onClose}
        aria-label="Fermer la fenêtre"
      >
        <Icon name="close" />
      </button>
    </div>
  );
  return (
    <div className="animal-sheet">
      {saved?.settings.active ? (
        <>
          <div className="sheet-heading">
            {saved.settings.photo && <Portrait pet={pet} />}
            <div>
              {title(saved.snapshot.name)}
              <p className="dialog-copy">
                {saved.snapshot.details || pet.species}
              </p>
              <p className="dialog-copy sheet-identifier">
                Identifiant : {pet.identifier || "Non renseigné"}
              </p>
            </div>
          </div>
          {saved.snapshot.notes && (
            <>
              <h3>Consignes</h3>
              <p className="dialog-copy emergency-notes">
                {saved.snapshot.notes}
              </p>
            </>
          )}
          {(saved.snapshot.contact || saved.snapshot.vet) && <h3>Contacts</h3>}
          <p className="dialog-copy">{saved.snapshot.contact}</p>
          <p className="dialog-copy">{saved.snapshot.vet}</p>
          {saved.snapshot.qrSvg && (
            <div className="sheet-qr">
              <img
                className="saved-qr"
                src={svgImage(saved.snapshot.qrSvg)}
                alt={`QR sauvegardé de ${pet.name}`}
              />
              <p className="dialog-copy">
                QR sauvegardé · Démonstration hors ligne
              </p>
            </div>
          )}
        </>
      ) : (
        <>
          {title(pet.name)}
          <div className="detail-meta">
            <div>
              <small>Race</small>
              <strong>{pet.breed || pet.description}</strong>
            </div>
            <div>
              <small>Identifiant fictif</small>
              <strong>{pet.identifier || "Non renseigné"}</strong>
            </div>
          </div>
        </>
      )}
      <div className="dialog-actions sheet-footer">
        <button className="button outline" onClick={() => onOpenRecord(pet)}>
          Carnet complet
        </button>
        <button
          className={`button ${saved?.settings.active ? "" : "outline"}`}
          onClick={onClose}
        >
          Fermer
        </button>
      </div>
    </div>
  );
}
