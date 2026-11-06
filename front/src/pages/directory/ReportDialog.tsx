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
  const [busy, setBusy] = useState(false),
    [reference, setReference] = useState("");
  return (
    <Modal busy={busy} onClose={onClose}>
      {reference ? (
        <>
          <h2 id="action-title">Signalement enregistré</h2>
          <p>
            Référence : <strong>{reference}</strong>. Retrouvez la réponse dans
            Contact → Demandes et recours.
          </p>
          <div className="dialog-actions">
            <button className="button" onClick={onClose}>
              Fermer
            </button>
          </div>
        </>
      ) : (
        <SubmissionForm
          title="Signaler une fiche"
          description={`Fiche concernée : ${name}. Décrivez précisément le problème pour aider la modération.`}
          busy={busy}
          setBusy={setBusy}
          onClose={onClose}
          onSaved={async () => {}}
          submitLabel="Envoyer le signalement"
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
            <Field name="message" label="Motif du signalement" error={error}>
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
