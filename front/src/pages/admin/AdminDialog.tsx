import { useEffect, useState } from "react";
import type {
  AdminRecord,
  AdminResource,
  AdminRole,
} from "../../../../shared/admin.ts";
import { adminRoles } from "../../../../shared/admin.ts";
import Modal from "../../shared/ui/Modal.tsx";
import SubmissionForm, { Field } from "../../shared/forms/SubmissionForm.tsx";
import type { ValidationState } from "../../shared/types.ts";
import { adminApi } from "../../shared/services/admin.ts";
import { readFile } from "../../shared/services/api.ts";
import { actionsFor, adminLink, isDangerAction, statusTone } from "./config.ts";
import AdminIconButton from "./AdminIconButton.tsx";

const PROOF_TYPES = ["application/pdf", "image/jpeg", "image/png"];

export function RecordBody({
  row,
  onProof,
}: {
  row: AdminRecord;
  onProof?: (id: string) => void;
}) {
  return (
    <div className="admin-record-body">
      <p>
        <span className={`admin-badge ${statusTone(row.status)}`}>
          {row.status}
        </span>
        {row.level && (
          <span
            className={`admin-badge ${row.level === "Dossier vérifié" ? "success" : ""}`}
          >
            {row.level}
          </span>
        )}
        {row.reference && <strong> · {row.reference}</strong>}
      </p>
      <dl>
        {[
          ["E-mail", row.email],
          ["Type de compte", row.accountType],
          ["Rôle", row.role],
          ["Catégorie", row.category],
          ["Ville", row.city],
          ["Priorité", row.priority],
          ["Audience", row.audience],
          [
            "Destinataires à la diffusion",
            row.recipients !== undefined ? String(row.recipients) : "",
          ],
          ["Attribué à", row.assignee],
          ["SIRET", row.siret],
          ["Nature", row.kind],
          ["Constat", row.issue],
          ["Cible", row.targetName],
          ["État de la cible", row.targetStatus],
          ["Sanction appliquée", row.accountAction],
          ["Fiches publiques", row.visibility],
          [
            "Invitation valable jusqu’au",
            row.expiresAt
              ? new Date(row.expiresAt).toLocaleString("fr-FR")
              : "",
          ],
          ["Origine", row.source],
          [
            "Reçu le",
            row.createdAt
              ? new Date(row.createdAt).toLocaleString("fr-FR")
              : "",
          ],
        ]
          .filter(([, v]) => v)
          .map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
      </dl>
      {row.priority && (
        <p className="admin-note">
          {row.firstResponseAt
            ? `Première réponse le ${new Date(row.firstResponseAt).toLocaleString("fr-FR")}`
            : `Objectif de première réponse : ${new Date(Date.parse(row.createdAt) + 86400000).toLocaleString("fr-FR")}${row.responseLate ? " · Délai de 24 h dépassé" : ""}`}
        </p>
      )}
      {row.resource && row.target && (
        <p>
          <a
            className="button outline"
            href={`${adminLink(row.resource)}?record=${encodeURIComponent(row.target)}`}
          >
            Ouvrir le dossier concerné →
          </a>
        </p>
      )}
      {row.ticketId && (
        <p>
          <a
            className="button outline"
            href={`${adminLink("tickets")}?record=${encodeURIComponent(row.ticketId)}`}
          >
            Ouvrir le ticket de support →
          </a>
        </p>
      )}
      {row.feedbackId && (
        <p>
          <a
            className="admin-text-button"
            href={`${adminLink("feedback")}?record=${encodeURIComponent(row.feedbackId)}`}
          >
            Consulter le retour utilisateur
          </a>
        </p>
      )}
      {row.importId && (
        <p>
          <a
            className="admin-text-button"
            href={`${adminLink("imports")}?record=${encodeURIComponent(row.importId)}`}
          >
            Consulter l’import concerné
          </a>
        </p>
      )}
      {row.targetType === "reports" && row.target && !row.resource && (
        <p>
          <a
            className="button outline"
            href={`${adminLink("reports")}?record=${encodeURIComponent(row.target)}`}
          >
            Consulter la décision initiale
          </a>
        </p>
      )}
      {row.message && <p className="admin-preserve">{row.message}</p>}
      {row.body && <p className="admin-preserve">{row.body}</p>}
      {row.note && <p className="admin-note">{row.note}</p>}
      {row.documents?.map((d) => (
        <article className="admin-proof" key={d.id}>
          <strong>{d.name}</strong>
          <span>
            {d.status} · {d.applicable ? "Applicable" : "Non applicable"}
            {d.file ? " · pièce reçue" : ""}
          </span>
          {d.expires && <small>Valable jusqu’au {d.expires}</small>}
          <p>{d.note}</p>
          {onProof && (
            <button className="button outline" onClick={() => onProof(d.id)}>
              Consulter le justificatif
            </button>
          )}
        </article>
      ))}
      {row.versions
        ?.slice()
        .reverse()
        .map((v) => (
          <article key={v.number} className="admin-proof">
            <span className="admin-badge">
              Version {v.number} · {v.status}
            </span>
            <h3>{v.title}</h3>
            <p>{v.summary}</p>
            <p className="admin-preserve">{v.body}</p>
            {v.review && (
              <p className="admin-note">
                Relu par {v.review.reviewer} : {v.review.note}
              </p>
            )}
          </article>
        ))}
      {!!row.history?.length && (
        <section className="admin-timeline">
          <h3>Historique du dossier</h3>
          {row.history
            .slice()
            .reverse()
            .map((entry, i) => (
              <article key={i}>
                <strong>{entry.action}</strong>
                <small>
                  {new Date(entry.date).toLocaleString("fr-FR")} · {entry.actor}
                </small>
                <p className="admin-preserve">{entry.note}</p>
              </article>
            ))}
        </section>
      )}
    </div>
  );
}
/** Pièce reçue : image affichée, PDF dans un cadre, avec le lien de téléchargement. */
function ProofPreview({
  record,
  proof,
}: {
  record: string;
  proof: { id: string; fileName?: string };
}) {
  const url = adminApi.proofFileUrl(record, proof.id);
  const image = /\.(png|jpe?g)$/i.test(proof.fileName || "");
  return (
    <div className="admin-proof-preview">
      {image ? (
        <img src={url} alt={`Pièce reçue : ${proof.fileName}`} />
      ) : (
        <iframe src={url} title={`Pièce reçue : ${proof.fileName}`} />
      )}
      <a
        className="admin-text-button"
        href={url}
        target="_blank"
        rel="noreferrer"
      >
        Ouvrir {proof.fileName || "la pièce"} dans un nouvel onglet
      </a>
    </div>
  );
}

export default function AdminDialog({
  resource,
  row,
  role,
  onClose,
  onSaved,
  initialAction = "view",
  returnLabel = "Fermer",
}: {
  resource: AdminResource;
  row: AdminRecord | null;
  role: AdminRole;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
  initialAction?: string;
  returnLabel?: string;
}) {
  const [busy, setBusy] = useState(false),
    [action, setAction] = useState(row ? initialAction : "new"),
    [dirty, setDirty] = useState(false),
    [discard, setDiscard] = useState(false);
  useEffect(() => {
    const selector = discard
      ? ".admin-discard button"
      : ".admin-editor input,.admin-editor select,.admin-editor textarea,.admin-editor button";
    document.querySelector<HTMLElement>(selector)?.focus();
  }, [action, discard]);
  const actions = row ? actionsFor(resource, row, role) : [];
  const chosen = actions.find((a) => a.id === action);
  const close = () => {
    if (dirty) setDiscard(true);
    else onClose();
  };
  const title =
    action === "new"
      ? {
          team: "Ajouter un membre",
          library: "Créer un guide",
          announcements: "Créer une annonce",
          tickets: "Créer une demande",
        }[resource as "team"] || "Créer"
      : action === "edit"
        ? `Modifier ${row?.name}`
        : action.startsWith("proof-file:")
          ? "Joindre la pièce reçue"
          : chosen?.label || row?.name || "Dossier";
  const proof = row?.documents?.find((d) => action === "proof:" + d.id);
  const proofUpload = row?.documents?.find(
    (d) => action === "proof-file:" + d.id,
  );
  const viewedProof = row?.documents?.find(
    (d) => action === "proof-view:" + d.id,
  );
  const v = row?.versions?.at(-1);
  const member = resource === "team" && row && !row.invitation;
  function fields(state: ValidationState) {
    const field = (
      name: string,
      label: string,
      value = "",
      options?: readonly string[],
      multiline = false,
    ) => (
      <Field key={name} name={name} label={label} error={state.error}>
        {options ? (
          <select
            id={name}
            name={name}
            defaultValue={value || options[0]}
            {...state.invalid(name)}
          >
            {options.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        ) : multiline ? (
          <textarea
            className="resize-none"
            style={{ resize: "none" }}
            rows={name === "body" && resource === "library" ? 10 : 4}
            id={name}
            name={name}
            defaultValue={value}
            maxLength={name === "body" ? 20000 : 3000}
            {...state.invalid(name)}
          />
        ) : (
          <input
            id={name}
            name={name}
            defaultValue={value}
            type={
              name === "email" ? "email" : name === "expires" ? "date" : "text"
            }
            maxLength={name === "summary" ? 600 : 180}
            {...state.invalid(name)}
          />
        )}
      </Field>
    );
    const editing = action === "new" || action === "save";
    return (
      <div className="admin-form-fields" onChange={() => setDirty(true)}>
        {(resource === "users" || member) && action === "edit" && (
          <>
            {field("name", "Nom affiché", row?.name)}
            {field("email", "Adresse e-mail", row?.email)}
            {resource === "users" &&
              field("accountType", "Type de compte", row?.accountType, [
                "Particulier",
                "Professionnel",
              ])}
            <p className="admin-note">
              L’adresse sert à la connexion. Les droits d’administration se
              gèrent dans Équipe.
            </p>
          </>
        )}
        {row &&
          [
            "publish",
            "review",
            "decide",
            "ticket",
            "delete",
            "decline",
            "unpublish",
            "reset",
            "retry",
            "incident",
            "renew",
            "cancel",
          ].includes(action) && <RecordBody row={row} />}
        {action === "delete" && (
          <p className="admin-note">
            {resource === "library"
              ? "Ce guide et ses versions seront supprimés, y compris sa publication éventuelle."
              : resource === "deletions"
                ? "Le compte, son espace, ses fiches publiques et ses sessions seront effacés définitivement. La demande ne conservera aucune donnée personnelle."
                : "Ce brouillon sera supprimé."}{" "}
            L’action restera dans l’historique.
          </p>
        )}
        {action === "decline" && (
          <p className="admin-note">
            Le compte reste actif. Indiquez la raison communiquée à la personne.
          </p>
        )}
        {action === "reset" && (
          <p className="admin-note">
            Un lien de réinitialisation, valable une heure, est envoyé à
            l’adresse du compte. La demande est tracée dans l’historique.
          </p>
        )}
        {action === "retry" && (
          <p className="admin-note">
            La personne reçoit un e-mail l’invitant à importer de nouveau son
            document. L’échec et son motif restent consignés pour le suivi.
          </p>
        )}
        {action === "renew" && (
          <p className="admin-note">
            L’invitation sera valable 14 jours de plus et un nouvel e-mail
            d’invitation sera envoyé.
          </p>
        )}
        {action === "cancel" && (
          <p className="admin-note">
            La personne ne recevra aucun accès à sa première connexion.
          </p>
        )}
        {action === "incident" &&
          field("name", "Objet du ticket", "Incident : " + row?.name)}
        {action === "ticket" && (
          <p className="admin-note">
            Le ticket reprendra ce retour et permettra de répondre à
            l’utilisateur dans son suivi privé.
          </p>
        )}
        {editing &&
          ["library", "announcements", "tickets"].includes(resource) &&
          field(
            "name",
            resource === "tickets" ? "Objet" : "Titre",
            v?.title || row?.name,
          )}
        {editing &&
          ["team", "tickets"].includes(resource) &&
          action === "new" &&
          field("email", "Adresse e-mail du compte", row?.email)}
        {editing &&
          resource === "team" &&
          field("role", "Rôle", row?.role || "Support", adminRoles)}
        {editing &&
          ["users", "team"].includes(resource) &&
          row &&
          field("status", "État", row.status, ["Actif", "Suspendu"])}
        {editing && resource === "library" && (
          <>
            {field("summary", "Résumé", v?.summary, undefined, true)}
            {field("body", "Contenu du guide", v?.body, undefined, true)}
          </>
        )}
        {editing &&
          resource === "announcements" &&
          field("audience", "Audience", row?.audience || "Tous", [
            "Tous",
            "Particuliers",
            "Professionnels",
          ])}
        {editing &&
          ["announcements", "tickets"].includes(resource) &&
          field("message", "Message", row?.message, undefined, true)}
        {action === "edit" && resource === "pros" && (
          <>
            {field("name", "Nom", row?.name)}
            {field("email", "E-mail", row?.email)}
            {field("city", "Ville", row?.city)}
            {field("category", "Catégorie", row?.category, [
              ...new Set([
                row?.category || "Vétérinaire",
                "Vétérinaire",
                "Toilettage",
                "Éducation",
                "Garde",
                "Nutrition",
              ]),
            ])}
            {field("body", "Présentation", row?.body, undefined, true)}
          </>
        )}
        {action === "save" && resource === "pros" && (
          <>
            <RecordBody row={row!} />
            {field("siret", "SIRET", row?.siret)}
            {field("status", "État du dossier", row?.status, [
              "À vérifier",
              "À corriger",
              "Validé",
              "Suspendu",
              "Refusé",
            ])}
          </>
        )}
        {proofUpload && (
          <>
            <p>
              {row?.name} · {proofUpload.name}
            </p>
            <Field
              name="file"
              label="Pièce reçue (PDF, JPEG ou PNG, 10 Mo)"
              error={state.error}
            >
              <input
                id="file"
                name="file"
                type="file"
                accept={PROOF_TYPES.join(",")}
                {...state.invalid("file")}
              />
            </Field>
            <p className="admin-note">
              La pièce est conservée avec le dossier et consultable depuis sa
              fiche. Une pièce manquante passe « À examiner ».
            </p>
          </>
        )}
        {proof && (
          <>
            {field("status", "État du justificatif", proof.status, [
              "Manquant",
              "À examiner",
              "Conforme",
              "À corriger",
              "Refusé",
            ])}
            {field(
              "applicable",
              "Pièce applicable",
              proof.applicable ? "Oui" : "Non",
              ["Oui", "Non"],
            )}
            {field("expires", "Valable jusqu’au (facultatif)", proof.expires)}
            <p className="admin-note">
              Contrôle manuel du dossier. Aucune vérification automatique dans
              un registre officiel.
            </p>
          </>
        )}
        {action === "review" &&
          field("status", "Décision de relecture", "Validé", [
            "Validé",
            "À corriger",
          ])}
        {action === "priority" &&
          field("priority", "Priorité", row?.priority, [
            "Normale",
            "Risque grave",
          ])}
        {action === "decide" &&
          field(
            "status",
            "Décision",
            "",
            resource === "appeals"
              ? ["Décision maintenue", "Réexamen demandé"]
              : row?.choices || ["Classé sans suite", "Signalement confirmé"],
          )}
        {action === "decide" && resource === "reports" && row?.sanctionable && (
          <>
            {field(
              "accountAction",
              "Action sur le compte signalé",
              "Aucune sanction",
              ["Aucune sanction", "Avertir le compte", "Suspendre le compte"],
            )}
            <p className="admin-note">
              Une sanction n’est possible qu’avec une décision qui ne classe pas
              le dossier. La suspension ferme immédiatement les sessions du
              compte.
            </p>
          </>
        )}
        {action === "reply" &&
          field(
            "status",
            "État",
            row?.status,
            resource === "tickets"
              ? ["Ouvert", "En cours", "Résolu", "Fermé"]
              : ["Nouveau", "À analyser", "Pris en charge", "Résolu", "Classé"],
          )}
        {action === "reply" &&
          resource === "tickets" &&
          field("assignee", "Attribuer à", row?.assignee || "Support", [
            ...new Set([
              row?.assignee || "Support",
              ...(row?.assignees || ["Support", "Administrateur"]),
            ]),
          ])}
        {action !== "new" &&
          !["read", "unread", "edit"].includes(action) &&
          !proofUpload &&
          field(
            "note",
            resource === "tickets"
              ? "Réponse enregistrée dans le suivi (sans e-mail)"
              : action === "incident"
                ? "Description de l’incident"
                : action === "reset"
                  ? "Commentaire (facultatif)"
                  : "Motif / commentaire",
            "",
            undefined,
            true,
          )}
        {proofUpload &&
          field("note", "Commentaire de réception", "", undefined, true)}
        {action === "new" && resource === "team" && (
          <p className="admin-note">
            Si la personne possède déjà un compte, l’accès est accordé
            immédiatement. Sinon, elle reçoit par e-mail une invitation valable
            14 jours, appliquée à sa première connexion.
          </p>
        )}
      </div>
    );
  }
  return (
    <Modal
      onClose={close}
      busy={busy}
      header={false}
      className="admin-dialog"
      labelledBy={discard ? "discard-title" : "action-title"}
    >
      {discard && (
        <div className="admin-discard">
          <h2 id="discard-title">Abandonner les modifications ?</h2>
          <p>Votre saisie n’a pas été enregistrée.</p>
          <div className="dialog-actions">
            <button
              className="button outline"
              autoFocus
              onClick={() => setDiscard(false)}
            >
              Continuer la saisie
            </button>
            <button className="button danger" onClick={onClose}>
              Abandonner
            </button>
          </div>
        </div>
      )}
      <div className="admin-editor" hidden={discard}>
        {viewedProof ? (
          <>
            <div className="admin-dialog-heading">
              <h2 id="action-title">{viewedProof.name}</h2>
              <div className="admin-row-actions">
                <AdminIconButton
                  icon="back"
                  label="Retour au dossier"
                  onClick={() => setAction("view")}
                />
                <AdminIconButton
                  icon="close"
                  label="Fermer le dossier"
                  danger
                  className="admin-close"
                  onClick={close}
                />
              </div>
            </div>
            <p>{row?.name}</p>
            <span className={`admin-badge ${statusTone(viewedProof.status)}`}>
              {viewedProof.status}
            </span>
            {viewedProof.file ? (
              <ProofPreview record={row!.id} proof={viewedProof} />
            ) : (
              <p className="admin-note">
                {viewedProof.status === "Manquant"
                  ? "Pièce non transmise. Demandez ce justificatif au professionnel avant de valider son dossier."
                  : "Le suivi de vérification est enregistré. Aucun fichier justificatif n’est joint à ce dossier."}
              </p>
            )}
            <dl className="admin-record-facts">
              <dt>Applicabilité</dt>
              <dd>
                {viewedProof.applicable ? "Applicable" : "Non applicable"}
              </dd>
              <dt>Validité</dt>
              <dd>{viewedProof.expires || "Non renseignée"}</dd>
            </dl>
            <p>{viewedProof.note}</p>
            <h3>Historique de vérification</h3>
            <div className="admin-timeline">
              {viewedProof.history?.map((h, i) => (
                <article key={i}>
                  <strong>{h.action}</strong>
                  <small>
                    {new Date(h.date).toLocaleString("fr-FR")} · {h.actor}
                  </small>
                  <p>{h.note}</p>
                </article>
              ))}
              {!viewedProof.history?.length && (
                <p>Aucun contrôle enregistré.</p>
              )}
            </div>
            {resource === "pros" && role === "Administrateur" && (
              <div className="admin-dialog-actions">
                <button
                  className="button outline"
                  onClick={() => setAction("proof-file:" + viewedProof.id)}
                >
                  {viewedProof.file
                    ? "Remplacer la pièce reçue"
                    : "Joindre la pièce reçue"}
                </button>
                <button
                  className="button"
                  onClick={() => setAction("proof:" + viewedProof.id)}
                >
                  Modifier les critères et le contrôle
                </button>
              </div>
            )}
          </>
        ) : action === "view" && row ? (
          <>
            <div className="admin-dialog-heading">
              <h2 id="action-title">{row.name}</h2>
              <AdminIconButton
                icon={returnLabel === "Fermer" ? "close" : "back"}
                label={returnLabel}
                danger={returnLabel === "Fermer"}
                className={returnLabel === "Fermer" ? "admin-close" : ""}
                onClick={onClose}
              />
            </div>
            <RecordBody
              row={row}
              onProof={(id) => setAction("proof-view:" + id)}
            />
            {resource === "users" && (
              <p className="admin-note">
                Les carnets, documents privés et mots de passe ne sont pas
                accessibles depuis cet écran.
              </p>
            )}
            <div className="admin-dialog-actions">
              {actions.map((a) => (
                <button
                  key={a.id}
                  className={
                    "button outline" + (isDangerAction(a.id) ? " danger" : "")
                  }
                  onClick={() => setAction(a.id)}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <SubmissionForm
            title={title}
            headerAction={
              <AdminIconButton
                icon="close"
                label="Fermer le formulaire"
                danger
                className="admin-close"
                disabled={busy}
                onClick={close}
              />
            }
            description={
              row && action !== "edit"
                ? `Dossier : ${row.name}. L’action sera enregistrée dans l’historique.`
                : undefined
            }
            key={action}
            submitLabel={
              action === "new"
                ? "Créer"
                : action === "edit"
                  ? "Enregistrer"
                  : proofUpload
                    ? "Enregistrer la pièce"
                    : chosen?.label || "Enregistrer"
            }
            busy={busy}
            setBusy={setBusy}
            onClose={() => {
              if (dirty) setDiscard(true);
              else if (row) setAction("view");
              else onClose();
            }}
            onSaved={onSaved}
            danger={isDangerAction(action)}
            onSubmit={async (values, form) => {
              if (action === "new") await adminApi.create(resource, values);
              else if (proofUpload) {
                const file = form.get("file");
                if (!(file instanceof File) || !file.size)
                  throw Object.assign(new Error("Choisissez un fichier."), {
                    field: "file",
                  });
                if (!PROOF_TYPES.includes(file.type) || file.size > 10485760)
                  throw Object.assign(
                    new Error(
                      "Choisissez un PDF, JPEG ou PNG de 10 Mo maximum.",
                    ),
                    { field: "file" },
                  );
                await adminApi.act(resource, row!.id, {
                  action: "proof-file",
                  version: row!.version,
                  document: proofUpload.id,
                  fileName: file.name,
                  note: values.note,
                  file: { type: file.type, content: await readFile(file) },
                });
              } else
                await adminApi.act(resource, row!.id, {
                  ...values,
                  version: row!.version,
                  action: proof ? "proof" : action,
                  document: proof?.id,
                  applicable: values.applicable === "Oui",
                });
              setDirty(false);
            }}
          >
            {fields}
          </SubmissionForm>
        )}
      </div>
    </Modal>
  );
}
