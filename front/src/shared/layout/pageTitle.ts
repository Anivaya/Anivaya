const titles: Record<string, string> = {
  accueil: "Accueil",
  connexion: "Connexion",
  inscription: "Inscription",
  espace: "Mon espace",
  animaux: "Mes animaux",
  documents: "Mes documents",
  rappels: "Mes rappels",
  profil: "Gestion de profil",
  annuaire: "Professionnels",
  reservations: "Réservations",
  partage: "Partage",
  communautes: "Communautés",
  notifications: "Notifications",
  contact: "Contact",
  informations: "Informations du service",
  urgence: "Fiche d’urgence",
  reinitialisation: "Réinitialisation du mot de passe",
  "mot-de-passe": "Nouveau mot de passe",
  desinscription: "Désinscription",
};
const publicTitles: Record<string, string> = {
  professionnels: "Professionnels",
  "pro-tarifs": "Professionnels",
  "pro-inscription": "Professionnels",
  cliniques: "Cliniques",
  "clinique-inscription": "Cliniques",
  "clinique-independance": "Cliniques",
  entreprises: "Entreprises",
  "entreprise-contact": "Entreprises",
  "entreprise-offre": "Entreprises",
  "informations-legales": "Informations légales",
  "mentions-legales": "Mentions légales",
  confidentialite: "Confidentialité",
  cookies: "Cookies",
};
const adminTitles: Record<string, string> = {
  dashboard: "Tableau de bord",
  utilisateurs: "Utilisateurs",
  professionnels: "Professionnels",
  moderation: "Modération",
  assistance: "Assistance",
  publications: "Publications",
  equipe: "Équipe",
  historique: "Historique",
  pilotage: "Pilotage",
  notifications: "Notifications",
  profil: "Gestion de profil",
  parametres: "Gestion de profil",
  annonces: "Publications",
  contenus: "Publications",
  reservations: "Professionnels",
};
const englishPublicTitles: Record<string, string> = {
  Accueil: "Home",
  Professionnels: "Professionals",
  Cliniques: "Clinics",
  Entreprises: "Businesses",
  "Informations légales": "Legal information",
  "Mentions légales": "Legal notice",
  Confidentialité: "Privacy",
  Cookies: "Cookies",
};
export function pageTitle(hash: string, homeView?: string, language = "fr") {
  const [page = "accueil", section = ""] = (
    hash.replace(/^#/, "").split("?")[0] || "accueil"
  ).split("/");
  const label =
    page === "admin"
      ? adminTitles[section || "dashboard"] || "Page introuvable"
      : page === "accueil"
        ? publicTitles[section] || publicTitles[homeView || ""] || "Accueil"
        : page === "contact" &&
            ["ressources", "service", "donnees"].includes(section)
          ? titles.informations
          : titles[page] || "Mon espace";
  return `Anivaya · ${page === "accueil" && language === "en" ? englishPublicTitles[label] || label : label}`;
}
