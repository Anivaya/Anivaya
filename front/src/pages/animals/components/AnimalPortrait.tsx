import { useText } from "../../../shared/i18n/HomeLocale.tsx";
import Icon from "../../../shared/ui/Icon.tsx";
export default function AnimalPortrait({
  pet,
}: {
  pet: { name: string; photo?: string | null; style?: string | null };
}) {
  const tr = useText();
  return pet.photo ? (
    <img className="portrait" src={pet.photo} alt={pet.name} />
  ) : (
    <span
      className={`portrait record-portrait ${pet.style}`}
      role="img"
      aria-label={tr("Photo illustrative de {0}", [pet.name])}
    >
      {pet.style === "new" && <Icon name="paw" />}
    </span>
  );
}
