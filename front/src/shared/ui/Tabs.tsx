/**
 * Onglets accessibles : flèches gauche/droite, Début et Fin.
 * Chaque onglet `clé` contrôle le panneau `panel-clé`.
 */
export default function Tabs<K extends string>({
  label,
  tabs,
  active,
  onChange,
}: {
  label: string;
  tabs: readonly (readonly [K, string])[];
  active: K;
  onChange: (key: K) => void;
}) {
  const keys = tabs.map(([key]) => key);
  function select(key: K) {
    onChange(key);
    document.getElementById("tab-" + key)?.focus();
  }
  return (
    <div className="settings-tabs" role="tablist" aria-label={label}>
      {tabs.map(([key, text], index) => (
        <button
          key={key}
          type="button"
          id={"tab-" + key}
          role="tab"
          aria-controls={"panel-" + key}
          aria-selected={active === key}
          tabIndex={active === key ? 0 : -1}
          onClick={() => onChange(key)}
          onKeyDown={(event) => {
            const target = {
              Home: 0,
              End: keys.length - 1,
              ArrowLeft: (index + keys.length - 1) % keys.length,
              ArrowRight: (index + 1) % keys.length,
            }[event.key];
            if (target === undefined) return;
            event.preventDefault();
            select(keys[target]);
          }}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
