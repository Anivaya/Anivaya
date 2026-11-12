import type { Professional } from "../../shared/account.ts";

/** Réservées à la recette explicite ; aucun établissement ni rendez-vous réel. */
export const previewProfessionals: Professional[] = [
  {
    id: "preview-veterinaire", fictional: true,
    name: "Clinique des Compagnons", category: "Vétérinaire", city: "Lyon",
    district: "Lyon 3e", address: "Adresse fictive · Lyon 3e",
    species: ["Chien", "Chat"], mode: "En cabinet", icon: "medical",
    intro: "Consultations et suivi régulier des chiens et des chats.",
    about: "Cette clinique fictive permet de découvrir une fiche vétérinaire et de tester le parcours de réservation. Aucune consultation réelle n’est organisée.",
    hours: "Lundi au vendredi · 9 h – 18 h",
    services: [{ name: "Consultation générale", price: 45, duration: 30 }, { name: "Bilan annuel", price: 65, duration: 60 }],
  },
  {
    id: "preview-toilettage", fictional: true,
    name: "Atelier Pelage doux", category: "Toilettage", city: "Villeurbanne",
    district: "Villeurbanne", address: "Adresse fictive · Villeurbanne",
    species: ["Chien", "Chat"], mode: "En salon", icon: "scissors",
    intro: "Bain, brossage et toilettage au rythme de chaque animal.",
    about: "Ce salon fictif propose plusieurs prestations pour explorer les tarifs, les créneaux et les favoris. Aucune prestation réelle n’est organisée.",
    hours: "Mardi au samedi · 9 h – 18 h",
    services: [{ name: "Bain et brossage", price: 35, duration: 45 }, { name: "Toilettage complet", price: 60, duration: 90 }],
  },
  {
    id: "preview-education", fictional: true,
    name: "Les Pas complices", category: "Éducation", city: "Bron",
    district: "Bron", address: "Lieu fictif · Bron",
    species: ["Chien"], mode: "En extérieur", icon: "training",
    intro: "Éducation canine et accompagnement des habitudes du quotidien.",
    about: "Cette fiche fictive permet de tester la recherche par activité et les rendez-vous d’éducation canine. Aucune séance réelle n’est organisée.",
    hours: "Lundi au samedi · 9 h – 18 h",
    services: [{ name: "Premier bilan éducatif", price: 55, duration: 60 }, { name: "Séance de suivi", price: 40, duration: 45 }],
  },
];
