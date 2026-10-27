import { randomUUID } from "node:crypto";
import type { Database, Input } from "../database/types.ts";
import type {
  Community,
  Friendship,
  SocialData,
  SocialEvent,
  SocialMessage,
  SocialPerson,
  Thread,
  ThreadKind,
} from "../../shared/social.ts";
import { communityTopics, reportReasons } from "../../shared/social.ts";
import { transaction } from "../database/connection.ts";
import { ApiError, text, upload, isBase64 } from "./validation.ts";

/** Notification déposée dans l’espace d’un compte (messages, demandes d’amis). */
export interface SocialNotice {
  id: string;
  title: string;
  text: string;
  href: string;
  action: string;
  date: string;
}
interface Hooks {
  notify: (person: string, notice: SocialNotice) => void;
  markRead: (person: string, notification: string) => void;
}

const schema = `
CREATE TABLE IF NOT EXISTS social_meta(key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS social_people(id TEXT PRIMARY KEY, name TEXT NOT NULL, city TEXT NOT NULL DEFAULT '', animal TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS social_communities(id TEXT PRIMARY KEY, name TEXT NOT NULL, city TEXT NOT NULL, topic TEXT NOT NULL, description TEXT NOT NULL, owner TEXT, tone TEXT NOT NULL DEFAULT 'blue', thread TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS social_community_members(community TEXT NOT NULL, person TEXT NOT NULL, PRIMARY KEY(community, person));
CREATE TABLE IF NOT EXISTS social_events(id TEXT PRIMARY KEY, name TEXT NOT NULL, city TEXT NOT NULL, place TEXT NOT NULL, date TEXT NOT NULL, capacity INTEGER NOT NULL, description TEXT NOT NULL, community TEXT NOT NULL DEFAULT '', owner TEXT, thread TEXT NOT NULL, cancelled INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS social_event_participants(event TEXT NOT NULL, person TEXT NOT NULL, PRIMARY KEY(event, person));
CREATE TABLE IF NOT EXISTS social_threads(id TEXT PRIMARY KEY, kind TEXT NOT NULL, ref TEXT NOT NULL DEFAULT '', name TEXT NOT NULL DEFAULT '', owner TEXT);
CREATE TABLE IF NOT EXISTS social_thread_members(thread TEXT NOT NULL, person TEXT NOT NULL, PRIMARY KEY(thread, person));
CREATE TABLE IF NOT EXISTS social_reads(thread TEXT NOT NULL, person TEXT NOT NULL, at TEXT NOT NULL, PRIMARY KEY(thread, person));
CREATE TABLE IF NOT EXISTS social_messages(id TEXT PRIMARY KEY, thread TEXT NOT NULL, sender TEXT NOT NULL, text TEXT NOT NULL, photo BLOB, photo_type TEXT, at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS social_friends(from_id TEXT NOT NULL, to_id TEXT NOT NULL, status TEXT NOT NULL, at TEXT NOT NULL, PRIMARY KEY(from_id, to_id));
CREATE TABLE IF NOT EXISTS social_blocks(from_id TEXT NOT NULL, to_id TEXT NOT NULL, PRIMARY KEY(from_id, to_id));
CREATE TABLE IF NOT EXISTS social_reports(id TEXT PRIMARY KEY, from_id TEXT NOT NULL, type TEXT NOT NULL, target TEXT NOT NULL, reason TEXT NOT NULL, at TEXT NOT NULL);`;

const MAX_PHOTO = 1024 * 1024;
const iso = (date = new Date()) => date.toISOString();
const minutesAgo = (n: number) => iso(new Date(Date.now() - n * 60000));
const daysFromNow = (n: number, hour = 10) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(hour, 0, 0, 0);
  return iso(d);
};
const need: (
  condition: unknown,
  message: string,
  status?: number,
) => asserts condition = (condition, message, status = 400) => {
  if (!condition) throw new ApiError(status, message);
};

interface ThreadRow {
  id: string;
  kind: ThreadKind;
  ref: string;
  name: string;
  owner: string | null;
  photo_type?: string | null;
  photo_at?: string | null;
}
interface MessageRow {
  id: string;
  thread: string;
  sender: string;
  text: string;
  photo_type: string | null;
  at: string;
}

/**
 * Communautés, événements et messagerie, partagés entre tous les comptes.
 * Les règles reprennent la maquette : accès aux discussions, blocages, propriétaires.
 */
