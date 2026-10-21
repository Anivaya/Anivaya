import { useState } from "react";
import SubmissionForm from "../../../shared/forms/SubmissionForm.jsx";
import Field from "../../../shared/ui/Field.jsx";
import { api } from "../../../shared/services/api.js";
import { fullDate } from "../../../shared/utils/format.js";

export default function RecordAction({ kind, item, ...props }) {
  const [error, setError] = useState("");
  const { onClose, onSaved, busy, setBusy } = props;
  const entity = item.entity;
  if (kind === "view-event")
    return (
      <>
        <h2 id="action-title">{item.type}</h2>
        <p>{fullDate(item.date)}</p>
        <p>{item.note || "Aucune précision."}</p>
        <button className="button" onClick={onClose}>
          Fermer
        </button>
      </>
    );
  if (kind === "delete-record-item")
    return (
      <>
        <h2 id="action-title">Supprimer {item.name || item.type} ?</h2>
        <p className="dialog-copy">
          {entity === "animal"
            ? "Son carnet, ses rappels, ses documents et sa fiche d’urgence seront retirés de votre espace."
            : "Cet élément sera retiré du carnet."}{" "}
          Les fichiers sur votre ordinateur sont conservés.
        </p>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button className="button outline" disabled={busy} onClick={onClose}>
            Annuler
          </button>
          <button
            className="button danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await {
                  animal: api.deleteAnimal,
                  event: api.deleteEvent,
                  reminder: api.deleteReminder,
                  emergency: api.deleteEmergency,
                }[entity](item.id);
                await onSaved("Élément supprimé.");
                if (entity === "animal") window.location.hash = "animaux";
              } catch (e) {
                setError(e.message);
                setBusy(false);
              }
            }}
          >
            {busy ? "Suppression…" : "Confirmer la suppression"}
          </button>
        </div>
      </>
    );
  const habits = kind === "habits",
    event = kind.includes("event");
  const editing = Boolean(item.id);
  const textFields = habits
    ? [
        ["food", "Alimentation"],
        ["routine", "Rythme et sorties"],
        ["behavior", "Comportement et approche"],
        ["medical", "Consignes essentielles déclarées"],
        ["contact", "Contact principal fictif"],
        ["vet", "Vétérinaire habituel fictif"],
      ]
    : event
      ? [["note", "Informations déclarées"]]
      : [];
  return (
    <SubmissionForm
      {...props}
      title={
        habits
          ? "Modifier les habitudes"
          : `${editing ? "Modifier" : "Ajouter"} ${event ? "un événement" : "un rappel"}`
      }
      description="Informations déclaratives conservées dans votre carnet local."
      successMessage="Modifications enregistrées."
      submitLabel="Enregistrer"
      onSubmit={async (values) => {
        if (habits) await api.editAnimal(item.id, values);
        else if (event)
          await api.saveEvent(item.id, { ...values, animal: item.animal });
        else if (editing) await api.editReminder(item.id, values);
        else await api.addReminder({ ...values, animal: item.animal });
      }}
    >
      {({ error, invalid }) => (
        <>
          {!habits && (
            <>
              {event ? (
                <Field name="type" label="Type" error={error}>
                  <select
                    id="type"
                    name="type"
                    defaultValue={item.type || "Consultation"}
                    {...invalid("type")}
                  >
                    {[
                      "Consultation",
                      "Pesée",
                      "Vaccination déclarée",
                      "Autre",
                    ].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </Field>
              ) : (
                <Field name="name" label="Intitulé" error={error}>
                  <input
                    id="name"
                    name="name"
                    defaultValue={item.name || ""}
                    maxLength={80}
                    required
                    {...invalid("name")}
                  />
                </Field>
              )}
              <Field name="date" label="Date" error={error}>
                <input
                  id="date"
                  name="date"
                  type="date"
                  defaultValue={item.date || ""}
                  required
                  {...invalid("date")}
                />
              </Field>
              {!event && (
                <Field name="repeat" label="Répétition">
                  <select
                    id="repeat"
                    name="repeat"
                    defaultValue={item.repeat || "Aucune"}
                  >
                    {[
                      "Aucune",
                      "Chaque semaine",
                      "Chaque mois",
                      "Chaque année",
                    ].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                  <p className="field-help">
                    Le choix est enregistré ; aucun envoi automatique n’est
                    programmé.
                  </p>
                </Field>
              )}
            </>
          )}
          {textFields.map(([name, label]) => (
            <Field key={name} name={name} label={label} error={error}>
              <textarea
                id={name}
                name={name}
                maxLength={["contact", "vet"].includes(name) ? 120 : 500}
                defaultValue={item[name] || ""}
                {...invalid(name)}
              />
            </Field>
          ))}
        </>
      )}
    </SubmissionForm>
  );
}
