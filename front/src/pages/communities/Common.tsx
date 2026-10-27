import type { ReactNode } from "react";
import Icon from "../../shared/ui/Icon.tsx";
import type { SocialContext, SocialDialog, SocialTab } from "./social.ts";
import { personInitials, personName, socialHref } from "./social.ts";

/** Nom cliquable d’un membre : ouvre son profil. */
export function PersonLink({
  ctx,
  id,
  avatar = true,
  back,
}: {
  ctx: SocialContext;
  id: string;
  avatar?: boolean;
  back?: SocialDialog;
}) {
  return (
    <button
      type="button"
      className="person-link"
      onClick={() => ctx.open({ kind: "person", id, back })}
    >
      {avatar && (
        <span className="social-avatar">{personInitials(ctx.data, id)}</span>
      )}
      <span>
        {personName(ctx.data, id)}
        {id === ctx.data.me && <small> (vous)</small>}
      </span>
    </button>
  );
}

export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="social-empty">
      <Icon name="chat" />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

export function BackLink({
  tab,
  className = "",
}: {
  tab: SocialTab;
  className?: string;
}) {
  return (
    <a
      className={`social-back ${className}`}
      href={socialHref(tab)}
      aria-label="Retour à la liste"
    >
      <Icon name="back" />
    </a>
  );
}

/** Bouton icône des actions sur les membres et les messages. */
export function IconButton({
  label,
  icon,
  onClick,
  danger = false,
  disabled = false,
  className = "",
}: {
  label: string;
  icon: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`social-icon ${danger ? "danger" : ""} ${className}`}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={icon} />
    </button>
  );
}
