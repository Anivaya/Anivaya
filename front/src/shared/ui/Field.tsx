import type { FieldProps } from "../types.ts";
export default function Field({ name, label, error, children }: FieldProps) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      {children}
      {error?.field === name && (
        <p className="field-help form-error" id={`${name}-error`}>
          {error.message}
        </p>
      )}
    </div>
  );
}
