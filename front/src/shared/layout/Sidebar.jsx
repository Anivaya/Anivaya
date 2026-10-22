import Icon from "../ui/Icon.jsx";
const navigation = [
  ["espace", "home", "Vue d’ensemble"],
  ["animaux", "paw", "Mes animaux"],
  ["documents", "file", "Documents"],
  ["rappels", "bell", "Rappels"],
  ["partage", "share", "Partage"],
];
export default function Sidebar({ page, household, onPublic }) {
  const fullName = household
    ? `${household.firstName} ${household.lastName}`
    : "Chargement…";
  return (
    <aside className="sidebar">
      <a
        className="app-brand"
        href="#espace"
        aria-label="Anivaya — Vue d’ensemble"
      >
        <img src="/images/logo.png" alt="Anivaya" width="78" height="69" />
      </a>
      <nav className="side-nav" aria-label="Navigation principale">
        {navigation.map(([id, icon, label]) => (
          <a
            key={id}
            href={`#${id}`}
            aria-current={page === id ? "page" : undefined}
          >
            <Icon name={icon} />
            {label}
          </a>
        ))}
      </nav>
      <div className="side-bottom">
        <button className="return-site" onClick={onPublic}>
          ↗ Retour au site public
        </button>
        <div className="user">
          <span className="initials">
            {household
              ? `${household.firstName[0]}${household.lastName[0]}`
              : "…"}
          </span>
          <div>
            {fullName}
            <small>{household?.label}</small>
          </div>
        </div>
      </div>
    </aside>
  );
}
