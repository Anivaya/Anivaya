import EmptyIllustration, { type EmptyKind } from "./EmptyIllustration.tsx";
import type { ReactNode } from "react";

const messages: Record<EmptyKind, { title: string; description: string }> = {
  animals: {
    title: "Aucun animal pour le moment",
    description: "Les carnets de vos compagnons apparaîtront ici.",
  },
  people: {
    title: "Aucune personne à afficher",
    description: "Les personnes associées à cet espace apparaîtront ici.",
  },
  documents: {
    title: "Aucun document pour le moment",
    description: "Les documents enregistrés apparaîtront ici.",
  },
  actions: {
    title: "Aucune action pour le moment",
    description: "Les actions de cet espace apparaîtront ici.",
  },
  conversations: {
    title: "Aucune conversation pour le moment",
    description: "Vos échanges apparaîtront ici.",
  },
  events: {
    title: "Aucun événement pour le moment",
    description: "Les prochains événements apparaîtront ici.",
  },
  communities: {
    title: "Aucune communauté pour le moment",
    description: "Les communautés disponibles apparaîtront ici.",
  },
  reminders: {
    title: "Aucun rappel pour le moment",
    description: "Les échéances de vos compagnons apparaîtront ici.",
  },
  data: {
    title: "Aucune donnée à afficher",
    description:
      "Les résultats apparaîtront lorsque des données seront disponibles.",
  },
};

/** À afficher après le chargement réussi d’une liste ou d’un bloc sans contenu. */
export default function EmptyState({
  kind,
  className = "",
  compact = false,
  size,
  title,
  description,
  filtered = false,
}: {
  kind: EmptyKind;
  className?: string;
  compact?: boolean;
  /** Petits indicateurs et lignes de synthèse ; compact pour les cartes ordinaires. */
  size?: "metric" | "inline";
  title?: string;
  description?: ReactNode;
  filtered?: boolean;
}) {
  const density = size ?? (compact ? "compact" : "standard");
  const heading = filtered ? "Aucun résultat" : (title ?? messages[kind].title);
  const copy = filtered
    ? "Modifiez votre recherche ou vos filtres pour retrouver les résultats."
    : (description ?? messages[kind].description);
  return (
    <div className={`empty-state empty-state-${density} ${className}`}>
      <EmptyIllustration kind={kind} />
      <div className="empty-state-copy">
        <p className="empty-state-title">{heading}</p>
        {copy && <p className="empty-state-description">{copy}</p>}
      </div>
    </div>
  );
}
