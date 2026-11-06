-- Consentement courant distinct de la demande d’origine, conservée pour le suivi.
CREATE TABLE IF NOT EXISTS public_waitlist_subscriptions (
  email TEXT PRIMARY KEY COLLATE NOCASE,
  subscribed_at TEXT NOT NULL,
  withdrawn_at TEXT
);
CREATE TABLE IF NOT EXISTS public_unsubscribe_tokens (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE REFERENCES public_waitlist_subscriptions(email),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS public_unsubscribe_email ON public_unsubscribe_tokens(email);
