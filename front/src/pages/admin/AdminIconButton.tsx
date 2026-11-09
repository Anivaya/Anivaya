import { useText } from "../../shared/i18n/HomeLocale.tsx";
import type { ButtonHTMLAttributes } from "react";
import Icon from "../../shared/ui/Icon.tsx";

export default function AdminIconButton({
  icon,
  label,
  danger = false,
  className = "",
  onClick,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: string;
  label: string;
  danger?: boolean;
}) {
  const tr = useText();
  return (
    <button
      {...props}
      onClick={onClick}
      type={props.type || "button"}
      className={`admin-icon-button ${danger ? "is-danger" : ""} ${className}`}
      aria-label={tr(label)}
      title={tr(label)}
    >
      <Icon name={icon} />
    </button>
  );
}
