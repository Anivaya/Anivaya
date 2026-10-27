import type { ReactNode } from "react";

export default function PageHeading({
  title,
  description,
  actionLabel,
  onAction,
  showPlus = true,
  secondary,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  showPlus?: boolean;
  /** Action placée avant le bouton principal. */
  secondary?: ReactNode;
}) {
  const action = (
    <button
      className={`button${showPlus ? " with-plus" : ""}`}
      onClick={onAction}
    >
      {showPlus && <span aria-hidden="true">+</span>}
      {actionLabel}
    </button>
  );
  return (
    <div className="welcome">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {secondary ? (
        <div className="heading-actions">
          {secondary}
          {action}
        </div>
      ) : (
        action
      )}
    </div>
  );
}
