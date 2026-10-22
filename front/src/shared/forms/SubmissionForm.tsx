import type { ReactNode, FormEvent } from "react";
import type { DialogControls, ValidationState, FormError } from "../types.ts";
import { errorMessage, errorField } from "../types.ts";
import { useRef, useState } from "react";

export default function SubmissionForm({
  title,
  description,
  children,
  onSubmit,
  onClose,
  onSaved,
  successMessage,
  busy,
  setBusy,
  disabled = false,
  submitLabel = "Ajouter",
  danger = false,
}: DialogControls & {
  title: string;
  description?: string;
  children: (state: ValidationState) => ReactNode;
  onSubmit: (
    values: Record<string, string>,
    form: FormData,
  ) => Promise<unknown>;
  successMessage?: string;
  disabled?: boolean;
  submitLabel?: string;
  danger?: boolean;
}) {
  const [error, setError] = useState<FormError | null>(null);
  const ref = useRef<HTMLFormElement>(null);
  const invalid: ValidationState["invalid"] = (name) => ({
    "aria-invalid": error?.field === name || undefined,
    "aria-describedby": error?.field === name ? `${name}-error` : undefined,
  });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const form = new FormData(event.currentTarget);
      const values: Record<string, string> = {};
      for (const [name, value] of form)
        if (typeof value === "string") values[name] = value;
      const message = await onSubmit(values, form);
      await onSaved(
        typeof message === "string"
          ? message
          : successMessage || "Modifications enregistrées.",
      );
    } catch (failure) {
      const field = errorField(failure);
      setError({ message: errorMessage(failure), field });
      const target = field ? ref.current?.elements.namedItem(field) : null;
      if (target instanceof HTMLElement) target.focus();
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h2 className="dialog-title" id="action-title">
        {title}
      </h2>
      <p className="dialog-copy">{description}</p>
      <form ref={ref} noValidate onSubmit={submit} aria-busy={busy}>
        {children({ error, invalid })}
        {error && (
          <p className="form-error" role="alert">
            {error.message}
          </p>
        )}
        <div className="dialog-actions">
          <button
            className="button outline"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            Annuler
          </button>
          <button
            className={`button${danger ? " danger" : ""}`}
            type="submit"
            disabled={busy || disabled}
          >
            {busy ? "Enregistrement…" : submitLabel}
          </button>
        </div>
      </form>
    </>
  );
}
