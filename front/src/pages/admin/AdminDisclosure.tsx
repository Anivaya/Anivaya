import { useText } from "../../shared/i18n/HomeLocale.tsx";
import { useId, useState, type ReactNode } from "react";
import Icon from "../../shared/ui/Icon.tsx";

export default function AdminDisclosure({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const tr = useText();
  const [open, setOpen] = useState(false),
    id = useId();
  return (
    <section className={className}>
      <button
        className="admin-disclosure-toggle"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        {/* « + » fermé, qui pivote en « × » à l’ouverture (comme les questions de l’accueil). */}
        <Icon name="plus" />
        {tr(label)}
      </button>
      <div
        id={id}
        className={`admin-disclosure-content ${open ? "is-open" : ""}`}
        inert={!open}
        aria-hidden={!open}
      >
        <div>{children}</div>
      </div>
    </section>
  );
}
