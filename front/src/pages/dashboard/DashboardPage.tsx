import type { PageProps } from "../../shared/types.ts";
import PageHeading from "../../shared/layout/PageHeading.tsx";
import { AnimalsSection } from "../animals/AnimalsPage.tsx";
import { RemindersSection } from "../reminders/RemindersPage.tsx";
import { DocumentsSection } from "../documents/DocumentsPage.tsx";
import Icon from "../../shared/ui/Icon.tsx";

export default function DashboardPage({ data, actions, pending }: PageProps) {
  return (
    <>
      <PageHeading
        title={`Bonjour ${data.household.firstName},`}
        hasContent={data.animals.length > 0}
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
            today={data.today}
            onAction={actions.openDialog}
            overview
            reminders={data.reminders}
            animals={data.animals}
            onToggle={actions.toggleReminder}
            pending={pending}
          />
        </div>
        <div className="app-right">
          <DocumentsSection
            shares={data.shares}
            documents={data.documents}
            animals={data.animals}
            overview
            onAdd={() => actions.add("document")}
            onAction={actions.openDialog}
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
        Vos documents sont privés. Vous choisissez les documents à partager, les
        personnes concernées et la date de fin de l’accès.
      </p>
    </aside>
  );
}
