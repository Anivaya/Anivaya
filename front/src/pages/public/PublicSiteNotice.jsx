import CloseDialogButton from "../../shared/ui/CloseDialogButton.jsx";

export default function PublicSiteNotice({ onClose }) {
  return (
    <>
      <h2 id="action-title" className="dialog-title">
        Le site public
      </h2>
      <p className="dialog-copy">
        La page publique n’est pas encore intégrée en React. Votre espace reste
        disponible ici.
      </p>
      <CloseDialogButton onClose={onClose} />
    </>
  );
}
