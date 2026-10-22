import type { Animal } from "../types.ts";
export const animalName = (animals: Animal[], id: string | undefined) =>
  animals.find((animal) => animal.id === id)?.name || "Animal";
export const parseDate = (value: string) => new Date(`${value}T12:00:00`);
export const fullDate = (value: string) =>
  parseDate(value).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export const svgImage = (svg: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
