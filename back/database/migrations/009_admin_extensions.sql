-- Base centrale uniquement : invitations de l’équipe et justificatifs reçus.
CREATE TABLE IF NOT EXISTS admin_invitations (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE,
 role TEXT NOT NULL CHECK(role IN ('Administrateur','Modérateur','Support','Vétérinaire référent')),
 invited_by TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS admin_files (
 id TEXT PRIMARY KEY, record TEXT NOT NULL, document TEXT NOT NULL,
 name TEXT NOT NULL, type TEXT NOT NULL, content BLOB NOT NULL, created_at TEXT NOT NULL,
 UNIQUE(record,document)
);
