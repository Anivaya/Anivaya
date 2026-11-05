import EmptyState from "../../shared/ui/EmptyState.tsx";
import type {
  PageProps,
  Animal,
  Reminder,
  OpenDialog,
} from "../../shared/types.ts";
import { useState } from "react";
import {
  animalName,
  parseDate,
  fullDate,
  shortDate,
  matches,
  reminderState,
  reminderLabels,
  byReminderOrder,
} from "../../shared/utils/format.ts";
import PageHeading from "../../shared/layout/PageHeading.tsx";
import Icon from "../../shared/ui/Icon.tsx";
import CollectionFilters from "../../shared/ui/CollectionFilters.tsx";
import { useMediaQuery } from "../../shared/hooks.ts";

export default function RemindersPage({ data, actions, pending }: PageProps) {
  return (
    <>
      <PageHeading
        title="Mes rappels"
        hasContent={data.reminders.length > 0}
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
            onToggle={actions.toggleReminder}
            pending={pending}
          />
        </div>
      </div>
    </>
  );
}

export function RemindersSection({
  reminders,
  animals,
  overview = false,
  onToggle,
  onAction,
  pending,
  today,
}: {
  reminders: Reminder[];
  animals: Animal[];
  overview?: boolean;
  onToggle: (item: Reminder) => void;
  onAction: OpenDialog;
  pending: string | null;
  today: string;
}) {
  const [search, setSearch] = useState(""),
    [animal, setAnimal] = useState(""),
    [status, setStatus] = useState("");
  const mobile = useMediaQuery("(max-width: 620px)");
  const filtered = reminders
    .filter(
      (r) =>
        (!animal || r.animal === animal) &&
        (!status || reminderState(r, today) === status) &&
        matches(r.name, search),
    )
    .sort(byReminderOrder);
  return (
    <section className="reminders-panel" aria-labelledby="reminders-title">
      <div className="section-head">
        <h2 id="reminders-title">
          {overview ? "Prochains rappels" : "Vos rappels"}
        </h2>
        {overview && reminders.length > 0 && (
          <a className="subtle" href="#rappels">
            Voir tous →
          </a>
        )}
      </div>
      {!overview && reminders.length > 0 && (
        <CollectionFilters
          search={search}
          onSearch={setSearch}
          animal={animal}
          onAnimal={setAnimal}
          animals={animals}
          filter={status}
          onFilter={setStatus}
          label="Filtrer par statut"
          options={[
            ["", "Tous les statuts"],
            ["todo", "À faire"],
            ["late", "En retard"],
            ["done", "Terminés"],
          ]}
        />
      )}
      <div className="reminder-list">
        {filtered.map((r) => {
          const date = parseDate(r.date),
            name = animalName(animals, r.animal);
          return (
            <div
              className={`reminder-row managed-reminder ${r.done ? "is-done" : ""}`}
              key={r.id}
            >
              <input
                className="reminder-check"
                type="checkbox"
                checked={r.done}
                disabled={pending === r.id}
                onChange={() => onToggle(r)}
                aria-label={`Marquer ${r.name} pour ${name} comme ${r.done ? "à faire" : "fait"}`}
              />
              <div className="date-tile">
                <strong>{String(date.getDate()).padStart(2, "0")}</strong>
                <small>
                  {date
                    .toLocaleDateString("fr-FR", { month: "short" })
                    .replace(".", "")
                    .toUpperCase()}
                </small>
              </div>
              <button
                className="reminder-open"
                onClick={() => onAction("reminder", r)}
              >
                <strong>{r.name}</strong>
                <small>{name}</small>
                <small>{reminderLabels[reminderState(r, today)]}</small>
                <small>{mobile ? shortDate(r.date) : fullDate(r.date)}</small>
              </button>
              <div className="row-buttons">
                <button
                  aria-label={`Modifier ${r.name}`}
                  title="Modifier"
                  onClick={() => onAction("edit-reminder", r)}
                >
                  <Icon name="edit" />
                </button>
                <button
                  className="red"
                  aria-label={`Supprimer ${r.name}`}
                  title="Supprimer"
                  onClick={() =>
                    onAction("delete-record-item", { ...r, entity: "reminder" })
                  }
                >
                  <Icon name="trash" />
                </button>
              </div>
            </div>
          );
        })}
        {!filtered.length && (
          <EmptyState
            kind="reminders"
            className="empty"
            compact={overview}
            filtered={reminders.length > 0}
          />
        )}
      </div>
    </section>
  );
}