export function socialService(db: Database, hooks: Hooks) {
  db.exec(schema);
  // Photo d’une discussion (groupe, communauté, événement), ajoutée après la première version.
  const threadColumns = db
    .prepare("PRAGMA table_info(social_threads)")
    .all<{ name: string }>()
    .map((c) => c.name);
  if (!threadColumns.includes("photo"))
    db.exec(
      "ALTER TABLE social_threads ADD COLUMN photo BLOB; ALTER TABLE social_threads ADD COLUMN photo_type TEXT; ALTER TABLE social_threads ADD COLUMN photo_at TEXT;",
    );
  if (!db.prepare("SELECT key FROM social_meta WHERE key='seeded'").get())
    transaction(db, () => {
      seed();
      db.prepare("INSERT INTO social_meta VALUES ('seeded','1')").run();
    });

  // --- Lectures -----------------------------------------------------------
  const ids = (sql: string, ...params: string[]) =>
    db
      .prepare(sql)
      .all<{ person: string }>(...params)
      .map((r) => r.person);
  const person = (id: string) =>
    db.prepare("SELECT * FROM social_people WHERE id=?").get<SocialPerson>(id);
  const thread = (id: string) =>
    db
      .prepare(
        "SELECT id,kind,ref,name,owner,photo_type,photo_at FROM social_threads WHERE id=?",
      )
      .get<ThreadRow>(id);
  const community = (id: string) =>
    db
      .prepare("SELECT * FROM social_communities WHERE id=?")
      .get<Omit<Community, "members">>(id);
  const event = (id: string) => {
    const row = db
      .prepare("SELECT * FROM social_events WHERE id=?")
      .get<
        Omit<SocialEvent, "participants" | "cancelled"> & { cancelled: number }
      >(id);
    return row && { ...row, cancelled: Boolean(row.cancelled) };
  };
  const communityMembers = (id: string) =>
    ids(
      "SELECT person FROM social_community_members WHERE community=? ORDER BY rowid",
      id,
    );
  const participants = (id: string) =>
    ids(
      "SELECT person FROM social_event_participants WHERE event=? ORDER BY rowid",
      id,
    );
  const blocked = (a: string, b: string) =>
    Boolean(
      db
        .prepare(
          "SELECT 1 FROM social_blocks WHERE (from_id=? AND to_id=?) OR (from_id=? AND to_id=?)",
        )
        .get(a, b, b, a),
    );
  function members(t: ThreadRow) {
    if (t.kind === "community") return communityMembers(t.ref);
    if (t.kind === "event") return participants(t.ref);
    return ids(
      "SELECT person FROM social_thread_members WHERE thread=? ORDER BY rowid",
      t.id,
    );
  }
  function canRead(t: ThreadRow | undefined, me: string): t is ThreadRow {
    if (!t) return false;
    const list = members(t);
    return (
      list.includes(me) &&
      !(t.kind === "direct" && list.some((id) => id !== me && blocked(me, id)))
    );
  }
  function canSend(t: ThreadRow, me: string) {
    if (!canRead(t, me)) return false;
    if (t.kind === "direct") return members(t).length === 2;
    if (t.kind === "event") {
      const e = event(t.ref);
      return Boolean(e && !e.cancelled && Date.parse(e.date) > Date.now());
    }
    return true;
  }
  const messages = (threadId: string) =>
    db
      .prepare(
        "SELECT id,thread,sender,text,photo_type,at FROM social_messages WHERE thread=? ORDER BY at,rowid",
      )
      .all<MessageRow>(threadId);
  const reads = (threadId: string) =>
    Object.fromEntries(
      db
        .prepare("SELECT person,at FROM social_reads WHERE thread=?")
        .all<{ person: string; at: string }>(threadId)
        .map((r) => [r.person, r.at]),
    );
  function unread(t: ThreadRow, me: string) {
    if (!canRead(t, me)) return 0;
    const since = reads(t.id)[me] ?? "1970-01-01";
    return messages(t.id).filter(
      (m) => m.sender !== me && !blocked(me, m.sender) && m.at > since,
    ).length;
  }
  const toMessage = (m: MessageRow): SocialMessage => ({
    id: m.id,
    sender: m.sender,
    text: m.text,
    photo: m.photo_type ? `/api/social/photos/${m.id}` : null,
    at: m.at,
  });
  /** Nom d’une discussion vu par un membre (messages privés : l’autre personne). */
  function threadTitle(t: ThreadRow, me: string) {
    if (t.kind !== "direct") return t.name;
    return members(t)
      .filter((id) => id !== me)
      .map((id) => person(id)?.name ?? "Ancien membre")
      .join(", ");
  }

  // --- Notifications ------------------------------------------------------
  /** Une notification par discussion, mise à jour au dernier message reçu. */
  function notifyThread(t: ThreadRow, sender: string, at: string) {
    const name = person(sender)?.name ?? "Un membre";
    for (const id of members(t)) {
      if (id === sender || blocked(id, sender)) continue;
      hooks.notify(id, {
        id: "social-thread-" + t.id,
        title:
          t.kind === "direct"
            ? "Un message de " + name
            : "Un échange dans " + t.name,
        text: "Retrouvez la conversation dans votre espace Communautés.",
        href: "#communautes/messagerie/" + t.id,
        action: "Ouvrir la discussion",
        date: at,
      });
    }
  }
  function notifyFriendRequest(from: string, to: string, at: string) {
    hooks.notify(to, {
      id: "social-friend-" + from,
      title:
        (person(from)?.name ?? "Un membre") + " souhaite devenir votre ami",
      text: "Consultez les invitations dans Mes amis, depuis la messagerie.",
      href: "#communautes/messagerie",
      action: "Voir la messagerie",
      date: at,
    });
  }

  // --- Écritures de base --------------------------------------------------
  function addThread(
    kind: ThreadKind,
    ref: string,
    name: string,
    owner: string | null,
  ) {
    const id = randomUUID();
    db.prepare(
      "INSERT INTO social_threads(id,kind,ref,name,owner) VALUES (?,?,?,?,?)",
    ).run(id, kind, ref, name, owner);
    return id;
  }
  function addMessage(
    threadId: string,
    sender: string,
    body: string,
    at = iso(),
  ) {
    db.prepare(
      "INSERT INTO social_messages(id,thread,sender,text,at) VALUES (?,?,?,?,?)",
    ).run(randomUUID(), threadId, sender, body, at);
    return at;
  }
  function setRead(threadId: string, me: string, at: string) {
    db.prepare(
      "INSERT INTO social_reads VALUES (?,?,?) ON CONFLICT(thread,person) DO UPDATE SET at=excluded.at",
    ).run(threadId, me, at);
  }
  function deleteThread(id: string) {
    for (const table of [
      "social_messages",
      "social_reads",
      "social_thread_members",
    ])
      db.prepare(`DELETE FROM ${table} WHERE thread=?`).run(id);
    db.prepare("DELETE FROM social_threads WHERE id=?").run(id);
  }

  // --- Exemples (mêmes contenus que la maquette) --------------------------
  function seed() {
    const [a, b, c] = ["demo", "demo-2", "demo-3"];
    const people: [string, string, string, string][] = [
      [a, "test", "Paris", "Nala et Milo"],
      [b, "test2", "Paris", "Oslo"],
      [c, "test3", "Lyon", "Luna"],
      ["claire-demo", "Claire", "Paris", "Rio"],
      ["samir-demo", "Samir", "Lyon", "Plume"],
    ];
    for (const p of people)
      db.prepare("INSERT OR IGNORE INTO social_people VALUES (?,?,?,?)").run(
        ...p,
      );
    const groups: [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string[],
      [string, string, number][],
    ][] = [
      [
        "canal",
        "Les pattes du canal",
        "Paris",
        "Balades",
        "Des promenades tranquilles au bord du canal et des voisins avec qui les partager. Tous les rythmes sont les bienvenus.",
        b,
        "gold",
        [a, b, c, "claire-demo"],
        [
          [
            b,
            "Bienvenue ! Présentez votre compagnon et vos coins de balade préférés.",
            180,
          ],
          [a, "Avec Nala, nous aimons les promenades tôt le matin.", 120],
          [
            c,
            "Luna préfère rester à la maison, mais je vous rejoins dimanche !",
            90,
          ],
        ],
      ],
      [
        "chats",
        "Entre voisins et félins",
        "Paris",
        "Chats",
        "Conseils du quotidien, jeux et entraide pour nos chats. Un endroit pour échanger ses petites découvertes.",
        c,
        "blue",
        [b, c, "claire-demo"],
        [[c, "Quel jeu plaît le plus à votre chat en ce moment ?", 100]],
      ],
      [
        "lyon",
        "Balades à quatre pattes",
        "Lyon",
        "Balades",
        "Retrouvons-nous pour découvrir les chemins autour de Lyon, avec de l’eau, une laisse et de la bonne humeur.",
        "samir-demo",
        "sage",
        [c, "samir-demo"],
        [
          [
            "samir-demo",
            "La prochaine balade se prépare. Des idées de parcours ?",
            60,
          ],
        ],
      ],
    ];
    for (const [
      id,
      name,
      city,
      topic,
      description,
      owner,
      tone,
      list,
      talk,
    ] of groups) {
      const t = addThread("community", id, name, null);
      db.prepare("INSERT INTO social_communities VALUES (?,?,?,?,?,?,?,?)").run(
        id,
        name,
        city,
        topic,
        description,
        owner,
        tone,
        t,
      );
      for (const p of list)
        db.prepare("INSERT INTO social_community_members VALUES (?,?)").run(
          id,
          p,
        );
      for (const [sender, body, n] of talk)
        addMessage(t, sender, body, minutesAgo(n));
    }
    const events: [
      string,
      string,
      string,
      string,
      string,
      number,
      string,
      string,
      string,
      string[],
      [string, string, number][],
    ][] = [
      [
        "balade",
        "Un dimanche au bord du canal",
        "Paris",
        "Entrée du jardin Villemin",
        daysFromNow(3),
        12,
        "Une promenade d’une heure, au rythme des chiens. Prévoyez une laisse et de l’eau.",
        "canal",
        b,
        [a, b, c],
        [
          [
            b,
            "Rendez-vous à l’entrée du jardin. Nous partirons ensemble à 10 h.",
            45,
          ],
        ],
      ],
      [
        "rencontre",
        "Un café entre voisins de chats",
        "Paris",
        "Terrasse du square, sans les animaux",
        daysFromNow(7, 15),
        8,
        "Un moment pour faire connaissance et partager nos astuces du quotidien.",
        "",
        c,
        [b, c],
        [[c, "Nous nous retrouverons sur la terrasse, sans nos chats.", 30]],
      ],
      [
        "ancienne",
        "La balade des quais",
        "Lyon",
        "Parc de la Tête d’Or",
        daysFromNow(-5),
        10,
        "Notre précédente sortie en petit groupe.",
        "lyon",
        "samir-demo",
        [c, "samir-demo"],
        [["samir-demo", "Merci à tous pour cette belle promenade !", 8000]],
      ],
    ];
    for (const [
      id,
      name,
      city,
      place,
      date,
      capacity,
      description,
      group,
      owner,
      list,
      talk,
    ] of events) {
      const t = addThread("event", id, name, null);
      db.prepare(
        "INSERT INTO social_events VALUES (?,?,?,?,?,?,?,?,?,?,0)",
      ).run(
        id,
        name,
        city,
        place,
        date,
        capacity,
        description,
        group,
        owner,
        t,
      );
      for (const p of list)
        db.prepare("INSERT INTO social_event_participants VALUES (?,?)").run(
          id,
          p,
        );
      for (const [sender, body, n] of talk)
        addMessage(t, sender, body, minutesAgo(n));
    }
    const direct = addThread("direct", "", "", a);
    for (const p of [a, b])
      db.prepare("INSERT INTO social_thread_members VALUES (?,?)").run(
        direct,
        p,
      );
    addMessage(
      direct,
      b,
      "Bonjour ! Tu viens avec Nala dimanche ?",
      minutesAgo(30),
    );
    addMessage(
      direct,
      a,
      "Oui, avec plaisir. On se retrouve à l’entrée ?",
      minutesAgo(20),
    );
    const group = addThread("private", "", "Les voisins du dimanche", a);
    for (const p of [a, b, c])
      db.prepare("INSERT INTO social_thread_members VALUES (?,?)").run(
        group,
        p,
      );
    addMessage(
      group,
      b,
      "Ce groupe nous permettra de préparer nos sorties.",
      minutesAgo(60),
    );
    addMessage(
      group,
      a,
      "Bonne idée ! Je prends une gourde pour les chiens.",
      minutesAgo(40),
    );
    setRead(group, c, minutesAgo(35));
    db.prepare("INSERT INTO social_friends VALUES (?,?,?,?)").run(
      b,
      c,
      "accepted",
      minutesAgo(600),
    );
    db.prepare("INSERT INTO social_friends VALUES (?,?,?,?)").run(
      c,
      a,
      "pending",
      minutesAgo(300),
    );
  }

  /** Notifications des exemples, déposées à la création ou à la recréation d’un espace. */
  function seedNotifications(me: string) {
    for (const t of db
      .prepare(
        "SELECT id,kind,ref,name,owner,photo_type,photo_at FROM social_threads",
      )
      .all<ThreadRow>()) {
      if (!unread(t, me)) continue;
      const last = messages(t.id)
        .filter((m) => m.sender !== me)
        .at(-1)!;
      const name = person(last.sender)?.name ?? "Un membre";
      hooks.notify(me, {
        id: "social-thread-" + t.id,
        title:
          t.kind === "direct"
            ? "Un message de " + name
            : "Un échange dans " + t.name,
        text: "Retrouvez la conversation dans votre espace Communautés.",
        href: "#communautes/messagerie/" + t.id,
        action: "Ouvrir la discussion",
        date: last.at,
      });
    }
    for (const f of db
      .prepare(
        "SELECT from_id AS 'from',at FROM social_friends WHERE to_id=? AND status='pending'",
      )
      .all<{ from: string; at: string }>(me))
      notifyFriendRequest(f.from, me, f.at);
  }

  // --- Validation des formulaires -----------------------------------------
  function communityValues(data: Input) {
    const topic = text(data.topic ?? "Autre", "topic", 20);
    need(
      (communityTopics as readonly string[]).includes(topic),
      "Choisissez un thème valide.",
    );
    return {
      name: text(data.name, "name", 90),
      city: text(data.city, "city", 80),
      topic,
      description: text(data.description, "description", 1500),
    };
  }
  function eventValues(data: Input, me: string, current?: SocialEvent) {
    const values = {
      name: text(data.name, "name", 90),
      city: text(data.city, "city", 80),
      place: text(data.place, "place", 150),
      description: text(data.description, "description", 1500),
      community: text(data.community ?? "", "community", 80, false),
    };
    const date = Date.parse(String(data.date));
    if (!Number.isFinite(date) || date <= Date.now())
      throw new ApiError(
        400,
        "Choisissez une date et une heure à venir.",
        "date",
      );
    const capacity = data.capacity;
    const enrolled = current?.participants.length ?? 1;
    if (
      typeof capacity !== "number" ||
      !Number.isInteger(capacity) ||
      capacity < Math.max(1, enrolled) ||
      capacity > 200
    )
      throw new ApiError(
        400,
        "Le nombre de places doit couvrir les participants inscrits (maximum 200).",
        "capacity",
      );
    if (values.community)
      need(
        communityMembers(values.community).includes(me),
        "Rejoignez d’abord cette communauté.",
      );
    return { ...values, date: iso(new Date(date)), capacity };
  }
  function peopleList(value: unknown, me: string) {
    need(
      Array.isArray(value) && value.every((v) => typeof v === "string"),
      "Sélectionnez au moins une personne.",
    );
    const list = [...new Set(value as string[])].filter((id) => id !== me);
    need(list.length, "Sélectionnez au moins une personne.");
    need(
      list.every((id) => person(id) && !blocked(me, id)),
      "Une personne n’est pas disponible pour cette conversation.",
    );
    return list;
  }
  function photoValue(value: unknown) {
    const file = upload(value, "Choisissez une image valide.", "photo");
    const type = text(file.type, "photo", 30);
    need(
      ["image/png", "image/jpeg", "image/webp"].includes(type) &&
        typeof file.content === "string" &&
        isBase64(file.content),
      "Choisissez une image JPG, PNG ou WebP de moins de 1 Mo.",
    );
    const content = Buffer.from(file.content as string, "base64");
    need(
      content.length > 0 && content.length <= MAX_PHOTO,
      "Choisissez une image JPG, PNG ou WebP de moins de 1 Mo.",
    );
    return { content, type };
  }
  const owned = <T extends { owner: string | null }>(
    item: T | undefined,
    me: string,
    missing: string,
    forbidden: string,
  ): T => {
    need(item, missing, 404);
    need(item.owner === me, forbidden, 403);
    return item;
  };

  /** Retire un membre de ses événements à venir liés à une communauté. */
  function leaveCommunityEvents(communityId: string, me: string) {
    for (const e of db
      .prepare(
        "SELECT id,owner FROM social_events WHERE community=? AND cancelled=0 AND date>?",
      )
      .all<{ id: string; owner: string | null }>(communityId, iso())) {
      db.prepare(
        "DELETE FROM social_event_participants WHERE event=? AND person=?",
      ).run(e.id, me);
      if (e.owner === me)
        db.prepare("UPDATE social_events SET cancelled=1 WHERE id=?").run(e.id);
    }
  }
  /** Le plus ancien membre restant reprend la gestion. */
  function nextOwner(list: string[]) {
    return list[0] ?? null;
  }

  return {
    seedNotifications,

    /** Crée ou met à jour la fiche du compte dans les communautés. */
    ensurePerson(id: string, values: Omit<SocialPerson, "id">) {
      db.prepare(
        "INSERT INTO social_people VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,city=excluded.city,animal=excluded.animal",
      ).run(id, values.name, values.city, values.animal);
      // Une seule fois par compte : notifications des échanges d’exemple déjà en cours.
      const key = "notified:" + id;
      if (!db.prepare("SELECT key FROM social_meta WHERE key=?").get(key)) {
        seedNotifications(id);
        db.prepare("INSERT INTO social_meta VALUES (?,'1')").run(key);
      }
    },

    view(me: string): SocialData {
      const communities = db
        // Les nouvelles communautés en tête, puis les exemples dans l’ordre de la maquette.
        .prepare(
          "SELECT * FROM social_communities ORDER BY id IN ('canal','chats','lyon'), CASE WHEN id IN ('canal','chats','lyon') THEN rowid ELSE -rowid END",
        )
        .all<Omit<Community, "members">>()
        .map((g) => ({ ...g, members: communityMembers(g.id) }));
      const events = db
        .prepare("SELECT id FROM social_events ORDER BY rowid DESC")
        .all<{ id: string }>()
        .map(({ id }) => ({ ...event(id)!, participants: participants(id) }));
      const threads: Thread[] = db
        .prepare(
          "SELECT id,kind,ref,name,owner,photo_type,photo_at FROM social_threads ORDER BY rowid",
        )
        .all<ThreadRow>()
        .filter((t) => canRead(t, me))
        .map((t) => {
          const list = members(t);
          const read = reads(t.id);
          const visible = messages(t.id).filter((m) => !blocked(me, m.sender));
          const last = visible.at(-1);
          return {
            id: t.id,
            kind: t.kind,
            ref: t.ref,
            name: threadTitle(t, me),
            photo: t.photo_type
              ? `/api/social/threads/${t.id}/photo?v=${encodeURIComponent(t.photo_at ?? "")}`
              : null,
            owner: t.owner,
            members: list,
            messages: visible.map(toMessage),
            unread: unread(t, me),
            canSend: canSend(t, me),
            latestRead: Boolean(
              last &&
              list.some(
                (id) => id !== last.sender && (read[id] ?? "") >= last.at,
              ),
            ),
          };
        });
      const friends = db
        .prepare(
          "SELECT from_id AS 'from',to_id AS 'to',status,at FROM social_friends WHERE from_id=? OR to_id=? ORDER BY rowid",
        )
        .all<Friendship>(me, me);
      const myBlocks = db
        .prepare("SELECT to_id AS person FROM social_blocks WHERE from_id=?")
        .all<{ person: string }>(me)
        .map((r) => r.person);
      const people = db
        .prepare("SELECT * FROM social_people ORDER BY rowid")
        .all<SocialPerson>();
      return {
        me,
        people,
        communities,
        events,
        threads,
        friends,
        myBlocks,
        blocked: people
          .filter((p) => p.id !== me && blocked(me, p.id))
          .map((p) => p.id),
      };
    },

    saveCommunity(me: string, id: string | null, data: Input) {
      const values = communityValues(data);
      return transaction(db, () => {
        if (id) {
          owned(
            community(id),
            me,
            "Communauté introuvable.",
            "Seul le créateur peut modifier la communauté.",
          );
        } else {
          id = randomUUID();
          const t = addThread("community", id, values.name, null);
          db.prepare(
            "INSERT INTO social_communities VALUES (?,?,?,?,?,?,?,?)",
          ).run(
            id,
            values.name,
            values.city,
            values.topic,
            values.description,
            me,
            "blue",
            t,
          );
          db.prepare("INSERT INTO social_community_members VALUES (?,?)").run(
            id,
            me,
          );
        }
        db.prepare(
          "UPDATE social_communities SET name=?,city=?,topic=?,description=? WHERE id=?",
        ).run(values.name, values.city, values.topic, values.description, id);
        db.prepare(
          "UPDATE social_threads SET name=? WHERE kind='community' AND ref=?",
        ).run(values.name, id);
        return { id };
      });
    },
    deleteCommunity(me: string, id: string) {
      const g = owned(
        community(id),
        me,
        "Communauté introuvable.",
        "Action réservée au créateur.",
      );
      transaction(db, () => {
        deleteThread(g.thread);
        db.prepare(
          "DELETE FROM social_community_members WHERE community=?",
        ).run(id);
        db.prepare("DELETE FROM social_communities WHERE id=?").run(id);
        db.prepare(
          "UPDATE social_events SET cancelled=1 WHERE community=? AND date>?",
        ).run(id, iso());
        db.prepare(
          "UPDATE social_events SET community='' WHERE community=?",
        ).run(id);
      });
    },
    joinCommunity(me: string, id: string, join: boolean) {
      const g = community(id);
      need(g, "Communauté introuvable.", 404);
      transaction(db, () => {
        if (join) {
          db.prepare(
            "INSERT OR IGNORE INTO social_community_members VALUES (?,?)",
          ).run(id, me);
          if (!g.owner)
            db.prepare("UPDATE social_communities SET owner=? WHERE id=?").run(
              me,
              id,
            );
          return;
        }
        need(
          communityMembers(id).includes(me),
          "Vous ne faites pas partie de cette communauté.",
        );
        db.prepare(
          "DELETE FROM social_community_members WHERE community=? AND person=?",
        ).run(id, me);
        if (g.owner === me)
          db.prepare("UPDATE social_communities SET owner=? WHERE id=?").run(
            nextOwner(communityMembers(id)),
            id,
          );
        leaveCommunityEvents(id, me);
      });
    },

    saveEvent(me: string, id: string | null, data: Input) {
      const current = id ? event(id) : undefined;
      if (id) {
        owned(
          current,
          me,
          "Événement introuvable.",
          "Seul l’organisateur peut modifier cet événement.",
        );
        need(!current!.cancelled, "Cet événement est annulé.");
      }
      const values = eventValues(
        data,
        me,
        current && { ...current, participants: participants(current.id) },
      );
      return transaction(db, () => {
        if (!id) {
          id = randomUUID();
          const t = addThread("event", id, values.name, null);
          db.prepare(
            "INSERT INTO social_events VALUES (?,?,?,?,?,?,?,?,?,?,0)",
          ).run(
            id,
            values.name,
            values.city,
            values.place,
            values.date,
            values.capacity,
            values.description,
            values.community,
            me,
            t,
          );
          db.prepare("INSERT INTO social_event_participants VALUES (?,?)").run(
            id,
            me,
          );
        }
        db.prepare(
          "UPDATE social_events SET name=?,city=?,place=?,date=?,capacity=?,description=?,community=? WHERE id=?",
        ).run(
          values.name,
          values.city,
          values.place,
          values.date,
          values.capacity,
          values.description,
          values.community,
          id,
        );
        db.prepare(
          "UPDATE social_threads SET name=? WHERE kind='event' AND ref=?",
        ).run(values.name, id);
        return { id };
      });
    },
    cancelEvent(me: string, id: string) {
      owned(
        event(id),
        me,
        "Événement introuvable.",
        "Action réservée à l’organisateur.",
      );
      db.prepare("UPDATE social_events SET cancelled=1 WHERE id=?").run(id);
    },
    attendEvent(me: string, id: string, join: unknown) {
      need(typeof join === "boolean", "Choisissez de participer ou non.");
      const e = event(id);
      need(
        e && !e.cancelled && Date.parse(e.date) > Date.now(),
        "Les inscriptions à cet événement sont fermées.",
        409,
      );
      const list = participants(id);
      if (join) {
        if (e.community)
          need(
            communityMembers(e.community).includes(me),
            "Rejoignez la communauté pour participer.",
            409,
          );
        if (list.includes(me)) return;
        need(list.length < e.capacity, "Cet événement est complet.", 409);
        db.prepare("INSERT INTO social_event_participants VALUES (?,?)").run(
          id,
          me,
        );
      } else {
        need(
          e.owner !== me,
          "L’organisateur doit annuler l’événement au lieu de se désinscrire.",
          409,
        );
        db.prepare(
          "DELETE FROM social_event_participants WHERE event=? AND person=?",
        ).run(id, me);
      }
    },

    createThread(me: string, data: Input) {
      const list = peopleList(data.people, me);
      const name = data.name === undefined ? "" : text(data.name, "name", 90);
      if (!name) {
        need(
          list.length === 1,
          "Sélectionnez une seule personne pour un message privé.",
        );
        const existing = db
          .prepare(
            "SELECT id,kind,ref,name,owner,photo_type,photo_at FROM social_threads WHERE kind='direct'",
          )
          .all<ThreadRow>()
          .find((t) => {
            const m = members(t);
            return m.length === 2 && m.includes(me) && m.includes(list[0]);
          });
        if (existing) return { id: existing.id };
      } else need(name.length >= 2, "Donnez un nom au groupe.");
      return transaction(db, () => {
        const id = addThread(name ? "private" : "direct", "", name, me);
        for (const p of [me, ...list])
          db.prepare("INSERT INTO social_thread_members VALUES (?,?)").run(
            id,
            p,
          );
        return { id };
      });
    },
    invite(me: string, id: string, people: unknown) {
      const t = thread(id);
      need(
        t?.kind === "private" && canRead(t, me),
        "Groupe inaccessible.",
        404,
      );
      need(t.owner === me, "Seul le créateur peut inviter des membres.", 403);
      for (const p of peopleList(people, me))
        db.prepare(
          "INSERT OR IGNORE INTO social_thread_members VALUES (?,?)",
        ).run(id, p);
    },
    leaveThread(me: string, id: string) {
      const t = thread(id);
      need(
        t?.kind === "private" && members(t).includes(me),
        "Groupe inaccessible.",
        404,
      );
      transaction(db, () => {
        db.prepare(
          "DELETE FROM social_thread_members WHERE thread=? AND person=?",
        ).run(id, me);
        if (t.owner === me)
          db.prepare("UPDATE social_threads SET owner=? WHERE id=?").run(
            nextOwner(members(t)),
            id,
          );
      });
    },
    sendMessage(me: string, id: string, data: Input) {
      const t = thread(id);
      need(
        t && canSend(t, me),
        "Vous ne pouvez pas écrire dans cette discussion.",
        403,
      );
      const body = text(data.text ?? "", "text", 3000, false);
      const photo = data.photo ? photoValue(data.photo) : null;
      need(body || photo, "Écrivez un message ou ajoutez une photo.");
      const last = messages(id).at(-1)?.at ?? "";
      // Toujours après le dernier message pour garder l’ordre de la discussion.
      const at = iso(new Date(Math.max(Date.now(), Date.parse(last) + 1 || 0)));
      transaction(db, () => {
        db.prepare("INSERT INTO social_messages VALUES (?,?,?,?,?,?,?)").run(
          randomUUID(),
          id,
          me,
          body,
          photo?.content ?? null,
          photo?.type ?? null,
          at,
        );
        setRead(id, me, at);
      });
      notifyThread(t, me, at);
    },
    deleteMessage(me: string, threadId: string, messageId: string) {
      const t = thread(threadId);
      need(canRead(t, me), "Discussion inaccessible.", 404);
      const m = messages(threadId).find((x) => x.id === messageId);
      need(
        m?.sender === me,
        "Vous pouvez supprimer uniquement vos messages.",
        403,
      );
      db.prepare("DELETE FROM social_messages WHERE id=?").run(messageId);
    },
    /**
     * Renommer ou changer la photo : membres d’un groupe privé, ou organisateur de la
     * communauté ou de l’événement (le nom de celle-ci change aussi).
     */
    updateThread(me: string, id: string, data: Input) {
      const t = thread(id);
      need(canRead(t, me), "Discussion inaccessible.", 404);
      const manager =
        t.kind === "private" ||
        (t.kind === "community" && community(t.ref)?.owner === me) ||
        (t.kind === "event" && event(t.ref)?.owner === me);
      need(
        manager,
        "Seuls les membres d’un groupe privé ou l’organisateur peuvent modifier cette discussion.",
        403,
      );
      const name =
        data.name === undefined ? undefined : text(data.name, "name", 90);
      if (name !== undefined)
        need(name.length >= 2, "Le nom doit comporter au moins 2 caractères.");
      const photo =
        data.photo === undefined
          ? undefined
          : data.photo === null
            ? null
            : photoValue(data.photo);
      transaction(db, () => {
        if (name !== undefined) {
          db.prepare("UPDATE social_threads SET name=? WHERE id=?").run(
            name,
            id,
          );
          if (t.kind === "community")
            db.prepare("UPDATE social_communities SET name=? WHERE id=?").run(
              name,
              t.ref,
            );
          if (t.kind === "event")
            db.prepare("UPDATE social_events SET name=? WHERE id=?").run(
              name,
              t.ref,
            );
        }
        if (photo !== undefined)
          db.prepare(
            "UPDATE social_threads SET photo=?,photo_type=?,photo_at=? WHERE id=?",
          ).run(photo?.content ?? null, photo?.type ?? null, iso(), id);
      });
    },
    threadPhoto(me: string, id: string) {
      const t = thread(id);
      need(canRead(t, me), "Photo indisponible.", 404);
      const row = db
        .prepare("SELECT photo,photo_type FROM social_threads WHERE id=?")
        .get<{ photo: Uint8Array | null; photo_type: string | null }>(id);
      need(row?.photo && row.photo_type, "Photo indisponible.", 404);
      return { content: row.photo, type: row.photo_type };
    },
    markRead(me: string, id: string) {
      const t = thread(id);
      need(canRead(t, me), "Discussion inaccessible.", 404);
      const last = messages(id).at(-1)?.at ?? "";
      setRead(id, me, last > iso() ? last : iso());
      hooks.markRead(me, "social-thread-" + id);
    },
    photo(me: string, messageId: string) {
      const row = db
        .prepare(
          "SELECT thread,photo,photo_type FROM social_messages WHERE id=?",
        )
        .get<{
          thread: string;
          photo: Uint8Array | null;
          photo_type: string | null;
        }>(messageId);
      need(
        row?.photo && row.photo_type && canRead(thread(row.thread), me),
        "Photo indisponible.",
        404,
      );
      return { content: row.photo, type: row.photo_type };
    },

    friend(me: string, to: string, action: unknown) {
      need(
        me !== to && person(to),
        "Cette personne n’est pas disponible.",
        404,
      );
      need(!blocked(me, to), "L’un des membres a bloqué les échanges.", 409);
      const f = db
        .prepare(
          "SELECT from_id AS 'from',to_id AS 'to',status FROM social_friends WHERE (from_id=? AND to_id=?) OR (from_id=? AND to_id=?)",
        )
        .get<Friendship>(me, to, to, me);
      if (action === "request") {
        need(!f, "Une relation ou une demande existe déjà.", 409);
        const at = iso();
        db.prepare("INSERT INTO social_friends VALUES (?,?,?,?)").run(
          me,
          to,
          "pending",
          at,
        );
        notifyFriendRequest(me, to, at);
      } else if (action === "accept") {
        need(
          f?.to === me && f.status === "pending",
          "Invitation introuvable.",
          404,
        );
        db.prepare(
          "UPDATE social_friends SET status='accepted' WHERE from_id=? AND to_id=?",
        ).run(to, me);
        hooks.markRead(me, "social-friend-" + to);
      } else if (action === "remove") {
        db.prepare(
          "DELETE FROM social_friends WHERE (from_id=? AND to_id=?) OR (from_id=? AND to_id=?)",
        ).run(me, to, to, me);
        hooks.markRead(me, "social-friend-" + to);
      } else throw new ApiError(400, "Action inconnue.");
    },
    block(me: string, to: string, value: unknown) {
      need(typeof value === "boolean", "Statut de blocage invalide.");
      need(
        me !== to && person(to),
        "Cette personne n’est pas disponible.",
        404,
      );
      transaction(db, () => {
        if (!value) {
          db.prepare(
            "DELETE FROM social_blocks WHERE from_id=? AND to_id=?",
          ).run(me, to);
          return;
        }
        db.prepare("INSERT OR IGNORE INTO social_blocks VALUES (?,?)").run(
          me,
          to,
        );
        db.prepare(
          "DELETE FROM social_friends WHERE (from_id=? AND to_id=?) OR (from_id=? AND to_id=?)",
        ).run(me, to, to, me);
      });
    },
    report(me: string, data: Input) {
      need(
        data.type === "person" || data.type === "message",
        "Signalement invalide.",
      );
      const reason = text(data.reason, "reason", 60);
      need(
        (reportReasons as readonly string[]).includes(reason),
        "Choisissez un motif.",
      );
      const target = text(data.target, "target", 120);
      need(
        data.type === "person"
          ? person(target)
          : db.prepare("SELECT id FROM social_messages WHERE id=?").get(target),
        "Élément introuvable.",
        404,
      );
      db.prepare("INSERT INTO social_reports VALUES (?,?,?,?,?,?)").run(
        randomUUID(),
        me,
        data.type,
        target,
        reason,
        iso(),
      );
    },

    /** Données du compte pour l’export : adhésions, participations, relations et messages envoyés. */
    exportFor(me: string) {
      const data = this.view(me);
      return {
        communities: data.communities
          .filter((g) => g.members.includes(me))
          .map((g) => ({
            id: g.id,
            name: g.name,
            city: g.city,
            owner: g.owner === me,
          })),
        events: data.events
          .filter((e) => e.participants.includes(me))
          .map((e) => ({
            id: e.id,
            name: e.name,
            date: e.date,
            cancelled: e.cancelled,
          })),
        friends: data.friends,
        messages: data.threads.flatMap((t) =>
          t.messages
            .filter((m) => m.sender === me)
            .map((m) => ({
              threadId: t.id,
              id: m.id,
              text: m.text,
              at: m.at,
              hasPhoto: Boolean(m.photo),
            })),
        ),
      };
    },

    /** Retire un compte supprimé : fiche, relations, adhésions, participations et messages. */
    removePerson(id: string) {
      transaction(db, () => {
        db.prepare("DELETE FROM social_people WHERE id=?").run(id);
        db.prepare("DELETE FROM social_friends WHERE from_id=? OR to_id=?").run(
          id,
          id,
        );
        db.prepare("DELETE FROM social_blocks WHERE from_id=? OR to_id=?").run(
          id,
          id,
        );
        db.prepare(
          "DELETE FROM social_reports WHERE from_id=? OR target=?",
        ).run(id, id);
        db.prepare("DELETE FROM social_community_members WHERE person=?").run(
          id,
        );
        for (const g of db
          .prepare("SELECT id FROM social_communities WHERE owner=?")
          .all<{ id: string }>(id))
          db.prepare("UPDATE social_communities SET owner=? WHERE id=?").run(
            nextOwner(communityMembers(g.id)),
            g.id,
          );
        db.prepare("DELETE FROM social_event_participants WHERE person=?").run(
          id,
        );
        for (const e of db
          .prepare("SELECT id FROM social_events WHERE owner=?")
          .all<{ id: string }>(id))
          db.prepare(
            "UPDATE social_events SET owner=?,cancelled=1 WHERE id=?",
          ).run(nextOwner(participants(e.id)), e.id);
        db.prepare("DELETE FROM social_thread_members WHERE person=?").run(id);
        for (const t of db
          .prepare(
            "SELECT id,kind,ref,name,owner,photo_type,photo_at FROM social_threads WHERE owner=?",
          )
          .all<ThreadRow>(id))
          db.prepare("UPDATE social_threads SET owner=? WHERE id=?").run(
            nextOwner(members(t)),
            t.id,
          );
        db.prepare("DELETE FROM social_messages WHERE sender=?").run(id);
        db.prepare("DELETE FROM social_reads WHERE person=?").run(id);
      });
    },
  };
}
export type SocialService = ReturnType<typeof socialService>;
