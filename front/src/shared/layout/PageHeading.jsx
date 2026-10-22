export default function PageHeading({
  title,
  description,
  actionLabel,
  onAction,
  showPlus = true,
}) {
  return (
    <div className="welcome">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <button className="button" onClick={onAction}>
        {showPlus && <span aria-hidden="true">+</span>}
        {actionLabel}
      </button>
    </div>
  );
}
