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
        <Icon name="arrow" />
        {label}
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
