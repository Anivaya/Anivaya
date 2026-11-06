-- Base centrale uniquement ; aucune liste publique des demandes.
CREATE TABLE IF NOT EXISTS public_leads (
  id TEXT PRIMARY KEY, request_id TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK(kind IN ('liste-attente','pro','clinique','entreprise')),
  email TEXT NOT NULL COLLATE NOCASE, data TEXT NOT NULL CHECK(json_valid(data)),
  consent_version TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS public_leads_email_kind ON public_leads(email,kind);
