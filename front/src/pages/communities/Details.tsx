import { api } from "../../shared/services/api.ts";
import Icon from "../../shared/ui/Icon.tsx";
import { BackLink, Empty, IconButton, PersonLink } from "./Common.tsx";
import Discussion from "./Discussion.tsx";
import type { SocialContext } from "./social.ts";
import { dateText, isPast, socialHref } from "./social.ts";

export function CommunityDetail({
  ctx,
  id,
}: {
  ctx: SocialContext;
  id: string;
}) {
  const { data } = ctx;
  const group = data.communities.find((g) => g.id === id);
  if (!group)
    return (
      <>
        <BackLink tab="communautes" />
        <Empty title="Communauté introuvable">
          Cette communauté a été supprimée.
        </Empty>
      </>
    );
  const joined = group.members.includes(data.me);
  const owner = group.owner === data.me;
  const upcoming = data.events.filter(
    (e) => e.community === id && !e.cancelled && !isPast(e.date),
  );
  return (
    <>
      <section className="social-detail community-presentation">
        <div className="detail-heading">
          <BackLink tab="communautes" />
          <span className="social-kicker">
            {group.city} · {group.topic}
          </span>
          <div className="social-actions">
            {owner && (
              <>
                <IconButton
                  label="Modifier la communauté"
                  icon="edit"
                  onClick={() => ctx.open({ kind: "community-editor", id })}
                />
                <IconButton
                  label="Supprimer la communauté"
                  icon="trash"
                  danger
                  onClick={() =>
                    ctx.open({
                      kind: "confirm",
                      title: "Supprimer la communauté ?",
                      text: "Sa discussion sera supprimée et ses événements à venir seront annulés pour tous les participants.",
                      label: "Supprimer",
                      message: "Communauté supprimée.",
                      work: async () => {
                        await api.deleteCommunity(id);
                        window.location.hash = socialHref("communautes");
                      },
                    })
                  }
                />
              </>
            )}
            {joined ? (
              <button
                type="button"
                className="button outline danger"
                onClick={() =>
                  ctx.open({
                    kind: "confirm",
                    title: "Quitter la communauté ?",
                    text: "Vous perdrez l’accès à sa discussion et vos participations à ses événements à venir seront retirées. Si vous la gérez, la gestion passera au prochain membre ; les événements que vous organisez seront annulés.",
                    label: "Quitter",
                    message: "Vous avez quitté la communauté.",
                    work: () => api.joinCommunity(id, false),
                  })
                }
              >
                Quitter
              </button>
            ) : (
              <button
                type="button"
                className="button"
                onClick={() =>
                  ctx.act(
                    () => api.joinCommunity(id, true),
                    "Vous avez rejoint la communauté.",
                  )
                }
              >
                Rejoindre
              </button>
            )}
          </div>
          <h2>{group.name}</h2>
        </div>
        <p className="social-description">{group.description}</p>
        <div className="detail-members">
          <div className="members-strip" tabIndex={0} aria-label="Membres">
            {group.members.map((member) => (
              <PersonLink key={member} ctx={ctx} id={member} />
            ))}
          </div>
          <button
            type="button"
            className="button outline"
            onClick={() =>
              ctx.open({
                kind: "members",
                ids: group.members,
                owner: group.owner,
              })
            }
          >
            {group.members.length} membres
          </button>
        </div>
      </section>
      <div className="social-detail-grid">
        <section className="social-discussion">
          <h2>La discussion du groupe</h2>
          {joined ? (
            <Discussion
              ctx={ctx}
              thread={data.threads.find((t) => t.id === group.thread)}
            />
          ) : (
            <Empty title="Faites connaissance">
              Rejoignez la communauté pour lire et participer à la discussion.
            </Empty>
          )}
        </section>
        <aside className="social-aside">
          <h3>Prochains rendez-vous</h3>
          {upcoming.length ? (
            upcoming.map((e) => (
              <a
                key={e.id}
                className="event-short"
                href={socialHref("evenements", e.id)}
              >
                <strong>{e.name}</strong>
                <span>{dateText(e.date)}</span>
              </a>
            ))
          ) : (
            <p>Aucun rendez-vous pour le moment.</p>
          )}
          {joined && (
            <button
              type="button"
              className="button outline"
              onClick={() => ctx.open({ kind: "event-editor", community: id })}
            >
              Proposer un événement
            </button>
          )}
          <h3>Un groupe accueillant</h3>
          <p>
            Respectez les autres membres. Depuis leur nom, vous pouvez discuter
            en privé, proposer de devenir amis ou signaler un comportement.
          </p>
        </aside>
      </div>
    </>
  );
}

