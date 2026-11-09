import { useText } from "../../shared/i18n/HomeLocale.tsx";
import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type {
  CommunityTopic,
  FriendAction,
} from "../../../../shared/social.ts";
import { communityTopics, reportReasons } from "../../../../shared/social.ts";
import { api } from "../../shared/services/api.ts";
import Icon from "../../shared/ui/Icon.tsx";
import Modal from "../../shared/ui/Modal.tsx";
import { IconButton, PersonLink } from "./Common.tsx";
import type { SocialContext, SocialDialog } from "./social.ts";
import {
  friendship,
  localDateTime,
  personInitials,
  personName,
  socialHref,
} from "./social.ts";

const titles: Partial<Record<SocialDialog["kind"], string>> = {
  members: "Les participants",
  friends: "Mes amis",
  photo: "Photo partagée",
};

/** Fenêtre active de la page Communautés. */
export default function SocialDialogView({
  ctx,
  dialog,
  onClose,
}: {
  ctx: SocialContext;
  dialog: SocialDialog;
  onClose: () => void;
}) {
  const tr = useText();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => title.current?.focus(), [dialog]);

  function requestClose() {
    if (busy) return;
    if (dirty) setDiscarding(true);
    else onClose();
  }
  /** Appel depuis une fenêtre : l’erreur s’affiche dans la fenêtre. */
  async function submit<T>(work: () => Promise<T>, message?: string) {
    setBusy(true);
    setError("");
    const result = await ctx.run(work, message);
    setBusy(false);
    if (!result.ok) setError(result.error);
    return result;
  }
  const shared = { ctx, submit, close: onClose, setDirty };
  let heading = titles[dialog.kind] ?? "";
  let body: ReactNode;
  switch (dialog.kind) {
    case "confirm":
      heading = dialog.title;
      body = (
        <>
          <p className="social-copy">{tr(dialog.text)}</p>
          <div className="dialog-actions">
            <button
              type="button"
              className="button outline cancel"
              onClick={onClose}
            >
              {tr("Annuler")}
            </button>
            <button
              type="button"
              className="button danger"
              disabled={busy}
              onClick={async () => {
                if ((await submit(dialog.work, dialog.message)).ok) onClose();
              }}
            >
              {tr(dialog.label)}
            </button>
          </div>
        </>
      );
      break;
    case "community-editor":
      heading = dialog.id ? "Modifier la communauté" : "Créer une communauté";
      body = <CommunityEditor {...shared} id={dialog.id} />;
      break;
    case "event-editor":
      heading = dialog.id ? "Modifier l’événement" : "Créer un événement";
      body = (
        <EventEditor {...shared} id={dialog.id} community={dialog.community} />
      );
      break;
    case "members":
      body = <Members {...shared} dialog={dialog} />;
      break;
    case "person":
      heading = personName(ctx.data, dialog.id);
      body = <PersonProfile {...shared} dialog={dialog} />;
      break;
    case "options":
      heading = tr("Options · {0}", [personName(ctx.data, dialog.id)]);
      body = <PersonOptions {...shared} dialog={dialog} />;
      break;
    case "friends":
      body = <Friends {...shared} />;
      break;
    case "new-thread":
      heading = dialog.existing
        ? "Inviter dans le groupe"
        : dialog.group
          ? "Créer un groupe privé"
          : "Nouvelle discussion";
      body = <NewThread {...shared} dialog={dialog} />;
      break;
    case "report":
      heading =
        dialog.type === "message"
          ? "Signaler un message"
          : "Signaler une personne";
      body = <Report {...shared} dialog={dialog} />;
      break;
    case "photo":
      body = (
        <img className="social-photo-full" src={dialog.src} alt={dialog.alt} />
      );
      break;
  }
  return (
    <Modal
      busy={busy}
      onClose={requestClose}
      header={false}
      className="social-modal"
    >
      <div className="social-modal-heading">
        {dialog.back && (
          <IconButton
            label={tr("Retour à la liste des participants")}
            icon="back"
            onClick={() => ctx.open(dialog.back!)}
          />
        )}
        <h2 id="action-title" tabIndex={-1} ref={title}>
          {dialog.kind === "person" || dialog.kind === "options"
            ? heading
            : tr(heading)}
        </h2>
        <button
          type="button"
          className="close"
          aria-label={tr("Fermer la fenêtre")}
          title={tr("Fermer")}
          disabled={busy}
          onClick={requestClose}
        >
          <Icon name="close" />
        </button>
      </div>
      {body}
      {discarding && (
        <div className="social-copy">
          <p>{tr("Abandonner les modifications non enregistrées ?")}</p>
          <div className="dialog-actions">
            <button
              type="button"
              className="button outline"
              onClick={() => setDiscarding(false)}
            >
              {tr("Continuer la saisie")}
            </button>
            <button
              type="button"
              className="button outline danger"
              onClick={onClose}
            >
              {tr("Abandonner")}
            </button>
          </div>
        </div>
      )}
      <p className="social-error" role="alert">
        {tr(error)}
      </p>
    </Modal>
  );
}

