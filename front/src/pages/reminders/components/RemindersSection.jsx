import { animalName, parseDate } from "../../../shared/utils/format.js";
export default function RemindersSection({
  reminders,
  animals,
  onAdd,
  onOpen,
  onToggle,
  pending,
}) {
  return (
    <section className="reminders-panel" aria-labelledby="reminders-title">
      <div className="section-head">
        <h2 id="reminders-title">Prochains rappels</h2>
        <button className="subtle" onClick={onAdd}>
          + Ajouter un rappel
        </button>
      </div>
      <div className="reminder-list">
        {reminders.map((reminder) => {
          const date = parseDate(reminder.date);
          const name = animalName(animals, reminder.animal);
          return (
            <div
              className={`reminder-row ${reminder.done ? "is-done" : ""}`}
              key={reminder.id}
            >
              <button
                className="row-hit"
                onClick={() => onOpen(reminder)}
                aria-label={`Ouvrir le rappel ${reminder.name} pour ${name}`}
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
              <div className="reminder-text">
                <strong>{reminder.name}</strong>
                <small>
                  {name} · {reminder.done ? "Terminé" : date.getFullYear()}
                </small>
              </div>
              <label className="done-label">
                <input
                  type="checkbox"
                  checked={reminder.done}
                  disabled={pending === reminder.id}
                  onChange={() => onToggle(reminder)}
                  aria-label={`Marquer ${reminder.name} pour ${name} comme ${reminder.done ? "à faire" : "fait"}`}
                />
                <span>
                  {pending === reminder.id
                    ? "Enregistrement…"
                    : reminder.done
                      ? "Terminé"
                      : "Marquer comme fait"}
                </span>
              </label>
            </div>
          );
        })}
        {!reminders.length && (
          <p className="empty">
            Aucun rappel. Ajoutez une échéance pour votre animal.
          </p>
        )}
      </div>
    </section>
  );
}
