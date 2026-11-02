export const adminRoles = [
  "Administrateur",
  "Modérateur",
  "Support",
  "Vétérinaire référent",
] as const;
export type AdminRole = (typeof adminRoles)[number];
export const adminResources = [
  "users",
  "pros",
  "reports",
  "appeals",
  "tickets",
  "imports",
  "feedback",
  "announcements",
  "library",
  "team",
  "security",
  "history",
  "alerts",
  "deletions",
] as const;
export type AdminResource = (typeof adminResources)[number];
export const roleResources: Record<AdminRole, readonly AdminResource[]> = {
  Administrateur: adminResources,
  Modérateur: ["reports", "appeals", "alerts", "team"],
  Support: ["users", "tickets", "imports", "feedback", "alerts", "team"],
  "Vétérinaire référent": ["library"],
};
export interface AdminEntry {
  date: string;
  actor: string;
  action: string;
  note: string;
}
export interface ArticleVersion {
  number: number;
  title: string;
  summary: string;
  body: string;
  status: string;
  review?: { reviewer: string; note: string; date: string };
  publishedAt?: string;
}
export interface Proof {
  id: string;
  name: string;
  status: string;
  applicable: boolean;
  expires: string;
  note: string;
  history?: AdminEntry[];
  /** Fichier reçu et conservé par l’administration (PDF, JPEG ou PNG). */
  file?: boolean;
  fileName?: string;
}
/** Niveau de confiance d’une fiche professionnelle, déduit de son dossier. */
export type ProLevel =
  "Dossier vérifié" | "Pièces à compléter" | "Vérification en cours";
/** Projection des dossiers d'administration ; les données privées des carnets en sont exclues. */
export interface AdminRecord {
  id: string;
  name: string;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  email?: string;
  category?: string;
  city?: string;
  role?: string;
  account?: string;
  message?: string;
  note?: string;
  audience?: string;
  reference?: string;
  target?: string;
  targetType?: string;
  priority?: string;
  assignee?: string;
  summary?: string;
  body?: string;
  siret?: string;
  read?: boolean;
  history?: AdminEntry[];
  versions?: ArticleVersion[];
  documents?: Proof[];
  source?: string;
  resource?: AdminResource;
  ticketId?: string;
  feedbackId?: string;
  importId?: string;
  firstResponseAt?: string;
  responseDueAt?: string;
  responseLate?: boolean;
  /** Professionnels : niveau du dossier. */
  level?: ProLevel;
  /** Comptes : visibilité des fiches publiques (Visible ou Masqué). */
  visibility?: string;
  /** Comptes : Particulier ou Professionnel. */
  accountType?: string;
  /** Signalements : cible, décisions possibles et compte sanctionnable. */
  targetName?: string;
  targetStatus?: string;
  choices?: string[];
  sanctionable?: boolean;
  /** Sanction appliquée au compte signalé lors de la décision. */
  accountAction?: string;
  /** Demandes d’assistance : membres à qui attribuer. */
  assignees?: string[];
  /** Annonces diffusées : destinataires concernés au moment de la diffusion. */
  recipients?: number;
  /** Imports et alertes de sécurité : nature et constat. */
  kind?: string;
  issue?: string;
  /** Équipe : invitation en attente, avec sa date limite. */
  invitation?: boolean;
  expiresAt?: string;
}
export interface AdminIndicator {
  id: string;
  label: string;
  resource: AdminResource;
  query: string;
  count: number;
  icon: string;
}
export interface AdminList {
  items: AdminRecord[];
  total: number;
  page: number;
  pageSize: number;
  statuses: string[];
}
export interface AdminOverview {
  role: AdminRole;
  counts: Partial<Record<AdminResource, number>>;
  attention: { resource: AdminResource; count: number; label: string }[];
  recent: AdminRecord[];
  metrics: { label: string; value: number; description: string }[];
  indicators: AdminIndicator[];
  pending: {
    resource: AdminResource;
    label: string;
    total: number;
    items: AdminRecord[];
  }[];
  unread: number;
}
