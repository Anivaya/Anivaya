export default function CloseDialogButton({ onClose }) {
  return (
    <div className="dialog-actions">
      <button className="button" onClick={onClose}>
        Fermer
      </button>
    </div>
  );
}
