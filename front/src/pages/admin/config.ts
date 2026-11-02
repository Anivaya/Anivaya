import type {
  AdminResource,
  AdminRole,
  AdminRecord,
} from "../../../../shared/admin.ts";
export const adminPages: Record<
  string,
  {
    title: string;
    intro: string;
    icon: string;
    tabs: readonly (readonly [AdminResource, string])[];
  }
> = {
  dashboard: {
    title: "Tableau de bord",
    intro: "Les demandes à traiter et l’activité de votre plateforme.",
    icon: "home",
    tabs: [],
  },
  utilisateurs: {
    title: "Utilisateurs",
    intro:
      "Accompagnez les utilisateurs et gérez les demandes liées à leur compte.",
    icon: "people",
    tabs: [
      ["users", "Comptes"],
      ["deletions", "Demandes de suppression"],
    ],
  },
  professionnels: {
    title: "Professionnels",
    intro: "Vérifiez les inscriptions et maintenez un annuaire fiable.",
    icon: "medical",
    tabs: [["pros", "Professionnels"]],
  },
  moderation: {
    title: "Modération",
    intro: "Examinez les signalements sur les fiches publiques et l’annuaire.",
    icon: "shield",
    tabs: [
      ["reports", "Signalements"],
      ["appeals", "Recours"],
    ],
  },
  assistance: {
    title: "Assistance",
    intro: "Répondez aux demandes et suivez les imports de documents.",
    icon: "headset",
    tabs: [
      ["tickets", "Demandes"],
      ["imports", "Imports IA"],
      ["feedback", "Retours utilisateurs"],
    ],
  },
  publications: {
    title: "Publications",
    intro: "Diffusez une annonce ou préparez un guide relu et validé.",
    icon: "file",
    tabs: [
      ["announcements", "Annonces"],
      ["library", "Contenus validés"],
    ],
  },
  equipe: {
    title: "Équipe",
    intro: "Gérez les membres et leurs droits d’accès.",
    icon: "people",
    tabs: [["team", "Membres"]],
  },
  historique: {
    title: "Historique",
    intro: "Consultez et exportez les actions d’administration.",
    icon: "clock",
    tabs: [["history", "Historique"]],
  },
  pilotage: {
    title: "Pilotage",
    intro: "Suivez l’activation et la rétention des foyers et des animaux.",
    icon: "chart",
    tabs: [],
  },
  notifications: {
    title: "Notifications",
    intro: "Vos alertes et les nouvelles qui demandent votre attention.",
    icon: "bell",
    tabs: [["alerts", "Notifications"]],
  },
  profil: {
    title: "Gestion de profil",
    intro: "Vos informations personnelles et les réglages de sécurité.",
    icon: "person",
    tabs: [],
  },
  parametres: {
    title: "Sécurité",
    intro: "Consultez les sessions actives et révoquez les accès inutilisés.",
    icon: "shield",
    tabs: [["security", "Sessions"]],
  },
};
export const adminLink = (resource: AdminResource) => {
  const page =
    Object.entries(adminPages).find(([, p]) =>
      p.tabs.some(([r]) => r === resource),
    )?.[0] || "dashboard";
  return `#admin/${page}/${resource}`;
};
export function actionsFor(
  resource: AdminResource,
  row: AdminRecord,
  role: AdminRole,
): { id: string; label: string }[] {
  const admin = role === "Administrateur";
  if (resource === "library") {
    const state = row.versions?.at(-1)?.status;
    if (role === "Vétérinaire référent")
      return state === "À relire"
        ? [{ id: "review", label: "Enregistrer la relecture" }]
        : [];
    if (!admin) return [];
    return [
      ...(["Brouillon", "À corriger"].includes(state || "")
        ? [
            { id: "save", label: "Modifier le guide" },
            { id: "submit", label: "Demander une relecture" },
          ]
        : []),
      ...(state === "Validé" ? [{ id: "publish", label: "Publier" }] : []),
      ...(["Publié", "Archivé", "Validé"].includes(state || "")
        ? [{ id: "version", label: "Créer une nouvelle version" }]
        : []),
      ...(row.versions?.some((v) => v.status === "Publié")
        ? [{ id: "unpublish", label: "Retirer de la publication" }]
        : []),
      { id: "delete", label: "Supprimer le contenu" },
    ];
  }
  if (resource === "reports")
    return [
      {
        id: row.status === "À traiter" ? "decide" : "reopen",
        label:
          row.status === "À traiter"
            ? "Prendre une décision"
            : "Rouvrir le dossier",
      },
      { id: "priority", label: "Modifier la priorité" },
    ];
  if (resource === "appeals")
    return row.status === "À examiner"
      ? [{ id: "decide", label: "Répondre au recours" }]
      : [];
  if (resource === "alerts")
    return row.status === "Résolue"
      ? []
      : [
          {
            id: row.read ? "unread" : "read",
            label: row.read ? "Marquer comme non lue" : "Marquer comme lue",
          },
        ];
  if (resource === "tickets" || resource === "feedback")
    return [
      {
        id: "reply",
        label:
          resource === "tickets"
            ? "Répondre et mettre à jour"
            : "Examiner le retour",
      },
      ...(resource === "feedback" && !row.ticketId
        ? [{ id: "ticket", label: "Transmettre au support" }]
        : []),
    ];
  if (resource === "imports")
    return [
      ...(!["Terminé", "Pris en charge"].includes(row.status)
        ? [{ id: "retry", label: "Relancer l’extraction" }]
        : []),
      ...(!row.ticketId
        ? [{ id: "incident", label: "Créer un ticket d’incident" }]
        : []),
    ];
  if (!admin) return [];
  if (resource === "team" && row.invitation)
    return [
      { id: "renew", label: "Prolonger l’invitation" },
      { id: "cancel", label: "Annuler l’invitation" },
    ];
  if (resource === "users" || resource === "team")
    return [
      { id: "edit", label: "Modifier les coordonnées" },
      {
        id: "save",
        label:
          resource === "team"
            ? "Modifier les accès"
            : "Modifier l’état du compte",
      },
      ...(resource === "users"
        ? [
            {
              id: "reset",
              label: "Préparer une réinitialisation du mot de passe",
            },
          ]
        : []),
    ];
  if (resource === "deletions")
    return row.status === "À traiter"
      ? [
          { id: "delete", label: "Supprimer le compte" },
          { id: "decline", label: "Refuser la demande" },
        ]
      : [];
  if (resource === "pros")
    return [
      { id: "edit", label: "Modifier les coordonnées" },
      { id: "save", label: "Examiner le dossier" },
      ...(row.documents?.map((d) => ({
        id: "proof:" + d.id,
        label: "Vérifier : " + d.name,
      })) || []),
    ];
  if (resource === "announcements")
    return row.status === "Brouillon"
      ? [
          { id: "save", label: "Modifier" },
          { id: "publish", label: "Publier" },
          { id: "delete", label: "Supprimer le brouillon" },
        ]
      : row.status === "Publié"
        ? [{ id: "unpublish", label: "Retirer de la publication" }]
        : [];
  if (resource === "security")
    return row.kind === "Session"
      ? [{ id: "revoke", label: "Révoquer cette session" }]
      : row.status === "À examiner"
        ? [{ id: "review", label: "Marquer comme examinée" }]
        : [];
  return [];
}

export function actionIcon(action: string, resource?: string) {
  if (action.startsWith("proof-file")) return "download";
  if (action.startsWith("proof")) return "shield";
  return (
    (
      {
        edit: "edit",
        save:
          resource === "users"
            ? "block"
            : resource === "pros"
              ? "shield"
              : "settings",
        delete: "trash",
        decline: "close",
        publish: "send",
        unpublish: "eye",
        reply: "chat",
        ticket: "headset",
        incident: "headset",
        priority: "flag",
        decide: "shield",
        reopen: "refresh",
        retry: "refresh",
        renew: "refresh",
        cancel: "close",
        reset: "lock",
        read: "check",
        unread: "bell",
        review: resource === "security" ? "check" : "medical",
        submit: "send",
        version: "plus",
        revoke: "lock",
      } as Record<string, string>
    )[action] || "edit"
  );
}
