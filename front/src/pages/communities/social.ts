import { uiLocale } from "../../shared/i18n/locale.ts";
import type { SocialData, Thread } from "../../../../shared/social.ts";

export type SocialTab = "communautes" | "evenements" | "messagerie";
export const socialTabs: [SocialTab, string][] = [
  ["communautes", "Communautés"],
  ["evenements", "Événements"],
  ["messagerie", "Messagerie"],
];

/** Lien interne vers un onglet ou un élément de la page Communautés. */
export const socialHref = (tab: SocialTab, id = "") =>
  `#communautes/${tab}${id ? `/${encodeURIComponent(id)}` : ""}`;

export const personName = (data: SocialData, id: string | null) =>
  data.people.find((p) => p.id === id)?.name || "Ancien membre";

export const personInitials = (data: SocialData, id: string) =>
  personName(data, id)
    .split(/\s+/)
    .map((x) => x[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export const threadName = (data: SocialData, thread: Thread) =>
  thread.kind === "direct"
    ? thread.members
        .filter((id) => id !== data.me)
        .map((id) => personName(data, id))
        .join(", ") || "Ancien membre"
    : thread.name;

export const threadKinds: Record<Thread["kind"], string> = {
  direct: "Discussion privée",
  private: "Groupe privé",
  community: "Communauté",
  event: "Événement",
};

export const dateText = (value: string) =>
  new Date(value).toLocaleString(uiLocale(), {
    weekday: "short",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

export const isPast = (date: string) => Date.parse(date) <= Date.now();

export const friendship = (data: SocialData, id: string) =>
  data.friends.find(
    (f) =>
      (f.from === data.me && f.to === id) ||
      (f.from === id && f.to === data.me),
  );

/** Valeur pour un champ datetime-local à partir d’une date ISO. */
export const localDateTime = (iso: string) => {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};

export const PAGE_SIZE = 9;
export const MESSAGE_PAGE = 20;

export type RunResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };
export interface Draft {
  text: string;
  photo?: { type: string; content: string };
}
/** Fenêtres de la page ; `back` rouvre la fenêtre précédente (liste des membres). */
export type SocialDialog = (
  | {
      kind: "confirm";
      title: string;
      text: string;
      label: string;
      message: string;
      work: () => Promise<unknown>;
    }
  | { kind: "community-editor"; id?: string }
  | { kind: "event-editor"; id?: string; community?: string }
  | { kind: "members"; ids: string[]; owner: string | null; thread?: string }
  | { kind: "person"; id: string }
  | { kind: "options"; id: string }
  | { kind: "friends" }
  | { kind: "new-thread"; group: boolean; existing?: string }
  | { kind: "report"; type: "person" | "message"; target: string }
  | { kind: "photo"; src: string; alt: string }
) & { back?: SocialDialog };

export interface SocialContext {
  data: SocialData;
  /** Appel à l’API, puis rechargement et confirmation ; l’erreur est renvoyée à l’appelant. */
  run: <T>(work: () => Promise<T>, message?: string) => Promise<RunResult<T>>;
  /** Comme `run`, mais l’erreur s’affiche en haut de la page. */
  act: (work: () => Promise<unknown>, message?: string) => void;
  open: (dialog: SocialDialog) => void;
  reload: () => Promise<void>;
  drafts: Map<string, Draft>;
}
