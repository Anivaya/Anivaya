import { randomUUID } from "node:crypto";
import type { Database } from "../database/types.ts";
import type { ReceivedShare, ReceivedShareState } from "../../shared/models.ts";
import type { Account, Authentication } from "./auth.ts";
import { profileRepository } from "./profile.ts";
import { ApiError, localToday } from "./validation.ts";
import { appUrl, sendMail } from "./mail.ts";

interface InvitationRow {
  id: string;
  owner: string;
  share: string;
  doc: string;
  email: string;
  title: string;
  animal_name: string;
  sender: string;
  sender_email: string;
  until: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  responded_at: string | null;
}

/**
 * Partage réel entre comptes : chaque document partagé à une adresse e-mail devient une
 * invitation de la base centrale. La personne la retrouve dans « Partage avec moi » dès
 * qu’elle se connecte avec cette adresse, même si elle crée son compte plus tard. L’état
 * (retiré, expiré) se lit en direct dans l’espace du propriétaire, qui reste maître du partage.
 */
export function sharedAccess(db: Database, auth: Authentication) {
  db.exec(`CREATE TABLE IF NOT EXISTS share_invitations(
 id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 share TEXT NOT NULL, doc TEXT NOT NULL, email TEXT NOT NULL,
 title TEXT NOT NULL, animal_name TEXT NOT NULL, sender TEXT NOT NULL, sender_email TEXT NOT NULL,
 until TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined')),
 created_at TEXT NOT NULL, responded_at TEXT);
 CREATE INDEX IF NOT EXISTS share_invitations_email ON share_invitations(email);`);

  const ownerOf = (row: InvitationRow) =>
    db.prepare("SELECT * FROM accounts WHERE id=?").get<Account>(row.owner);
  /** Le partage côté propriétaire : retiré, document supprimé ou toujours actif. */
  function ownerShare(row: InvitationRow) {
    const owner = ownerOf(row);
    if (!owner) return null;
    return auth
      .workspace(owner)
      .prepare(
        "SELECT s.revoked,s.until,d.name,d.type,d.content,d.category FROM document_shares s JOIN documents d ON d.id=s.doc JOIN animals a ON a.id=d.animal WHERE s.id=? AND d.deleted_at IS NULL AND a.deleted_at IS NULL",
      )
      .get<{
        revoked: number;
        until: string;
        name: string;
        type: string | null;
        content: Uint8Array | null;
        category: string;
      }>(row.share);
  }
  function stateOf(row: InvitationRow): ReceivedShareState {
    const share = ownerShare(row);
    if (!share || share.revoked) return "revoked";
    if (row.status === "declined") return "declined";
    if (share.until < localToday()) return "expired";
    return row.status;
  }
  const rowsFor = (account: Account) =>
    db
      .prepare(
        "SELECT * FROM share_invitations WHERE email=? ORDER BY created_at DESC",
      )
      .all<InvitationRow>(account.email.toLowerCase());
  function toShare(row: InvitationRow): ReceivedShare {
    const state = stateOf(row);
    const share = state === "accepted" ? ownerShare(row) : null;
    return {
      id: row.id,
      title: row.title,
      kind: "document",
      animalName: row.animal_name,
      sender: row.sender,
      email: row.sender_email,
      permission: "Lecture seule",
      until: row.until,
      createdAt: row.created_at,
      respondedAt: row.responded_at,
      state,
      content: share
        ? {
            document: share.name,
            description: `${share.category} · ${row.animal_name}`,
            entries: [],
            file: share.content
              ? `/api/received-shares/${row.id}/file`
              : undefined,
          }
        : null,
    };
  }
  function own(account: Account, id: string) {
    const row = rowsFor(account).find((r) => r.id === id);
    if (!row) throw new ApiError(404, "Invitation introuvable.");
    return row;
  }

  return {
    /** Invitations reçues par le compte connecté, avec leur état réel. */
    forRecipient: (account: Account) => rowsFor(account).map(toShare),
    has: (account: Account, id: string) =>
      rowsFor(account).some((r) => r.id === id),
    /** Après un partage : invitation centrale, notification et e-mail au destinataire. */
    publish(
      owner: Account,
      shares: { id: string; doc: string; email: string; until: string }[],
    ) {
      const ws = auth.workspace(owner);
      const sender = profileRepository(ws).get();
      for (const share of shares) {
        const doc = ws
          .prepare(
            "SELECT d.name,a.name AS animal FROM documents d JOIN animals a ON a.id=d.animal WHERE d.id=?",
          )
          .get<{ name: string; animal: string }>(share.doc);
        if (!doc) continue;
        const email = share.email.toLowerCase();
        const id = randomUUID();
        db.prepare(
          "INSERT INTO share_invitations(id,owner,share,doc,email,title,animal_name,sender,sender_email,until,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        ).run(
          id,
          owner.id,
          share.id,
          share.doc,
          email,
          doc.name,
          doc.animal,
          sender.name || owner.email,
          owner.email,
          share.until,
          new Date().toISOString(),
        );
        const until = new Date(`${share.until}T12:00`).toLocaleDateString(
          "fr-FR",
          { day: "numeric", month: "long", year: "numeric" },
        );
        const recipient = db
          .prepare("SELECT id FROM accounts WHERE email=?")
          .get<{ id: string }>(email);
        if (recipient)
          auth.notify(
            recipient.id,
            {
              id: `share-${id}`,
              title: `${sender.name || owner.email} vous partage « ${doc.name} »`,
              text: `Document de ${doc.animal}, en lecture seule jusqu’au ${until}.`,
              href: "#partage/recus",
              action: "Voir l’invitation",
              date: new Date().toISOString(),
            },
            "shares",
          );
        void sendMail({
          to: email,
          subject: `${sender.name || owner.email} vous partage un document sur Anivaya`,
          text: `Bonjour,\n\n${sender.name || owner.email} (${owner.email}) vous partage « ${doc.name} », un document de ${doc.animal}, en lecture seule jusqu’au ${until}.\n\n${recipient ? "Connectez-vous à Anivaya pour accepter l’invitation." : "Créez votre compte Anivaya avec cette adresse e-mail pour accepter l’invitation."}`,
          action: {
            label: recipient ? "Voir l’invitation" : "Créer mon compte",
            url: `${appUrl()}/#${recipient ? "partage/recus" : "inscription"}`,
          },
        });
      }
    },
    respond(account: Account, id: string, response: unknown) {
      if (response !== "accepted" && response !== "declined")
        throw new ApiError(
          400,
          "Choisissez d’accepter ou de refuser.",
          "status",
        );
      const row = own(account, id);
      if (stateOf(row) !== "pending")
        throw new ApiError(409, "Cette invitation n’attend plus de réponse.");
      db.prepare(
        "UPDATE share_invitations SET status=?,responded_at=? WHERE id=?",
      ).run(response, new Date().toISOString(), id);
      return toShare({ ...row, status: response });
    },
    /** Le fichier partagé, lu dans l’espace du propriétaire tant que l’accès est actif. */
    file(account: Account, id: string) {
      const row = own(account, id);
      if (stateOf(row) !== "accepted")
        throw new ApiError(403, "Cet accès n’est plus actif.");
      const share = ownerShare(row);
      if (!share?.content || !share.type)
        throw new ApiError(404, "Ce document ne contient pas de fichier.");
      return { type: share.type, content: share.content, name: share.name };
    },
  };
}
export type SharedAccess = ReturnType<typeof sharedAccess>;