interface Shared {
  ctx: SocialContext;
  submit: <T>(
    work: () => Promise<T>,
    message?: string,
  ) => Promise<{ ok: true; value: T } | { ok: false; error: string }>;
  close: () => void;
  setDirty: (dirty: boolean) => void;
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  const tr = useText();
  return (
    <div className="field">
      <label htmlFor={"social-" + id}>{tr(label)}</label>
      {children}
      <span id={"error-" + id} className="social-error">
        {tr(error)}
      </span>
    </div>
  );
}

/** Champs texte partagés par les éditeurs de communauté et d’événement. */
function useForm<T extends Record<string, string>>(
  initial: T,
  setDirty: (dirty: boolean) => void,
) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const input = (
    key: keyof T & string,
    extra: Record<string, unknown> = {},
  ) => ({
    id: "social-" + key,
    name: key,
    value: values[key],
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": "error-" + key,
    onChange: (e: { target: { value: string } }) => {
      setValues({ ...values, [key]: e.target.value });
      setErrors({ ...errors, [key]: undefined });
      setDirty(true);
    },
    ...extra,
  });
  function fail(key: keyof T & string, message: string) {
    setErrors({ ...errors, [key]: message });
    document.getElementById("social-" + key)?.focus();
  }
  return { values, errors, input, fail };
}

function CommunityEditor({
  ctx,
  submit,
  close,
  setDirty,
  id,
}: Shared & { id?: string }) {
  const tr = useText();
  const item = ctx.data.communities.find((g) => g.id === id);
  const form = useForm(
    {
      name: item?.name ?? "",
      city: item?.city ?? "",
      topic: item?.topic ?? "Balades",
      description: item?.description ?? "",
    },
    setDirty,
  );
  async function save(event: FormEvent) {
    event.preventDefault();
    for (const key of ["name", "city", "description"] as const)
      if (!form.values[key].trim())
        return form.fail(key, "Ce champ est nécessaire.");
    const result = await submit(
      () =>
        api.saveCommunity(id, {
          ...form.values,
          topic: form.values.topic as CommunityTopic,
        }),
      "Enregistré.",
    );
    if (result.ok) {
      close();
      window.location.hash = socialHref("communautes", result.value.id);
    }
  }
  return (
    <form id="social-editor" noValidate onSubmit={save}>
      <Field id="name" label={tr("Nom")} error={form.errors.name}>
        <input {...form.input("name", { maxLength: 90 })} />
      </Field>
      <Field id="city" label={tr("Ville")} error={form.errors.city}>
        <input {...form.input("city", { maxLength: 80 })} />
      </Field>
      <Field id="topic" label={tr("Thème")}>
        <select {...form.input("topic")}>
          {communityTopics.map((topic) => (
            <option key={topic} value={topic}>
              {tr(topic)}
            </option>
          ))}
        </select>
      </Field>
      <Field
        id="description"
        label={tr("Présentation")}
        error={form.errors.description}
      >
        <textarea
          data-resize-none
          {...form.input("description", { rows: 4, maxLength: 1500 })}
        />
      </Field>
      <p className="social-copy">
        {tr(
          "Indiquez un quartier ou un lieu de rendez-vous public, sans publier votre adresse personnelle.",
        )}
      </p>
      <div className="dialog-actions">
        <button type="button" className="button outline cancel" onClick={close}>
          {tr("Annuler")}
        </button>
        <button className="button" type="submit">
          {id ? tr("Enregistrer") : tr("Créer")}
        </button>
      </div>
    </form>
  );
}

