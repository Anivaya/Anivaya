import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Thread } from "../../../../shared/social.ts";
import { api, readFile } from "../../shared/services/api.ts";
import { errorMessage } from "../../shared/types.ts";
import Icon from "../../shared/ui/Icon.tsx";
import { Empty, IconButton, PersonLink } from "./Common.tsx";
import type { Draft, SocialContext } from "./social.ts";
import { MESSAGE_PAGE, personName } from "./social.ts";

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Historique et saisie d’une discussion. La discussion est marquée comme lue quand
 * son dernier message est visible, page au premier plan.
 */
export default function Discussion({
  ctx,
  thread,
  focus,
}: {
  ctx: SocialContext;
  thread: Thread | undefined;
  /** Message à afficher et encadrer (résultat de recherche) ; nonce relance l’effet. */
  focus?: { id: string; nonce: number };
}) {
  if (!thread)
    return (
      <Empty kind={null} title="Discussion inaccessible">
        Vous n’avez pas accès à cette conversation.
      </Empty>
    );
  return <ThreadView key={thread.id} ctx={ctx} thread={thread} focus={focus} />;
}

function ThreadView({
  ctx,
  thread,
  focus,
}: {
  ctx: SocialContext;
  thread: Thread;
  focus?: { id: string; nonce: number };
}) {
  const { data } = ctx;
  const [limit, setLimit] = useState(MESSAGE_PAGE);
  const [draft, setDraft] = useState<Draft>(
    () => ctx.drafts.get(thread.id) ?? { text: "" },
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const marking = useRef(false);
  const messages = thread.messages.filter(
    (m) => !data.blocked.includes(m.sender),
  );
  // Le message choisi dans la recherche est toujours chargé, même ancien.
  const focusIndex = focus ? messages.findIndex((m) => m.id === focus.id) : -1;
  const shown = Math.max(
    limit,
    focusIndex < 0 ? 0 : messages.length - focusIndex,
  );
  const visible = messages.slice(-shown);
  const last = thread.messages.at(-1);
  const lastId = last?.id;

  function update(next: Draft) {
    setDraft(next);
    ctx.drafts.set(thread.id, next);
  }

  // Reste en bas tant que l’utilisateur n’est pas remonté dans l’historique.
  const pinned = useRef(true);
  const stickToBottom = () => {
    const element = list.current;
    if (element && pinned.current) element.scrollTop = element.scrollHeight;
  };
  // À l’ouverture : bas de la discussion. Seule la messagerie amène la discussion à l’écran ;
  // les pages de communauté et d’événement s’ouvrent en haut.
  useEffect(() => {
    const element = list.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
    element.closest(".conversation-detail")?.scrollIntoView({ block: "end" });
  }, []);
  // Nouveau message : on suit s’il était déjà en bas.
  useEffect(stickToBottom, [lastId]);

  // Résultat de recherche : le message est centré, puis encadré par l’animation CSS.
  useEffect(() => {
    const element = list.current;
    const target = focus && document.getElementById("message-" + focus.id);
    if (!element || !target) return;
    pinned.current = false;
    element.scrollTop =
      target.offsetTop - element.clientHeight / 2 + target.clientHeight / 2;
  }, [focus]);

  // Messages plus anciens : chargés en arrivant en haut, position de lecture gardée.
  const hasOlder = messages.length > shown;
  function loadOlder() {
    const element = list.current!;
    const before = element.scrollHeight - element.scrollTop;
    setLimit(shown + MESSAGE_PAGE);
    requestAnimationFrame(
      () => (element.scrollTop = element.scrollHeight - before),
    );
  }
  // En bout d’historique, la molette fait défiler la page, sauf vers le haut tant
  // qu’il reste des messages à charger.
  useEffect(() => {
    const element = list.current;
    if (!element || !hasOlder) return;
    const wheel = (event: WheelEvent) => {
      if (event.deltaY >= 0 || element.scrollTop > 0) return;
      event.preventDefault();
      loadOlder();
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  });

  const unread = thread.unread;
  const reload = ctx.reload;
  useEffect(() => {
    const element = list.current,
      target = sentinel.current;
    if (!element || !target || !unread) return;
    const acknowledge = () => {
      if (
        marking.current ||
        document.visibilityState !== "visible" ||
        !document.hasFocus() ||
        element.scrollHeight - element.scrollTop - element.clientHeight > 24
      )
        return;
      marking.current = true;
      api
        .markThreadRead(thread.id)
        .then(reload)
        .catch(() => {})
        .finally(() => (marking.current = false));
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) acknowledge();
      },
      { root: element, threshold: 1 },
    );
    observer.observe(target);
    element.addEventListener("scroll", acknowledge, { passive: true });
    window.addEventListener("focus", acknowledge);
    document.addEventListener("visibilitychange", acknowledge);
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", acknowledge);
      window.removeEventListener("focus", acknowledge);
      document.removeEventListener("visibilitychange", acknowledge);
    };
  }, [reload, thread.id, unread]);

  async function attach(file: File | undefined) {
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type) || file.size > 1024 * 1024) {
      setError("Choisissez une photo JPG, PNG ou WebP de moins de 1 Mo.");
      return;
    }
    setBusy(true);
    try {
      update({
        ...draft,
        photo: { type: file.type, content: await readFile(file) },
      });
      setError("");
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) {
      setError("Patientez pendant le chargement de la photo.");
      return;
    }
    if (!draft.text.trim() && !draft.photo) {
      setError("Écrivez un message ou ajoutez une photo.");
      return;
    }
    setBusy(true);
    const result = await ctx.run(() =>
      api.sendMessage(thread.id, { text: draft.text, photo: draft.photo }),
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    ctx.drafts.delete(thread.id);
    setDraft({ text: "" });
    setError("");
    document.getElementById("message-text")?.focus();
  }

  return (
    <>
      <div
        className="message-window"
        ref={list}
        onScroll={(e) => {
          const element = e.currentTarget;
          pinned.current =
            element.scrollHeight - element.scrollTop - element.clientHeight <
            40;
          if (hasOlder && element.scrollTop < 8) loadOlder();
        }}
        tabIndex={0}
        aria-label="Historique de la discussion"
      >
        {hasOlder && (
          <div className="older-messages">
            <button
              type="button"
              className="button outline"
              onClick={loadOlder}
            >
              Voir les messages précédents
            </button>
          </div>
        )}
        <ol>
          {visible.map((m) => {
            const mine = m.sender === data.me;
            const latest = m.id === lastId;
            const read = latest && thread.latestRead;
            return (
              <li
                // Nouvelle clé à chaque choix : l’animation d’encadrement repart.
                key={m.id === focus?.id ? `${m.id}-${focus.nonce}` : m.id}
                id={"message-" + m.id}
                className={`social-message ${mine ? "mine" : ""} ${m.id === focus?.id ? "search-hit" : ""}`}
              >
                <PersonLink ctx={ctx} id={m.sender} avatar={!mine} />
                <div className="message-bubble">
                  {m.text && <p>{m.text}</p>}
                  {m.photo && (
                    <button
                      type="button"
                      className="message-photo"
                      aria-label="Agrandir la photo"
                      onClick={() =>
                        ctx.open({
                          kind: "photo",
                          src: m.photo!,
                          alt: `Photo partagée par ${personName(data, m.sender)}`,
                        })
                      }
                    >
                      <img
                        src={m.photo}
                        alt={`Photo partagée par ${personName(data, m.sender)}`}
                        width="240"
                        height="180"
                        onLoad={stickToBottom}
                      />
                    </button>
                  )}
                </div>
                <div className="message-meta">
                  <time dateTime={m.at}>
                    {new Date(m.at).toLocaleString("fr-FR", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                  {latest &&
                    (read ? (
                      <span className="read-receipt">
                        <Icon name="check-double" />
                        Lu
                      </span>
                    ) : (
                      mine && (
                        <span>
                          <Icon name="check" />
                          Envoyé
                        </span>
                      )
                    ))}
                  {mine && (
                    <IconButton
                      label="Supprimer mon message"
                      icon="trash"
                      danger
                      onClick={() =>
                        ctx.open({
                          kind: "confirm",
                          title: "Supprimer votre message ?",
                          text: "Il disparaîtra de cette discussion pour tous les participants.",
                          label: "Supprimer",
                          message: "Message supprimé.",
                          work: () => api.deleteMessage(thread.id, m.id),
                        })
                      }
                    />
                  )}
                  {/* Signaler : en bas à droite, après le statut de lecture. */}
                  {!mine && (
                    <IconButton
                      label="Signaler le message"
                      icon="flag"
                      danger
                      onClick={() =>
                        ctx.open({
                          kind: "report",
                          type: "message",
                          target: m.id,
                        })
                      }
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        {!messages.length && (
          <Empty title="La conversation commence ici">
            {thread.canSend
              ? "Envoyez un premier bonjour aux participants."
              : "Les premiers messages apparaîtront ici."}
          </Empty>
        )}
        <div ref={sentinel} aria-hidden="true" />
      </div>
      {thread.canSend ? (
        <form className="message-compose" noValidate onSubmit={submit}>
          <label className="sr-only" htmlFor="message-text">
            Votre message
          </label>
          <textarea
            data-resize-none
            id="message-text"
            rows={2}
            maxLength={3000}
            placeholder="Écrivez un message…"
            value={draft.text}
            onChange={(e) => {
              update({ ...draft, text: e.target.value });
              setError("");
            }}
            onKeyDown={(e) => {
              // Entrée envoie ; Maj + Entrée garde le retour à la ligne.
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            aria-describedby="compose-hint"
          />
          {draft.photo && (
            <div className="attachment-preview">
              <span>Photo prête à envoyer</span>
              <button
                type="button"
                className="button outline"
                onClick={() => update({ text: draft.text })}
              >
                Retirer
              </button>
            </div>
          )}
          <div className="compose-actions">
            <label className="attach-photo">
              <Icon name="image" />
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                aria-label="Joindre une photo (1 Mo maximum)"
                onChange={(e) => {
                  void attach(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            <small>
              <span>JPG, PNG ou WebP</span>
              <span>1 Mo max.</span>
            </small>
            <small id="compose-hint" className="compose-hint">
              <span>Entrée pour envoyer</span>
              <span>Maj + Entrée pour aller à la ligne</span>
            </small>
            <button type="submit" className="button" disabled={busy}>
              <Icon name="send" />
              Envoyer
            </button>
          </div>
          <p className="social-error" role="alert">
            {error}
          </p>
        </form>
      ) : (
        <p className="chat-start">
          La discussion reste consultable. Les nouveaux messages sont fermés.
        </p>
      )}
    </>
  );
}
