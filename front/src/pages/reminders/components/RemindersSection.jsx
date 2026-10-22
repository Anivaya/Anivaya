import { useState } from "react";
import {
  animalName,
  parseDate,
  fullDate,
} from "../../../shared/utils/format.js";
import Icon from "../../../shared/ui/Icon.jsx";
import CollectionFilters from "../../../shared/ui/CollectionFilters.jsx";
export default function RemindersSection({
  reminders,
  animals,
  overview = false,
  onOpen,
  onToggle,
  onAction,
  pending,
  today,
}) {
  const [search, setSearch] = useState(""),
    [animal, setAnimal] = useState(""),
    [status, setStatus] = useState("");
  const state = (r) => (r.done ? "done" : r.date < today ? "late" : "todo");
  const filtered = reminders
    .filter(
      (r) =>
        (!animal || r.animal === animal) &&
        (!status || state(r) === status) &&
        r.name
          .toLocaleLowerCase("fr")
          .includes(search.trim().toLocaleLowerCase("fr")),
    )
    .sort(
      (a, b) => Number(a.done) - Number(b.done) || a.date.localeCompare(b.date),
    );
  return (
    <section className="reminders-panel" aria-labelledby="reminders-title">
      <div className="section-head">
        <h2 id="reminders-title">
          {overview ? "Prochains rappels" : "Vos rappels"}
        </h2>
        {overview && (
          <a className="subtle" href="#rappels">
            Voir tous →
          </a>
        )}
      </div>
      {!overview && (
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
              <button className="reminder-open" onClick={() => onOpen(r)}>
                <strong>{r.name}</strong>
                <small>
                  {name} · {fullDate(r.date)} ·{" "}
                  {r.done
                    ? "Terminé"
                    : state(r) === "late"
                      ? "En retard"
                      : "À faire"}
                </small>
                <small>
                  {r.repeat} · {r.notice}
                </small>
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
          <p className="empty">
            {reminders.length
              ? "Aucun rappel pour ces filtres."
              : "Aucun rappel. Ajoutez une échéance pour votre animal."}
          </p>
        )}
      </div>
    </section>
  );
}