function EventEditor({
  ctx,
  submit,
  close,
  setDirty,
  id,
  community,
}: Shared & { id?: string; community?: string }) {
  const tr = useText();
  const item = ctx.data.events.find((e) => e.id === id);
  const form = useForm(
    {
      name: item?.name ?? "",
      city: item?.city ?? "",
      place: item?.place ?? "",
      date: item ? localDateTime(item.date) : "",
      capacity: String(item?.capacity ?? 12),
      community: item?.community ?? community ?? "",
      description: item?.description ?? "",
    },
    setDirty,
  );
  async function save(event: FormEvent) {
    event.preventDefault();
    const v = form.values;
    for (const key of ["name", "city", "place", "date", "description"] as const)
      if (!v[key].trim()) return form.fail(key, "Ce champ est nécessaire.");
    if (
      !Number.isFinite(Date.parse(v.date)) ||
      Date.parse(v.date) <= Date.now()
    )
      return form.fail("date", "Choisissez une date à venir.");
    const result = await submit(
      () =>
        api.saveSocialEvent(id, {
          ...v,
          date: new Date(v.date).toISOString(),
          capacity: Number(v.capacity),
        }),
      "Enregistré.",
    );
    if (result.ok) {
      close();
      window.location.hash = socialHref("evenements", result.value.id);
    }
  }
  return (
    <form id="social-editor" noValidate onSubmit={save}>
      <Field id="name" label={tr("Nom")} error={form.errors.name}>
        <input {...form.input("name", { maxLength: 90 })} />
      </Field>
      <Field id="city" label={tr("Ville")} error={form.errors.city}>
        <input {...form.input("city", { maxLength: 80 })} />
      </Field>
      <Field
        id="place"
        label={tr("Lieu du rendez-vous")}
        error={form.errors.place}
      >
        <input {...form.input("place", { maxLength: 150 })} />
      </Field>
      <Field id="date" label={tr("Date et heure")} error={form.errors.date}>
        <input {...form.input("date", { type: "datetime-local" })} />
      </Field>
      <Field
        id="capacity"
        label={tr("Nombre de places")}
        error={form.errors.capacity}
      >
        <input
          {...form.input("capacity", { type: "number", min: 1, max: 200 })}
        />
      </Field>
      <Field id="community" label={tr("Communauté (facultatif)")}>
        <select {...form.input("community")}>
          <option value="">{tr("Événement ouvert à tous")}</option>
          {ctx.data.communities
            .filter((g) => g.members.includes(ctx.data.me))
            .map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
        </select>
      </Field>
      <Field
        id="description"
        label={tr("Présentation")}
        error={form.errors.description}
      >
        <textarea
          data-resize-none
          {...form.input("description", { rows: 4, maxLength: 1500 })}
        />
      </Field>
      <p className="social-copy">
        {tr(
          "Indiquez un quartier ou un lieu de rendez-vous public, sans publier votre adresse personnelle.",
        )}
      </p>
      <div className="dialog-actions">
        <button type="button" className="button outline cancel" onClick={close}>
          {tr("Annuler")}
        </button>
        <button className="button" type="submit">
          {id ? tr("Enregistrer") : tr("Créer")}
        </button>
      </div>
    </form>
  );
}

/** Action d’amitié proposée selon la relation existante. */
function friendAction(ctx: SocialContext, id: string) {
  const f = friendship(ctx.data, id);
  if (f?.status === "accepted")
    return {
      action: "remove",
      label: "Retirer de mes amis",
      icon: "close",
    } as const;
  if (f?.status === "pending")
    return f.to === ctx.data.me
      ? ({
          action: "accept",
          label: "Accepter la demande d’amitié",
          icon: "check",
        } as const)
      : ({
          action: "remove",
          label: "Annuler la demande d’amitié",
          icon: "close",
        } as const);
  return {
    action: "request",
    label: "Ajouter en ami",
    icon: "friend",
  } as const;
}

const friendMessages: Record<FriendAction, string> = {
  request: "Demande d’amitié envoyée.",
  accept: "Relation mise à jour.",
  remove: "Relation mise à jour.",
};

/** Actions communes sur un membre : discussion privée, amitié, blocage. */
function useMemberActions({ ctx, submit, close }: Shared) {
  return {
    async dm(id: string) {
      const result = await submit(() => api.createThread({ people: [id] }));
      if (result.ok) {
        close();
        window.location.hash = socialHref("messagerie", result.value.id);
      }
    },
    friend(id: string, action: FriendAction) {
      void submit(() => api.friend(id, action), friendMessages[action]);
    },
    block(id: string, back: SocialDialog) {
      ctx.open({
        kind: "confirm",
        title: "Bloquer cette personne ?",
        text: "Ses messages seront masqués et les échanges privés seront bloqués. Vous pourrez la débloquer depuis son profil.",
        label: "Bloquer",
        message: "Personne bloquée.",
        work: () => api.block(id, true),
        back,
      });
    },
    unblock(id: string) {
      void submit(() => api.block(id, false), "Personne débloquée.");
    },
  };
}

function Members(
  props: Shared & { dialog: Extract<SocialDialog, { kind: "members" }> },
) {
  const tr = useText();
  const { ctx, dialog } = props;
  const { data } = ctx;
  const actions = useMemberActions(props);
  return (
    <>
      <div className="social-member-list participant-list">
        {dialog.ids.map((member) => {
          const blocked = data.blocked.includes(member);
          const mine = data.myBlocks.includes(member);
          const friend = friendAction(ctx, member);
          return (
            <div className="participant-row" key={member}>
              <div className="participant-identity">
                <PersonLink ctx={ctx} id={member} back={dialog} />
                {member === dialog.owner && <small>{tr("Créateur")}</small>}
              </div>
              {member === data.me ? (
                <span className="participant-self">{tr("Vous")}</span>
              ) : (
                <div className="participant-actions">
                  <IconButton
                    label={
                      blocked
                        ? tr("Discussion indisponible (personne bloquée)")
                        : tr("Discuter en privé")
                    }
                    icon="chat"
                    disabled={blocked}
                    onClick={() => void actions.dm(member)}
                  />
                  <IconButton
                    label={
                      blocked
                        ? tr("Amitié indisponible (personne bloquée)")
                        : friend.label
                    }
                    icon={friend.icon}
                    danger={friend.action === "remove"}
                    disabled={blocked}
                    onClick={() => actions.friend(member, friend.action)}
                  />
                  <IconButton
                    label={mine ? tr("Débloquer") : tr("Bloquer")}
                    icon="block"
                    className="block-action"
                    onClick={() =>
                      mine
                        ? actions.unblock(member)
                        : actions.block(member, dialog)
                    }
                  />
                  <IconButton
                    label={tr("Plus d’options")}
                    icon="more"
                    className="more-action"
                    onClick={() =>
                      ctx.open({ kind: "options", id: member, back: dialog })
                    }
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {dialog.thread &&
        data.threads.find((t) => t.id === dialog.thread)?.owner === data.me && (
          <button
            type="button"
            className="button outline"
            onClick={() =>
              ctx.open({
                kind: "new-thread",
                group: true,
                existing: dialog.thread,
              })
            }
          >
            {tr("Inviter une personne")}
          </button>
        )}
    </>
  );
}

function PersonProfile(
  props: Shared & { dialog: Extract<SocialDialog, { kind: "person" }> },
) {
  const tr = useText();
  const { ctx, dialog } = props;
  const { data } = ctx;
  const id = dialog.id;
  const person = data.people.find((p) => p.id === id);
  const actions = useMemberActions(props);
  const f = friendship(data, id);
  const blocked = data.blocked.includes(id);
  const mine = data.myBlocks.includes(id);
  return (
    <>
      <div className="member-profile">
        <span className="social-avatar large">{personInitials(data, id)}</span>
        <p>
          {person?.city || tr("Membre de la communauté")}
          {person?.animal && (
            <>
              <br />
              {tr("Avec ")}
              {person.animal}
            </>
          )}
        </p>
      </div>
      {id === data.me ? (
        <p>{tr("Voici votre profil dans les communautés.")}</p>
      ) : (
        <>
          <div className="member-profile-actions">
            <div className="member-profile-primary">
              {!blocked && (
                <>
                  <IconButton
                    label={tr("Discuter en privé")}
                    icon="chat"
                    onClick={() => void actions.dm(id)}
                  />
                  {f?.status === "accepted" ? (
                    <IconButton
                      label={tr("Retirer de mes amis")}
                      icon="close"
                      danger
                      onClick={() => actions.friend(id, "remove")}
                    />
                  ) : f?.status === "pending" ? (
                    f.to === data.me ? (
                      <>
                        <IconButton
                          label={tr("Accepter la demande d’amitié")}
                          icon="check"
                          onClick={() => actions.friend(id, "accept")}
                        />
                        <IconButton
                          label={tr("Refuser la demande d’amitié")}
                          icon="close"
                          danger
                          onClick={() => actions.friend(id, "remove")}
                        />
                      </>
                    ) : (
                      <IconButton
                        label={tr("Annuler ma demande d’amitié")}
                        icon="close"
                        danger
                        onClick={() => actions.friend(id, "remove")}
                      />
                    )
                  ) : (
                    <IconButton
                      label={tr("Ajouter en ami")}
                      icon="friend"
                      onClick={() => actions.friend(id, "request")}
                    />
                  )}
                </>
              )}
              <IconButton
                label={tr("Signaler cette personne")}
                icon="flag"
                danger
                onClick={() =>
                  ctx.open({
                    kind: "report",
                    type: "person",
                    target: id,
                    back: dialog,
                  })
                }
              />
            </div>
            <IconButton
              label={mine ? tr("Débloquer") : tr("Bloquer")}
              icon="block"
              className="profile-block"
              onClick={() =>
                mine ? actions.unblock(id) : actions.block(id, dialog)
              }
            />
          </div>
          {blocked && (
            <p className="social-copy">
              {tr("Les échanges privés sont bloqués entre ces deux comptes.")}
            </p>
          )}
        </>
      )}
    </>
  );
}

function PersonOptions(
  props: Shared & { dialog: Extract<SocialDialog, { kind: "options" }> },
) {
  const tr = useText();
  const { ctx, dialog } = props;
  const id = dialog.id;
  const actions = useMemberActions(props);
  const incoming = ctx.data.friends.some(
    (f) => f.from === id && f.to === ctx.data.me && f.status === "pending",
  );
  return (
    <div className="participant-options">
      <button
        type="button"
        className="button outline"
        onClick={() => ctx.open({ kind: "person", id, back: dialog.back })}
      >
        <Icon name="people" />
        {tr("Voir le profil")}
      </button>
      <button
        type="button"
        className="button outline danger"
        onClick={() =>
          ctx.open({ kind: "report", type: "person", target: id, back: dialog })
        }
      >
        <Icon name="flag" />
        {tr("Signaler cette personne")}
      </button>
      {incoming && (
        <button
          type="button"
          className="button outline"
          onClick={() => actions.friend(id, "remove")}
        >
          {tr("Refuser la demande d’amitié")}
        </button>
      )}
    </div>
  );
}

function Friends({ ctx }: Shared) {
  const tr = useText();
  const { data } = ctx;
  const pending = data.friends.filter(
    (f) => f.to === data.me && f.status === "pending",
  );
  const accepted = data.friends.filter((f) => f.status === "accepted");
  const respond = (id: string, action: FriendAction) =>
    ctx.act(() => api.friend(id, action), friendMessages[action]);
  return (
    <>
      <h3>
        {tr("Invitations reçues (")}
        {pending.length})
      </h3>
      {pending.length ? (
        pending.map((f) => (
          <div className="friend-row" key={f.from}>
            <PersonLink ctx={ctx} id={f.from} />
            <button
              type="button"
              className="button outline"
              onClick={() => respond(f.from, "accept")}
            >
              {tr("Accepter")}
            </button>
            <button
              type="button"
              className="button outline"
              onClick={() => respond(f.from, "remove")}
            >
              {tr("Refuser")}
            </button>
          </div>
        ))
      ) : (
        <p>{tr("Aucune invitation en attente.")}</p>
      )}
      <h3>
        {tr("Mes amis (")}
        {accepted.length})
      </h3>
      {accepted.length ? (
        accepted.map((f) => {
          const other = f.from === data.me ? f.to : f.from;
          return <PersonLink key={other} ctx={ctx} id={other} />;
        })
      ) : (
        <p>
          {tr(
            "Ouvrez le profil d’un membre pour lui proposer de devenir amis.",
          )}
        </p>
      )}
      <h3>{tr("Trouver une personne")}</h3>
      <div className="social-member-list">
        {data.people
          .filter((p) => p.id !== data.me)
          .map((p) => (
            <PersonLink key={p.id} ctx={ctx} id={p.id} />
          ))}
      </div>
    </>
  );
}

function NewThread({
  ctx,
  submit,
  close,
  setDirty,
  dialog,
}: Shared & { dialog: Extract<SocialDialog, { kind: "new-thread" }> }) {
  const tr = useText();
  const { data } = ctx;
  const { group, existing } = dialog;
  const thread = existing
    ? data.threads.find((t) => t.id === existing)
    : undefined;
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [pickError, setPickError] = useState("");
  const candidates = data.people.filter(
    (p) =>
      p.id !== data.me &&
      !data.blocked.includes(p.id) &&
      !thread?.members.includes(p.id),
  );
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!selected.length)
      return setPickError("Sélectionnez au moins une personne.");
    if (group && !existing && name.trim().length < 2) {
      setNameError("Indiquez un nom de groupe (2 caractères minimum).");
      document.getElementById("social-group-name")?.focus();
      return;
    }
    const result = existing
      ? await submit(async () => {
          await api.inviteToThread(existing, selected);
          return { id: existing };
        }, "Membres ajoutés.")
      : await submit(
          () =>
            api.createThread({
              people: selected,
              name: group ? name : undefined,
            }),
          "Discussion prête.",
        );
    if (result.ok) {
      close();
      window.location.hash = socialHref("messagerie", result.value.id);
    }
  }
  return (
    <form noValidate onSubmit={save}>
      {group && !existing && (
        <Field id="group-name" label={tr("Nom du groupe")} error={nameError}>
          <input
            id="social-group-name"
            maxLength={90}
            value={name}
            aria-invalid={nameError ? true : undefined}
            aria-describedby="error-group-name"
            onChange={(e) => {
              setName(e.target.value);
              setNameError("");
              setDirty(true);
            }}
          />
        </Field>
      )}
      <fieldset className="people-picker">
        <legend>
          {group ? tr("Choisir les participants") : tr("Choisir une personne")}
        </legend>
        {candidates.length ? (
          candidates.map((p) => (
            <label key={p.id}>
              <input
                type={group ? "checkbox" : "radio"}
                name="people"
                value={p.id}
                checked={selected.includes(p.id)}
                onChange={(e) => {
                  setPickError("");
                  setDirty(true);
                  setSelected(
                    group
                      ? e.target.checked
                        ? [...selected, p.id]
                        : selected.filter((x) => x !== p.id)
                      : [p.id],
                  );
                }}
              />
              <span className="social-avatar">
                {personInitials(data, p.id)}
              </span>
              <span>
                {p.name}
                <small>{p.city}</small>
              </span>
            </label>
          ))
        ) : (
          <p>{tr("Aucune personne disponible.")}</p>
        )}
      </fieldset>
      <p className="social-error" role="alert">
        {tr(pickError)}
      </p>
      {group && (
        <p className="social-copy">
          {tr(
            "Les personnes ajoutées pourront lire l’historique du groupe privé.",
          )}
        </p>
      )}
      <div className="dialog-actions">
        <button type="button" className="button outline cancel" onClick={close}>
          {tr("Annuler")}
        </button>
        <button className="button" type="submit">
          {existing
            ? tr("Inviter")
            : group
              ? tr("Créer le groupe")
              : tr("Ouvrir la discussion")}
        </button>
      </div>
    </form>
  );
}

function Report({
  submit,
  close,
  dialog,
}: Shared & { dialog: Extract<SocialDialog, { kind: "report" }> }) {
  const tr = useText();
  const [reason, setReason] = useState<string>(reportReasons[0]);
  return (
    <form
      id="report-form"
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        const result = await submit(
          () =>
            api.report({ type: dialog.type, target: dialog.target, reason }),
          "Signalement enregistré.",
        );
        if (result.ok) close();
      }}
    >
      <div className="field">
        <label htmlFor="report-reason">{tr("Motif")}</label>
        <select
          id="report-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        >
          {reportReasons.map((r) => (
            <option key={r} value={r}>
              {tr(r)}
            </option>
          ))}
        </select>
      </div>
      <p className="social-copy">
        {tr(
          "Le signalement est enregistré pour l’équipe de modération. Aucune notification n’est envoyée à la personne concernée.",
        )}
      </p>
      <div className="dialog-actions">
        <button type="button" className="button outline cancel" onClick={close}>
          {tr("Annuler")}
        </button>
        <button className="button" type="submit">
          {tr("Enregistrer le signalement")}
        </button>
      </div>
    </form>
  );
}
