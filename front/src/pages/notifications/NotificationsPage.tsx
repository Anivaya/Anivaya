import { uiLocale } from "../../shared/i18n/locale.ts";
import { useText } from "../../shared/i18n/HomeLocale.tsx";
import { notificationText } from "../../../../shared/translations/notification.ts";
import EmptyState from "../../shared/ui/EmptyState.tsx";
import { useEffect, useRef, useState } from "react";
import type { Notification, PageProps } from "../../shared/types.ts";
import { errorMessage } from "../../shared/types.ts";
import { api } from "../../shared/services/api.ts";
import Icon from "../../shared/ui/Icon.tsx";

const categories = {
  reminders: ["Rappels", "Rappel"],
  reservations: ["Réservations", "Réservation"],
  shares: ["Partages", "Partage"],
  documents: ["Documents", "Document"],
  account: ["Compte", "Compte"],
  social: ["Communautés", "Communautés"],
} as const;
type Category = keyof typeof categories;

const formatDate = (value: string) =>
  new Date(value).toLocaleString(uiLocale(), {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function NotificationsPage({ data, actions }: PageProps) {
  const tr = useText();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [category, setCategory] = useState<Category | "all">("all");
  const [error, setError] = useState("");
  const filters = useRef<HTMLDivElement>(null);
  const toggled = useRef<string | null>(null);
  const unread = data.notifications.filter((n) => !n.read).length;
  const visible = data.notifications.filter(
    (n) =>
      (!unreadOnly || !n.read) &&
      (category === "all" || n.category === category),
  );

  /** Enregistre, recharge l’espace (badge compris) et confirme. */
  async function update(work: Promise<unknown>, message?: string) {
    setError("");
    try {
      await work;
      await actions.saved(message);
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }
  function toggle(notification: Notification) {
    const read = !notification.read;
    toggled.current = notification.id;
    void update(
      api.setNotification(notification.id, read),
      read
        ? "Notification marquée comme lue."
        : "Notification marquée comme non lue.",
    );
  }
  useEffect(() => {
    // Après l’affichage des nouvelles données : si la notification a quitté le filtre,
    // le focus revient sur les filtres au lieu d’être perdu.
    const id = toggled.current;
    if (!id) return;
    toggled.current = null;
    (
      document.getElementById("toggle-" + id) ??
      filters.current?.querySelector<HTMLElement>("[aria-pressed=true]")
    )?.focus();
  }, [data]);

  return (
    <div className="profile-page">
      <div className="welcome">
        <div>
          <h1>{tr("Vos notifications")}</h1>
          <p>{tr("Les nouvelles de vos compagnons, au même endroit.")}</p>
        </div>
        {data.notifications.length > 0 && (
          <a className="button outline" href="#profil/notifications">
            {tr("Mes préférences")}
          </a>
        )}
      </div>
      {data.notifications.length > 0 && (
        <div className="notification-toolbar">
          <div
            className="notification-tabs"
            role="group"
            aria-label={tr("Afficher les notifications")}
            ref={filters}
          >
            <button
              type="button"
              aria-pressed={!unreadOnly}
              onClick={() => setUnreadOnly(false)}
            >
              {tr("Toutes")}
            </button>
            <button
              type="button"
              aria-pressed={unreadOnly}
              onClick={() => setUnreadOnly(true)}
            >
              {tr("Non lues ")}
              {unread}
            </button>
          </div>
          <div className="notification-category">
            <label htmlFor="category-filter">{tr("Catégorie")}</label>
            <select
              id="category-filter"
              value={category}
              onChange={(e) => setCategory(e.target.value as Category | "all")}
            >
              <option value="all">{tr("Toutes les catégories")}</option>
              {(Object.keys(categories) as Category[]).map((key) => (
                <option key={key} value={key}>
                  {tr(categories[key][0])}
                </option>
              ))}
            </select>
          </div>
          {visible.length > 0 && (
            <button
              className="button outline"
              type="button"
              disabled={!unread}
              onClick={() =>
                update(
                  api.readAllNotifications(),
                  "Toutes vos notifications sont marquées comme lues.",
                )
              }
            >
              {tr("Tout marquer comme lu")}
            </button>
          )}
        </div>
      )}
      {error && (
        <p className="profile-feedback error" role="alert">
          {tr(error)}
        </p>
      )}
      {visible.length > 0 && (
        <p className="muted" aria-live="polite">
          {visible.length}
          {tr(" notification")}
          {visible.length > 1 ? tr("s") : ""}
        </p>
      )}
      {visible.length ? (
        <div className="notification-list">
          {visible.map((n) => (
            <article
              key={n.id}
              className={"notification-item" + (n.read ? "" : " unread")}
            >
              <span className="notification-item-icon" aria-hidden="true">
                <Icon name="bell" />
              </span>
              <div className="notification-item-body">
                <p className="notification-meta">
                  {tr(categories[n.category][1])} · {formatDate(n.date)}
                  {n.read ? "" : tr(" · Non lue")}
                </p>
                <h2>{notificationText(n, "title", tr)}</h2>
                <p>{notificationText(n, "text", tr)}</p>
                <div className="notification-item-actions">
                  <a
                    href={n.href}
                    onClick={() => {
                      if (!n.read) void update(api.setNotification(n.id, true));
                    }}
                  >
                    {tr(n.action)}
                  </a>
                  <button
                    type="button"
                    id={"toggle-" + n.id}
                    onClick={() => toggle(n)}
                    aria-label={`${tr(n.read ? "Marquer comme non lue" : "Marquer comme lue")} : ${notificationText(n, "title", tr)}`}
                  >
                    {n.read
                      ? tr("Marquer comme non lue")
                      : tr("Marquer comme lue")}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          kind="reminders"
          className="empty-notifications"
          title={tr("Vous êtes à jour")}
          description={tr("Les nouvelles de vos compagnons apparaîtront ici.")}
          filtered={data.notifications.length > 0}
        />
      )}
    </div>
  );
}
