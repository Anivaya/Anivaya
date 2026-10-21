import Icon from "../../../shared/ui/Icon.jsx";
export default function PrivacyNote() {
  return (
    <aside className="privacy-note">
      <div className="lock">
        <Icon name="lock" />
      </div>
      <h2>Un dossier, vos choix.</h2>
      <p>
        Vos documents sont conservés dans votre espace local. Aucun partage
        n’est activé. Vous choisissez les documents que vous ajoutez à votre
        carnet.
      </p>
    </aside>
  );
}
