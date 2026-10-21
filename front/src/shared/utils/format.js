export const animalName = (animals, id) =>
  animals.find((animal) => animal.id === id)?.name || "Animal";
export const parseDate = (value) => new Date(`${value}T12:00:00`);
export const fullDate = (value) =>
  parseDate(value).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export const svgImage = (svg) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
