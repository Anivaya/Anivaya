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
  invitation: "Invitation à rejoindre l’équipe",
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
  "Tableau de bord": "Dashboard",
  Utilisateurs: "Users",
  Modération: "Moderation",
  Assistance: "Support",
  Publications: "Publications",
  Équipe: "Team",
  Historique: "History",
  Pilotage: "Analytics",
  "Page introuvable": "Page not found",
  Accueil: "Home",
  Connexion: "Sign in",
  Inscription: "Sign up",
  "Réinitialisation du mot de passe": "Password reset",
  "Nouveau mot de passe": "New password",
  Désinscription: "Unsubscribe",
  "Invitation à rejoindre l’équipe": "Team invitation",
  "Mon espace": "My space",
  "Mes animaux": "My animals",
  "Mes documents": "My documents",
  "Mes rappels": "My reminders",
  "Gestion de profil": "Profile settings",
  Réservations: "Bookings",
  Partage: "Sharing",
  Communautés: "Communities",
  Notifications: "Notifications",
  Contact: "Contact",
  "Informations du service": "About the service",
  "Fiche d’urgence": "Emergency sheet",
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
  return `Anivaya · ${language === "en" ? englishPublicTitles[label] || label : label}`;
}
