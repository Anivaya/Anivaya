export default function CloseDialogButton({
  onClose,
}: {
  onClose: () => void;
}) {
  return (
    <div className="dialog-actions">
      <button className="button" onClick={onClose}>
        Fermer
      </button>
    </div>
  );
}
