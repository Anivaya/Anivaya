export default function SelectionGroup({
  name,
  title,
  items,
  selected,
  onChange,
  help,
}: {
  name: string;
  title: string;
  items: { id: string; name: string; help?: string; disabled?: boolean }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  help?: string;
}) {
  const enabled = items.filter((item) => !item.disabled).map((item) => item.id);
  return (
    <fieldset className="selection-group">
      <legend>{title}</legend>
      {help && <p className="selection-help">{help}</p>}
      {enabled.length > 0 && (
        <button
          type="button"
          className="pick-all"
          onClick={() =>
            onChange(
              enabled.every((id) => selected.includes(id)) ? [] : enabled,
            )
          }
        >
          Tout sélectionner / désélectionner
        </button>
      )}
      <div className="pick-list">
        {items.map((item) => (
          <label className="pick-row" key={item.id}>
            <input
              type="checkbox"
              name={name}
              value={item.id}
              disabled={item.disabled}
              checked={selected.includes(item.id)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...selected, item.id]
                    : selected.filter((id) => id !== item.id),
                )
              }
            />
            <span>
              {item.name}
              <small>{item.help}</small>
            </span>
          </label>
        ))}
        {!items.length && (
          <p className="selection-help">Aucun élément disponible.</p>
        )}
      </div>
    </fieldset>
  );
}
