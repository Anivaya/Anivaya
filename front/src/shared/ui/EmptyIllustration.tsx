const images = {
  animals: "gamelle-vide",
  people: "aucune-personne",
  documents: "aucun-document",
  actions: "aucune-action",
  conversations: "aucune-conversation",
  events: "aucun-evenement",
  communities: "aucune-communaute",
  reminders: "aucun-rappel",
  data: "aucune-donnee",
} as const;

export type EmptyKind = keyof typeof images;

/** Illustration décorative : le titre et l’explication sont affichés par EmptyState. */
export default function EmptyIllustration({ kind }: { kind: EmptyKind }) {
  return (
    <img
      className="empty-illustration"
      src={`/images/empty-state/${images[kind]}.png`}
      alt=""
      width={180}
      height={180}
      loading="lazy"
      decoding="async"
    />
  );
}
