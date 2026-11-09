import { useText } from "../../shared/i18n/HomeLocale.tsx";
import { useState } from "react";
import Modal from "../../shared/ui/Modal.tsx";
import SubmissionForm, { Field } from "../../shared/forms/SubmissionForm.tsx";
import { adminApi } from "../../shared/services/admin.ts";
export default function ReportDialog({
  id,
  name,
  onClose,
}: {
  id: string;
  name: string;
  onClose: () => void;
}) {
  const tr = useText();
  const [busy, setBusy] = useState(false),
    [reference, setReference] = useState("");
  return (
    <Modal busy={busy} onClose={onClose}>
      {reference ? (
        <>
          <h2 id="action-title">{tr("Signalement enregistré")}</h2>
          <p>
            {tr("Référence : ")}
            <strong>{reference}</strong>
            {tr(". Retrouvez la réponse dans Contact → Demandes et recours.")}
          </p>
          <div className="dialog-actions">
            <button className="button" onClick={onClose}>
              {tr("Fermer")}
            </button>
          </div>
        </>
      ) : (
        <SubmissionForm
          title={tr("Signaler une fiche")}
          description={tr(
            "Fiche concernée : {0}. Décrivez précisément le problème pour aider la modération.",
            [name],
          )}
          busy={busy}
          setBusy={setBusy}
          onClose={onClose}
          onSaved={async () => {}}
          submitLabel={tr("Envoyer le signalement")}
          onSubmit={async (values) => {
            const result = await adminApi.report({
              ...values,
              targetType: "pros",
              target: id,
              name: `Signalement : ${name}`,
            });
            setReference(result.reference);
          }}
        >
          {({ error, invalid }) => (
            <Field
              name="message"
              label={tr("Motif du signalement")}
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
          )}
        </SubmissionForm>
      )}
    </Modal>
  );
}
