import type { Database } from "../database/types.ts";
import type { Account, Authentication } from "./auth.ts";
import type { SocialService } from "./social.ts";
import type { AdminRecord } from "../../shared/admin.ts";
import { transaction } from "../database/connection.ts";

/** Sandbox remplie : deux connexions de test et trois foyers ; les deux comptes vides restent séparés. */
export const compactDemoIds = ["demo", "demo-admin", "sample-01", "sample-02", "sample-06"] as const;
export const compactDemoAllows = (db: Database, id: string) =>
  db.previewDemo !== "sample" || (compactDemoIds as readonly string[]).includes(id);
export const compactDemoRecordAllows = (db: Database, data: Partial<AdminRecord>) =>
  (!data.account || compactDemoAllows(db, data.account)) &&
  (data.targetType !== "users" || !data.target || compactDemoAllows(db, data.target));

function retiredAccount(account: Account) {
  return (account.id === "demo-2" && account.email === "test2@gmail.com") ||
    (account.id === "demo-3" && account.email === "test3@gmail.com") ||
    (/^sample-(?:0[1-9]|1[0-9]|2[0-4])$/.test(account.id) && account.email.endsWith("@foyers.example"));
}

/** Migration limitée à la sandbox remplie ; aucune inscription réelle n'est sélectionnée. */
export function pruneCompactDemo(db: Database, auth: Authentication, social: SocialService) {
  if (db.previewDemo !== "sample") return;
  const retired = auth.accounts().filter(a => !compactDemoAllows(db, a.id) && retiredAccount(a));
  for (const account of retired) {
    // La suppression du compte reste idempotente : les dossiers liés sont retirés d'abord.
    social.removePerson(account.id);
    transaction(db, () => {
      const records = db.prepare("SELECT id,data FROM admin_records").all<{ id: string; data: string }>();
      const ids = new Set<string>([account.id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const record of records) {
          if (ids.has(record.id)) continue;
          const data = JSON.parse(record.data) as Partial<AdminRecord>;
          if (data.account === account.id || (data.target && ids.has(data.target))) {
            ids.add(record.id); changed = true;
          }
        }
      }
      for (const id of ids) {
        db.prepare("DELETE FROM admin_records WHERE id=?").run(id);
        db.prepare("DELETE FROM admin_audit WHERE target=?").run(id);
      }
      db.prepare("DELETE FROM admin_invitations WHERE email=?").run(account.email);
      db.prepare("DELETE FROM admin_members WHERE account=?").run(account.id);
    });
    auth.deleteAccountById(account.id);
  }
  // Anciens personnages sociaux sans compte : les nouveaux exemples utilisent les foyers conservés.
  for (const id of ["claire-demo", "samir-demo"]) {
    if (db.prepare("SELECT id FROM social_people WHERE id=?").get(id)) social.removePerson(id);
  }
}
