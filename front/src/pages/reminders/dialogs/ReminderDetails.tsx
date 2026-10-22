import { errorMessage } from "../../../shared/types.ts";
import type { Reminder, DialogProps } from "../../../shared/types.ts";
import { useState } from "react";
import { animalName, fullDate } from "../../../shared/utils/format.ts";
import { api } from "../../../shared/services/api.ts";
export default function ReminderDetails({
  item,
  data,
  onClose,
  onSaved,
  onOpenDialog,
  busy,
  setBusy,
}: DialogProps<Reminder>) {
  const [error, setError] = useState("");
  return (
    <>
      <h2 id="action-title" className="dialog-title">
        {item.name}
      </h2>
      <p className="dialog-copy">
        Rappel pour {animalName(data.animals, item.animal)}
      </p>
      <div className="detail-meta">
        {[
          ["Date prévue", fullDate(item.date)],
          [
            "Statut",
            item.done
              ? "Terminé"
              : item.date < data.today
                ? "En retard"
                : "À faire",
          ],
          ["Répétition", item.repeat],
          ["Prévenir", item.notice],
        ].map(([label, value]) => (
          <div key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      {item.note && <p className="dialog-copy preserve-lines">{item.note}</p>}
      <p className="dialog-copy">
        Aucune notification réelle n’est envoyée pour le moment.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <button
          className="button outline"
          disabled={busy}
          onClick={() => onOpenDialog("edit-reminder", item)}
        >
          Modifier
        </button>
        <button
          className="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api.setReminder(item.id, !item.done);
              await onSaved(
                item.done ? "Rappel remis à faire." : "Rappel terminé.",
              );
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy
            ? "Enregistrement…"
            : item.done
              ? "Remettre à faire"
              : "Marquer comme fait"}
        </button>
        <button className="button outline" disabled={busy} onClick={onClose}>
          Fermer
        </button>
      </div>
    </>
  );
}