export function EventDetail({ ctx, id }: { ctx: SocialContext; id: string }) {
  const { data } = ctx;
  const event = data.events.find((e) => e.id === id);
  if (!event)
    return (
      <>
        <BackLink tab="evenements" />
        <Empty title="Événement introuvable">
          Revenez à la liste des événements.
        </Empty>
      </>
    );
  const joined = event.participants.includes(data.me);
  const closed = event.cancelled || isPast(event.date);
  const full = event.participants.length >= event.capacity;
  const community = data.communities.find((g) => g.id === event.community);
  return (
    <>
      <section className="social-detail">
        <div className="detail-heading">
          <BackLink tab="evenements" />
          <div>
            <span
              className={`social-kicker ${event.cancelled ? "danger" : ""}`}
            >
              {event.cancelled
                ? "Événement annulé"
                : closed
                  ? "Événement passé"
                  : dateText(event.date)}
            </span>
            <h2>{event.name}</h2>
          </div>
          <div className="social-actions">
            {!closed &&
              (event.owner === data.me ? (
                <>
                  <IconButton
                    label="Modifier l’événement"
                    icon="edit"
                    onClick={() => ctx.open({ kind: "event-editor", id })}
                  />
                  <button
                    type="button"
                    className="button outline danger"
                    onClick={() =>
                      ctx.open({
                        kind: "confirm",
                        title: "Annuler l’événement ?",
                        text: "L’annulation sera visible par tous les participants. La discussion restera consultable.",
                        label: "Annuler l’événement",
                        message: "Événement annulé.",
                        work: () => api.cancelSocialEvent(id),
                      })
                    }
                  >
                    Annuler l’événement
                  </button>
                </>
              ) : joined ? (
                <button
                  type="button"
                  className="button outline"
                  onClick={() =>
                    ctx.open({
                      kind: "confirm",
                      title: "Annuler votre participation ?",
                      text: "Votre place sera libérée et vous quitterez la discussion de cet événement.",
                      label: "Annuler ma participation",
                      message: "Votre participation est annulée.",
                      work: () => api.attendSocialEvent(id, false),
                    })
                  }
                >
                  Annuler ma participation
                </button>
              ) : (
                <button
                  type="button"
                  className="button"
                  disabled={full}
                  onClick={() =>
                    ctx.act(
                      () => api.attendSocialEvent(id, true),
                      "Votre participation est enregistrée.",
                    )
                  }
                >
                  {full ? "Complet" : "Participer"}
                </button>
              ))}
          </div>
        </div>
        <p>
          <Icon name="pin" /> {event.place} · {event.city}
        </p>
        <p className="social-description">{event.description}</p>
        {event.community && (
          <p>
            Avec{" "}
            <a href={socialHref("communautes", event.community)}>
              {community?.name || "la communauté"}
            </a>
          </p>
        )}
        <div className="detail-members">
          <span>Organisé par</span>
          {event.owner && <PersonLink ctx={ctx} id={event.owner} />}
          <button
            type="button"
            className="button outline"
            onClick={() =>
              ctx.open({
                kind: "members",
                ids: event.participants,
                owner: event.owner,
              })
            }
          >
            {event.participants.length} / {event.capacity} participants
          </button>
        </div>
      </section>
      <section className="social-discussion event-discussion">
        <h2>Avant et après la rencontre</h2>
        {joined ? (
          <Discussion
            ctx={ctx}
            thread={data.threads.find((t) => t.id === event.thread)}
          />
        ) : (
          <Empty title="Retrouvez les participants">
            Inscrivez-vous pour accéder à la discussion de l’événement.
          </Empty>
        )}
      </section>
    </>
  );
}
