import { useText } from "../i18n/HomeLocale.tsx";
import type { Animal } from "../types.ts";
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
}: {
  search: string;
  onSearch: (value: string) => void;
  animal: string;
  onAnimal: (value: string) => void;
  animals: Animal[];
  filter: string;
  onFilter: (value: string) => void;
  options: [string, string][];
  label: string;
}) {
  const tr = useText();
  return (
    <div className="collection-filters">
      <input
        aria-label={tr("Rechercher par nom")}
        placeholder={tr("Rechercher par nom…")}
        value={search}
        onChange={(e) => onSearch(e.target.value)}
      />
      <select
        aria-label={tr("Filtrer par animal")}
        value={animal}
        onChange={(e) => onAnimal(e.target.value)}
      >
        <option value="">{tr("Tous les animaux")}</option>
        {animals.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <select
        aria-label={tr(label)}
        value={filter}
        onChange={(e) => onFilter(e.target.value)}
      >
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {tr(text)}
          </option>
        ))}
      </select>
    </div>
  );
}
