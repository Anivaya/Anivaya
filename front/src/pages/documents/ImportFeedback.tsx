import { useState } from "react";
import SubmissionForm, { Field } from "../../shared/forms/SubmissionForm.tsx";
import { adminApi } from "../../shared/services/admin.ts";
export default function ImportFeedback({
  importId,
}: {
  /** Import suivi par l’assistance, pour rattacher le retour. */
  importId?: string;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [sent, setSent] = useState(false);
  return sent ? (
    <p role="status">
      Merci, votre retour a été enregistré pour l’équipe d’assistance.
    </p>
  ) : open ? (
    <section className="admin-proof">
      <SubmissionForm
        title="Votre avis sur l’import"
        busy={busy}
        setBusy={setBusy}
        onClose={() => setOpen(false)}
        onSaved={async () => setSent(true)}
        submitLabel="Envoyer le retour"
        onSubmit={(values) =>
          adminApi.feedback(importId ? { ...values, importId } : values)
        }
      >
        {({ error, invalid }) => (
          <>
            <Field name="name" label="Objet" error={error}>
              <input
                id="name"
                name="name"
                maxLength={180}
                {...invalid("name")}
              />
            </Field>
            <Field name="category" label="Type de retour" error={error}>
              <select id="category" name="category" {...invalid("category")}>
                {[
                  "Information incorrecte",
                  "Difficulté rencontrée",
                  "Suggestion",
                ].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field name="message" label="Votre retour" error={error}>
              <textarea
                style={{ resize: "none" }}
                id="message"
                name="message"
                rows={4}
                maxLength={3000}
                {...invalid("message")}
              />
            </Field>
          </>
        )}
      </SubmissionForm>
    </section>
  ) : (
    <button className="button outline" onClick={() => setOpen(true)}>
      Donner mon avis sur l’import
    </button>
  );
}
