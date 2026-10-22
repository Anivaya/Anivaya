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
}) {
  const [error, setError] = useState(null);
  const ref = useRef(null);
  const invalid = (name) => ({
    "aria-invalid": error?.field === name || undefined,
    "aria-describedby": error?.field === name ? `${name}-error` : undefined,
  });
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const message = await onSubmit(
        Object.fromEntries(new FormData(event.currentTarget)),
      );
      await onSaved(typeof message === "string" ? message : successMessage);
    } catch (failure) {
      setError({ message: failure.message, field: failure.field });
      if (failure.field)
        ref.current.elements.namedItem(failure.field)?.focus?.();
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
