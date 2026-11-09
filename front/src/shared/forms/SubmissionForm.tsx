import { useText } from "../i18n/HomeLocale.tsx";
import type { ReactNode, FormEvent } from "react";
import type {
  Animal,
  DialogControls,
  ValidationState,
  FormError,
} from "../types.ts";
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
  headerAction,
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
  headerAction?: ReactNode;
}) {
  const tr = useText();
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
      {headerAction ? (
        <div className="admin-dialog-heading">
          <h2 className="dialog-title" id="action-title">
            {title}
          </h2>
          {headerAction}
        </div>
      ) : (
        <h2 className="dialog-title" id="action-title">
          {title}
        </h2>
      )}
      <p className="dialog-copy">{description}</p>
      <form ref={ref} noValidate onSubmit={submit} aria-busy={busy}>
        {children({ error, invalid })}
        <FormAlert message={error?.message} />
        <div className="dialog-actions">
          <button
            className="button outline cancel"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            {tr("Annuler")}
          </button>
          <button
            className={`button${danger ? " danger" : ""}`}
            type="submit"
            disabled={busy || disabled}
          >
            {busy ? tr("Enregistrement…") : tr(submitLabel)}
          </button>
        </div>
      </form>
    </>
  );
}

export function FormAlert({ message }: { message?: string }) {
  const tr = useText();
  return message ? (
    <p className="form-error" role="alert">
      {tr(message)}
    </p>
  ) : null;
}

export function Field({
  name,
  label,
  error,
  children,
}: {
  name: string;
  label: ReactNode;
  error?: FormError | null;
  children: ReactNode;
}) {
  const tr = useText();
  return (
    <div className="field">
      <label htmlFor={name}>
        {typeof label === "string" ? tr(label) : label}
      </label>
      {children}
      {error?.field === name && (
        <p className="field-help form-error" id={`${name}-error`}>
          {tr(error.message)}
        </p>
      )}
    </div>
  );
}

export function AnimalSelectField({
  animals,
  defaultValue,
  error,
  invalid,
}: ValidationState & { animals: Animal[]; defaultValue?: string }) {
  const tr = useText();
  return (
    <Field name="animal" label={tr("Animal")} error={error}>
      <select
        id="animal"
        name="animal"
        defaultValue={defaultValue || animals[0]?.id || ""}
        {...invalid("animal")}
      >
        {!animals.length && <option value="">{tr("Aucun animal")}</option>}
        {animals.map((animal) => (
          <option key={animal.id} value={animal.id}>
            {animal.name}
          </option>
        ))}
      </select>
    </Field>
  );
}
