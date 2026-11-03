import type { ValidationState, DialogProps } from "../../shared/types.ts";
import { useEffect, useRef, useState } from "react";
import SubmissionForm, { Field } from "../../shared/forms/SubmissionForm.tsx";
import { CloseDialogButton } from "../../shared/ui/Modal.tsx";
import { api } from "../../shared/services/api.ts";
import {
  addDays,
  animalName,
  fullDate,
  shareLabels,
} from "../../shared/utils/format.ts";

export default function SharingDialog({
  kind,
  item = {},
  data,
  onOpenDialog,
  ...props
}: DialogProps) {
  const [animals, setAnimals] = useState(
    item.animals || (item.animal ? [item.animal] : []),
  );
  const [people, setPeople] = useState(item.person ? [item.person] : []);
  const [documents, setDocuments] = useState(
    kind === "share-document"
      ? [item.id!]
      : item.documents
        ? item.documents
        : data.documents
            .filter((d) => item.animal && d.animal === item.animal)
            .map((d) => d.id),
  );
  const [recipient, setRecipient] = useState("");
  const [until] = useState(() => addDays(data.today, 7));
  const input =
    (
      name: "name" | "email" | "phone",
      label: string,
      type = "text",
      max = 120,
      required = false,
    ) =>
    ({ error, invalid }: ValidationState) => (
      <Field name={name} label={label} error={error}>
        <input
          id={name}
          name={name}
          type={type}
          maxLength={max}
          required={required}
          defaultValue={item[name] || ""}
          {...invalid(name)}
        />
      </Field>
    );
  if (kind === "add-person" || kind === "edit-person")
    return (
      <SubmissionForm
        {...props}
        title={item.id ? "Modifier la personne" : "Ajouter une personne"}
        description="Renseignez au moins un e-mail ou un téléphone. Un e-mail est nécessaire pour lui partager des documents."
        submitLabel="Enregistrer"
        successMessage="Personne de confiance enregistrée."
        onSubmit={(values) => api.savePerson(item.id, { ...values, animals })}
      >
        {(validation) => (
          <>
            <div className="field-grid">
              {input("name", "Nom", "text", 120, true)(validation)}
              <Field
                name="role"
                label="Lien avec les animaux"
                error={validation.error}
              >
                <select
                  id="role"
                  name="role"
                  defaultValue={item.role || "Proche"}
                >
                  {["Proche", "Famille", "Garde", "Professionnel", "Autre"].map(
                    (r) => (
                      <option key={r}>{r}</option>
                    ),
                  )}
                </select>
              </Field>
              {input("email", "E-mail", "email")(validation)}
              {input("phone", "Téléphone", "tel", 25)(validation)}
            </div>
            <Field
              name="note"
              label="Note (facultatif)"
              error={validation.error}
            >
              <textarea
                id="note"
                name="note"
                maxLength={500}
                defaultValue={item.note || ""}
              />
            </Field>
            <SelectionGroup
              name="animals"
              title="Animaux associés (facultatif)"
              items={data.animals}
              selected={animals}
              onChange={setAnimals}
              help="L’association ajoute la personne aux contacts du carnet, sans lui donner accès aux documents."
            />
          </>
        )}
      </SubmissionForm>
    );
  if (
    kind === "delete-person" ||
    kind === "remove-person" ||
    kind === "revoke-share"
  ) {
    const remove = kind === "remove-person",
      revoke = kind === "revoke-share";
    return (
      <SubmissionForm
        {...props}
        danger
        title={
          revoke
            ? "Révoquer ce partage ?"
            : remove
              ? "Retirer cette personne du carnet ?"
              : "Supprimer cette personne ?"
        }
        description={
          revoke
            ? `L’accès de ${item.recipient} à ce document sera désactivé immédiatement. Ses autres partages sont conservés.`
            : remove
              ? `${item.name} sera retirée des contacts de cet animal. Ses partages de documents restent inchangés.`
              : `${item.name} sera retirée de la liste et des carnets associés. Ses partages seront révoqués.`
        }
        submitLabel={
          revoke
            ? "Révoquer le partage"
            : remove
              ? "Retirer du carnet"
              : "Supprimer la personne"
        }
        successMessage={
          revoke
            ? "Partage révoqué."
            : remove
              ? "Personne retirée du carnet."
              : "Personne supprimée et partages révoqués."
        }
        onSubmit={() =>
          revoke
            ? api.revoke(item.id!)
            : remove
              ? api.associate({
                  people: [item.id!],
                  animals: [item.animal!],
                  mode: "remove",
                })
              : api.deletePerson(item.id!)
        }
      >
        {() => null}
      </SubmissionForm>
    );
  }
  if (kind === "share-details") {
    const doc = data.documents.find((d) => d.id === item.doc);
    return (
      <>
        <h2 id="action-title" className="dialog-title">
          Détail du partage
        </h2>
        <p className="dialog-copy">
          <strong>{doc?.name}</strong> · {animalName(data.animals, doc?.animal)}
        </p>
        <p className="dialog-copy">
          Destinataire : {item.recipient}
          <br />
          {item.email}
          <br />
          Fin : {fullDate(item.until!)}
          <br />
          Accès : lecture seule ·{" "}
          {item.status && shareLabels[item.status].toLocaleLowerCase("fr")}
        </p>
        <p className="share-note">
          Ce partage concerne uniquement ce document. Aucun accès réel n’a été
          créé.
        </p>
        <div className="dialog-actions">
          {item.status === "active" && (
            <button
              className="button danger"
              onClick={() => onOpenDialog("revoke-share", item)}
            >
              Révoquer
            </button>
          )}
          <button
            className="button outline close-action"
            onClick={props.onClose}
          >
            Fermer
          </button>
        </div>
      </>
    );
  }
  if (
    kind === "associate-people" &&
    (!data.animals.length || !data.people.length)
  )
    return (
      <>
        <h2 className="dialog-title" id="action-title">
          {!data.people.length
            ? "Ajoutez une personne de confiance"
            : "Ajoutez d’abord un animal"}
        </h2>
        <p className="dialog-copy">
          Une personne et un animal sont nécessaires pour créer une association.
        </p>
        {!data.people.length ? (
          <button
            className="button"
            onClick={() => onOpenDialog("add-person", item)}
          >
            Ajouter une personne
          </button>
        ) : (
          <a className="button" href="#animaux" onClick={props.onClose}>
            Mes animaux
          </a>
        )}
        <CloseDialogButton onClose={props.onClose} />
      </>
    );
  if (kind === "associate-people")
    return (
      <SubmissionForm
        {...props}
        title="Associer des personnes de confiance"
        description="Sélectionnez les personnes et les animaux concernés."
        submitLabel="Confirmer les associations"
        successMessage="Associations mises à jour dans les carnets."
        onSubmit={(values) =>
          api.associate({ mode: values.mode, animals, people })
        }
      >
        {({ error }) => (
          <>
            <SelectionGroup
              name="people"
              title="Personnes de confiance"
              items={data.people.map((p) => ({
                ...p,
                help: p.email || p.phone,
              }))}
              selected={people}
              onChange={setPeople}
            />
            <SelectionGroup
              name="animals"
              title="Animaux"
              items={data.animals}
              selected={animals}
              onChange={setAnimals}
            />
            <Field name="mode" label="Action" error={error}>
              <select id="mode" name="mode">
                <option value="add">
                  Ajouter aux contacts des animaux sélectionnés
                </option>
                <option value="remove">
                  Retirer des contacts des animaux sélectionnés
                </option>
              </select>
            </Field>
            <p className="share-note">
              Ces associations concernent les contacts des carnets. Les accès
              aux documents se gèrent dans « Documents partagés ».
            </p>
          </>
        )}
      </SubmissionForm>
    );
  if (
    !data.documents.length ||
    (kind === "share-documents" && !data.people.length)
  )
    return (
      <>
        <h2 className="dialog-title" id="action-title">
          {!data.documents.length
            ? "Ajoutez d’abord un document"
            : "Choisissez vos destinataires"}
        </h2>
        <p className="dialog-copy">
          {!data.documents.length
            ? "Ajoutez un document au carnet pour préparer un partage."
            : "Ajoutez un destinataire avec un e-mail avant de préparer un partage."}
        </p>
        {!data.documents.length ? (
          <a className="button" href="#documents" onClick={props.onClose}>
            Mes documents
          </a>
        ) : (
          <button
            className="button"
            onClick={() => onOpenDialog("add-person", item)}
          >
            Ajouter une personne
          </button>
        )}
        <CloseDialogButton onClose={props.onClose} />
      </>
    );
  const single = kind === "share-document";
  const eligible = data.people.filter(
    (p) => p.email && (!single || p.animals.includes(item.animal!)),
  );
  return (
    <>
      <SubmissionForm
        {...props}
        title={single ? `Partager : ${item.name}` : "Partager des documents"}
        description="Chaque destinataire reçoit une invitation par e-mail et retrouve les documents dans « Partage avec moi », en lecture seule, jusqu’à la date choisie."
        submitLabel="Confirmer le partage"
        onSubmit={async (values) => {
          const result = await api.share({
            ...values,
            documents,
            until: values.until,
            ...(single
              ? recipient
                ? { people: [recipient] }
                : {}
              : { people }),
          });
          return `${result.created} partage(s) enregistré(s).${result.skipped ? ` ${result.skipped} accès existant(s) conservé(s).` : ""}`;
        }}
      >
        {({ error, invalid }) => (
          <>
            {!single && (
              <>
                <SelectionGroup
                  name="documents"
                  title="Documents à partager"
                  items={data.documents.map((d) => ({
                    ...d,
                    help: `${animalName(data.animals, d.animal)}${d.example ? " · Sans fichier" : ""}`,
                  }))}
                  selected={documents}
                  onChange={setDocuments}
                />
                <SelectionGroup
                  name="people"
                  title="Destinataires"
                  items={data.people.map((p) => ({
                    ...p,
                    help:
                      p.email || "Ajoutez un e-mail pour partager un document",
                    disabled: !p.email,
                  }))}
                  selected={people}
                  onChange={setPeople}
                />
              </>
            )}
            {single && (
              <>
                {eligible.length > 0 && (
                  <Field name="person" label="Personne de confiance">
                    <select
                      id="person"
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                    >
                      <option value="">Saisir un destinataire</option>
                      {eligible.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {p.email}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                {!recipient && (
                  <div className="field-grid">
                    <Field
                      name="recipient"
                      label="Nom du destinataire"
                      error={error}
                    >
                      <input
                        id="recipient"
                        name="recipient"
                        maxLength={120}
                        required
                        {...invalid("recipient")}
                      />
                    </Field>
                    <Field name="email" label="E-mail" error={error}>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        maxLength={120}
                        required
                        {...invalid("email")}
                      />
                    </Field>
                  </div>
                )}
              </>
            )}
            <Field name="until" label="Date de fin de l’accès" error={error}>
              <input
                id="until"
                name="until"
                type="date"
                defaultValue={until}
                min={data.today}
                required
                {...invalid("until")}
              />
            </Field>
            <p className="share-note">
              {single
                ? "1 document · 1 destinataire"
                : `${documents.length} document(s) × ${people.length} personne(s) : ${documents.length * people.length} accès`}{" "}
              en lecture seule. Aucun accès au reste du carnet.
            </p>
          </>
        )}
      </SubmissionForm>
      {single && (
        <div className="previous-shares">
          <h3>Partages de ce document</h3>
          {data.shares
            .filter((s) => s.doc === item.id)
            .map((s) => (
              <div className="access-row" key={s.id}>
                <div className="person-info">
                  <strong>{s.recipient}</strong>
                  <p>
                    {s.email} · Jusqu’au {fullDate(s.until)}
                  </p>
                  <small>{shareLabels[s.status]}</small>
                </div>
                {s.status === "active" && (
                  <button
                    className="subtle"
                    disabled={props.busy}
                    onClick={() => onOpenDialog("revoke-share", s)}
                  >
                    Révoquer
                  </button>
                )}
              </div>
            ))}
          {!data.shares.some((s) => s.doc === item.id) && (
            <p className="dialog-copy">Aucun partage pour ce document.</p>
          )}
        </div>
      )}
    </>
  );
}

function SelectionGroup({
  name,
  title,
  items,
  selected,
  onChange,
  help,
}: {
  name: string;
  title: string;
  items: { id: string; name: string; help?: string; disabled?: boolean }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  help?: string;
}) {
  const enabled = items.filter((item) => !item.disabled).map((item) => item.id);
  const count = enabled.filter((id) => selected.includes(id)).length;
  const all = enabled.length > 0 && count === enabled.length;
  const master = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (master.current) master.current.indeterminate = count > 0 && !all;
  }, [count, all]);
  return (
    <fieldset className="selection-group">
      <legend>{title}</legend>
      {help && <p className="selection-help">{help}</p>}
      {enabled.length > 0 && (
        <label className="pick-all">
          <input
            ref={master}
            type="checkbox"
            checked={all}
            onChange={(e) =>
              onChange(
                e.target.checked
                  ? [...new Set([...selected, ...enabled])]
                  : selected.filter((id) => !enabled.includes(id)),
              )
            }
          />
          <span>{all ? "Tout désélectionner" : "Tout sélectionner"}</span>
        </label>
      )}
      <div className="pick-list">
        {items.map((item) => (
          <label className="pick-row" key={item.id}>
            <input
              type="checkbox"
              name={name}
              value={item.id}
              disabled={item.disabled}
              checked={selected.includes(item.id)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...selected, item.id]
                    : selected.filter((id) => id !== item.id),
                )
              }
            />
            <span>
              {item.name}
              <small>{item.help}</small>
            </span>
          </label>
        ))}
        {!items.length && (
          <p className="selection-help">Aucun élément disponible.</p>
        )}
      </div>
    </fieldset>
  );
}
