import { uiLocale } from "../../shared/i18n/locale.ts";
import { useText } from "../../shared/i18n/HomeLocale.tsx";
import EmptyState from "../../shared/ui/EmptyState.tsx";
import { useEffect, useState } from "react";
import type { AdminRecord } from "../../../../shared/admin.ts";
import { adminApi } from "../../shared/services/admin.ts";
import Modal from "../../shared/ui/Modal.tsx";
import SubmissionForm, { Field } from "../../shared/forms/SubmissionForm.tsx";
import { errorMessage } from "../../shared/types.ts";
export default function SupportPanel({
  authenticated,
}: {
  authenticated: boolean;
}) {
  const tr = useText();
  const [items, setItems] = useState<AdminRecord[] | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  useEffect(() => {
    if (!authenticated) return;
    const c = new AbortController();
    adminApi
      .support(c.signal)
      .then((d) => {
        if (!c.signal.aborted) {
          setItems(d);
          setError("");
        }
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(errorMessage(e));
      });
    return () => c.abort();
  }, [authenticated, retry]);
  if (!authenticated)
    return (
      <div className="profile-panel support-panel">
        <h2>{tr("Vos demandes et recours")}</h2>
        <p>
          {tr(
            "Connectez-vous pour consulter vos dossiers et demander un nouvel examen d’une décision.",
          )}
        </p>
        <a className="button" href="#connexion">
          {tr("Se connecter")}
        </a>
      </div>
    );
  return (
    <div className="profile-panel support-panel">
      <h2>{tr("Vos demandes et recours")}</h2>
      <p>
        {tr(
          "Retrouvez les réponses de l’équipe et les décisions concernant vos signalements.",
        )}
      </p>
      {!!items?.length && (
        <button className="button" onClick={() => setOpen(true)}>
          {tr("Demander un nouvel examen")}
        </button>
      )}
      <p role="status">{tr(notice)}</p>
      {error ? (
        <div role="alert">
          <p>{tr(error)}</p>
          <button
            className="button outline"
            onClick={() => setRetry((n) => n + 1)}
          >
            {tr("Réessayer")}
          </button>
        </div>
      ) : !items ? (
        <p role="status">{tr("Chargement de vos dossiers…")}</p>
      ) : (
        <div className="resource-cards">
          {items.map((r) => (
            <article key={r.id}>
              <span className="admin-badge">{tr(r.status)}</span>
              <h3>{r.name}</h3>
              {r.reference && (
                <p>
                  {tr("Référence : ")}
                  <strong>{r.reference}</strong>
                </p>
              )}
              <p className="admin-preserve">{r.message}</p>
              {r.history?.map((h, i) => (
                <div className="admin-note" key={i}>
                  <strong>
                    {h.actor} ·{" "}
                    {new Date(h.date).toLocaleDateString(uiLocale())}
                  </strong>
                  <p className="admin-preserve">{h.note}</p>
                </div>
              ))}
            </article>
          ))}
          {!items.length && (
            <EmptyState
              kind="conversations"
              title={tr("Aucune demande en cours")}
              description={tr(
                "Vos échanges avec l’équipe Anivaya apparaîtront ici.",
              )}
            />
          )}
        </div>
      )}
      {open && (
        <Modal busy={busy} onClose={() => setOpen(false)}>
          <SubmissionForm
            title={tr("Demander un nouvel examen")}
            description={tr(
              "Indiquez la référence de la décision et les éléments à réexaminer. Le recours sera transmis à l’équipe de modération.",
            )}
            busy={busy}
            setBusy={setBusy}
            onClose={() => setOpen(false)}
            submitLabel={tr("Enregistrer le recours")}
            onSubmit={(values) => adminApi.appeal(values)}
            onSaved={async () => {
              setOpen(false);
              setNotice("Votre recours a été enregistré.");
              setRetry((n) => n + 1);
            }}
          >
            {({ error, invalid }) => (
              <>
                <Field
                  name="reference"
                  label={tr("Référence de la décision")}
                  error={error}
                >
                  <input
                    id="reference"
                    name="reference"
                    placeholder={tr("DEC-…")}
                    {...invalid("reference")}
                  />
                </Field>
                <Field
                  name="message"
                  label={tr("Motif du recours")}
                  error={error}
                >
                  <textarea
                    data-resize-none
                    style={{ resize: "none" }}
                    id="message"
                    name="message"
                    rows={6}
                    maxLength={3000}
                    {...invalid("message")}
                  />
                </Field>
              </>
            )}
          </SubmissionForm>
        </Modal>
      )}
    </div>
  );
}
