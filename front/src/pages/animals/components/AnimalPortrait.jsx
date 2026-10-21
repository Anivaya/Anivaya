import Icon from "../../../shared/ui/Icon.jsx";
export default function AnimalPortrait({ pet }) {
  return pet.photo ? (
    <img className="portrait" src={pet.photo} alt={pet.name} />
  ) : (
    <span
      className={`portrait record-portrait ${pet.style}`}
      role="img"
      aria-label={`Photo illustrative de ${pet.name}`}
    >
      {pet.style === "new" && <Icon name="paw" />}
    </span>
  );
}
