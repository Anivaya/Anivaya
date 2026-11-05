import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  Community,
  SocialData,
  SocialEvent,
} from "../../../../shared/social.ts";
import { api } from "../../shared/services/api.ts";
import { errorMessage } from "../../shared/types.ts";
import Icon from "../../shared/ui/Icon.tsx";
import PageHeading from "../../shared/layout/PageHeading.tsx";
import { matches } from "../../shared/utils/format.ts";
import { Empty } from "./Common.tsx";
import EmptyState from "../../shared/ui/EmptyState.tsx";
import { CommunityDetail, EventDetail } from "./Details.tsx";
import SocialDialogView from "./Dialogs.tsx";
import Messaging from "./Messaging.tsx";
import type {
  Draft,
  SocialContext,
  SocialDialog,
  SocialTab,
} from "./social.ts";
import {
  dateText,
  isPast,
  PAGE_SIZE,
  socialHref,
  socialTabs,
} from "./social.ts";

const REFRESH_MS = 5000;

/** Communautés, événements et messagerie, partagés entre les comptes. */
export default function CommunitiesPage({ params }: { params: string[] }) {
  const tab = (socialTabs.find(([key]) => key === params[0])?.[0] ??
    "communautes") as SocialTab;
  const id = params[1] ? decodeURIComponent(params[1]) : "";
  const [data, setData] = useState<SocialData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [toast, setToast] = useState("");
  const [dialog, setDialog] = useState<{
    value: SocialDialog;
    key: number;
  } | null>(null);
  // Brouillons par discussion, conservés en changeant de page ; la Map ne change jamais.
  const [drafts] = useState(() => new Map<string, Draft>());

  const reload = useCallback(async () => {
    try {
      setData(await api.social());
      setLoadError("");
    } catch (failure) {
      setLoadError(errorMessage(failure));
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    api
      .social(controller.signal)
      .then(setData)
      .catch((failure) => {
        if (!controller.signal.aborted) setLoadError(errorMessage(failure));
      });
    // Les autres comptes ont pu écrire : on recharge au retour sur la page.
    const refresh = () => {
      if (document.visibilityState === "visible") void reload();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    // Les messages des autres arrivent aussi pendant qu’on reste sur la page.
    const timer = setInterval(refresh, REFRESH_MS);
    return () => {
      clearInterval(timer);
      controller.abort();
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [reload]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  const ctx = useMemo<SocialContext | null>(() => {
    if (!data) return null;
    async function run<T>(work: () => Promise<T>, message?: string) {
      try {
        const value = await work();
        await reload();
        setFeedback("");
        if (message) setToast(message);
        return { ok: true as const, value };
      } catch (failure) {
        return { ok: false as const, error: errorMessage(failure) };
      }
    }
    return {
      data,
      reload,
      drafts,
      run,
      open: (value) =>
        setDialog((current) => ({ value, key: (current?.key ?? 0) + 1 })),
      act: (work, message) =>
        void run(work, message).then((result) => {
          if (!result.ok) setFeedback(result.error);
        }),
    };
  }, [data, drafts, reload]);

  const unread = data?.threads.reduce((n, t) => n + t.unread, 0) ?? 0;
  const detail = Boolean(id) && tab !== "messagerie";
  return (
    <div className="social-page">
      <PageHeading
        title="Communautés"
        description="Rejoignez des groupes près de chez vous, participez à des sorties et échangez avec d’autres propriétaires."
      />
      <nav className="page-tabs" aria-label="Sections des communautés">
        {socialTabs.map(([key, label]) => (
          <a
            key={key}
            href={socialHref(key)}
            aria-current={tab === key ? "page" : undefined}
          >
            {label}
            {key === "messagerie" && unread > 0 && ` (${unread})`}
          </a>
        ))}
      </nav>
      {feedback && (
        <p className="social-error social-feedback" role="alert">
          {feedback}
        </p>
      )}
      {!ctx ? (
        loadError ? (
          <div className="empty error-panel" role="alert">
            <p>{loadError}</p>
            <button className="button outline" onClick={() => void reload()}>
              Réessayer
            </button>
          </div>
        ) : (
          <p className="empty" role="status">
            Chargement des communautés…
          </p>
        )
      ) : detail ? (
        tab === "communautes" ? (
          <CommunityDetail ctx={ctx} id={id} />
        ) : (
          <EventDetail ctx={ctx} id={id} />
        )
      ) : (
        <SocialList key={tab} ctx={ctx} tab={tab} id={id} />
      )}

      <div className="toast" role="status" hidden={!toast}>
        {toast}
      </div>
      {ctx && dialog && (
        <SocialDialogView
          key={dialog.key}
          ctx={ctx}
          dialog={dialog.value}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}

const filters: Record<SocialTab, [string, string][]> = {
  communautes: [
    ["", "Toutes les communautés"],
    ["mine", "Mes communautés"],
  ],
  evenements: [
    ["mine", "Mes participations"],
    ["", "À venir"],
    ["past", "Passés"],
    ["cancelled", "Annulés"],
  ],
  // La messagerie a ses propres filtres par type de discussion.
  messagerie: [],
};
/** Action principale de chaque onglet : libellé complet, libellé court du bouton, fenêtre. */
const primary: Record<SocialTab, [string, string, SocialDialog]> = {
  communautes: ["Créer une communauté", "Créer", { kind: "community-editor" }],
  evenements: ["Créer un événement", "Créer", { kind: "event-editor" }],
  messagerie: [
    "Nouvelle discussion",
    "Nouvelle",
    { kind: "new-thread", group: false },
  ],
};
const placeholders: Record<SocialTab, string> = {
  communautes: "Nom, ville ou thème…",
  evenements: "Événement ou ville…",
  messagerie: "Personne ou discussion…",
};

/** Barre d’outils et liste d’un onglet ; recherche et filtre repartent à zéro par onglet. */
function SocialList({
  ctx,
  tab,
  id,
}: {
  ctx: SocialContext;
  tab: SocialTab;
  id: string;
}) {
  const { data } = ctx;
  const [search, setSearch] = useState("");
  // Événements : « Mes participations » d’abord ; les autres onglets montrent tout.
  const [filter, setFilter] = useState(tab === "evenements" ? "mine" : "");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const communities = data.communities.filter(
    (g) =>
      (!filter || g.members.includes(data.me)) &&
      matches(`${g.name} ${g.city} ${g.topic}`, search),
  );
  const events = data.events
    .filter((e) => {
      const past = isPast(e.date);
      const keep =
        filter === "past"
          ? past && !e.cancelled
          : filter === "cancelled"
            ? e.cancelled
            : filter === "mine"
              ? e.participants.includes(data.me)
              : !past && !e.cancelled;
      return keep && matches(`${e.name} ${e.city}`, search);
    })
    .sort((a, b) =>
      filter === "past"
        ? Date.parse(b.date) - Date.parse(a.date)
        : Date.parse(a.date) - Date.parse(b.date),
    );
  const list = tab === "communautes" ? communities : events;
  if (
    !(
      tab === "communautes"
        ? data.communities
        : tab === "evenements"
          ? data.events
          : data.threads
    ).length &&
    !id
  )
    return (
      <EmptyState
        kind={
          tab === "communautes"
            ? "communities"
            : tab === "evenements"
              ? "events"
              : "conversations"
        }
      />
    );
  return (
    <>
      <div className="social-toolbar">
        <div className="social-search">
          <label htmlFor="social-search">Rechercher</label>
          <div>
            <input
              id="social-search"
              type="search"
              autoComplete="off"
              placeholder={placeholders[tab]}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setLimit(PAGE_SIZE);
              }}
            />
            {search && (
              <button
                type="button"
                className="social-icon"
                aria-label="Effacer la recherche"
                onClick={() => {
                  setSearch("");
                  setLimit(PAGE_SIZE);
                  document.getElementById("social-search")?.focus();
                }}
              >
                <Icon name="close" />
              </button>
            )}
          </div>
        </div>
        {filters[tab].length > 0 && (
          <div className="social-filter-field">
            <label htmlFor="social-filter">Afficher</label>
            <select
              id="social-filter"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setLimit(PAGE_SIZE);
              }}
            >
              {filters[tab].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        )}
        <button
          type="button"
          className="button social-primary"
          aria-label={primary[tab][0]}
          title={primary[tab][0]}
          onClick={() => ctx.open(primary[tab][2])}
        >
          <Icon name="plus" />
          <span aria-hidden="true">{primary[tab][1]}</span>
        </button>
      </div>
      {tab === "messagerie" ? (
        <Messaging
          ctx={ctx}
          id={id}
          search={search}
          limit={limit}
          onMore={() => setLimit(limit + PAGE_SIZE)}
        />
      ) : (
        <>
          <p className="results-label" role="status">
            {list.length}{" "}
            {tab === "communautes" ? "communauté(s)" : "événement(s)"}
          </p>
          <div className="social-grid">
            {tab === "communautes"
              ? communities
                  .slice(0, limit)
                  .map((g) => <CommunityCard key={g.id} ctx={ctx} group={g} />)
              : events
                  .slice(0, limit)
                  .map((e) => <EventCard key={e.id} ctx={ctx} event={e} />)}
          </div>
          {!list.length && (
            <Empty
              kind={tab === "communautes" ? "communities" : "events"}
              title={
                search
                  ? "Aucun résultat"
                  : tab === "communautes"
                    ? "Aucune communauté à afficher"
                    : "Aucun événement à afficher"
              }
            >
              {search
                ? "Essayez un autre nom ou une autre ville."
                : tab === "communautes"
                  ? "Explorez les communautés ou créez la vôtre."
                  : filter === "mine"
                    ? "Rejoignez un événement ou proposez une rencontre."
                    : "Changez de filtre ou proposez une rencontre entre compagnons."}
            </Empty>
          )}
          {list.length > limit && (
            <div className="social-more">
              <button
                type="button"
                className="button outline"
                onClick={() => setLimit(limit + PAGE_SIZE)}
              >
                Afficher plus
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}

function CommunityCard({
  ctx,
  group,
}: {
  ctx: SocialContext;
  group: Community;
}) {
  const joined = group.members.includes(ctx.data.me);
  const href = socialHref("communautes", group.id);
  return (
    <article className="social-card">
      <a
        className={`community-cover ${group.tone}`}
        href={href}
        aria-label={
          (joined ? "Ouvrir la discussion de " : "Découvrir ") + group.name
        }
      >
        <Icon name={group.topic === "Balades" ? "pin" : "people"} />
        <span>{group.city}</span>
      </a>
      <div className="social-card-body">
        <div className="social-tags">
          <span>{group.topic}</span>
          {joined && <span className="joined">Membre</span>}
        </div>
        <h2>
          <a href={href}>{group.name}</a>
        </h2>
        <p>{group.description}</p>
        <div className="social-card-foot">
          <span>{group.members.length} membre(s)</span>
          <a className="button outline" href={href}>
            {joined ? "Discussion" : "Découvrir"}
          </a>
        </div>
      </div>
    </article>
  );
}

function EventCard({ ctx, event }: { ctx: SocialContext; event: SocialEvent }) {
  const date = new Date(event.date);
  const href = socialHref("evenements", event.id);
  const status = event.cancelled
    ? "Annulé"
    : isPast(event.date)
      ? "Terminé"
      : event.participants.includes(ctx.data.me)
        ? "Inscrit"
        : event.participants.length >= event.capacity
          ? "Complet"
          : "À venir";
  return (
    <article className="social-card event-card">
      <a
        className="event-date"
        href={href}
        aria-label={`Voir l’événement : ${event.name}`}
      >
        <strong>{date.getDate()}</strong>
        <span>{date.toLocaleDateString("fr-FR", { month: "short" })}</span>
      </a>
      <div className="social-card-body">
        <div className="social-tags">
          <span className={event.cancelled ? "cancelled" : ""}>{status}</span>
        </div>
        <h2>
          <a href={href}>{event.name}</a>
        </h2>
        <p>
          {dateText(event.date)}
          <br />
          {event.city} · {event.place}
        </p>
        <div className="social-card-foot">
          <span>
            {event.participants.length} / {event.capacity} participants
          </span>
          <a className="button outline" href={href}>
            Voir l’événement
          </a>
        </div>
      </div>
    </article>
  );
}
