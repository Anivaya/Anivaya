-- Base centrale uniquement : appliquée après la création des comptes.
CREATE TABLE IF NOT EXISTS admin_members (
 account TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
 role TEXT NOT NULL CHECK(role IN ('Administrateur','Modérateur','Support','Vétérinaire référent')),
 status TEXT NOT NULL DEFAULT 'Actif' CHECK(status IN ('Actif','Suspendu')),
 version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS account_controls (
 account TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
 status TEXT NOT NULL DEFAULT 'Actif' CHECK(status IN ('Actif','Suspendu')),
 version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS admin_records (
 id TEXT PRIMARY KEY, resource TEXT NOT NULL,
 name TEXT NOT NULL, status TEXT NOT NULL,
 data TEXT NOT NULL CHECK(json_valid(data)), version INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_records_resource_status ON admin_records(resource,status,updated_at);
CREATE TABLE IF NOT EXISTS admin_audit (
 id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL,
 resource TEXT NOT NULL, target TEXT NOT NULL, note TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS admin_alert_reads (
 account TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 alert TEXT NOT NULL, PRIMARY KEY(account,alert)
);
CREATE TABLE IF NOT EXISTS admin_metadata (key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS account_mfa (
 account TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
 secret TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 0,
 expires INTEGER NOT NULL, last_step INTEGER NOT NULL DEFAULT -1,
 recovery TEXT NOT NULL DEFAULT '[]'
);
