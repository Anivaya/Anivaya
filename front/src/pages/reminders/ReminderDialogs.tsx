import type { Reminder, DialogProps } from "../../shared/types.ts";
import SubmissionForm, {
  Field,
  AnimalSelectField,
  FormAlert,
} from "../../shared/forms/SubmissionForm.tsx";
import { useDialogAction } from "../../shared/hooks.ts";
import {
  animalName,
  fullDate,
  reminderState,
  reminderLabels,
} from "../../shared/utils/format.ts";
import { api } from "../../shared/services/api.ts";

const choices = {
  repeat: ["Aucune", "Chaque semaine", "Chaque mois", "Chaque année"],
  notice: ["Le jour même", "1 jour avant", "3 jours avant", "7 jours avant"],
};

export function ReminderDetails({
  item,
  data,
  onClose,
  onSaved,
  onOpenDialog,
  busy,
  setBusy,
}: DialogProps<Reminder>) {
  const { error, run } = useDialogAction(setBusy);
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
          ["Statut", reminderLabels[reminderState(item, data.today)]],
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
        Vous serez prévenu par notification et par e-mail, selon le délai
        choisi.
      </p>
      <FormAlert message={error} />
      <div className="dialog-actions">
        <button
          className="button"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await api.setReminder(item.id, !item.done);
              await onSaved(
                item.done ? "Rappel remis à faire." : "Rappel terminé.",
              );
            })
          }
        >
          {busy
            ? "Enregistrement…"
            : item.done
              ? "Remettre à faire"
              : "Marquer comme fait"}
        </button>
        <button
          className="button outline"
          disabled={busy}
          onClick={() => onOpenDialog("edit-reminder", item)}
        >
          Modifier
        </button>
        {/* Marge automatique : les deux actions restent à gauche, Fermer à droite. */}
        <button
          className="button outline close-action push-end"
          disabled={busy}
          onClick={onClose}
        >
          Fermer
        </button>
      </div>
    </>
  );
}

export function ReminderForm({
  data,
  item = {},
  ...props
}: DialogProps<Partial<Reminder>>) {
  return (
    <SubmissionForm
      {...props}
      title={item.id ? "Modifier le rappel" : "Ajouter un rappel"}
      description="Choisissez une date à suivre pour votre animal. Vous serez prévenu par notification et par e-mail."
      submitLabel={item.id ? "Enregistrer" : "Ajouter"}
      successMessage={item.id ? "Rappel modifié." : "Rappel ajouté."}
      disabled={!data.animals.length}
      onSubmit={(values) =>
        item.id ? api.editReminder(item.id, values) : api.addReminder(values)
      }
    >
      {({ error, invalid }) => (
        <>
          <Field name="name" label="Intitulé" error={error}>
            <input
              id="name"
              name="name"
              maxLength={80}
              required
              defaultValue={item.name || ""}
              {...invalid("name")}
            />
          </Field>
          <AnimalSelectField
            animals={data.animals}
            defaultValue={item.animal}
            error={error}
            invalid={invalid}
          />
          <Field name="date" label="Date" error={error}>
            <input
              id="date"
              name="date"
              type="date"
              required
              defaultValue={item.date || ""}
              {...invalid("date")}
            />
          </Field>
          <div className="field-grid">
            {(
              [
                ["repeat", "Répétition"],
                ["notice", "Prévenir"],
              ] as const
            ).map(([name, label]) => (
              <Field key={name} name={name} label={label} error={error}>
                <select
                  id={name}
                  name={name}
                  defaultValue={item[name] || choices[name][0]}
                  {...invalid(name)}
                >
                  {choices[name].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
          <Field name="note" label="Note (facultatif)" error={error}>
            <textarea
              id="note"
              name="note"
              maxLength={1000}
              rows={3}
              defaultValue={item.note || ""}
              {...invalid("note")}
            />
          </Field>
        </>
      )}
    </SubmissionForm>
  );
}
