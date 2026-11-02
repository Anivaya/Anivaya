import { openDatabase } from "../back/database/connection.ts";
import { authentication } from "../back/api/auth.ts";
import { adminRoles } from "../shared/admin.ts";
import { randomUUID } from "node:crypto";

// Provisionnement explicite depuis le serveur ; aucune route publique ne peut attribuer un rôle.
const [email, role = "Administrateur"] = process.argv.slice(2);
if (!email || !(adminRoles as readonly string[]).includes(role))
  throw new Error(
    'Usage : npm run admin:grant -- adresse@example.fr "Administrateur"',
  );
const db = openDatabase(),
  auth = authentication(db);
try {
  await auth.ready;
  const account = db
    .prepare("SELECT id FROM accounts WHERE email=?")
    .get<{ id: string }>(email.trim().toLowerCase());
  if (!account) throw new Error("Créez d’abord le compte dans l’application.");
  if (account.id === "demo-admin" && process.env.NODE_ENV === "production")
    throw new Error("Utilisez un compte personnel en production.");
  db.prepare(
    "INSERT INTO admin_members(account,role) VALUES (?,?) ON CONFLICT(account) DO UPDATE SET role=excluded.role,status='Actif',version=admin_members.version+1",
  ).run(account.id, role);
  db.prepare("INSERT INTO admin_audit VALUES (?,?,?,?,?,?,?)").run(
    randomUUID(),
    "Provisionnement serveur",
    "Accès équipe attribué",
    "team",
    account.id,
    role,
    new Date().toISOString(),
  );
  console.log(`Accès ${role} attribué au compte demandé.`);
} finally {
  auth.close();
  db.close();
}
