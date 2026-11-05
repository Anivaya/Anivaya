import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { Thread } from "../../../../shared/social.ts";
import { api, readFile } from "../../shared/services/api.ts";
import Icon from "../../shared/ui/Icon.tsx";
import Modal from "../../shared/ui/Modal.tsx";
import { matches } from "../../shared/utils/format.ts";
import { BackLink, Empty, IconButton } from "./Common.tsx";
import Discussion from "./Discussion.tsx";
import type { SocialContext } from "./social.ts";
import {
  friendship,
  personName,
  socialHref,
  threadKinds,
  threadName,
} from "./social.ts";

type KindFilter = "all" | "community" | "event" | "private";
const kindFilters: [KindFilter, string][] = [
  ["all", "Tous"],
  ["community", "Communautés"],
  ["event", "Événements"],
  ["private", "Privé"],
];
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const lastAt = (thread: { messages: { at: string }[] }) =>
  Date.parse(thread.messages.at(-1)?.at ?? "") || 0;

export default function Messaging({
  ctx,
  id,
  search,
  limit,
  onMore,
}: {
  ctx: SocialContext;
  id: string;
  search: string;
  limit: number;
  onMore: () => void;
}) {
  const { data } = ctx;
  const [kind, setKind] = useState<KindFilter>("all");
  // Sous-filtres de « Privé » : type de discussion et non lues.
  const [privateKind, setPrivateKind] = useState<"" | "direct" | "private">("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const threads = data.threads
    .filter((t) => {
      if (kind === "private") {
        if (t.kind !== "direct" && t.kind !== "private") return false;
        if (privateKind && t.kind !== privateKind) return false;
        if (unreadOnly && !t.unread) return false;
      } else if (kind !== "all" && t.kind !== kind) return false;
      return matches(threadName(data, t), search);
    })
    .sort((a, b) => lastAt(b) - lastAt(a));
  const thread = id ? data.threads.find((t) => t.id === id) : undefined;
  return (
    <div className={`messaging-layout ${id ? "chat-selected" : ""}`}>
      <aside className="conversation-list">
        <div className="conversation-tools">
          <div
            className="conversation-filters"
            role="group"
            aria-label="Type de discussion"
          >
            {kindFilters.map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={kind === key}
                onClick={() => setKind(key)}
              >
                {label}
              </button>
            ))}
          </div>
          {kind === "private" && (
            <div className="conversation-subfilters">
              <div role="group" aria-label="Filtrer les discussions privées">
                {(
                  [
                    ["direct", "Discussion privée"],
                    ["private", "Groupe privé"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={privateKind === key}
                    onClick={() =>
                      setPrivateKind(privateKind === key ? "" : key)
                    }
                  >
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  aria-pressed={unreadOnly}
                  onClick={() => setUnreadOnly(!unreadOnly)}
                >
                  Non lues
                </button>
              </div>
              <div className="conversation-shortcuts">
                <IconButton
                  label="Mes amis"
                  icon="people"
                  onClick={() => ctx.open({ kind: "friends" })}
                />
                <IconButton
                  label="Créer un groupe privé"
                  icon="group-add"
                  onClick={() => ctx.open({ kind: "new-thread", group: true })}
                />
              </div>
            </div>
          )}
        </div>
        <div className="conversation-scroll">
          {threads.slice(0, limit).map((t) => (
            <a
              key={t.id}
              href={socialHref("messagerie", t.id)}
              className={`conversation-item ${t.id === id ? "active" : ""}`}
              aria-current={t.id === id ? "true" : undefined}
            >
              <ThreadAvatar thread={t} />
              <span>
                <strong>{threadName(data, t)}</strong>
                <small>{threadKinds[t.kind]}</small>
                <span>{t.messages.at(-1)?.text || "Aucun message"}</span>
              </span>
              {t.unread > 0 && <b className="unread-dot">{t.unread}</b>}
            </a>
          ))}
          {!threads.length && (
            <Empty
              title={
                data.threads.length
                  ? "Aucune discussion trouvée"
                  : "Aucune discussion pour le moment"
              }
            >
              {data.threads.length
                ? "Modifiez votre recherche ou vos filtres."
                : "Commencez une conversation avec un membre."}
            </Empty>
          )}
          {threads.length > limit && (
            <button type="button" className="button outline" onClick={onMore}>
              Afficher plus
            </button>
          )}
        </div>
      </aside>
      <section className="conversation-detail">
        {thread ? (
          <Conversation key={thread.id} ctx={ctx} thread={thread} />
        ) : id ? (
          <Empty kind={null} title="Discussion inaccessible">
            Vous avez quitté ce groupe ou un échange a été bloqué.
          </Empty>
        ) : (
          <Empty title="Un petit message, un nouveau lien">
            Choisissez une conversation ou écrivez à une personne rencontrée
            dans votre communauté.
          </Empty>
        )}
      </section>
    </div>
  );
}

function ThreadAvatar({ thread }: { thread: Thread }) {
  return (
    <span className="social-avatar">
      {thread.photo ? (
        <img src={thread.photo} alt="" />
      ) : (
        <Icon name={thread.kind === "direct" ? "chat" : "people"} />
      )}
    </span>
  );
}

/** En-tête de la discussion ouverte : profil, recherche, paramètres, puis l’historique. */
function Conversation({ ctx, thread }: { ctx: SocialContext; thread: Thread }) {
  const { data } = ctx;
  const [searching, setSearching] = useState(false);
  const [focus, setFocus] = useState<{ id: string; nonce: number }>();
  const [renaming, setRenaming] = useState(false);
  const other =
    thread.kind === "direct"
      ? thread.members.find((m) => m !== data.me)
      : undefined;
  return (
    <>
      <div className="conversation-header">
        <BackLink tab="messagerie" className="mobile-chat-back" />
        <ThreadAvatar thread={thread} />
        <div className="conversation-title">
          <h2>{threadName(data, thread)}</h2>
          <small>{thread.members.length} participants</small>
        </div>
        <div className="social-actions">
          <IconButton
            label="Rechercher dans la conversation"
            icon="search"
            className={searching ? "active" : ""}
            onClick={() => setSearching(!searching)}
          />
          {other ? (
            <IconButton
              label="Voir le profil"
              icon="user"
              onClick={() => ctx.open({ kind: "person", id: other })}
            />
          ) : (
            <IconButton
              label="Voir les membres"
              icon="people"
              onClick={() =>
                ctx.open({
                  kind: "members",
                  ids: thread.members,
                  owner: thread.owner,
                  thread: thread.kind === "private" ? thread.id : undefined,
                })
              }
            />
          )}
          {(thread.kind === "community" || thread.kind === "event") && (
            <a
              className="button outline"
              href={socialHref(
                thread.kind === "community" ? "communautes" : "evenements",
                thread.ref,
              )}
            >
              Voir{" "}
              {thread.kind === "community" ? "la communauté" : "l’événement"}
            </a>
          )}
          <ThreadSettings
            ctx={ctx}
            thread={thread}
            other={other}
            onRename={() => setRenaming(true)}
          />
        </div>
      </div>
      {searching && (
        <MessageSearch
          ctx={ctx}
          thread={thread}
          onSelect={(messageId) =>
            setFocus({ id: messageId, nonce: Date.now() })
          }
          onClose={() => setSearching(false)}
        />
      )}
      <Discussion ctx={ctx} thread={thread} focus={focus} />
      {renaming && (
        <RenameDialog
          ctx={ctx}
          thread={thread}
          onClose={() => setRenaming(false)}
        />
      )}
    </>
  );
}

/** Menu des réglages : réservé aux discussions privées et à l’organisateur. */
function ThreadSettings({
  ctx,
  thread,
  other,
  onRename,
}: {
  ctx: SocialContext;
  thread: Thread;
  other: string | undefined;
  onRename: () => void;
}) {
  const { data } = ctx;
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const organizer =
    (thread.kind === "community" &&
      data.communities.find((g) => g.id === thread.ref)?.owner === data.me) ||
    (thread.kind === "event" &&
      data.events.find((e) => e.id === thread.ref)?.owner === data.me);
  const manager = thread.kind === "private" || organizer;
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (
        event instanceof KeyboardEvent
          ? event.key === "Escape"
          : !menu.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  if (!manager && !other) return null;

  const entries: [string, string, () => void, boolean?][] = [];
  if (other) {
    const f = friendship(data, other);
    const name = personName(data, other);
    const blockedByMe = data.myBlocks.includes(other);
    if (!data.blocked.includes(other))
      entries.push(
        f?.status === "accepted"
          ? [
              "Retirer de mes amis",
              "close",
              () =>
                ctx.act(
                  () => api.friend(other, "remove"),
                  "Relation mise à jour.",
                ),
              true,
            ]
          : f?.status === "pending"
            ? f.to === data.me
              ? [
                  "Accepter la demande d’amitié",
                  "check",
                  () =>
                    ctx.act(
                      () => api.friend(other, "accept"),
                      "Relation mise à jour.",
                    ),
                ]
              : [
                  "Annuler ma demande d’amitié",
                  "close",
                  () =>
                    ctx.act(
                      () => api.friend(other, "remove"),
                      "Relation mise à jour.",
                    ),
                  true,
                ]
            : [
                "Ajouter en ami",
                "friend",
                () =>
                  ctx.act(
                    () => api.friend(other, "request"),
                    "Demande d’amitié envoyée.",
                  ),
              ],
      );
    entries.push(
      blockedByMe
        ? [
            "Débloquer",
            "block",
            () => ctx.act(() => api.block(other, false), "Personne débloquée."),
          ]
        : [
            "Bloquer",
            "block",
            () =>
              ctx.open({
                kind: "confirm",
                title: `Bloquer ${name} ?`,
                text: "Ses messages seront masqués et les échanges privés seront bloqués. Vous pourrez la débloquer depuis son profil.",
                label: "Bloquer",
                message: "Personne bloquée.",
                work: () => api.block(other, true),
              }),
            true,
          ],
      [
        "Signaler cette personne",
        "flag",
        () => ctx.open({ kind: "report", type: "person", target: other }),
        true,
      ],
    );
  }
  if (manager) {
    entries.push(
      [
        thread.kind === "private" ? "Renommer le groupe" : "Renommer",
        "edit",
        onRename,
      ],
      [
        thread.photo ? "Changer la photo" : "Ajouter une photo",
        "image",
        () => document.getElementById("thread-photo-input")?.click(),
      ],
    );
    if (thread.photo)
      entries.push([
        "Retirer la photo",
        "trash",
        () =>
          ctx.act(
            () => api.updateThread(thread.id, { photo: null }),
            "Photo retirée.",
          ),
        true,
      ]);
  }
  if (organizer)
    entries.push([
      thread.kind === "community"
        ? "Modifier la communauté"
        : "Modifier l’événement",
      "settings",
      () =>
        ctx.open(
          thread.kind === "community"
            ? { kind: "community-editor", id: thread.ref }
            : { kind: "event-editor", id: thread.ref },
        ),
    ]);
  if (thread.kind === "private") {
    if (thread.owner === data.me)
      entries.push([
        "Ajouter des personnes",
        "group-add",
        () =>
          ctx.open({ kind: "new-thread", group: true, existing: thread.id }),
      ]);
    entries.push([
      "Quitter le groupe",
      "logout",
      () =>
        ctx.open({
          kind: "confirm",
          title: "Quitter le groupe privé ?",
          text: "Vous ne pourrez plus consulter ses messages. Si vous êtes le créateur, la gestion passera à un autre membre.",
          label: "Quitter le groupe",
          message: "Vous avez quitté le groupe.",
          work: async () => {
            await api.leaveThread(thread.id);
            window.location.hash = socialHref("messagerie");
          },
        }),
      true,
    ]);
  }

  return (
    <div className="thread-settings" ref={menu}>
      <IconButton
        label="Paramètres de la conversation"
        icon="settings"
        className={open ? "active" : ""}
        onClick={() => setOpen(!open)}
      />
      {open && (
        <div className="thread-menu" role="menu">
          {entries.map(([label, icon, action, danger]) => (
            <button
              key={label}
              type="button"
              role="menuitem"
              className={danger ? "danger" : ""}
              onClick={() => {
                setOpen(false);
                action();
              }}
            >
              <Icon name={icon} />
              {label}
            </button>
          ))}
        </div>
      )}
      <input
        id="thread-photo-input"
        type="file"
        hidden
        accept={PHOTO_TYPES.join(",")}
        aria-label="Photo de la conversation (1 Mo maximum)"
        onChange={async (e) => {
          const chosen = e.target.files?.[0];
          e.target.value = "";
          if (!chosen) return;
          if (!PHOTO_TYPES.includes(chosen.type) || chosen.size > 1024 * 1024) {
            ctx.act(async () => {
              throw new Error(
                "Choisissez une photo JPG, PNG ou WebP de moins de 1 Mo.",
              );
            });
            return;
          }
          const content = await readFile(chosen);
          ctx.act(
            () =>
              api.updateThread(thread.id, {
                photo: { type: chosen.type, content },
              }),
            "Photo de la conversation mise à jour.",
          );
        }}
      />
    </div>
  );
}

function RenameDialog({
  ctx,
  thread,
  onClose,
}: {
  ctx: SocialContext;
  thread: Thread;
  onClose: () => void;
}) {
  const [name, setName] = useState(thread.name);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal busy={busy} onClose={onClose}>
      <h2 id="action-title">Renommer la conversation</h2>
      <form
        noValidate
        onSubmit={async (event) => {
          event.preventDefault();
          if (name.trim().length < 2) {
            setError("Le nom doit comporter au moins 2 caractères.");
            return;
          }
          setBusy(true);
          const result = await ctx.run(
            () => api.updateThread(thread.id, { name: name.trim() }),
            "Conversation renommée.",
          );
          setBusy(false);
          if (result.ok) onClose();
          else setError(result.error);
        }}
      >
        <div className="field">
          <label htmlFor="thread-name">Nom</label>
          <input
            id="thread-name"
            maxLength={90}
            value={name}
            autoFocus
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            aria-describedby="thread-name-error"
          />
          <span id="thread-name-error" className="social-error" role="alert">
            {error}
          </span>
        </div>
        {thread.kind !== "private" && (
          <p className="social-copy">
            Le nom de la{" "}
            {thread.kind === "community" ? "communauté" : "l’événement"} change
            aussi.
          </p>
        )}
        <div className="dialog-actions">
          <button
            type="button"
            className="button outline cancel"
            onClick={onClose}
          >
            Annuler
          </button>
          <button type="submit" className="button" disabled={busy}>
            Renommer
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Insensible aux accents et à la casse. */
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("fr");

/**
 * Recherche dans toute la discussion, messages anciens compris. Flèches haut/bas pour
 * parcourir les résultats, Entrée ou Tab pour aller au message.
 */
function MessageSearch({
  ctx,
  thread,
  onSelect,
  onClose,
}: {
  ctx: SocialContext;
  thread: Thread;
  onSelect: (messageId: string) => void;
  onClose: () => void;
}) {
  const { data } = ctx;
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const needle = normalize(query.trim());
  const results = needle
    ? thread.messages
        .filter(
          (m) =>
            !data.blocked.includes(m.sender) &&
            normalize(m.text).includes(needle),
        )
        .reverse()
    : [];
  const current = Math.min(active, Math.max(results.length - 1, 0));
  // Le résultat actif reste visible dans la liste pendant la navigation au clavier.
  useEffect(() => {
    document
      .getElementById(`search-result-${current}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [current, needle]);
  function choose(index: number) {
    const message = results[index];
    if (!message) return;
    setActive(index);
    onSelect(message.id);
  }
  function keyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!results.length) return;
      setActive(
        (current + (event.key === "ArrowDown" ? 1 : results.length - 1)) %
          results.length,
      );
    } else if (
      (event.key === "Enter" || event.key === "Tab") &&
      results.length
    ) {
      event.preventDefault();
      choose(current);
    } else if (event.key === "Escape") onClose();
  }
  /** Extrait autour de l’occurrence, l’occurrence mise en évidence. */
  function snippet(text: string) {
    const start = normalize(text).indexOf(needle);
    const from = Math.max(0, start - 30);
    return (
      <>
        {from > 0 && "…"}
        {text.slice(from, start)}
        <mark>{text.slice(start, start + needle.length)}</mark>
        {text.slice(start + needle.length, start + needle.length + 60)}
        {start + needle.length + 60 < text.length && "…"}
      </>
    );
  }
  return (
    <div className="message-search">
      <div className="message-search-field">
        <Icon name="search" />
        <input
          type="search"
          autoFocus
          placeholder="Rechercher dans la conversation…"
          aria-label="Rechercher dans la conversation"
          aria-controls="message-search-results"
          aria-activedescendant={
            results.length ? `search-result-${current}` : undefined
          }
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={keyDown}
        />
        <IconButton
          label="Fermer la recherche"
          icon="close"
          className="close-icon"
          onClick={onClose}
        />
      </div>
      {needle && (
        <p className="message-search-count" role="status">
          {results.length
            ? `${results.length} résultat(s) · ↑ ↓ pour parcourir, Entrée pour afficher`
            : "Aucun message ne contient ce texte."}
        </p>
      )}
      {results.length > 0 && (
        <ul id="message-search-results" role="listbox">
          {results.map((m, index) => (
            <li
              key={m.id}
              id={`search-result-${index}`}
              role="option"
              aria-selected={index === current}
              className={index === current ? "active" : ""}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(index)}
            >
              <strong>{personName(data, m.sender)}</strong>
              <time dateTime={m.at}>
                {new Date(m.at).toLocaleString("fr-FR", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
              <span>{snippet(m.text)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
