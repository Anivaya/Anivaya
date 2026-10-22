import PageHeading from "../../shared/layout/PageHeading.jsx";
import RemindersSection from "./components/RemindersSection.jsx";

export default function RemindersPage({ data, actions, pending }) {
  return (
    <>
      <PageHeading
        title="Mes rappels"
        description="Retrouvez les échéances que vous avez choisies."
        actionLabel="Ajouter un rappel"
        onAction={() => actions.add("reminder")}
      />
      <div className="app-grid">
        <div className="app-left">
          <RemindersSection
            today={data.today}
            onAction={actions.openDialog}
            reminders={data.reminders}
            animals={data.animals}
            onAdd={() => actions.add("reminder")}
            onOpen={actions.openReminder}
            onToggle={actions.toggleReminder}
            pending={pending}
          />
        </div>
      </div>
    </>
  );
}
