import type { Database } from "../database/types.ts";
import type { ReceivedShare, ReceivedShareState } from "../../shared/models.ts";
import { ApiError, localToday } from "./validation.ts";

interface ReceivedRow {
  id: string;
  title: string;
  kind: ReceivedShare["kind"];
  animal_name: string;
  sender: string;
  email: string;
  permission: string;
  status: "pending" | "accepted" | "declined" | "revoked";
  until: string;
  content: string | null;
  created_at: string;
  responded_at: string | null;
}

/** Une invitation acceptée expire à sa date de fin ; refus et retrait restent définitifs. */
function stateOf(row: ReceivedRow): ReceivedShareState {
  if (row.status === "revoked" || row.status === "declined") return row.status;
  if (row.until < localToday()) return "expired";
  return row.status;
}

/** Partages que d’autres propriétaires confient à ce compte (« Partage avec moi »). */
export function receivedSharesRepository(db: Database) {
  const rows = () =>
    db
      .prepare("SELECT * FROM received_shares ORDER BY created_at DESC")
      .all<ReceivedRow>();
  const toShare = (row: ReceivedRow): ReceivedShare => {
    const state = stateOf(row);
    return {
      id: row.id,
      title: row.title,
      kind: row.kind,
      animalName: row.animal_name,
      sender: row.sender,
      email: row.email,
      permission: row.permission,
      until: row.until,
      createdAt: row.created_at,
      respondedAt: row.responded_at,
      state,
      content:
        state === "accepted" && row.content ? JSON.parse(row.content) : null,
    };
  };
  const all = () => rows().map(toShare);
  return {
    all,
    respond(id: string, response: unknown) {
      if (response !== "accepted" && response !== "declined")
        throw new ApiError(
          400,
          "Choisissez d’accepter ou de refuser.",
          "status",
        );
      const row = rows().find((r) => r.id === id);
      if (!row) throw new ApiError(404, "Invitation introuvable.");
      if (stateOf(row) !== "pending")
        throw new ApiError(409, "Cette invitation n’attend plus de réponse.");
      db.prepare(
        "UPDATE received_shares SET status=?,responded_at=? WHERE id=?",
      ).run(response, new Date().toISOString(), id);
      return all().find((share) => share.id === id)!;
    },
  };
}
