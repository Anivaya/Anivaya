import PageHeading from "../../shared/layout/PageHeading.jsx";
import AnimalsSection from "../animals/components/AnimalsSection.jsx";
import RemindersSection from "../reminders/components/RemindersSection.jsx";
import DocumentsSection from "../documents/components/DocumentsSection.jsx";
import Icon from "../../shared/ui/Icon.jsx";

export default function DashboardPage({ data, actions, pending }) {
  return (
    <>
      <PageHeading
        title={`Bonjour ${data.household.firstName},`}
        description="Tout pour prendre soin de vos compagnons."
        actionLabel="Ajouter un animal"
        onAction={() => actions.add("animal")}
      />
      <div className="app-grid">
        <div className="app-left">
          <AnimalsSection
            animals={data.animals}
            overview
            onOpen={actions.openAnimal}
            onAdd={() => actions.add("animal")}
          />
          <RemindersSection
            reminders={data.reminders}
            animals={data.animals}
            onAdd={() => actions.add("reminder")}
            onOpen={actions.openReminder}
            onToggle={actions.toggleReminder}
            pending={pending}
          />
        </div>
        <div className="app-right">
          <DocumentsSection
            documents={data.documents}
            animals={data.animals}
            overview
            onAdd={() => actions.add("document")}
            onAction={actions.openDocument}
          />
          <PrivacyNote />
        </div>
      </div>
    </>
  );
}

function PrivacyNote() {
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
