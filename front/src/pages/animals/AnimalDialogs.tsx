import { useText } from "../../shared/i18n/HomeLocale.tsx";
import type { Animal, DialogItem, DialogProps } from "../../shared/types.ts";
import type { AnimalInput } from "../../../../shared/models.ts";
import SubmissionForm, {
  Field,
  FormAlert,
} from "../../shared/forms/SubmissionForm.tsx";
import { useDialogAction } from "../../shared/hooks.ts";
import { api, fieldError, readFile } from "../../shared/services/api.ts";
import { fullDate, parisToday, svgImage } from "../../shared/utils/format.ts";
import Icon from "../../shared/ui/Icon.tsx";
import Portrait from "./components/AnimalPortrait.tsx";

/** Aperçu rapide ouvert depuis la vue d’ensemble. */
export function AnimalDetails({
  item,
  data,
  onClose,
  onOpenRecord,
}: DialogProps<Animal>) {
  const tr = useText();
  const pet = data.animals.find((a) => a.id === item.id) || item;
  const saved = data.emergencySheets.find((s) => s.animal === pet.id);
  const title = (name: string) => (
    <div className="animal-title-row">
      <h2 className="dialog-title" id="action-title">
        {name}
      </h2>
      <button
        className="close"
        onClick={onClose}
        aria-label={tr("Fermer la fenêtre")}
      >
        <Icon name="close" />
      </button>
    </div>
  );
  return (
    <div className="animal-sheet">
      {saved?.settings.active ? (
        <>
          <div className="sheet-heading">
            {saved.settings.photo && <Portrait pet={pet} />}
            <div>
              {title(saved.snapshot.name)}
              <p className="dialog-copy">
                {saved.snapshot.details || tr(pet.species)}
              </p>
              <p className="dialog-copy sheet-identifier">
                {tr("Identifiant : ")}
                {pet.identifier || tr("Non renseigné")}
              </p>
            </div>
          </div>
          {saved.snapshot.notes && (
            <>
              <h3>{tr("Consignes")}</h3>
              <p className="dialog-copy emergency-notes">
                {saved.snapshot.notes}
              </p>
            </>
          )}
          {(saved.snapshot.contact || saved.snapshot.vet) && (
            <h3>{tr("Contacts")}</h3>
          )}
          <p className="dialog-copy">{saved.snapshot.contact}</p>
          <p className="dialog-copy">{saved.snapshot.vet}</p>
          {saved.snapshot.qrSvg && (
            <div className="sheet-qr">
              <img
                className="saved-qr"
                src={svgImage(saved.snapshot.qrSvg)}
                alt={tr("QR sauvegardé de {0}", [pet.name])}
              />
              <p className="dialog-copy">
                {tr("QR sauvegardé · Fiche publique")}
              </p>
              {saved.snapshot.payload?.startsWith("http") && (
                <a
                  className="text-button"
                  href={saved.snapshot.payload}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {tr("Voir la fiche publique")}
                </a>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          {title(pet.name)}
          {/* Un seul bloc : l’identifiant en haut, la race en dessous. */}
          <div className="detail-meta single">
            <div>
              <small>{tr("Identifiant")}</small>
              <strong>{pet.identifier || tr("Non renseigné")}</strong>
              <small>{tr("Race")}</small>
              <strong>{pet.breed || pet.description}</strong>
            </div>
          </div>
        </>
      )}
      <div className="dialog-actions sheet-footer">
        <button className="button outline" onClick={() => onOpenRecord(pet)}>
          {tr("Carnet complet")}
        </button>
        <button className="button outline close-action" onClick={onClose}>
          {tr("Fermer")}
        </button>
      </div>
    </div>
  );
}

const profileFields: Record<string, [string, string | string[]]> = {
  name: ["Nom de l’animal", "text"],
  species: ["Espèce", ["Chien", "Chat"]],
  breed: ["Race", "text"],
  dob: ["Date de naissance", "date"],
  weight: ["Poids déclaré (kg)", "number"],
  coat: ["Robe", "text"],
  identifier: ["Identifiant", "text"],
  sex: ["Sexe", ["Non renseigné", "Femelle", "Mâle"]],
  neutered: ["Stérilisation", ["Non renseignée", "Oui", "Non"]],
};
const editOrder = [
  "name",
  "species",
  "breed",
  "sex",
  "dob",
  "weight",
  "coat",
  "neutered",
  "identifier",
];

export function AnimalForm({ item, ...props }: DialogProps<Partial<Animal>>) {
  const tr = useText();
  const editing = Boolean(item?.id);
  const today = parisToday();
  return (
    <SubmissionForm
      {...props}
      title={editing ? tr("Modifier le profil") : tr("Ajouter un animal")}
      description={
        editing
          ? tr("Modifiez les informations de son profil.")
          : tr(
              "Créez le profil de votre animal. Vous pourrez le compléter à tout moment.",
            )
      }
      successMessage={
        editing ? tr("Profil modifié.") : tr("Animal ajouté au foyer.")
      }
      submitLabel={editing ? tr("Enregistrer") : tr("Ajouter")}
      onSubmit={async (values, form) => {
        if (!values.name?.trim())
          throw fieldError("name", "Renseignez le nom de votre animal.");
        const file = form.get("photo");
        const body: AnimalInput = { ...values };
        if (file instanceof File && file.size) {
          if (
            !["image/jpeg", "image/png"].includes(file.type) ||
            file.size > 2 * 1024 * 1024
          )
            throw fieldError(
              "photo",
              "Choisissez un JPEG ou PNG de moins de 2 Mo.",
            );
          body.photo = { type: file.type, content: await readFile(file) };
        }
        if (editing) await api.editAnimal(item.id!, body);
        else await api.addAnimal(body);
      }}
    >
      {({ error, invalid }) => (
        <div className={editing ? "record-form-grid" : "animal-add-fields"}>
          {(editing ? editOrder : Object.keys(profileFields)).map((name) => {
            const [label, kind] = profileFields[name];
            const options = typeof kind === "string" ? null : kind;
            const type = typeof kind === "string" ? kind : undefined;
            const caption =
              editing || options
                ? tr(label)
                : name === "name"
                  ? `${tr(label)} *`
                  : tr("{0} (facultatif)", [tr(label)]);
            const value = item?.[name as keyof Animal];
            return (
              <Field key={name} name={name} label={caption} error={error}>
                {options ? (
                  <select
                    id={name}
                    name={name}
                    defaultValue={value || options[0]}
                    {...invalid(name)}
                  >
                    {options.map((option) => (
                      <option key={option} value={option}>
                        {tr(option)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={name}
                    name={name}
                    type={type}
                    defaultValue={value || ""}
                    required={name === "name"}
                    maxLength={name === "name" ? 40 : 100}
                    min={type === "number" ? "0.1" : undefined}
                    max={
                      type === "number"
                        ? "200"
                        : type === "date"
                          ? today
                          : undefined
                    }
                    step={type === "number" ? "0.1" : undefined}
                    {...invalid(name)}
                  />
                )}
              </Field>
            );
          })}
          <Field
            name="photo"
            label={
              editing
                ? tr("Remplacer la photo (facultatif)")
                : tr("Photo (facultatif)")
            }
            error={error}
          >
            <input
              id="photo"
              name="photo"
              type="file"
              accept="image/jpeg,image/png"
              {...invalid("photo")}
            />
            <p className="field-help">
              {tr("JPEG ou PNG · 2 Mo maximum. Seul le nom est obligatoire.")}
            </p>
          </Field>
        </div>
      )}
    </SubmissionForm>
  );
}

const deleters = {
  animal: api.deleteAnimal,
  event: api.deleteEvent,
  reminder: api.deleteReminder,
  emergency: api.deleteEmergency,
};
const eventTypes = ["Consultation", "Pesée", "Vaccination déclarée", "Autre"];
const habitFields: [keyof DialogItem, string][] = [
  ["food", "Alimentation"],
  ["routine", "Rythme et sorties"],
  ["behavior", "Comportement et approche"],
  ["medical", "Consignes essentielles déclarées"],
  ["contact", "Contact principal"],
  ["vet", "Vétérinaire habituel"],
];

/** Fenêtres du carnet : événements, habitudes et suppressions. */
export function RecordAction({ kind, item, ...props }: DialogProps) {
  const tr = useText();
  const { onClose, onSaved, busy, setBusy } = props;
  const { error, run } = useDialogAction(setBusy);
  if (kind === "view-event")
    return (
      <>
        <h2 id="action-title">{tr(item.type)}</h2>
        <p>{fullDate(item.date!)}</p>
        <p>{item.note || tr("Aucune précision.")}</p>
        <button className="button outline close-action" onClick={onClose}>
          {tr("Fermer")}
        </button>
      </>
    );
  if (kind === "delete-record-item") {
    const entity = item.entity as keyof typeof deleters;
    return (
      <>
        <h2 id="action-title">
          {tr("Supprimer ")}
          {item.name || item.type} ?
        </h2>
        <p className="dialog-copy">
          {entity === "animal"
            ? tr(
                "Son carnet, ses rappels, ses documents et sa fiche d’urgence seront retirés de votre espace.",
              )
            : tr("Cet élément sera retiré du carnet.")}{" "}
          {tr("Les fichiers sur votre ordinateur sont conservés.")}
        </p>
        <FormAlert message={error} />
        <div className="dialog-actions">
          <button
            className="button outline cancel"
            disabled={busy}
            onClick={onClose}
          >
            {tr("Annuler")}
          </button>
          <button
            className="button danger"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await deleters[entity](item.id!);
                await onSaved("Élément supprimé.");
                if (entity === "animal") window.location.hash = "animaux";
              })
            }
          >
            {busy ? tr("Suppression…") : tr("Confirmer la suppression")}
          </button>
        </div>
      </>
    );
  }
  const habits = kind === "habits";
  const textFields: [keyof DialogItem, string][] = habits
    ? habitFields
    : [["note", "Informations déclarées"]];
  return (
    <SubmissionForm
      {...props}
      title={
        habits
          ? tr("Modifier les habitudes")
          : tr("{0} un événement", [tr(item.id ? "Modifier" : "Ajouter")])
      }
      description={tr(
        "Informations déclaratives conservées dans votre carnet.",
      )}
      successMessage={tr("Modifications enregistrées.")}
      submitLabel={tr("Enregistrer")}
      onSubmit={async (values) => {
        if (habits) await api.editAnimal(item.id!, values);
        else await api.saveEvent(item.id, { ...values, animal: item.animal });
      }}
    >
      {({ error, invalid }) => (
        <>
          {!habits && (
            <>
              <Field name="type" label={tr("Type")} error={error}>
                <select
                  id="type"
                  name="type"
                  defaultValue={item.type || "Consultation"}
                  {...invalid("type")}
                >
                  {eventTypes.map((type) => (
                    <option key={type} value={type}>
                      {tr(type)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field name="date" label={tr("Date")} error={error}>
                <input
                  id="date"
                  name="date"
                  type="date"
                  defaultValue={item.date || ""}
                  required
                  {...invalid("date")}
                />
              </Field>
            </>
          )}
          {textFields.map(([name, label]) => (
            <Field key={name} name={name} label={tr(label)} error={error}>
              <textarea
                data-resize-none
                id={name}
                name={name}
                maxLength={["contact", "vet"].includes(name) ? 120 : 500}
                defaultValue={String(item[name] || "")}
                {...invalid(name)}
              />
            </Field>
          ))}
        </>
      )}
    </SubmissionForm>
  );
}
