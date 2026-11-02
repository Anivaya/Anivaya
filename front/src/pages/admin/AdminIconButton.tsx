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
  return (
    <button
      {...props}
      onClick={onClick}
      type={props.type || "button"}
      className={`admin-icon-button ${danger ? "is-danger" : ""} ${className}`}
      aria-label={label}
      title={label}
    >
      <Icon name={icon} />
    </button>
  );
}
