-- Ajoute la catégorie « social » (communautés) : SQLite impose de recréer la table.
CREATE TABLE notifications_next (
 id TEXT PRIMARY KEY,
 category TEXT NOT NULL CHECK(category IN ('reminders','reservations','shares','documents','account','social')),
 title TEXT NOT NULL, text TEXT NOT NULL, href TEXT NOT NULL, action TEXT NOT NULL,
 created_at TEXT NOT NULL, read INTEGER NOT NULL DEFAULT 0
);
INSERT INTO notifications_next(id,category,title,text,href,action,created_at,read)
 SELECT id,category,title,text,href,action,created_at,read FROM notifications;
DROP TABLE notifications;
ALTER TABLE notifications_next RENAME TO notifications;
