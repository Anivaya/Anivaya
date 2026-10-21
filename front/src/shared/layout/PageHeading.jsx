export default function PageHeading({
  title,
  description,
  actionLabel,
  onAction,
}) {
  return (
    <div className="welcome">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <button className="button" onClick={onAction}>
        <span aria-hidden="true">+</span>
        {actionLabel}
      </button>
    </div>
  );
}
