export default function CollectionFilters({
  search,
  onSearch,
  animal,
  onAnimal,
  animals,
  filter,
  onFilter,
  options,
  label,
}) {
  return (
    <div className="collection-filters">
      <input
        aria-label="Rechercher par nom"
        placeholder="Rechercher par nom…"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
      />
      <select
        aria-label="Filtrer par animal"
        value={animal}
        onChange={(e) => onAnimal(e.target.value)}
      >
        <option value="">Tous les animaux</option>
        {animals.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <select
        aria-label={label}
        value={filter}
        onChange={(e) => onFilter(e.target.value)}
      >
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}
