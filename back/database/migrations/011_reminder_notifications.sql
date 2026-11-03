-- Date d’envoi du rappel par e-mail et notification : un rappel n’est signalé qu’une fois,
-- et de nouveau si sa date ou son délai de prévenance change.
ALTER TABLE reminders ADD COLUMN notified_at TEXT;
